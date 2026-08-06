import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Sparkles, Ear, EarOff, Radio } from 'lucide-react';
import { setPendingFilter } from '../lib/pendingSearch';
import { apiUpload } from '../lib/api';
import { getSocket } from '../lib/realtime';
import { useVoiceInput } from '../lib/useVoiceInput';
import { PAGE_MAP, PAGE_ALIASES, fuzzyPageMatch, resolvePage, canonical } from '../lib/pageMap';
import { speakStreamed, resetSpeech, queueSpeechSegment, stopSpeaking, waitUntilDoneSpeaking } from '../lib/streamingAudioPlayer';
import { chatStream } from '../lib/streamingChat';
import { useVoiceSession } from '../lib/voiceSession';

// MediaRecorder only produces WebM/Opus (or MP4 on Safari), but the self-hosted
// Moonshine transcriber decodes with libsndfile, which cannot read either
// container — so every voice command failed at the first transcription hop and
// only recovered if a paid Sarvam/OpenAI key was configured. Decoding to 16 kHz
// mono PCM WAV here (the rate ASR models want anyway) makes the free, always-on
// path work and shrinks the upload about 3x.
export function encodeWav(samples: Float32Array, rate: number): ArrayBuffer {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);          // PCM header size
  view.setUint16(20, 1, true);           // format: PCM
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);    // byte rate
  view.setUint16(32, 2, true);           // block align
  view.setUint16(34, 16, true);          // bits per sample
  ascii(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return view.buffer;
}

async function toWav16k(blob: Blob): Promise<Blob> {
  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    ctx.close().catch(() => {});
  }

  const rate = 16000;
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const samples = (await offline.startRendering()).getChannelData(0);
  return new Blob([encodeWav(samples, rate)], { type: 'audio/wav' });
}

function navigateTo(page: string) {
  const resolved = PAGE_ALIASES[page] || page;
  const path = PAGE_MAP[resolved];
  if (!path) return false;
  setPendingFilter(resolved, {});
  window.location.hash = path;
  return true;
}

// A sentence that mentions a page name isn't necessarily a "go there" command —
// "how many leads do we have" contains "leads" but is a question, not
// navigation. Route anything question-shaped straight to the AI instead of
// silently treating it as "show me leads".
const QUESTION_PATTERN = /\?\s*$|^(how|what|why|when|who|which|is|are|do|does|can|could|will|should|would)\b/i;

const NAV_VERB = /^(?:show\s+me|show|go\s+to|go|open|navigate\s+to|navigate|take\s+me\s+to|jump\s+to|switch\s+to|pull\s+up|bring\s+up|view)\s+/i;

export function matchCommand(text: string): { page: string; filter?: string } | null {
  if (QUESTION_PATTERN.test(text.trim())) return null;
  const raw = text.toLowerCase().trim().replace(/[.!,]+$/, '');
  const t = raw.replace(NAV_VERB, '').replace(/^(?:the|my|all)\s+/, '');
  const words = t.split(/\s+/);
  // Only shortcut past the AI for an explicit navigation phrase or a bare page
  // name. Anything else ("call ravi back", "draft a follow up") is a real
  // request the copilot should reason about, not a page to jump to.
  if (!NAV_VERB.test(raw) && words.length > 2) return null;

  // Check for "[filter] [page]" pattern
  const filters = ['hot', 'warm', 'cold', 'new', 'open', 'converted', 'lost', 'qualified', 'urgent', 'high', 'medium', 'low'];
  if (words.length >= 2 && filters.includes(words[0])) {
    const page = words.slice(1).join(' ');
    const fuzzy = fuzzyPageMatch(page);
    if (fuzzy) return { page: canonical(fuzzy), filter: words[0] };
  }

  // Try fuzzy matching the whole thing
  const fuzzy = fuzzyPageMatch(t);
  if (fuzzy) return { page: canonical(fuzzy) };

  return null;
}

export default function VoiceCommandUI() {
  const [supported, setSupported] = useState(false);
  const [whisperMode, setWhisperMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [mode, setMode] = useState<'idle' | 'listening' | 'copilot'>('idle');
  // Live, still-being-said preview while the browser recognizer is listening —
  // separate from `result` (the finished transcript/answer), which takes render
  // priority in the JSX below and would otherwise hide the listening/waveform UI
  // the instant this got set.
  const [interimText, setInterimText] = useState('');
  // Guards startListening() against firing twice for one press — React's `listening`
  // state hasn't re-rendered yet between two rapid keydown events (OS key-repeat on
  // a held Ctrl+H, or a fast double-tap), so both would otherwise see the same stale
  // `listening === false` and each spin up its own SpeechRecognition/MediaRecorder —
  // two independent listeners hearing the same utterance, each replying and
  // speaking on its own. A ref updates synchronously, closing that window.
  const startingRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const resultTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Silence-detection + hard-cap so the recorder auto-sends when you stop
  // talking and can never hang open waiting for a manual stop.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const rafRef = useRef<number>(0);
  // Browser recognizer running in parallel with the recording, as a fallback
  // transcript source when server transcription yields nothing.
  const shadowRef = useRef<any>(null);
  const shadowTextRef = useRef<string>('');
  // Lets a manual Stop actually cancel the in-flight chatStream() request, not just
  // stop playing whatever's already been spoken — mirrors voiceSession.ts's chatAbort.
  const chatAbortRef = useRef<AbortController | null>(null);

  // Phase 3: continuous listening (always-on mic, live transcription, can be
  // talked over mid-reply) — see lib/voiceSession.ts. Independent of the
  // tap-to-talk / wake-word flow below; only one would realistically be
  // active at a time, but nothing here prevents both existing side by side.
  const voiceSession = useVoiceSession();

  const [wakeWordOn, setWakeWordOn] = useState(() => localStorage.getItem('mikeyWakeWordOn') !== 'false');
  const [userCaption, setUserCaption] = useState('');
  const [mikeyCaption, setMikeyCaption] = useState('');
  const wakeWord = useVoiceInput();

  // Reuses the same voice-on preference the Mikey chat page uses, so turning
  // voice on/off in one place applies everywhere Mikey talks. Voice is on
  // unless explicitly turned off — a voice command that answers silently
  // reads as "nothing happened". Streams via speakStreamed() instead of
  // waiting for the whole clip — see lib/streamingAudioPlayer.ts.
  const speakReply = useCallback((text: string) => {
    if (localStorage.getItem('mikeyVoiceOn') === 'false' || !text?.trim()) return;
    speakStreamed(text);
  }, []);

  useEffect(() => {
    const hasWhisperPath = !!(navigator.mediaDevices?.getUserMedia && (window as any).MediaRecorder);
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    // Prefer the browser's own SpeechRecognition when available: it's a single
    // API with sole access to the mic. The record-and-upload path additionally
    // ran a "shadow" SpeechRecognition alongside MediaRecorder as a fallback,
    // which meant two consumers fighting over the same microphone on every
    // single command — and since server transcription needs a configured STT
    // backend (Moonshine/Sarvam/Whisper) that isn't always deployed, that
    // contended fallback was actually the only path most commands had.
    // Recording+upload is now the fallback for browsers without SpeechRecognition.
    setWhisperMode(hasWhisperPath && !Ctor);
    setSupported(hasWhisperPath || !!Ctor);
  }, []);

  useEffect(() => {
    if (!result) return;
    resultTimer.current = setTimeout(() => setResult(null), 4000);
    return () => clearTimeout(resultTimer.current);
  }, [result]);

  // Shared downstream handling for a transcript, whichever engine produced it.
  const handleTranscript = useCallback((text: string) => {
    setMode('copilot');
    setUserCaption(text);
    setMikeyCaption('');

    const cmd = matchCommand(text);
    if (cmd) {
      const filters: Record<string, string> = {};
      const filterMap: Record<string, string> = {
        hot: 'HOT', warm: 'WARM', cold: 'COLD', new: 'NEW',
        open: 'OPEN', converted: 'CONVERTED', lost: 'LOST',
        urgent: 'URGENT', high: 'HIGH',
      };
      if (cmd.filter && filterMap[cmd.filter]) {
        filters.segment = filterMap[cmd.filter];
      }
      setPendingFilter(cmd.page, { filters: Object.keys(filters).length ? filters : undefined });
      window.location.hash = PAGE_MAP[cmd.page];
      const spoken = `Showing ${cmd.page}${cmd.filter ? ', ' + cmd.filter : ''}`;
      setMikeyCaption(spoken);
      setResult(spoken);
      speakReply(spoken);
      waitUntilDoneSpeaking().finally(() => {
        setMode('idle');
        setListening(false);
        setUserCaption('');
        setMikeyCaption('');
        if (wakeWordOn) wakeWord.start();
      });
      return;
    }

    if (localStorage.getItem('mikeyVoiceOn') !== 'false') resetSpeech();
    let liveReply = '';
    const controller = new AbortController();
    chatAbortRef.current = controller;
    chatStream(text, undefined, {
      onSegment: (segment) => {
        if (localStorage.getItem('mikeyVoiceOn') !== 'false') queueSpeechSegment(segment);
        liveReply += (liveReply ? ' ' : '') + segment;
        setMikeyCaption(liveReply);
        setResult(liveReply);
      },
    }, controller.signal).then((res) => {
      const nav = (res.actions || []).find((a: any) => a.tool === 'navigate_ui' && a.status !== 'error');
      if (nav) {
        const page = resolvePage(nav.args.page);
        setPendingFilter(page, { filters: nav.args.filters, highlightId: nav.args.highlightId, zoom: nav.args.zoom, summary: nav.args.summary });
        window.location.hash = PAGE_MAP[page] || '/' + page;
        const summary = nav.args.summary || `Navigated to ${page}`;
        setMikeyCaption(summary);
        setResult(summary);
      } else {
        const reply = res.reply || 'Done';
        setMikeyCaption(reply);
        setResult(reply);
      }
    }).catch(() => {
      setMikeyCaption("Couldn't reach Mikey. Check your connection.");
      setResult("Couldn't reach Mikey. Check your connection.");
    }).finally(() => {
      setMode('idle');
      setListening(false);
      if (wakeWordOn) wakeWord.start();
    });
  }, [wakeWordOn, wakeWord, speakReply]);

  const startBrowserRecognition = useCallback(() => {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) { startingRef.current = false; setResult('Voice input not supported in this browser'); return; }

    const r = new Ctor();
    // continuous:true + a silence-based stop (below) instead of continuous:false,
    // which ended the whole recognition after the FIRST pause — cutting off any
    // command with a natural pause in the middle ("show me... hot leads").
    r.continuous = true;
    // Was false, which meant zero feedback of what the mic was hearing until the
    // whole recognition ended — you'd get either a final answer or "Didn't catch
    // that" with nothing in between. Interim results give a live, still-being-said
    // caption (see onresult below) the same way the continuous-session mode
    // already has via Deepgram.
    r.interimResults = true;
    r.lang = 'en-US';

    let finalText = '';
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    const armAutoStop = (ms: number) => {
      if (stopTimer) clearTimeout(stopTimer);
      stopTimer = setTimeout(() => { try { r.stop(); } catch {} }, ms);
    };

    // The very first arm (onstart, before any speech exists) has to cover reaction
    // time to the "Listening..." indicator plus the browser's own mic/recognition
    // startup lag, not just silence — 2.5s there was cutting people off with zero
    // captured text before they'd even finished their first sentence. Once a result
    // has actually come back, tighten back to 2.5s of real silence to auto-send.
    r.onstart = () => { startingRef.current = false; setListening(true); setMode('listening'); setInterimText(''); armAutoStop(6000); };
    r.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' ';
        else interim += e.results[i][0].transcript;
      }
      setInterimText((finalText + interim).trim());
      armAutoStop(2500);
    };
    let lastErrorReason: string | null = null;
    r.onerror = (e: any) => {
      // Always log the real reason — this was being silently thrown away for
      // 'aborted'/'no-speech', which is why repeated "Didn't catch that" reports
      // couldn't be diagnosed any further than "the mic didn't work." Chrome's
      // SpeechRecognition is cloud-based (audio goes to Google's servers), so
      // 'network' here specifically means that request never got a response —
      // not a local mic problem at all, and no code-side timing fix can address it.
      console.warn('[VoiceCommandUI] SpeechRecognition error:', e.error);
      lastErrorReason = e.error;
      // 'no-speech' (silence until timeout) and 'aborted' (stopped manually,
      // or a fresh start cut off the previous session) are routine, not
      // failures — surfacing "Microphone error" for either was overwriting a
      // clean stop or empty attempt with a scary, wrong message every time.
      if (e.error === 'aborted' || e.error === 'no-speech') return;
      setResult(`Microphone error: ${e.error}. Check permissions and network.`);
    };
    r.onend = () => {
      if (stopTimer) clearTimeout(stopTimer);
      recognitionRef.current = null;
      setListening(false);
      setMode('idle');
      setInterimText('');
      const text = finalText.trim();
      if (text) handleTranscript(text);
      // Distinguish "Chrome's own recognizer reported no-speech / network failure"
      // from "recognition ran clean but produced literally nothing" — same visible
      // failure, different root cause, and without this the message alone gives no
      // way to tell "mic isn't picking anything up" apart from "reached Google's
      // speech service and it timed out."
      else if (lastErrorReason === 'network') setResult("Couldn't reach the speech recognition service — check your internet connection (this runs through Google's servers, not locally).");
      else if (lastErrorReason === 'no-speech') setResult("No speech detected — check the correct microphone is selected/unmuted at the OS level, then try again.");
      else setResult("Didn't catch that — tap the mic and speak.");
      if (wakeWordOn) wakeWord.start();
    };

    recognitionRef.current = r;
    try { r.start(); } catch { startingRef.current = false; recognitionRef.current = null; setResult('Failed to start microphone.'); }
  }, [handleTranscript, wakeWordOn, wakeWord]);

  // Press-to-talk + Whisper: a clean start/stop recording is transcribed
  // server-side, which catches full sentences the browser's live recognizer
  // routinely cuts off or mishears. Auto-stops ~2.5s after you stop talking,
  // and hard-stops at 20s so it can never hang open.
  //
  // The browser recognizer runs *alongside* the recording as a safety net:
  // if server transcription is unconfigured, times out, or comes back empty,
  // we use whatever the browser heard instead of telling the user
  // "didn't catch that" when they in fact spoke perfectly clearly.
  const startWhisperRecording = useCallback(async () => {
    const startShadowRecognition = () => {
      const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!Ctor) return;
      shadowTextRef.current = '';
      try {
        const sr = new Ctor();
        sr.continuous = true;
        sr.interimResults = true;
        sr.lang = 'en-US';
        sr.onresult = (e: any) => {
          let text = '';
          for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript + ' ';
          shadowTextRef.current = text.trim();
        };
        sr.onerror = () => {};
        shadowRef.current = sr;
        sr.start();
      } catch { shadowRef.current = null; }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        // Tear down all the listening machinery before we do anything else.
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        try { await audioCtxRef.current?.close(); } catch {}
        audioCtxRef.current = null;
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        try { shadowRef.current?.stop(); } catch {}
        shadowRef.current = null;
        recorderRef.current = null;
        setMode('copilot');

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        let text = '';
        // Server transcription first (better accuracy), browser recognizer as
        // the fallback whenever it returns nothing or fails outright.
        if (blob.size >= 500) {
          try {
            // If the browser can't decode its own recording, send the raw blob
            // and let the server's Sarvam/Whisper fallbacks try it.
            let upload = blob;
            let name = 'command.webm';
            try {
              upload = await toWav16k(blob);
              name = 'command.wav';
            } catch { /* keep the original container */ }
            const formData = new FormData();
            formData.append('audio', upload, name);
            const res = await apiUpload('/copilot/voice-transcribe', formData);
            text = (res?.text || '').trim();
          } catch { /* fall through to the browser transcript */ }
        }
        // Give a final browser result a beat to land if it hasn't yet.
        if (!text && !shadowTextRef.current) await new Promise(r => setTimeout(r, 600));
        if (!text) text = shadowTextRef.current.trim();

        if (text) {
          handleTranscript(text);
        } else {
          setResult("Didn't catch that — tap the mic and speak.");
          setListening(false);
          setMode('idle');
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      startShadowRecognition();
      startingRef.current = false;
      setListening(true);
      setMode('listening');

      // Hard cap: stop after 20s no matter what.
      maxTimerRef.current = setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
          recorderRef.current = null;
        }
      }, 20000);

      // Silence detection: watch the mic level, and once it stays quiet for
      // ~1.5s (after the person has actually started talking), auto-stop.
      try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        let hasSpoken = false;

        const tick = () => {
          if (!audioCtxRef.current) return;
          analyser.getByteTimeDomainData(data);
          // Root-mean-square deviation from the 128 midpoint = rough loudness.
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          // Low threshold on purpose: quiet mics and soft speakers were never
          // registering as "spoken", so the clip only ended at the hard cap.
          const SPEAKING = rms > 0.015;

          if (SPEAKING) {
            hasSpoken = true;
            if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = undefined; }
          } else if (hasSpoken && !silenceTimerRef.current) {
            // Gone quiet after speaking — arm the auto-stop. 2.5s so a pause
            // mid-sentence doesn't truncate the command.
            silenceTimerRef.current = setTimeout(() => {
              if (recorderRef.current && recorderRef.current.state !== 'inactive') {
                recorderRef.current.stop();
                recorderRef.current = null;
              }
            }, 2500);
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        // AudioContext unavailable — the 15s cap + manual Tap to send still work.
      }
    } catch {
      startingRef.current = false;
      setResult('Microphone permission denied.');
    }
  }, [handleTranscript]);

  const startListening = useCallback(() => {
    if (startingRef.current || listening || recognitionRef.current || recorderRef.current) return;
    startingRef.current = true;
    if (wakeWordOn) wakeWord.stop();
    if (whisperMode) startWhisperRecording();
    else startBrowserRecognition();
  }, [listening, whisperMode, startWhisperRecording, startBrowserRecognition, wakeWordOn, wakeWord]);

  // "Okay Mikey" hands-free mode: runs a background SpeechRecognition
  // listener (useVoiceInput) that only reacts after hearing the wake phrase,
  // feeding whatever comes after it into the same handleTranscript pipeline
  // press-to-talk uses. Toggled separately since it's opt-in (always-on mic).
  const toggleWakeWord = useCallback(() => {
    setWakeWordOn(prev => {
      const next = !prev;
      localStorage.setItem('mikeyWakeWordOn', String(next));
      if (next) wakeWord.start(); else wakeWord.stop();
      return next;
    });
  }, [wakeWord]);

  useEffect(() => {
    if (wakeWordOn) wakeWord.start();
    return () => { wakeWord.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!wakeWord.transcript) return;
    const text = wakeWord.transcript;
    wakeWord.clearTranscript();
    handleTranscript(text);
  }, [wakeWord.transcript, handleTranscript, wakeWord]);

  // Two independent always-listening mics (wake word + continuous conversation)
  // both reacting to the same utterance meant two separate replies got generated
  // and spoken over each other. Also pause wake word for the duration of any
  // Mikey reply (mode === 'copilot', tap-to-talk/wake-word path) — the wake-word
  // recognizer has no echo cancellation of its own, so left running while Mikey
  // talks it can hear Mikey's own voice through the speakers and re-send it as a
  // new "command", the actual cause of a self-triggering loop with no real input
  // ever getting through. Resume only once fully idle again.
  useEffect(() => {
    if (voiceSession.state !== 'idle' || mode === 'copilot') { wakeWord.stop(); return; }
    if (wakeWordOn) wakeWord.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceSession.state, mode]);

  const stopListening = useCallback(() => {
    // Whisper path: leave listening/mode alone here — recorder.onstop owns
    // the transition once transcription finishes, so the "Thinking..." bar
    // stays visible instead of flashing back to idle mid-request.
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      recorderRef.current = null;
      return;
    }
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;
    setListening(false);
    setMode('idle');
    if (wakeWordOn) wakeWord.start();
  }, [wakeWordOn, wakeWord]);

  /** Cuts off Mikey mid-thought or mid-sentence: cancels the in-flight chatStream
   * request (not just the audio already playing) and returns to idle. This is the
   * tap-to-talk/wake-word equivalent of voiceSession.ts's interruptSpeech() — that
   * one only covers the continuous Radio-button session, and this flow had no
   * interrupt at all once a reply started generating. */
  const stopMikey = useCallback(() => {
    chatAbortRef.current?.abort();
    stopSpeaking();
    setResult(null);
    setMode('idle');
    setListening(false);
    setUserCaption('');
    setMikeyCaption('');
  }, []);

  // Proactive alerts — Mikey speaks up when business events happen (hot lead, new lead, etc.)
  // Only fires when not already listening/speaking so it doesn't interrupt an active session.
  useEffect(() => {
    const sock = getSocket();
    if (!sock) return;
    const handler = (data: { type: string; message: string }) => {
      if (localStorage.getItem('mikeyVoiceOn') === 'false') return;
      if (mode !== 'idle' || voiceSession.state !== 'idle') return;
      setMikeyCaption(data.message);
      setResult(data.message);
      speakStreamed(data.message);
      waitUntilDoneSpeaking().finally(() => {
        setMikeyCaption('');
        setResult(null);
      });
    };
    sock.on('mikey:alert', handler);
    return () => { sock.off('mikey:alert', handler); };
  }, [mode, voiceSession.state]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'h' && e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (result) { setResult(null); return; }
        if (listening) stopListening(); else startListening();
      }
      if (e.key === 'Escape') { setResult(null); stopListening(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [listening, result, startListening, stopListening]);

  if (!supported) return null;

  if (voiceSession.state !== 'idle') {
    const stateLabel = {
      listening: 'Listening... say something, or talk over Mikey anytime',
      thinking: 'Thinking...',
      speaking: 'Speaking... just start talking to interrupt',
    }[voiceSession.state];
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-fade-up flex flex-col items-center gap-2 max-w-lg w-full mx-4">
        {(voiceSession.transcript || voiceSession.interimTranscript || voiceSession.replyText) && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 shadow-2xl flex flex-col gap-2 w-full pointer-events-none">
            {/* Live, still-being-said preview — replaced by the finalized transcript
                once Deepgram commits to it (see onTranscript clearing interim). */}
            {!voiceSession.transcript && voiceSession.interimTranscript && (
              <div className="flex items-start gap-2">
                <Mic size={14} className="text-[var(--primary)] mt-0.5 shrink-0 animate-pulse" />
                <p className="text-xs text-[var(--muted-foreground)] italic">{voiceSession.interimTranscript}</p>
              </div>
            )}
            {voiceSession.transcript && (
              <div className="flex items-start gap-2">
                <Mic size={14} className="text-[var(--primary)] mt-0.5 shrink-0" />
                <p className="text-xs text-[var(--muted-foreground)]">{voiceSession.transcript}</p>
              </div>
            )}
            {voiceSession.replyText && (
              <div className="flex items-start gap-2">
                <Sparkles size={16} className="text-[var(--primary)] mt-0.5 shrink-0" />
                <p className="text-sm text-[var(--foreground)] leading-relaxed flex-1">{voiceSession.replyText}</p>
              </div>
            )}
          </div>
        )}
        <div className="rounded-full border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 shadow-2xl flex items-center gap-3">
          <div className="flex items-end gap-0.5 h-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`w-1 rounded-full bg-[var(--primary)] ${voiceSession.state === 'thinking' ? 'animate-pulse' : ''}`} style={{ height: `${20 + Math.random() * 60}%` }} />
            ))}
          </div>
          <span className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">{stateLabel}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        </div>
        {voiceSession.error && (
          <p className="text-xs text-red-500">{voiceSession.error}</p>
        )}
        <div className="flex items-center gap-2">
          {/* Guaranteed interrupt — doesn't depend on the mic picking up "stop" loud
              enough to trip the automatic barge-in detector. Only meaningful while
              Mikey is actually talking or working on a reply. */}
          {(voiceSession.state === 'speaking' || voiceSession.state === 'thinking') && (
            <button
              onClick={voiceSession.interrupt}
              className="flex items-center gap-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] px-5 py-3 shadow-2xl active:scale-95 transition-transform"
            >
              <MicOff size={18} />
              <span className="text-sm font-medium">Stop</span>
            </button>
          )}
          <button
            onClick={voiceSession.stop}
            className="flex items-center gap-2 rounded-full bg-[var(--primary)] text-white px-6 py-3 shadow-2xl active:scale-95 transition-transform"
          >
            <Radio size={18} />
            <span className="text-sm font-medium">End conversation</span>
          </button>
        </div>
      </div>
    );
  }

  // Subtitle panel — shown whenever there's user speech or Mikey's reply to display.
  // Both captions live independently so they can appear/disappear at their own pace.
  if ((userCaption || mikeyCaption || mode === 'copilot') && voiceSession.state === 'idle') {
    return (
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] max-w-2xl w-full px-4 animate-fade-up flex flex-col items-center gap-2 [body.mikey-panel-open_&]:hidden">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/95 backdrop-blur px-5 py-4 shadow-2xl flex flex-col gap-3 w-full">
          {/* User caption — what the user said */}
          {userCaption && (
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5">
                <Mic size={12} className="text-[var(--primary)]" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-0.5">You</p>
                <p className="text-sm text-[var(--foreground)]">{userCaption}</p>
              </div>
            </div>
          )}
          {/* Mikey caption — streaming reply */}
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles size={12} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-semibold text-[var(--primary)] uppercase tracking-wide mb-0.5">Mikey</p>
              {mikeyCaption
                ? <p className="text-sm text-[var(--foreground)] leading-relaxed">{mikeyCaption}</p>
                : <div className="flex items-center gap-1 mt-1">{[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />)}</div>
              }
            </div>
          </div>
        </div>
        {/* Stop button — always reachable while Mikey is active */}
        {mode === 'copilot' && (
          <button
            onClick={stopMikey}
            className="flex items-center gap-2 rounded-full bg-red-500 text-white px-5 py-2 shadow-xl active:scale-95 transition-transform text-sm font-medium"
          >
            <MicOff size={15} />
            Stop Mikey
          </button>
        )}
      </div>
    );
  }

  if (listening || mode === 'copilot') {
    const thinking = mode === 'copilot';
    return (
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] animate-fade-up flex flex-col items-center gap-2 max-w-2xl w-full px-4">
        {/* Live subtitle panel — user speech + Mikey's thinking state */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/95 backdrop-blur px-5 py-4 shadow-2xl flex flex-col gap-3 w-full">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5">
              <Mic size={12} className={`text-[var(--primary)] ${!thinking ? 'animate-pulse' : ''}`} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-0.5">You</p>
              <p className="text-sm text-[var(--foreground)] min-h-[1.25rem]">
                {interimText || (thinking ? userCaption : <span className="italic text-[var(--muted-foreground)]">Listening...</span>)}
              </p>
            </div>
          </div>
          {thinking && (
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles size={12} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[var(--primary)] uppercase tracking-wide mb-0.5">Mikey</p>
                <div className="flex items-center gap-1 mt-1">{[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />)}</div>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={thinking ? stopMikey : stopListening}
          className="flex items-center gap-2 rounded-full bg-red-500 text-white px-6 py-3 shadow-2xl active:scale-95 transition-transform"
        >
          <MicOff size={18} />
          <span className="text-sm font-medium">{thinking ? 'Stop Mikey' : 'Tap to send'}</span>
        </button>
      </div>
    );
  }

  // Idle state — persistent bottom bar so Mikey's status is always visible
  const stopEverything = useCallback(() => {
    chatAbortRef.current?.abort();
    stopSpeaking();
    stopListening();
    voiceSession.stop();
    wakeWord.stop();
    setResult(null);
    setMode('idle');
    setListening(false);
    setWakeWordOn(false);
    localStorage.setItem('mikeyWakeWordOn', 'false');
  }, [stopListening, voiceSession, wakeWord]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9990] [body.overlay-open_&]:hidden [body.mikey-panel-open_&]:hidden">
      <div className="mx-auto max-w-2xl px-4 pb-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/95 backdrop-blur shadow-2xl px-4 py-2.5 flex items-center gap-3">
          {/* Status dot */}
          <span className={`w-2 h-2 rounded-full shrink-0 ${wakeWordOn ? 'bg-emerald-500 animate-pulse' : 'bg-[var(--muted-foreground)] opacity-40'}`} />

          {/* Mikey label + status */}
          <span className="text-xs font-semibold text-[var(--foreground)] shrink-0">Mikey</span>
          <span className="text-xs text-[var(--muted-foreground)] flex-1 truncate">
            {wakeWordOn ? 'Listening for "Okay Mikey"...' : 'Voice off — tap mic or say "Okay Mikey"'}
          </span>

          {/* Tap-to-talk */}
          <button
            onClick={startListening}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--primary)] text-white hover:opacity-90 active:scale-95 transition-all shrink-0"
            title="Tap to talk (Ctrl+H)"
          >
            <Mic size={14} />
          </button>

          {/* Wake word toggle */}
          <button
            onClick={toggleWakeWord}
            className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all shrink-0 ${
              wakeWordOn ? 'bg-emerald-500 text-white border-transparent' : 'bg-[var(--accent)] text-[var(--muted-foreground)] border-[var(--border)]'
            }`}
            title={wakeWordOn ? 'Wake word ON — click to disable' : 'Enable "Okay Mikey" wake word'}
          >
            {wakeWordOn ? <Ear size={14} /> : <EarOff size={14} />}
          </button>

          {/* Continuous conversation */}
          <button
            onClick={() => { wakeWord.stop(); voiceSession.start(); }}
            className="w-8 h-8 rounded-full flex items-center justify-center border bg-[var(--accent)] text-[var(--muted-foreground)] border-[var(--border)] hover:bg-[var(--primary)] hover:text-white transition-all shrink-0"
            title="Start always-on conversation"
          >
            <Radio size={14} />
          </button>

          {/* Kill switch — stops everything */}
          <button
            onClick={stopEverything}
            className="w-8 h-8 rounded-full flex items-center justify-center border border-red-200 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shrink-0"
            title="Stop Mikey completely"
          >
            <MicOff size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
