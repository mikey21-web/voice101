import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

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

const SYSTEM_PROMPT = `You design phone-call flows for an AI voice sales/qualification agent. The
user describes what a call should accomplish in plain language. Output ONLY a JSON object with
this exact shape, no markdown, no explanation:

{
  "name": "short_snake_case_id",
  "role": "Human-readable role, e.g. 'Senior Real Estate Sales Executive'",
  "persona": "2-4 sentences: who the agent is, what business/product this is for, overall tone.",
  "greeting": "The opening line the agent says when the call connects. Include {{first_name}} if a name variable makes sense. Keep it under 2 sentences.",
  "steps": [
    {
      "key": "snake_case_key",
      "label": "Short label",
      "prompt": "One instruction: what this step should ask or do, in ONE turn. Never ask two things.",
      "extract": [ { "name": "snake_case_var", "type": "string|number|boolean", "prompt": "what this variable captures" } ]
    }
  ],
  "outcomes": [
    {
      "key": "snake_case_key",
      "label": "Short label, e.g. 'Qualified' or 'Not interested'",
      "condition": "Plain-English condition over the extracted variables from the steps above, e.g. \\"timeline is 'immediate' and budget_confirmed is true\\"",
      "closingPrompt": "What the agent should say to close the call this way, in 1-2 sentences."
    }
  ]
}

Rules:
- 3 to 6 steps. Each step captures 1-2 variables maximum, asked as ONE question per turn.
- 2 to 4 outcomes. Always include one clearly positive/qualified outcome and one clearly negative/not-interested outcome.
- Every outcome's condition must only reference variable names that some step actually extracts.
- Do not write any language-specific style rules (no Telugu-specific phrasing, no acknowledgement
  patterns) — that layer is handled separately. Write plain, tone-neutral instructions.
- Do not include any safety/compliance/escalation logic — that is added automatically.
- Keep every "prompt" field to plain instructions for the AGENT, not example dialogue.`;

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
  async generate(description: string, businessName?: string): Promise<GeneratedFlowDraft> {
    if (!this.client) throw new Error('AI API key not configured (OPENAI_API_KEY or DEEPSEEK_API_KEY)');
    if (!description?.trim()) throw new Error('Description is required');

    const userPrompt = businessName ? `Business: ${businessName}\n\nCall goal: ${description}` : description;

    const response = await this.client.chat.completions.create({
      model: this.config.get<string>('WORKFLOW_MODEL') || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
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
}
