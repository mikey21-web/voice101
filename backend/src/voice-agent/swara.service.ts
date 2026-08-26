import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join } from 'path';

const SWARA_QUESTIONS = [
  {
    key: 'who',
    label: 'Who should I call?',
    prompt: "Ask the owner who this employee will phone — their customers, leads, patients, students, or someone else. Get the business type if you can — real estate, clinic, tuition, etc.",
  },
  {
    key: 'goal',
    label: 'What should the call get done?',
    prompt: "Ask what the call should ACCOMPLISH. Examples: book an appointment, qualify a lead, collect a payment, follow up, send a brochure, set a site visit. One clear goal per agent.",
  },
  {
    key: 'qualification',
    label: 'What should we ask to figure out if they are a good fit?',
    prompt: "Ask what information the owner needs before deciding the call went well. Improvise CONCRETE questions for their industry (real estate → budget, area, bedrooms, timeline; clinic → which service, when, insurance; tuition → class, board, location). Never invent business facts — use placeholders for anything specific.",
  },
  {
    key: 'objections',
    label: 'What should we do if they say no, are busy, or not interested?',
    prompt: "Ask the owner how to handle: (a) the person is busy / wrong time, (b) they say 'not interested', (c) they ask for a price the agent doesn't know. If they delegate ('you decide'), improvise warmly — offer WhatsApp, callback, or 'team will confirm'.",
  },
  {
    key: 'rules',
    label: 'Any rules — things to never say, prices never to quote, languages to use, tone?',
    prompt: "Ask for hard rules: language preference (Telugu, Hindi, English, mix), what NEVER to say, prices to never quote directly, the agent's persona/name, the business name. Capture everything, even offhand remarks.",
  },
];

const SWARA_GREETING_TELUGU = 'హలో! నేను Swara AI, మీ voice employee setup చేయడానికి వచ్చాను. మీ business గురించి చెప్పండి, నేను questions అడుగుతాను. చెప్పగలరా?';
const SWARA_GREETING_ENGLISH = "Hello! I'm Swara, your AI onboarding assistant. I'll ask you a few questions to set up your voice employee. Ready to tell me about your business?";

const SWARA_BUILD_SYSTEM_PROMPT = `You are Swara AI, a voice assistant that helps Indian business owners set up their AI phone-call agent. They have SPOKEN OR TYPED, in their own words, how they want the call to go. Turn that into a clean, complete, ACTIONABLE brief.

RULE 1 — CAPTURE EVERYTHING:
- Who they call (customers / leads / patients / students)
- The business type (real estate, clinic, tuition, etc.)
- Business facts: name, location, hours, services, prices, offers
- The call goal: book, qualify, follow up, collect, send info, schedule
- Qualification questions they need answered
- How to handle busy / not interested / wrong time
- Hard rules: language, tone, what never to say, prices to never quote
- Anything else, even offhand remarks

RULE 2 — IMPROVISE WHERE THEY DELEGATE:
When owner says "you decide" or "handle it well" — DON'T copy that vague line. Write CONCRETE specifics. E.g. for real estate, ask about budget, area, bedrooms, timeline in plain language.

RULE 3 — NEVER FABRICATE BUSINESS FACTS:
Conversational DESIGN you improvise freely. Business FACTS (prices, exact timings, addresses) you never invent — write placeholders like "quote our current price" or "team will confirm".

Same language and script as the owner's input. If they wrote in Telugu (Telugu script), keep the brief in Telugu. If they wrote in English, keep the brief in English with Telugu speaking-style notes if they want Telugu output.

Output ONLY a numbered list of facts. No preamble, no summary.`;

@Injectable()
export class SwaraService {
  private readonly logger = new Logger(SwaraService.name);
  private client: OpenAI | undefined;
  private providerBase = '';
  private baseUrl: string;
  private apiKey: string;

  constructor(private config: ConfigService) {
    this.baseUrl = this.config.get<string>('DOGRAH_URL', 'http://localhost:8010');
    this.apiKey = this.config.get<string>('DOGRAH_API_KEY', '');

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

  getQuestions() {
    return SWARA_QUESTIONS;
  }

  getGreeting(language: string) {
    if ((language || '').toLowerCase().startsWith('te')) return SWARA_GREETING_TELUGU;
    if ((language || '').toLowerCase().startsWith('hi')) return 'नमस्ते! मैं Swara AI हूँ। आपका voice employee setup करने आई हूँ। बताइए, आपका business क्या है?';
    return SWARA_GREETING_ENGLISH;
  }

  async structureBrief(transcript: string, language: string = 'en'): Promise<string> {
    if (!this.client) throw new Error('AI API key not configured (OPENAI_API_KEY or DEEPSEEK_API_KEY)');
    if (!transcript?.trim()) throw new Error('Transcript is required');
    const completion = await this.client.chat.completions.create({
      model: this.model(),
      temperature: 0.3,
      messages: [
        { role: 'system', content: SWARA_BUILD_SYSTEM_PROMPT },
        { role: 'user', content: transcript.trim() },
      ],
    });
    return completion.choices[0]?.message?.content?.trim() || '';
  }

  async processOneAnswer(questionKey: string, answer: string, priorContext: string, language: string = 'en'): Promise<{ nextQuestion?: { key: string; label: string; prompt: string }; summary?: string; isComplete: boolean }> {
    if (!this.client) throw new Error('AI API key not configured');
    const system = `You are Swara, an AI onboarding assistant for an Indian voice agent platform. The business owner is answering your questions about their AI employee setup. Your job right now:
- Extract the KEY FACTS from the owner's answer
- If the answer is rich and complete, return isComplete=true
- If you need to ask the next question from the fixed list, return it
- If the answer is vague or incomplete for this question, ask one follow-up

Prior conversation context:
${priorContext}

Questions (in order):
${SWARA_QUESTIONS.map((q, i) => `${i + 1}. [${q.key}] ${q.label} — ${q.prompt}`).join('\n')}

Current question: [${questionKey}]
Owner's answer: ${answer}

Respond ONLY with JSON in this exact shape:
{
  "isComplete": boolean,
  "summary": "one-line summary of what we learned from this answer",
  "facts_extracted": ["fact 1", "fact 2"],
  "needs_followup": boolean,
  "followup": "short clarification question or empty",
  "next_question": { "key": "who|goal|qualification|objections|rules", "label": "short label", "prompt": "the next question to ask in ${language === 'te' ? 'spoken Telugu' : language === 'hi' ? 'spoken Hindi' : 'natural English'}" }
}
- isComplete=true ONLY when you have enough to build a complete agent (all 5 questions answered at least minimally)
- next_question is required when isComplete=false AND needs_followup=false
- Output ONLY the JSON, no markdown`;

    const completion = await this.client.chat.completions.create({
      model: this.model(),
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: answer },
      ],
    });
    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    return {
      isComplete: !!parsed.isComplete,
      summary: parsed.summary,
      nextQuestion: parsed.next_question ? { key: parsed.next_question.key, label: parsed.next_question.label, prompt: parsed.next_question.prompt } : undefined,
    };
  }

  private model(): string {
    const explicit = this.config.get<string>('TALK_TO_BUILD_MODEL');
    if (explicit) return explicit;
    if (this.providerBase.includes('deepseek')) return 'deepseek-chat';
    if (this.providerBase.includes('openrouter')) return this.config.get<string>('AGENT_MODEL') || 'deepseek/deepseek-chat';
    return 'gpt-4o-mini';
  }
}
