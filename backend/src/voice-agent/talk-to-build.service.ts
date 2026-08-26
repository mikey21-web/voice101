import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { VoiceEmployeeService, EmployeeInput } from './voice-employee.service';

const LANGUAGE_NAMES: Record<string, string> = {
  te: 'Telugu',
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
  kn: 'Kannada',
  ml: 'Malayalam',
  mr: 'Marathi',
};

const STRUCTURE_SYSTEM_PROMPT = `You are an expert assistant helping an Indian business owner set up
their AI phone-call agent. They've just SPOKEN, in their own words, how they want the call to go.
Turn that raw speech into a clean, complete, ACTIONABLE brief.

RULE 1 - CAPTURE EVERYTHING:
- Call flow (greeting, what to ask, order)
- Business facts (name, what they do, location, hours, services, prices, offers)
- Tone/personality and language preferences
- Rules, exceptions, special cases
- Direct instructions ("if busy offer callback", "send on WhatsApp")
- Anything else, even offhand remarks

RULE 2 - IMPROVISE WHERE THEY DELEGATE:
When owner says "handle objections well" or "ask qualification questions, you decide" - DON'T copy
that vague line. Use your expertise to write CONCRETE specifics. E.g. "qualification questions" for
real estate means actual questions about budget, bedrooms, timeline, area.

RULE 3 - NEVER FABRICATE BUSINESS FACTS:
Conversational DESIGN you improvise freely. Business FACTS you never invent (prices, timings,
addresses). Write placeholders instead: "quote our current price".

ENHANCE wording - clear sentences, not broken phrasing.
Organize: business facts -> call flow -> rules/instructions.
Same language/script as input (Telugu stays Telugu).
Output ONLY a numbered list.`;

const DRAFT_AGENT_SYSTEM_PROMPT = `You generate a complete AI phone-call agent from a structured
business brief. You receive a numbered brief describing an Indian business owner's call flow, plus
a business name and target language. Output ONLY a JSON object of this exact shape, no markdown,
no explanation:

{
  "name": "Culturally appropriate human first-name for the agent, matching the target region",
  "gender": "male | female",
  "role": "Short job title, e.g. 'Clinic Receptionist', 'Sales Representative'",
  "welcome_message": "Exact opening line the agent speaks first, written natively in the TARGET LANGUAGE script. May reference {{lead_name}} if a pre-known caller name variable makes sense.",
  "agent_information": "2-5 sentences of identity + business context for the agent: who it is, what the business does, tone. Written natively in the target language.",
  "call_end_rules": "Explicit rules for when and how to hang up politely, in English.",
  "sections": [
    {
      "key": "snake_case_key",
      "heading": "Short human-readable label",
      "node_type": "llm",
      "prompt": "Full instruction for this section, written NATIVELY in the target language script - not translated after the fact. What to do, how to say it, ONE example spoken line where helpful.",
      "edges": [ { "to_key": "snake_case_key_of_another_section", "condition": "plain-English condition for taking this edge, e.g. 'if they agree to talk now'" } ]
    }
  ],
  "variables": [
    { "key": "snake_case_var", "label": "Human label", "source": "pre", "required": false },
    { "source": "capture" entries also include: "extract_hint": "what to listen for during the call" }
  ]
}

LANGUAGE (CRITICAL): Detect the target language field. Generate welcome_message, agent_information
and EVERY section prompt directly in that language's native script (te-IN -> Telugu script,
hi-IN -> Devanagari). English words speakers naturally mix in stay in Latin script. Numbers are
written as words for speech.

GRAPH RULES:
- 3 to 7 sections, ordered as the call flows. The FIRST section opens the conversation after the
  greeting. Sections branch with multiple edges when the brief describes conditional paths.
- Every edge's to_key must reference a section key that exists. The final closing section may have
  an empty edges array. Do NOT create sections for wrong-number/busy/voicemail/human-handoff -
  those safety branches are added by the platform automatically.
- One question or one move per section. Multi-part asks get split across sections.

VARIABLES:
- source "pre": known before the call (lead_name, appointment_date given by the owner/campaign).
- source "capture": extracted during the call; every capture variable MUST have extract_hint.
- Only declare variables the brief implies. Never invent business facts - if the brief lacks a
  price, hours, or address, the relevant prompt says to confirm-and-follow-up instead of asserting.

STYLE: Warm, natural spoken register - the way a real person talks on a phone, never bookish.
Never repeat the same acknowledgement twice in one prompt.`;

export interface StructuredBriefResult {
  structured: string;
}

export interface DraftSection {
  key: string;
  heading: string;
  node_type: 'llm' | string;
  prompt: string;
  edges: Array<{ to_key: string; condition: string }>;
}

export interface DraftVariable {
  key: string;
  label: string;
  source: 'pre' | 'capture';
  required?: boolean;
  extract_hint?: string;
}

export interface DraftAgent {
  name: string;
  gender: 'male' | 'female';
  role: string;
  welcome_message: string;
  agent_information: string;
  call_end_rules: string;
  sections: DraftSection[];
  variables: DraftVariable[];
}

@Injectable()
export class TalkToBuildService {
  private readonly logger = new Logger(TalkToBuildService.name);
  private client: OpenAI | undefined;

  constructor(private config: ConfigService, private employees: VoiceEmployeeService) {
    const deepseekKey = this.config.get<string>('DEEPSEEK_API_KEY');
    const openrouterKey = this.config.get<string>('PROD_OPENROUTER_API_KEY');
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    let apiKey: string | undefined;
    let baseURL: string | undefined = this.config.get<string>('DEEPSEEK_BASE_URL') || this.config.get<string>('OPENAI_BASE_URL') || undefined;
    if (deepseekKey) {
      apiKey = deepseekKey;
      baseURL = baseURL || 'https://api.deepseek.com/v1';
    } else if (openrouterKey) {
      apiKey = openrouterKey;
      baseURL = baseURL && !baseURL.includes('openai') ? baseURL : 'https://openrouter.ai/api/v1';
    } else if (openaiKey) {
      apiKey = openaiKey;
    }
    if (apiKey) {
      this.client = new OpenAI({ apiKey, baseURL, timeout: 180000, maxRetries: 1 });
      this.providerBase = baseURL || '';
    }
  }

  private providerBase = '';

  async transcribeChunk(audio: Buffer, mimeType: string, language?: string): Promise<{ transcript: string }> {
    const deepgramKey = this.config.get<string>('DEEPGRAM_API_KEY');
    if (!deepgramKey) throw new Error('DEEPGRAM_API_KEY not configured');
    const lang = (language || '').trim() || 'multi';
    const params = new URLSearchParams({
      model: 'nova-2',
      smart_format: 'true',
      language: ['en', 'hi'].includes(lang) ? lang : (lang.length === 2 ? `${lang}` : 'multi'),
    });
    const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${deepgramKey}`,
        'Content-Type': mimeType || 'audio/wav',
      },
      body: new Uint8Array(audio),
    });
    if (!res.ok) throw new Error(`Transcription failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    return { transcript };
  }

  async structurePrompt(transcript: string): Promise<StructuredBriefResult> {
    if (!this.client) throw new Error('AI API key not configured (OPENAI_API_KEY or DEEPSEEK_API_KEY)');
    if (!transcript?.trim()) throw new Error('Transcript is required');
    const completion = await this.client.chat.completions.create({
      model: this.model(),
      temperature: 0.3,
      messages: [
        { role: 'system', content: STRUCTURE_SYSTEM_PROMPT },
        { role: 'user', content: transcript.trim() },
      ],
    });
    return { structured: completion.choices[0]?.message?.content?.trim() || '' };
  }

  /** Whether the owner has given enough to build a complete agent — mirrors Outpero's
   * /ai/onboarding-readiness gate shown between the describe step and the build step. */
  readiness(description: string): { ready: boolean; missing: string[]; score: number } {
    const text = (description || '').trim();
    const checks: Array<{ key: string; label: string; present: boolean }> = [
      { key: 'business', label: 'What the business does', present: text.length > 10 },
      { key: 'caller', label: 'Who the agent calls', present: /call|lead|patient|student|customer|enquir|buyer/i.test(text) },
      { key: 'goal', label: 'What the call should achieve', present: /book|appointment|qualif|follow|remind|visit|schedule|collect|pitch|sell/i.test(text) },
      { key: 'language', label: 'Language to speak', present: /telugu|hindi|tamil|english|kannada|malayalam|marathi|te\b|hi\b|en\b/i.test(text) },
    ];
    const missing = checks.filter((c) => !c.present).map((c) => c.label);
    const score = Math.round((checks.filter((c) => c.present).length / checks.length) * 100);
    return { ready: missing.length === 0, missing, score };
  }

  /** Accepts a voice-note transcript and returns a compact, conversational brief the agent
   * can be built from in one shot — Outpero's /ai/voice-prompt equivalent. */
  async voicePrompt(transcript: string, language?: string): Promise<{ brief: string; agentName?: string }> {
    if (!this.client) throw new Error('AI API key not configured (OPENAI_API_KEY or DEEPSEEK_API_KEY)');
    if (!transcript?.trim()) throw new Error('Transcript is required');
    const completion = await this.client.chat.completions.create({
      model: this.model(),
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            'You turn a spoken voice note from an Indian business owner into a compact brief for an AI phone-call agent. Output ONLY: a suggested agent name (a culturally appropriate Indian first name), and the brief as a numbered list of concrete, build-ready points (business, who to call, call goal, questions to ask, how to handle no/busy, rules, language/tone). Same language/script as the input. Format:\nAgent name: <name>\nBrief:\n1. ...\n2. ...',
        },
        { role: 'user', content: transcript.trim() },
      ],
    });
    const content = completion.choices[0]?.message?.content?.trim() || '';
    const nameMatch = content.match(/Agent name:\s*(.+)/i);
    const brief = content.replace(/Agent name:\s*.+\n?/i, '').trim();
    return { brief, agentName: nameMatch?.[1]?.trim() };
  }

  async draftAgent(input: {
    channel?: string;
    description: string;
    business_name?: string;
    language?: string;
  }): Promise<DraftAgent> {
    if (!this.client) throw new Error('AI API key not configured (OPENAI_API_KEY or DEEPSEEK_API_KEY)');
    if (!input.description?.trim()) throw new Error('Description is required');
    const language = input.language || 'te-IN';
    const languageName = LANGUAGE_NAMES[language.slice(0, 2).toLowerCase()] || 'Telugu';
    const userPrompt = [
      input.business_name ? `Business name: ${input.business_name}` : null,
      `Channel/mode: ${input.channel || 'instant'}`,
      `Target language: ${languageName} (${language})`,
      '',
      'Structured brief:',
      input.description.trim(),
    ]
      .filter((x) => x !== null)
      .join('\n');

    const completion = await this.client.chat.completions.create({
      model: this.model(),
      temperature: 0.6,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: DRAFT_AGENT_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });
    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw) as DraftAgent;
    if (!parsed.sections?.length) throw new Error('Draft generation returned no sections');
    const keys = new Set(parsed.sections.map((s) => s.key));
    parsed.sections.forEach((s) => {
      s.edges = (s.edges || []).filter((e) => keys.has(e.to_key));
    });
    return parsed;
  }

  draftToEmployeeInput(draft: DraftAgent, opts: { channel?: string; language?: string; businessName?: string } = {}): EmployeeInput {
    return {
      name: draft.name,
      role: draft.role,
      mode: opts.channel || 'instant',
      voiceProvider: 'smallest',
      voiceId: 'rhea',
      voiceName: 'Rhea',
      ttsSpeed: 1.0,
      language: opts.language || 'te-IN',
      welcomeMessage: draft.welcome_message,
      agentInformation: draft.agent_information,
      callEndRules: draft.call_end_rules,
      scriptAdherence: 2,
      stylePackEnabled: true,
      aiAcknowledgementEnabled: true,
      sections: draft.sections.map((s, i) => ({
        sectionKey: s.key,
        label: s.heading || s.key,
        prompt: s.prompt,
        enabled: true,
        order: i + 1,
        nodeType: s.node_type === 'faq' ? 'faq' : 'agentNode',
        edges: s.edges || [],
      })),
      variables: (draft.variables || []).map((v) => ({
        key: v.key,
        label: v.label || v.key,
        source: v.source,
        required: !!v.required,
        extractHint: v.extract_hint || null,
      })),
    };
  }

  async createEmployeeFromDraft(
    tenantId: string,
    draft: DraftAgent,
    opts: { channel?: string; language?: string; businessName?: string },
  ) {
    const input = this.draftToEmployeeInput(draft, opts);
    const employee = await this.employees.create(tenantId, input);
    return employee;
  }

  private model(): string {
    const explicit = this.config.get<string>('TALK_TO_BUILD_MODEL');
    if (explicit) return explicit;
    if (this.providerBase.includes('deepseek')) return 'deepseek-chat';
    if (this.providerBase.includes('openrouter')) return this.config.get<string>('AGENT_MODEL') || 'deepseek/deepseek-chat';
    return 'gpt-4o-mini';
  }
}
