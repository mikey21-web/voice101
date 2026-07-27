import { getToken } from './api';
import { parseSSEFrames } from './streamingAudioPlayer';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Don't wait forever on a long clause with no punctuation ("um, so basically
// what happened was...") — cap how much text accumulates before it's spoken
// regardless of a sentence boundary showing up.
const MAX_SEGMENT_CHARS = 200;

/** Pulls one speakable segment (up to and including the last sentence boundary)
 * off the front of `buffer`, returning the segment plus what's left to keep
 * accumulating — or null if nothing's ready yet. With `force` (stream ended),
 * whatever remains gets returned as the final segment even without a boundary. */
export function extractSpeakableSegment(buffer: string, force: boolean): { segment: string; rest: string } | null {
  if (!buffer) return null;
  if (buffer.length >= MAX_SEGMENT_CHARS) {
    const cut = buffer.lastIndexOf(' ', MAX_SEGMENT_CHARS);
    const idx = cut > 20 ? cut : MAX_SEGMENT_CHARS; // avoid a near-zero cut on one long word
    return { segment: buffer.slice(0, idx).trim(), rest: buffer.slice(idx) };
  }
  const matches = [...buffer.matchAll(/[.!?](?:\s+|$)/g)];
  if (matches.length > 0) {
    const last = matches[matches.length - 1];
    const end = last.index! + last[0].length;
    return { segment: buffer.slice(0, end).trim(), rest: buffer.slice(end) };
  }
  if (force && buffer.trim()) {
    return { segment: buffer.trim(), rest: '' };
  }
  return null;
}

export interface ChatStreamResult {
  conversationId: string;
  reply: string;
  actions: any[];
}

export interface ChatStreamCallbacks {
  /** Fires with the full accumulated reply text so far, for incremental rendering. */
  onTextUpdate?: (fullTextSoFar: string) => void;
  /** Fires once per sentence-sized chunk as it becomes ready to speak. */
  onSegment?: (segment: string) => void;
}

/** Same as a plain POST /copilot/chat, but reads the reply as it's generated instead
 * of waiting for the whole thing — segments get handed to onSegment as sentence
 * boundaries arrive so a caller can start speaking before the reply is complete.
 * Resolves with the same {conversationId, reply, actions} shape /copilot/chat
 * returns in one shot, so callers can treat both the same way once this settles.
 *
 * `signal` is barge-in support (Phase 3): aborting it doesn't just stop reading here,
 * it closes the underlying fetch, which the backend detects (req.on('close')) and uses
 * to cancel the upstream agent-service generation too — so interrupting Mikey actually
 * stops the LLM call, not just the frontend's relay of it. On abort this resolves
 * (doesn't throw) with whatever text had streamed in so far, since the backend already
 * persists that partial turn — the caller doesn't need special abort-vs-error handling. */
export async function chatStream(
  message: string,
  conversationId: string | undefined,
  callbacks: ChatStreamCallbacks = {},
  signal?: AbortSignal,
): Promise<ChatStreamResult> {
  const t = getToken();
  let fullText = '';
  let segmentBuffer = '';

  try {
    const res = await fetch(`${API_URL}/copilot/chat-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ message, conversationId }),
      signal,
    });
    if (!res.ok || !res.body) throw new Error('Chat request failed');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffered = '';
    let result: ChatStreamResult | null = null;
    let errorMessage: string | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      sseBuffered += decoder.decode(value, { stream: true });
      const { messages, remainder } = parseSSEFrames(sseBuffered);
      sseBuffered = remainder;
      for (const msg of messages) {
        if (msg.type === 'token' && msg.text) {
          fullText += msg.text;
          segmentBuffer += msg.text;
          callbacks.onTextUpdate?.(fullText);
          const extracted = extractSpeakableSegment(segmentBuffer, false);
          if (extracted) {
            callbacks.onSegment?.(extracted.segment);
            segmentBuffer = extracted.rest;
          }
        } else if (msg.type === 'done') {
          result = { conversationId: msg.conversationId, reply: msg.reply, actions: msg.actions || [] };
        } else if (msg.type === 'error') {
          errorMessage = msg.message || 'Chat failed';
        }
      }
    }

    const final = extractSpeakableSegment(segmentBuffer, true);
    if (final) callbacks.onSegment?.(final.segment);

    if (errorMessage) throw new Error(errorMessage);
    if (!result) throw new Error('Stream ended without a result');
    return result;
  } catch (err: any) {
    if (signal?.aborted) return { conversationId: conversationId || '', reply: fullText, actions: [] };
    throw err;
  }
}
