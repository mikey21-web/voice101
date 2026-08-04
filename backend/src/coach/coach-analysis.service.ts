import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface CoachAnalysis {
  score: number | null;
  missedQuestions: string[];
  objections: string[];
  buyingSignals: string[];
  recommendedAction: string | null;
  whatToSend: string | null;
  dealProbability: number | null;
  /** 'llm' when a model read the call, 'rules' when it fell back. */
  method: 'llm' | 'rules' | 'none';
}

/** The four things a real estate call has to establish. Everything else can wait. */
const CORE_QUESTIONS = [
  { key: 'budget', label: 'budget', probe: /\b(budget|price range|afford|lakh|crore|how much)\b/i },
  { key: 'location', label: 'preferred location', probe: /\b(location|area|where|locality|near)\b/i },
  { key: 'timeline', label: 'timeline', probe: /\b(when|timeline|how soon|month|possession|ready)\b/i },
  { key: 'finance', label: 'loan or cash', probe: /\b(loan|cash|finance|emi|bank|mortgage)\b/i },
];

const OBJECTION_PATTERNS: Array<[string, RegExp]> = [
  ['price too high', /\b(too expensive|too high|costly|out of budget|cheaper)\b/i],
  ['location concern', /\b(too far|far from|traffic|commute|connectivity)\b/i],
  ['possession delay', /\b(delay|late possession|not ready|under construction)\b/i],
  ['comparing competitors', /\b(other builder|another project|comparing|also looking at)\b/i],
  ['needs family approval', /\b(ask my (wife|husband|family)|discuss with)\b/i],
  ['loan uncertainty', /\b(loan (not|might not)|eligibility|cibil|sanction)\b/i],
];

const BUYING_SIGNAL_PATTERNS: Array<[string, RegExp]> = [
  ['asked to visit', /\b(site visit|come and see|visit the|show me the)\b/i],
  ['asked about payment plan', /\b(payment plan|instalment|emi|down payment|booking amount)\b/i],
  ['asked about availability', /\b(available|still there|any left|which floor)\b/i],
  ['gave a timeline', /\b(this month|next month|within \d+|by \w+ (month|year))\b/i],
  ['discussed paperwork', /\b(agreement|registration|documents|kyc|pan)\b/i],
];

/**
 * The rubric the model scores against. Written as instructions to a sales
 * manager rather than a prompt, because that is the judgement being copied.
 */
const RUBRIC = `You are the best sales manager at an Indian real estate developer, reviewing one call by one of your salespeople. You are coaching them, not grading them.

Score out of 100 on these weights:
- 40  Did they establish the four things that decide a deal: budget, preferred location, timeline, and loan or cash? Credit them if the buyer volunteered it. Do not credit a question that was asked but never answered.
- 25  Did they listen? Follow-up questions on what the buyer actually said beat running a script.
- 20  Did they handle objections without discounting? Steering to payment plans, EMI, or value is good. Offering to cut the price is bad.
- 15  Did they close for a next step? A booked site visit or a specific callback time. "I'll send details" is not a next step.

Rules:
- Be specific. "You never asked about the loan" is useful. "Improve discovery" is not.
- Never recommend a discount. Recommend the payment plan instead.
- If the buyer showed a buying signal and the rep did not act on it, say so plainly. That is the most expensive mistake on a call.
- A short call is not automatically a bad call. A wrong number handled politely in 20 seconds is fine.
- Write to the rep as "you", in plain English. No jargon, no em dashes.

Return ONLY JSON, no markdown fence:
{
  "score": 0-100,
  "missedQuestions": ["budget"],
  "objections": ["price too high"],
  "buyingSignals": ["asked to visit"],
  "recommendedAction": "one sentence, the single next thing to do",
  "whatToSend": "one thing to send this buyer, or null",
  "dealProbability": 0.0-1.0
}`;

/**
 * Scores one call.
 *
 * An LLM reads the transcript against the rubric above, because a keyword
 * check cannot tell the difference between a rep who asked about budget and a
 * rep who was told the budget. When the model is unavailable or returns
 * nonsense it falls back to keyword rules, so the coach never goes silent:
 * reps only learn from feedback that arrives every time.
 */
@Injectable()
export class CoachAnalysisService {
  private readonly logger = new Logger(CoachAnalysisService.name);
  private llm: OpenAI | null = null;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY');
    const baseURL = this.config.get<string>('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com/v1';
    if (apiKey) this.llm = new OpenAI({ apiKey, baseURL });
  }

  async analyze(input: {
    transcript?: string | null;
    summary?: string | null;
    durationSec?: number | null;
  }): Promise<CoachAnalysis> {
    const text = `${input.transcript || ''}\n${input.summary || ''}`.trim();

    if (!text) {
      // No transcript is not a bad call, it is an unknown one. Scoring it 0
      // would punish a rep for a recording that failed to upload.
      return {
        score: null, missedQuestions: [], objections: [], buyingSignals: [],
        recommendedAction: 'No transcript available for this call. Add your own notes.',
        whatToSend: null, dealProbability: null, method: 'none',
      };
    }

    if (this.llm) {
      try {
        const scored = await this.analyzeWithLlm(text, input.durationSec ?? null);
        if (scored) return scored;
      } catch (err: any) {
        this.logger.warn(`Coach LLM failed, falling back to rules: ${err.message}`);
      }
    }

    return this.analyzeWithRules(text, input.durationSec ?? null);
  }

  private async analyzeWithLlm(text: string, durationSec: number | null): Promise<CoachAnalysis | null> {
    const res = await this.llm!.chat.completions.create({
      model: this.config.get<string>('AGENT_MODEL') || 'deepseek-v4-flash',
      temperature: 0.2, // coaching should be consistent call to call, not creative
      messages: [
        { role: 'system', content: RUBRIC },
        {
          role: 'user',
          content: `Call duration: ${durationSec ?? 'unknown'} seconds.\n\nTranscript:\n${text.slice(0, 12000)}`,
        },
      ],
    });

    const raw = res.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = this.parseJson(raw);
    if (!parsed) {
      this.logger.warn('Coach LLM returned unparseable output');
      return null;
    }

    return {
      // Clamp everything. A model that returns 150 or -3 must not reach a rep.
      score: this.clampInt(parsed.score, 0, 100),
      missedQuestions: this.strings(parsed.missedQuestions),
      objections: this.strings(parsed.objections),
      buyingSignals: this.strings(parsed.buyingSignals),
      recommendedAction: this.text(parsed.recommendedAction),
      whatToSend: this.text(parsed.whatToSend),
      dealProbability: this.clampFloat(parsed.dealProbability, 0, 1),
      method: 'llm',
    };
  }

  /**
   * Keyword fallback. Coarser than the model but it always answers, which is
   * what keeps the coach trusted on a day the LLM provider is down.
   */
  private analyzeWithRules(text: string, durationSec: number | null): CoachAnalysis {
    const missedQuestions = CORE_QUESTIONS.filter((q) => !q.probe.test(text)).map((q) => q.label);
    const objections = OBJECTION_PATTERNS.filter(([, re]) => re.test(text)).map(([l]) => l);
    const buyingSignals = BUYING_SIGNAL_PATTERNS.filter(([, re]) => re.test(text)).map(([l]) => l);

    const asked = CORE_QUESTIONS.length - missedQuestions.length;
    let score = Math.round((asked / CORE_QUESTIONS.length) * 70);
    score += Math.min(20, buyingSignals.length * 7);
    if ((durationSec ?? 0) >= 60) score += 10;
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      missedQuestions,
      objections,
      buyingSignals,
      recommendedAction: this.nextAction(missedQuestions, objections, buyingSignals),
      whatToSend: this.whatToSend(buyingSignals, objections),
      dealProbability: Math.max(
        0,
        Math.min(1, +(0.1 + buyingSignals.length * 0.15 - objections.length * 0.08).toFixed(2)),
      ),
      method: 'rules',
    };
  }

  /** Models like to wrap JSON in a markdown fence however firmly you ask them not to. */
  private parseJson(raw: string): any | null {
    const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try { return JSON.parse(match[0]); } catch { return null; }
    }
  }

  private clampInt(v: unknown, min: number, max: number): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : null;
  }

  private clampFloat(v: unknown, min: number, max: number): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? +Math.max(min, Math.min(max, n)).toFixed(2) : null;
  }

  private strings(v: unknown): string[] {
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 8) : [];
  }

  private text(v: unknown): string | null {
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  }

  private nextAction(missed: string[], objections: string[], signals: string[]): string {
    if (signals.includes('asked to visit')) return 'Lock the site visit date before they cool off.';
    if (objections.includes('price too high')) return 'Send the payment plan and EMI breakdown, not a discount.';
    if (objections.includes('needs family approval')) return 'Offer a visit slot that suits the whole family.';
    if (missed.length >= 3) return `Call back and cover the basics you missed: ${missed.join(', ')}.`;
    if (missed.length > 0) return `One gap to close on the next call: ${missed.join(', ')}.`;
    return 'Follow up with matching units while the conversation is warm.';
  }

  private whatToSend(signals: string[], objections: string[]): string | null {
    if (signals.includes('asked about payment plan') || objections.includes('price too high')) {
      return 'Payment plan and EMI calculator';
    }
    if (signals.includes('asked about availability')) return 'Live availability for the units discussed';
    if (signals.includes('asked to visit')) return 'Location pin and site visit confirmation';
    if (objections.includes('possession delay')) return 'Construction progress photos and the possession timeline';
    return null;
  }
}
