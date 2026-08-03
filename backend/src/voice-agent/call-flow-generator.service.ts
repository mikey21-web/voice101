import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SectionInput } from './voice-employee.service';

/** One qualifying question the agent asks mid-call, with what it should capture while asking it. */
export interface GeneratedStep {
  key: string;
  label: string;
  prompt: string;
  extract: Array<{ name: string; type: 'string' | 'number' | 'boolean'; prompt: string }>;
}

/** One way the call can end, and the free-text condition (Dograh's own edge-condition style,
 * e.g. "timeline is 'immediate' and wants_site_visit is true") that routes to it from the last
 * qualifying step. */
export interface GeneratedOutcome {
  key: string;
  label: string;
  condition: string;
  closingPrompt: string;
}

export interface GeneratedFlowDraft {
  name: string;
  role: string;
  persona: string;
  greeting: string;
  steps: GeneratedStep[];
  outcomes: GeneratedOutcome[];
}

/** Section key → spoken language name, matching Dograh's per-language workflows. */
const LANGUAGE_NAMES: Record<string, string> = {
  te: 'Telugu',
  en: 'English',
  hi: 'Hindi',
};

const SYSTEM_PROMPT = (languageName: string) => `You design phone-call flows for an AI voice sales/qualification agent. The
user describes what a call should accomplish in plain language, and may provide business facts
the agent must know. Output ONLY a JSON object with this exact shape, no markdown, no explanation:

{
  "name": "short_snake_case_id",
  "role": "Human-readable role, e.g. 'Senior Real Estate Sales Executive'",
  "persona": "2-4 sentences: who the agent is, what business/product this is for, overall tone.",
  "greeting": "The opening line the agent says when the call connects. Include {{first_name}} if a name variable makes sense. Keep it under 2 sentences.",
  "steps": [
    {
      "key": "snake_case_key",
      "label": "Short label",
      "prompt": "What this step should do and how to say it, in natural spoken ${languageName}. Include ONE example line: 'For example you might say: ...'.",
      "extract": [ { "name": "snake_case_var", "type": "string|number|boolean", "prompt": "what this variable captures" } ]
    }
  ],
  "outcomes": [
    {
      "key": "snake_case_key",
      "label": "Short label, e.g. 'Qualified' or 'Not interested'",
      "condition": "Plain-English condition over the extracted variables from the steps above, e.g. \\"timeline is 'immediate' and budget_confirmed is true\\"",
      "closingPrompt": "What the agent should say to close the call this way, in 1-2 sentences, in natural spoken ${languageName}."
    }
  ]
}

LANGUAGE & VOICE (CRITICAL):
- Write persona, greeting, every step's prompt, and every outcome's closingPrompt in NATURAL
  SPOKEN ${languageName}, the way a real person actually talks on a phone — never bookish or
  written-style words. Prefer the spoken word over the literary one (e.g. నమస్తే not నమస్కారం,
  సారీ not క్షమించండి, డీటెయిల్స్ not వివరాలు, ప్రైస్ not ధరలు, ఏంటి not ఏమిటి).
- English words ${languageName} speakers say naturally inside their own sentences stay in LATIN
  script (e.g. "మీ booking confirm అయ్యింది", "site visit", "budget", "EMI", "WhatsApp").
- Embed the provided business facts DIRECTLY into the prompts — opening hours, location,
  services/products, prices, offers — so the agent can answer naturally instead of guessing.
- Every step prompt must contain ONE concrete example line: "For example you might say: '<natural
  spoken ${languageName} line>'". It shows tone and naturalness and is illustrative only.
- NEVER invent a fact that was not provided. If no facts were given for something a caller will
  likely ask (price, hours, location), phrase the step so the agent handles it with a warm
  "let me confirm and follow up" rather than guessing.
- Keep "condition" fields in plain ENGLISH — they route the call graph and are never spoken.
- Never repeat the same acknowledgement or filler twice in any one prompt.

UNIVERSAL SPOKEN LAYERS (apply to every flow, in every step prompt):
- PRONUNCIATION: spell acronyms out loud, never as a word — "S-F-T" not "sft", "O-R-R" not "orr",
  "Three B-H-K" not "3bhk". Brand names stay clear ("Skyline Heights").
- LISTENING: do not interrupt; wait one extra beat (300-500ms) for fillers like "ఆ..."/"అంటే...".
  Acknowledge with a 1-2 word confirmation before responding.
- MEMORY: remember facts the caller shared earlier in the call and reference them later; never re-ask
  a question already answered.
- DATA (capture silently): note numbers/dates/times without reading them back; confirm critical
  scheduling details (date + time + morning/afternoon/evening) in the closing step.
- ERRORS: if the transcript is garbled, ask once briefly ("మళ్ళీ ఒక్కసారి చెప్తారా?") — never guess.

Rules:
- 3 to 6 steps. Each step captures 1-2 variables maximum, asked as ONE question per turn.
- 2 to 4 outcomes. Always include one clearly positive/qualified outcome and one clearly negative/not-interested outcome.
- Every outcome's condition must only reference variable names that some step actually extracts.
- Do not include any safety/compliance/escalation logic — that is added automatically.
- Each "prompt" is an instruction to the AGENT (what to do and how to say it), not a transcript of both sides.`;

/** The section shape editFlow reads and writes: an already-hired employee's LIVE call script
 * (VoiceEmployeeSection, same as SectionInput) — not the pre-creation draft from generate().
 * Editing an existing agent's script is what actually happens on the "Call script" tab. */
export interface SectionsEditResult {
  sections: SectionInput[];
}

const EDIT_SYSTEM_PROMPT = `You edit an EXISTING AI voice agent's call script — a sequence of
named sections, each with instructions for what to do and rules for where the call goes next.
You are given the current sections as JSON and one plain-English instruction describing a single
change the business owner wants made. Output ONLY a JSON object of this exact shape, no markdown,
no explanation:

{
  "sections": [
    {
      "sectionKey": "snake_case_key",
      "label": "Short human-readable label",
      "prompt": "One instruction: what this section should ask or do. Never ask two things in one section.",
      "enabled": true,
      "order": 1,
      "nodeType": "agentNode",
      "edges": [ { "to_key": "snake_case_key_of_next_section", "condition": "plain-English condition for taking this edge" } ]
    }
  ]
}

Rules:
- Apply ONLY the requested change. Copy every other section through UNCHANGED — same prompt text,
  same edges, same order — unless the instruction requires touching it (e.g. inserting a new
  section requires re-pointing the edge that used to skip over where it now sits).
- order is 1-indexed and must have no gaps or duplicates across the returned array.
- sectionKey values must be unique. When adding a section, invent a new key that doesn't collide.
- A section can have MULTIPLE edges (branches) — e.g. one condition routing to a follow-up section
  and another routing to closing if the caller isn't interested. Every to_key must be a sectionKey
  that exists somewhere in the returned sections array (no dangling edges).
- The LAST section in call order should have an empty edges array (nothing routes onward from it).
- If the instruction references a fact, price, or promise the script can't already verify, phrase
  the section as asking/offering it, not asserting it as already true.
- nodeType is "agentNode" for a normal conversational section. Preserve whatever nodeType an
  existing section already has when you copy it through.
- Do not add language-specific style rules, safety/compliance/escalation logic, or persona/greeting
  text — those live outside sections and are not yours to touch.`;

@Injectable()
export class CallFlowGeneratorService {
  private readonly logger = new Logger(CallFlowGeneratorService.name);
  private client: OpenAI | undefined;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY') || this.config.get<string>('DEEPSEEK_API_KEY');
    const baseURL = this.config.get<string>('OPENAI_BASE_URL') || this.config.get<string>('DEEPSEEK_BASE_URL');
    if (apiKey) {
      this.client = new OpenAI({ apiKey, baseURL: baseURL || undefined, timeout: 45000, maxRetries: 1 });
    }
  }

  /** Pure generation — no side effects, nothing is applied to the live workflow. The caller
   * reviews (and, for non-English output, gets native sign-off on) the draft before calling
   * DograhService.applyGeneratedFlow. */
  async generate(
    description: string,
    businessName?: string,
    options: { businessFacts?: string; language?: string } = {},
  ): Promise<GeneratedFlowDraft> {
    if (!this.client) throw new Error('AI API key not configured (OPENAI_API_KEY or DEEPSEEK_API_KEY)');
    if (!description?.trim()) throw new Error('Description is required');

    const language = options.language || 'te';
    const languageName = LANGUAGE_NAMES[language] || 'Telugu';
    const factsBlock = options.businessFacts?.trim()
      ? `\n\nBusiness facts (embed these into the relevant steps, never invent any others):\n${options.businessFacts.trim()}`
      : '';
    const userPrompt = `${businessName ? `Business: ${businessName}\n\n` : ''}Call goal: ${description}${factsBlock}\n\nOutput language: ${languageName}.`;

    const response = await this.client.chat.completions.create({
      model: this.config.get<string>('WORKFLOW_MODEL') || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT(languageName) },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error('AI returned an empty response');

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('AI returned malformed JSON');
    }

    return this.validate(parsed);
  }

  /** Conversational script editor ("Swara"-style): takes an already-hired employee's CURRENT
   * live sections plus one plain-English instruction ("add urgency before closing", "handle a
   * price objection") and returns the whole section list again with only that change applied.
   * Whole-list in/out (not a diff) so the model sees full context — existing section keys and
   * edges — and doesn't duplicate a section or point an edge at a key that doesn't exist.
   * Pure generation like generate(): nothing is saved until the caller reviews the result and
   * calls VoiceEmployeeService.update() themselves (same draft-vs-published flow as everywhere
   * else in this module — publish() is what actually reaches live calls). */
  async editFlow(currentSections: SectionInput[], instruction: string): Promise<SectionsEditResult> {
    if (!this.client) throw new Error('AI API key not configured (OPENAI_API_KEY or DEEPSEEK_API_KEY)');
    if (!instruction?.trim()) throw new Error('Instruction is required');
    if (!currentSections?.length) throw new Error('There are no sections to edit yet');

    const response = await this.client.chat.completions.create({
      model: this.config.get<string>('WORKFLOW_MODEL') || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: EDIT_SYSTEM_PROMPT },
        { role: 'user', content: `Current sections:\n${JSON.stringify({ sections: currentSections }, null, 2)}\n\nRequested change:\n${instruction.trim()}` },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error('AI returned an empty response');

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('AI returned malformed JSON');
    }

    return this.validateSections(parsed);
  }

  /** Same fail-loudly principle as validate() below, but for the sections shape: a dangling edge
   * or duplicate key here would either crash the Dograh compile step or silently produce a call
   * flow with a section the caller can never reach. */
  private validateSections(result: any): SectionsEditResult {
    const errors: string[] = [];
    const sections = result?.sections;
    if (!Array.isArray(sections) || sections.length === 0) {
      throw new Error('AI-edited flow is invalid: sections must be a non-empty array');
    }

    const keys = new Set<string>();
    for (const s of sections) {
      if (!s.sectionKey || !s.prompt) errors.push(`section missing sectionKey/prompt: ${JSON.stringify(s).slice(0, 80)}`);
      if (s.sectionKey && keys.has(s.sectionKey)) errors.push(`duplicate sectionKey: ${s.sectionKey}`);
      if (s.sectionKey) keys.add(s.sectionKey);
      if (typeof s.order !== 'number') errors.push(`section "${s.sectionKey}" missing numeric order`);
    }
    for (const s of sections) {
      for (const e of s.edges || []) {
        if (!e.to_key || !keys.has(e.to_key)) errors.push(`section "${s.sectionKey}" has an edge to unknown section "${e.to_key}"`);
        if (!e.condition) errors.push(`section "${s.sectionKey}" has an edge with no condition`);
      }
    }

    if (errors.length) {
      this.logger.warn(`AI-edited flow failed validation: ${errors.join('; ')}`);
      throw new Error(`AI-edited flow is invalid: ${errors.join('; ')}`);
    }

    return result as SectionsEditResult;
  }

  /** Fails loudly on a structurally broken draft rather than passing it through to the graph
   * builder, where a missing field would either crash mid-write or silently produce a call flow
   * with a dangling edge. */
  private validate(draft: any): GeneratedFlowDraft {
    const errors: string[] = [];
    if (!draft.name) errors.push('missing name');
    if (!draft.persona) errors.push('missing persona');
    if (!draft.greeting) errors.push('missing greeting');
    if (!Array.isArray(draft.steps) || draft.steps.length === 0) errors.push('steps must be a non-empty array');
    if (!Array.isArray(draft.outcomes) || draft.outcomes.length === 0) errors.push('outcomes must be a non-empty array');

    const stepVars = new Set<string>();
    for (const s of draft.steps || []) {
      if (!s.key || !s.prompt) errors.push(`step missing key/prompt: ${JSON.stringify(s).slice(0, 80)}`);
      for (const v of s.extract || []) {
        if (!v.name || !v.type) errors.push(`extraction variable missing name/type in step "${s.key}"`);
        stepVars.add(v.name);
      }
    }
    for (const o of draft.outcomes || []) {
      if (!o.key || !o.condition || !o.closingPrompt) errors.push(`outcome missing key/condition/closingPrompt: ${JSON.stringify(o).slice(0, 80)}`);
    }

    if (errors.length) {
      this.logger.warn(`Generated flow failed validation: ${errors.join('; ')}`);
      throw new Error(`AI-generated flow is invalid: ${errors.join('; ')}`);
    }

    return draft as GeneratedFlowDraft;
  }

  checkReadiness(sections: SectionInput[]): { score: number; canPublish: boolean; feedback: string[] } {
    const feedback: string[] = [];
    let totalScore = 0;

    for (const section of sections) {
      const promptLength = section.prompt?.length || 0;
      const hasEdges = (section.edges || []).length > 0;
      const isTerminal = !hasEdges;

      // Prompt richness (0-25)
      if (promptLength < 30) feedback.push(`[${section.sectionKey}] Prompt too short — expand to at least 30 chars`);
      if (promptLength < 50) totalScore += 10;
      else if (promptLength < 100) totalScore += 15;
      else if (promptLength < 200) totalScore += 20;
      else totalScore += 25;

      // Edges quality (0-25)
      if (!isTerminal) {
        const hasWeakEdges = (section.edges || []).some((e) => !e.condition || e.condition.length < 10);
        if (hasWeakEdges) feedback.push(`[${section.sectionKey}] Edge conditions too vague — be specific when this branch should trigger`);
        totalScore += (section.edges || []).length * 8;
      } else {
        totalScore += 15;
      }

      // Variables captured (0-25)
      const captureVars = (section.edges || [])
        .flatMap((e) => e.condition.match(/\w+/g) || [])
        .filter((v) => !['is', 'and', 'or', 'true', 'false'].includes(v));
      if (captureVars.length === 0 && !isTerminal) feedback.push(`[${section.sectionKey}] No extraction variables — what should the LLM capture here?`);
      totalScore += Math.min(captureVars.length * 5, 25);

      // Label/section quality (0-25)
      if (section.label?.length >= 5) totalScore += 15;
      if (section.sectionKey?.length >= 3 && !section.sectionKey.match(/[A-Z]|[0-9]{2}/)) totalScore += 10;
    }

    const score = Math.min(100, Math.round(totalScore / Math.max(1, sections.length)));
    const canPublish = score >= 40;

    if (score < 40) feedback.push(`Overall readiness: ${score}/100. Prompts are too thin to publish reliably.`);
    else if (score < 70) feedback.push(`Overall readiness: ${score}/100. Could be richer — consider adding more context/instructions.`);
    else feedback.push(`Overall readiness: ${score}/100. Ready to publish.`);

    return { score, canPublish, feedback };
  }
}
