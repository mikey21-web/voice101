import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CoachAnalysis {
  score: number | null;
  missedQuestions: string[];
  objections: string[];
  buyingSignals: string[];
  recommendedAction: string | null;
  whatToSend: string | null;
  dealProbability: number | null;
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
 * Scores one call. Deliberately rule-based rather than an LLM call.
 *
 * A coach that goes quiet when an API key is missing or a provider rate-limits
 * is a coach nobody trusts, and reps only learn from feedback that arrives
 * every time. The rules cover the four questions that decide a real estate
 * call; an LLM pass can be layered on later for tone and phrasing.
 *
 * ponytail: keyword rules, swap in an LLM pass if the misses get expensive.
 */
@Injectable()
export class CoachAnalysisService {
  private readonly logger = new Logger(CoachAnalysisService.name);

  constructor(private config: ConfigService) {}

  analyze(input: { transcript?: string | null; summary?: string | null; durationSec?: number | null }): CoachAnalysis {
    const text = `${input.transcript || ''}\n${input.summary || ''}`.trim();

    if (!text) {
      // No transcript is not a bad call, it is an unknown one. Scoring it 0
      // would punish a rep for a recording that failed to upload.
      return {
        score: null, missedQuestions: [], objections: [], buyingSignals: [],
        recommendedAction: 'No transcript available for this call. Add your own notes.',
        whatToSend: null, dealProbability: null,
      };
    }

    const missedQuestions = CORE_QUESTIONS
      .filter((q) => !q.probe.test(text))
      .map((q) => q.label);

    const objections = OBJECTION_PATTERNS
      .filter(([, re]) => re.test(text))
      .map(([label]) => label);

    const buyingSignals = BUYING_SIGNAL_PATTERNS
      .filter(([, re]) => re.test(text))
      .map(([label]) => label);

    const asked = CORE_QUESTIONS.length - missedQuestions.length;
    // Coverage of the four questions is most of the score; engagement and a
    // call long enough to have been a conversation make up the rest.
    let score = Math.round((asked / CORE_QUESTIONS.length) * 70);
    score += Math.min(20, buyingSignals.length * 7);
    if ((input.durationSec ?? 0) >= 60) score += 10;
    score = Math.max(0, Math.min(100, score));

    const dealProbability = Math.max(
      0,
      Math.min(1, +(0.1 + buyingSignals.length * 0.15 - objections.length * 0.08).toFixed(2)),
    );

    return {
      score,
      missedQuestions,
      objections,
      buyingSignals,
      recommendedAction: this.nextAction(missedQuestions, objections, buyingSignals),
      whatToSend: this.whatToSend(buyingSignals, objections),
      dealProbability,
    };
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
