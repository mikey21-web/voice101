import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getToken } from './api';
import { chatStream } from './streamingChat';
import { resetSpeech, queueSpeechSegment, stopSpeaking } from './streamingAudioPlayer';
import { setPendingFilter } from './pendingSearch';
import { PAGE_MAP, resolvePage } from './pageMap';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export type VoiceSessionState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface VoiceSessionListener {
  onStateChange?: (state: VoiceSessionState) => void;
  /** The user's own utterance, once Deepgram finalizes it. */
  onTranscript?: (text: string) => void;
  /** Live, unstable preview of what the user is saying mid-utterance — may be
   * revised/replaced by the next call, never a signal to act on. */
  onInterimTranscript?: (text: string) => void;
  /** Mikey's reply, updated incrementally as it streams in. */
  onReplyText?: (fullText: string) => void;
  onError?: (message: string) => void;
}

// Module-level singleton (mirrors useVoiceInput.ts's wake-word listener): the mic, the
// Deepgram-backed socket, and playback state are process-wide resources — there should
// only ever be one active session regardless of how many components render a "start
// listening" control.
let socket: Socket | null = null;
let audioCtx: AudioContext | null = null;
let micStream: MediaStream | null = null;
let processor: ScriptProcessorNode | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let silenceSink: GainNode | null = null;

let state: VoiceSessionState = 'idle';
let listeners = new Set<VoiceSessionListener>();
let chatAbort: AbortController | null = null;
let conversationId: string | undefined;

// Barge-in tuning: same RMS threshold VoiceCommandUI's tap-to-talk VAD already uses.
// Sustained-frames requirement avoids a single click/cough firing it; the grace window
// avoids Mikey's own speech onset (before echoCancellation has settled) self-triggering.
const RMS_THRESHOLD = 0.015;
const SUSTAINED_FRAMES_REQUIRED = 2; // ~2 x 256ms buffers ≈ 500ms of continuous speech
const BARGE_IN_GRACE_MS = 400;
let consecutiveLoudFrames = 0;
let speakingStartedAt = 0;

/** API_URL is sometimes a same-origin path prefix behind a reverse proxy (e.g. '/api'
 * in production, routing to the backend), not an absolute origin. Socket.io's own
 * transport path defaults to '/socket.io/' on the page's origin regardless of what
 * pathname is baked into the connection URL, so a relative prefix like '/api' silently
 * gets dropped from the handshake and the socket never reaches the backend at all.
 * Route the transport through that same prefix explicitly, and keep the namespace
 * (/realtime) separate from it. */
export function resolveSocketConfig(apiUrl: string): { url: string; path: string } {
  const isRelative = apiUrl.startsWith('/');
  return {
    url: isRelative ? '/realtime' : `${apiUrl}/realtime`,
    path: isRelative ? `${apiUrl}/socket.io/` : '/socket.io/',
  };
}

function setState(next: VoiceSessionState) {
  state = next;
  for (const l of listeners) l.onStateChange?.(next);
}

function emitError(message: string) {
  for (const l of listeners) l.onError?.(message);
}

// PCM16 conversion happens once per ~256ms audio buffer (4096 samples @ 16kHz) —
// cheap enough to not need a worklet; see startMicPipeline() for why
// ScriptProcessorNode (despite being deprecated) is used over AudioWorklet here.
export function float32ToPCM16(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

export function rms(input: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
  return Math.sqrt(sum / input.length);
}

/** Cuts off whatever Mikey is currently saying/thinking and returns to listening —
 * the same effect the RMS-based auto barge-in has, but callable directly from a
 * button so interrupting never depends on how loud/sustained your mic picked up
 * "stop" (background noise, a soft voice, or an aggressive noise-suppression
 * filter can all make automatic detection miss it). No-op outside an active
 * session. */
export function interruptSpeech(): void {
  if (state === 'idle') return;
  handleBargeIn();
}

function handleBargeIn() {
  chatAbort?.abort();
  stopSpeaking();
  consecutiveLoudFrames = 0;
  setState('listening');
}

function startMicPipeline(): void {
  // 16kHz mono, matching what Deepgram is told to expect (see deepgram.service.ts's
  // connect() query params) — creating the AudioContext at that rate lets the browser
  // do the resampling from the mic's native rate, instead of hand-rolling one.
  audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  sourceNode = audioCtx.createMediaStreamSource(micStream!);

  // ScriptProcessorNode is deprecated in favor of AudioWorklet, but AudioWorklet needs
  // a separate module file fetched and registered before use — real added complexity
  // (and a build-pipeline concern) for a feature that's already the most
  // hardware/browser-uncertain part of this whole plan. ScriptProcessorNode remains
  // universally supported despite the deprecation notice; revisit if that changes.
  processor = audioCtx.createScriptProcessor(4096, 1, 1);
  // Some browsers only pull audio through a node that's connected somewhere — route
  // through a zero-gain node instead of straight to destination so the mic is never
  // actually audible (would otherwise be an instant feedback loop).
  silenceSink = audioCtx.createGain();
  silenceSink.gain.value = 0;
  processor.connect(silenceSink);
  silenceSink.connect(audioCtx.destination);
  sourceNode.connect(processor);

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    socket?.emit('voice:audio', float32ToPCM16(input));

    if (state !== 'speaking') { consecutiveLoudFrames = 0; return; }
    if (Date.now() - speakingStartedAt < BARGE_IN_GRACE_MS) return;
    if (rms(input) > RMS_THRESHOLD) {
      consecutiveLoudFrames++;
      if (consecutiveLoudFrames >= SUSTAINED_FRAMES_REQUIRED) handleBargeIn();
    } else {
      consecutiveLoudFrames = 0;
    }
  };
}

function stopMicPipeline(): void {
  try { processor?.disconnect(); } catch {}
  try { sourceNode?.disconnect(); } catch {}
  try { silenceSink?.disconnect(); } catch {}
  processor = null;
  sourceNode = null;
  silenceSink = null;
  try { audioCtx?.close(); } catch {}
  audioCtx = null;
  micStream?.getTracks().forEach(t => t.stop());
  micStream = null;
}

async function handleFinalTranscript(text: string) {
  // A stray transcript while already mid-turn (Deepgram's own endpointing firing
  // slightly after local barge-in already moved on) isn't a new command.
  if (state !== 'listening' || !text.trim()) return;

  setState('thinking');
  for (const l of listeners) l.onTranscript?.(text);

  resetSpeech();
  chatAbort = new AbortController();
  let spoke = false;

  try {
    const res = await chatStream(text, conversationId, {
      onTextUpdate: (fullText) => { for (const l of listeners) l.onReplyText?.(fullText); },
      onSegment: (segment) => {
        if (!spoke) { spoke = true; setState('speaking'); speakingStartedAt = Date.now(); }
        queueSpeechSegment(segment);
      },
    }, chatAbort.signal);

    if (res.conversationId) conversationId = res.conversationId;

    const nav = (res.actions || []).find((a: any) => a.tool === 'navigate_ui' && a.status !== 'error');
    if (nav) {
      const page = resolvePage(nav.args.page);
      setPendingFilter(page, { filters: nav.args.filters, highlightId: nav.args.highlightId, zoom: nav.args.zoom, summary: nav.args.summary });
      window.location.hash = PAGE_MAP[page] || '/' + page;
    }
  } catch (err: any) {
    emitError(err.message || 'Mikey had trouble replying.');
  }

  // If nothing was ever spoken (empty/error reply), there's no playback to wait out —
  // go straight back to listening rather than sitting in 'speaking' with no audio.
  if (!spoke && (state as VoiceSessionState) !== 'listening') setState('listening');
}

/** Starts a continuous-listening session: opens the mic, connects to the Deepgram-backed
 * socket channel, and streams audio the whole time the session is active — including
 * while Mikey is talking, which is what makes barge-in possible (see startMicPipeline's
 * local VAD check). Ends any prior session first. */
export async function startVoiceSession(): Promise<void> {
  if (state !== 'idle') stopVoiceSession();

  const token = getToken();
  if (!token) { emitError('Not signed in.'); return; }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch {
    emitError('Microphone permission denied.');
    return;
  }
  micStream = stream;

  const socketConfig = resolveSocketConfig(API_URL);
  socket = io(socketConfig.url, {
    auth: { token },
    transports: ['websocket'],
    path: socketConfig.path,
  });

  socket.on('connect', () => socket?.emit('voice:start'));
  socket.on('voice:started', () => { startMicPipeline(); setState('listening'); });
  socket.on('voice:transcript', ({ text }: { text: string }) => { handleFinalTranscript(text); });
  socket.on('voice:interim', ({ text }: { text: string }) => {
    if (state === 'listening') for (const l of listeners) l.onInterimTranscript?.(text);
  });
  socket.on('voice:error', ({ message }: { message: string }) => emitError(message));
  socket.on('connect_error', (err: Error) => emitError(`Couldn't connect: ${err.message}`));
  socket.on('disconnect', () => { if (state !== 'idle') stopVoiceSession(); });
}

export function stopVoiceSession(): void {
  chatAbort?.abort();
  stopSpeaking();
  stopMicPipeline();
  try { socket?.emit('voice:stop'); } catch {}
  try { socket?.disconnect(); } catch {}
  socket = null;
  consecutiveLoudFrames = 0;
  setState('idle');
}

export function addVoiceSessionListener(listener: VoiceSessionListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getVoiceSessionState(): VoiceSessionState {
  return state;
}

/** React binding for the module-level session singleton — reactive state plus
 * transcript/reply text, for a component that wants to render a continuous-listening
 * UI (mic state indicator, live transcript, live reply). */
export function useVoiceSession() {
  const [sessionState, setSessionState] = useState<VoiceSessionState>(getVoiceSessionState());
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [replyText, setReplyText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return addVoiceSessionListener({
      onStateChange: (s) => {
        setSessionState(s);
        if (s === 'listening') { setTranscript(''); setInterimTranscript(''); setReplyText(''); }
      },
      onTranscript: (t) => { setTranscript(t); setInterimTranscript(''); },
      onInterimTranscript: setInterimTranscript,
      onReplyText: setReplyText,
      onError: setError,
    });
  }, []);

  const start = useCallback(() => { setError(null); startVoiceSession(); }, []);
  const stop = useCallback(() => stopVoiceSession(), []);
  const interrupt = useCallback(() => interruptSpeech(), []);

  return { state: sessionState, transcript, interimTranscript, replyText, error, start, stop, interrupt };
}
