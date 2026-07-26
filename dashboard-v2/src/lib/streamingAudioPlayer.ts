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
let activeSources: AudioBufferSourceNode[] = [];

// A streamed reply arrives as multiple sentence-sized segments (see the
// frontend's sentence segmenter), each fetched and spoken in turn — segment 2
// must continue after segment 1, not interrupt it, so segments run through a
// serial queue rather than each cancelling whatever came before. `generation`
// only bumps on an actual reset (a genuinely new reply, or an explicit stop),
// so an in-flight segment fetch that's been superseded can tell and skip
// scheduling audio nobody should hear anymore.
let generation = 0;
let segmentQueue: Promise<void> = Promise.resolve();

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

/** Stops whatever's currently playing/queued and starts a fresh generation —
 * call this once at the start of a new reply, before queuing its segments. */
export function resetSpeech(): void {
  generation++;
  for (const src of activeSources) { try { src.stop(); } catch {} }
  activeSources = [];
  segmentQueue = Promise.resolve();
  nextStartTime = getCtx().currentTime;
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

function scheduleChunk(ctx: AudioContext, bytes: Uint8Array, myGeneration: number) {
  if (myGeneration !== generation) return; // superseded — don't speak over the new reply
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

async function fetchAndScheduleSegment(text: string, myGeneration: number): Promise<void> {
  if (!text?.trim() || myGeneration !== generation) return;
  const ctx = getCtx();

  let res: Response;
  try {
    const t = getToken();
    res = await fetch(`${API_URL}/copilot/speak-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ text }),
    });
  } catch {
    return;
  }
  if (!res.ok || !res.body || myGeneration !== generation) return;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  try {
    while (true) {
      if (myGeneration !== generation) { try { await reader.cancel(); } catch {} return; }
      const { value, done } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      const { messages, remainder } = parseSSEFrames(buffered);
      buffered = remainder;
      for (const msg of messages) {
        if (msg.error || msg.final || !msg.audioBase64) continue;
        scheduleChunk(ctx, base64ToBytes(msg.audioBase64), myGeneration);
      }
    }
  } catch {
    // Network hiccup mid-stream — whatever already got scheduled keeps playing.
  }
}

/** Queues one segment of Mikey's reply to speak after whatever's already
 * queued in the current generation, instead of interrupting it — call
 * resetSpeech() first for a new reply, then this once per sentence/segment
 * as they become available. Silently no-ops on any failure — voice is a
 * nice-to-have, never something a caller should have to handle an error for. */
export function queueSpeechSegment(text: string): void {
  if (!text?.trim()) return;
  const myGeneration = generation;
  segmentQueue = segmentQueue.then(() => fetchAndScheduleSegment(text, myGeneration)).catch(() => {});
}

/** Speaks a single complete reply, streamed. Equivalent to resetSpeech() (interrupting
 * anything already playing) followed by one queueSpeechSegment() call — for callers
 * with the whole reply text up front rather than incremental segments. */
export function speakStreamed(text: string): void {
  resetSpeech();
  queueSpeechSegment(text);
}

export function stopSpeaking(): void {
  resetSpeech();
}
