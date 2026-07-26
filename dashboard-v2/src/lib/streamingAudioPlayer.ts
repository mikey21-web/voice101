import { getToken } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// One AudioContext, one running playback cursor, shared app-wide. Both
// VoiceCommandUI and MikeyWidget used to keep their own independent <audio>
// element for full-clip playback; a shared player here means a new reply
// interrupts whatever Mikey was already saying instead of two voices
// overlapping, which full-clip playback never had to worry about but
// streaming makes possible if each caller owned its own queue.
let audioCtx: AudioContext | null = null;
let nextStartTime = 0;
let activeAbort: AbortController | null = null;
let activeSources: AudioBufferSourceNode[] = [];

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

function stopActive() {
  activeAbort?.abort();
  activeAbort = null;
  for (const src of activeSources) { try { src.stop(); } catch {} }
  activeSources = [];
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Server sends pcm_s16le (little-endian 16-bit PCM), 44.1kHz mono. Reading it
// straight into Int16Array assumes a little-endian platform, true for every
// mainstream browser/device (x86, ARM) — not worth a DataView indirection for
// the theoretical big-endian case nothing here will ever run on.
export function pcm16BytesToFloat32(bytes: Uint8Array): Float32Array {
  const pcm16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
  return float32;
}

/** Splits a buffered SSE byte stream on frame boundaries ("\n\n"), parsing each
 * complete frame's `data: {...}` line as JSON. Returns the parsed messages plus
 * whatever incomplete tail should be kept and prepended to the next chunk. */
export function parseSSEFrames(buffered: string): { messages: any[]; remainder: string } {
  const frames = buffered.split('\n\n');
  const remainder = frames.pop() || '';
  const messages: any[] = [];
  for (const frame of frames) {
    const line = frame.split('\n').find(l => l.startsWith('data: '));
    if (!line) continue;
    try { messages.push(JSON.parse(line.slice(6))); } catch { /* malformed frame, skip */ }
  }
  return { messages, remainder };
}

function scheduleChunk(ctx: AudioContext, bytes: Uint8Array) {
  const float32 = pcm16BytesToFloat32(bytes);
  const buffer = ctx.createBuffer(1, float32.length, 44100);
  buffer.copyToChannel(float32, 0);

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  // If playback fell behind (network stall), don't stack the backlog into a
  // burst — resume from now instead of compounding silence into more silence.
  const startAt = Math.max(ctx.currentTime, nextStartTime);
  src.start(startAt);
  nextStartTime = startAt + buffer.duration;
  activeSources.push(src);
  src.onended = () => { activeSources = activeSources.filter(s => s !== src); };
}

/** Streams a Mikey reply from Cartesia and plays it as chunks arrive, instead
 * of waiting for the whole clip. Interrupts any speech already playing.
 * Silently no-ops on any failure — voice is a nice-to-have, never something
 * a caller should have to handle an error for. */
export async function speakStreamed(text: string): Promise<void> {
  if (!text?.trim()) return;
  stopActive();
  const ctx = getCtx();
  nextStartTime = ctx.currentTime;

  const controller = new AbortController();
  activeAbort = controller;

  let res: Response;
  try {
    const t = getToken();
    res = await fetch(`${API_URL}/copilot/speak-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
  } catch {
    return;
  }
  if (!res.ok || !res.body) return;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      const { messages, remainder } = parseSSEFrames(buffered);
      buffered = remainder;
      for (const msg of messages) {
        if (msg.error || msg.final || !msg.audioBase64) continue;
        scheduleChunk(ctx, base64ToBytes(msg.audioBase64));
      }
    }
  } catch {
    // Aborted (interrupted by a newer reply) or a mid-stream network hiccup —
    // whatever already got scheduled keeps playing either way.
  } finally {
    if (activeAbort === controller) activeAbort = null;
  }
}

export function stopSpeaking(): void {
  stopActive();
}
