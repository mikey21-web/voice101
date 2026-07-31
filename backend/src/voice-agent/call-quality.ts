/**
 * Automated call-quality scoring.
 *
 * "Does it sound natural" is a judgement call, but most of what makes a voice agent sound like a
 * bot is mechanically detectable in the transcript: it repeats itself, it asks two things at once,
 * it reads your phone number back to you, it uses words nobody says out loud. Those are the checks
 * below.
 *
 * This exists so prompt changes can be measured instead of argued about, and so a regression shows
 * up on the next call rather than in a complaint three weeks later. It scores what the style pack
 * (style-pack.ts) instructs — the two are meant to be read together.
 *
 * Deliberately NOT a judge of whether the conversation succeeded; that's what lead outcome is for.
 */

import { SPOKEN_SUBSTITUTIONS, ACKNOWLEDGEMENTS } from './style-pack';

export type Severity = 'high' | 'medium' | 'low';

export interface Violation {
  rule: string;
  severity: Severity;
  /** 1-based index of the agent turn, or 0 for call-wide findings. */
  turn: number;
  detail: string;
  excerpt?: string;
}

export interface QualityReport {
  /** 0-100. 100 = no detected violations. */
  score: number;
  violations: Violation[];
  agentTurns: number;
  violationsPerTurn: number;
}

export interface Turn {
  role: 'agent' | 'user' | 'system';
  content: string;
}

const SEVERITY_COST: Record<Severity, number> = { high: 12, medium: 6, low: 3 };

/**
 * Transcripts arrive in whatever shape the provider felt like: an array of message objects, a JSON
 * string of the same, or a flat "Agent: ... / User: ..." log. Normalize all three rather than making
 * every caller care which one they have.
 */
export function normalizeTranscript(raw: unknown): Turn[] {
  if (!raw) return [];

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try { return normalizeTranscript(JSON.parse(trimmed)); } catch { /* fall through to line parsing */ }
    }
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*(agent|assistant|bot|ai|user|caller|human|system)\s*[:>-]\s*(.*)$/i))
      .filter((m): m is RegExpMatchArray => !!m && !!m[2].trim())
      .map((m) => ({ role: mapRole(m[1]), content: m[2].trim() }));
  }

  if (Array.isArray(raw)) {
    return raw
      .map((t: any) => ({
        role: mapRole(t?.role ?? t?.speaker ?? t?.from ?? ''),
        content: String(t?.content ?? t?.text ?? t?.message ?? '').trim(),
      }))
      .filter((t) => t.content);
  }

  return [];
}

function mapRole(raw: string): Turn['role'] {
  const r = String(raw).toLowerCase();
  if (/^(agent|assistant|bot|ai)$/.test(r)) return 'agent';
  if (/^(user|caller|human|customer)$/.test(r)) return 'user';
  return r === 'system' ? 'system' : 'user';
}

/** Rough sentence split that tolerates Telugu punctuation ("।" and bare newlines). */
const sentences = (s: string) => s.split(/[.!?।]+|\n+/).map((x) => x.trim()).filter(Boolean);

/** Strips punctuation/whitespace so "సరే!" and "సరే" compare equal. */
const normalize = (s: string) => s.toLowerCase().replace(/[\s.,!?…"'`।-]+/g, ' ').trim();

/** Number-ish tokens a caller might supply and the agent might wrongly echo back. */
function dataTokens(text: string): string[] {
  const tokens = text.match(/\d{2,}/g) || [];
  return tokens.filter((t) => t.length >= 2);
}

/**
 * Domain shorthand like "2BHK" or "3 BHK" is spoken exactly as written — a real Hyderabad
 * speaker says "two B H K", and the TTS renders the digit correctly in that context. Strip
 * these before checking for bare numerals so they don't get flagged as digits-not-words.
 */
function stripDomainNumerals(text: string): string {
  return text.replace(/\d+\s*BHK/gi, '');
}

export function lintTranscript(raw: unknown): QualityReport {
  const turns = normalizeTranscript(raw);
  const violations: Violation[] = [];

  const agentIdx = turns.map((t, i) => ({ t, i })).filter((x) => x.t.role === 'agent');
  const agentTurns = agentIdx.length;

  if (agentTurns === 0) {
    return { score: 0, violations: [{ rule: 'empty', severity: 'high', turn: 0, detail: 'No agent turns found in transcript' }], agentTurns: 0, violationsPerTurn: 0 };
  }

  const ackCounts = new Map<string, number>();
  const seenSentences = new Map<string, number>();
  let sorryCount = 0;
  let lastAck: string | null = null;

  agentIdx.forEach(({ t, i }, n) => {
    const turnNo = n + 1;
    const text = t.content;
    const lower = text.toLowerCase();

    // 1. Written/literary Telugu where a spoken form exists.
    for (const [written, spoken] of SPOKEN_SUBSTITUTIONS) {
      if (text.includes(written)) {
        violations.push({ rule: 'literary-word', severity: 'medium', turn: turnNo, detail: `Used written "${written}" instead of spoken "${spoken}"`, excerpt: written });
      }
    }

    // 2. More than one question in a single turn — the loudest "I am a form" tell.
    const questionCount = (text.match(/\?/g) || []).length;
    if (questionCount > 1) {
      violations.push({ rule: 'multiple-questions', severity: 'high', turn: turnNo, detail: `${questionCount} questions in one turn; the rule is one`, excerpt: text.slice(0, 120) });
    }

    // 3. Digits should be spoken as words — a figure means the TTS will read it wrong.
    //    Domain shorthand (2BHK, 3 BHK) is exempt: it's how people actually say it out loud,
    //    and the TTS handles it correctly.
    const digitMatch = stripDomainNumerals(text).match(/\d+/g);
    if (digitMatch) {
      violations.push({ rule: 'digits-not-words', severity: 'medium', turn: turnNo, detail: `Numerals present (${digitMatch.slice(0, 3).join(', ')}); should be words`, excerpt: text.slice(0, 120) });
    }

    // 4. Reading a caller-supplied value back. Checked against the immediately preceding user turn.
    const prevUser = turns.slice(0, i).reverse().find((x) => x.role === 'user');
    if (prevUser) {
      for (const tok of dataTokens(prevUser.content)) {
        if (text.includes(tok)) {
          violations.push({ rule: 'readback', severity: 'high', turn: turnNo, detail: `Read caller's value "${tok}" back to them`, excerpt: tok });
          break;
        }
      }
    }

    // 5. Acknowledgement variety. Same one twice running is worse than twice overall.
    const opener = ACKNOWLEDGEMENTS.find((a) => normalize(text).startsWith(normalize(a)));
    if (opener) {
      ackCounts.set(opener, (ackCounts.get(opener) || 0) + 1);
      if (opener === lastAck) {
        violations.push({ rule: 'repeated-ack-consecutive', severity: 'medium', turn: turnNo, detail: `Opened with "${opener}" twice in a row`, excerpt: opener });
      }
      lastAck = opener;
    } else {
      lastAck = null;
    }

    // 6. Apology budget: once per call.
    if (/సారీ|\bsorry\b/i.test(lower)) sorryCount++;

    // 7. Verbatim repetition across turns.
    for (const s of sentences(text)) {
      if (s.length < 12) continue; // short acknowledgements are meant to recur
      const key = normalize(s);
      const prev = seenSentences.get(key);
      if (prev !== undefined) {
        violations.push({ rule: 'repeated-sentence', severity: 'high', turn: turnNo, detail: `Repeated a line already said in turn ${prev}`, excerpt: s.slice(0, 100) });
      } else {
        seenSentences.set(key, turnNo);
      }
    }

    // 8. Length. A phone turn that runs long stops being a conversation.
    const sentenceCount = sentences(text).length;
    if (sentenceCount > 3) {
      violations.push({ rule: 'turn-too-long', severity: 'low', turn: turnNo, detail: `${sentenceCount} sentences in one turn; aim for one or two`, excerpt: text.slice(0, 120) });
    }
  });

  // Call-wide checks.
  for (const [ack, count] of ackCounts) {
    if (count > 2) {
      violations.push({ rule: 'repeated-ack-overused', severity: 'medium', turn: 0, detail: `Opened with "${ack}" ${count} times across the call`, excerpt: ack });
    }
  }
  if (sorryCount > 1) {
    violations.push({ rule: 'over-apologising', severity: 'medium', turn: 0, detail: `Said sorry ${sorryCount} times; the budget is one per call` });
  }

  const cost = violations.reduce((sum, v) => sum + SEVERITY_COST[v.severity], 0);
  const score = Math.max(0, 100 - cost);

  return {
    score,
    violations,
    agentTurns,
    violationsPerTurn: Number((violations.length / agentTurns).toFixed(2)),
  };
}

/** Short human-readable line for logs and the call-log UI. */
export function summarizeQuality(report: QualityReport): string {
  if (!report.violations.length) return `Clean (${report.agentTurns} turns)`;
  const bySeverity = report.violations.reduce<Record<string, number>>((acc, v) => {
    acc[v.severity] = (acc[v.severity] || 0) + 1;
    return acc;
  }, {});
  const parts = (['high', 'medium', 'low'] as Severity[]).filter((s) => bySeverity[s]).map((s) => `${bySeverity[s]} ${s}`);
  return `Score ${report.score}/100 — ${parts.join(', ')}`;
}
