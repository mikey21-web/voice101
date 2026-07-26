import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Sparkles, Ear, EarOff } from 'lucide-react';
import { setPendingFilter } from '../lib/pendingSearch';
import { api, apiUpload } from '../lib/api';
import { useVoiceInput } from '../lib/useVoiceInput';

const PAGE_MAP: Record<string, string> = {
  leads: '/leads', contacts: '/contacts', tickets: '/tickets',
  campaigns: '/campaigns', analytics: '/analytics', mikey: '/mikey',
  pipeline: '/pipeline', overview: '/', crm: '/crm', inbox: '/messages',
  'qr-codes': '/qr-codes', qr: '/qr-codes', qrcodes: '/qr-codes',
  settings: '/settings', events: '/events', bookings: '/bookings',
  conversions: '/conversions', reports: '/reports', tasks: '/tasks',
  properties: '/properties', shipments: '/shipments', flows: '/flows',
  invoices: '/invoices', quotations: '/quotations', contracts: '/contracts',
  team: '/team', timesheet: '/timesheet', inventory: '/inventory',
  'purchase-orders': '/purchase-orders', 'vendor-bookings': '/vendor-bookings',
  media: '/media', templates: '/templates',
  scoring: '/scoring', routing: '/routing', webhooks: '/webhooks',
  forms: '/forms', 'sync-logs': '/sync-logs', 'audit-logs': '/audit-logs',
  health: '/health', import: '/import', advanced: '/advanced',
};

const PAGE_ALIASES: Record<string, string> = {
  'qr code': 'qr-codes', 'qr codes': 'qr-codes',
  settings: 'settings', 'setting': 'settings',
  integrations: 'integrations', events: 'events', event: 'events',
  campaign: 'campaigns', ticket: 'tickets', support: 'tickets',
  contact: 'contacts', task: 'tasks', team: 'team',
  reports: 'reports', report: 'reports',
  dashboard: 'overview', home: 'overview', inbox: 'inbox',
};

// Fuzzy match a potentially messy transcript against known page names.
// Handles typos, slurred speech, abbreviations, and partial matches.
function fuzzyPageMatch(text: string): string | null {
  const known = Object.entries(PAGE_MAP);
  const lower = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '');
  const words = lower.split(/\s+/).filter(Boolean);

  // Direct or alias match first
  for (const w of words) {
    if (PAGE_MAP[w]) return w;
    const aliased = PAGE_ALIASES[w];
    if (aliased && PAGE_MAP[aliased]) return aliased;
  }

  // Fuzzy: for each known page name, check if the input text contains
  // a word with high character overlap (handles "whsirpflow" -> "workflow")
  for (const [name] of known) {
    const normalized = name.replace(/[^a-z0-9]/g, '');
    if (normalized.length < 2) continue;
    for (const w of words) {
      if (w.length < 2) continue;
      // word is substring of page name or vice versa
      if (normalized.includes(w) || w.includes(normalized)) return name;
      // character overlap > 60% = likely typo/mispronunciation
      const overlap = [...new Set([...w])].filter(c => normalized.includes(c)).length;
      const maxLen = Math.max(w.length, normalized.length);
      if (overlap / maxLen > 0.6) return name;
    }
    // Check if most characters of the page name appear in order in the text
    let ci = 0;
    for (const ch of lower) {
      if (ch === normalized[ci]) ci++;
      if (ci === normalized.length) return name;
    }
  }

  return null;
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

function matchCommand(text: string): { page: string; filter?: string } | null {
  if (QUESTION_PATTERN.test(text.trim())) return null;
  const t = text.toLowerCase().trim().replace(/^(?:show\s+me|go\s+to|open|navigate\s+to|navigate|take\s+me\s+to)\s+/i, '');
  const words = t.split(/\s+/);

  // Check for "[filter] [page]" pattern
  const filters = ['hot', 'warm', 'cold', 'new', 'open', 'converted', 'lost', 'qualified', 'urgent', 'high', 'medium', 'low'];
  if (words.length >= 2 && filters.includes(words[0])) {
    const page = words.slice(1).join(' ');
    const fuzzy = fuzzyPageMatch(page);
    if (fuzzy) return { page: fuzzy, filter: words[0] };
  }

  // Try fuzzy matching the whole thing
  const fuzzy = fuzzyPageMatch(t);
  if (fuzzy) return { page: fuzzy };

  return null;
}

export default function VoiceCommandUI() {
  const [supported, setSupported] = useState(false);
  const [whisperMode, setWhisperMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [mode, setMode] = useState<'idle' | 'listening' | 'copilot'>('idle');
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

  const [wakeWordOn, setWakeWordOn] = useState(() => localStorage.getItem('mikeyWakeWordOn') === 'true');
  const wakeWord = useVoiceInput();
  const speakAudioRef = useRef<HTMLAudioElement | null>(null);

  // Reuses the same voice-on preference the Mikey chat page uses, so turning
  // voice on/off in one place applies everywhere Mikey talks.
  const speakReply = useCallback((text: string) => {
    if (localStorage.getItem('mikeyVoiceOn') !== 'true' || !text?.trim()) return;
    api('/copilot/speak', { method: 'POST', body: JSON.stringify({ text }) })
      .then((res: any) => {
        if (!res?.audioBase64) return;
        speakAudioRef.current?.pause();
        const audio = new Audio(`data:${res.mimeType};base64,${res.audioBase64}`);
        speakAudioRef.current = audio;
        audio.play().catch(() => {});
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const hasWhisperPath = !!(navigator.mediaDevices?.getUserMedia && (window as any).MediaRecorder);
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setWhisperMode(hasWhisperPath);
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

    const transcriptLine = `🗣️ You said: "${text}"`;

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
      setResult(`${transcriptLine}\n→ Showing ${cmd.page}${cmd.filter ? ' (' + cmd.filter + ')' : ''}`);
      setMode('idle');
      setListening(false);
      return;
    }

    // Fallback to copilot — it handles messy phrases and multi-step actions.
    api('/copilot/chat', {
      method: 'POST',
      body: JSON.stringify({ message: text }),
    }).then((res: any) => {
      const nav = (res.actions || []).find((a: any) => a.tool === 'navigate_ui' && a.status !== 'error');
      if (nav) {
        setPendingFilter(nav.args.page, { filters: nav.args.filters, highlightId: nav.args.highlightId, zoom: nav.args.zoom, summary: nav.args.summary });
        window.location.hash = PAGE_MAP[nav.args.page] || '/' + nav.args.page;
        const summary = nav.args.summary || `Navigated to ${nav.args.page}`;
        setResult(`${transcriptLine}\n→ ${summary}`);
        speakReply(summary);
      } else {
        const reply = res.reply || 'Done';
        setResult(`${transcriptLine}\n→ ${reply}`);
        speakReply(reply);
      }
    }).catch(() => {
      setResult(`${transcriptLine}\n→ I didn't understand that. Try 'show me leads' or 'go to qr'.`);
    }).finally(() => {
      setMode('idle');
      setListening(false);
      if (wakeWordOn) wakeWord.start();
    });
  }, [wakeWordOn, wakeWord, speakReply]);

  const startBrowserRecognition = useCallback(() => {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) { setResult('Voice input not supported in this browser'); return; }

    const r = new Ctor();
    r.continuous = false;
    r.interimResults = false;
    r.lang = 'en-US';

    r.onstart = () => { setListening(true); setMode('listening'); };
    r.onresult = (e: any) => handleTranscript(e.results[e.results.length - 1][0].transcript);
    r.onerror = () => { setResult('Microphone error. Check permissions.'); };
    r.onend = () => { setListening(false); setMode('idle'); if (wakeWordOn) wakeWord.start(); };

    recognitionRef.current = r;
    try { r.start(); } catch { setResult('Failed to start microphone.'); }
  }, [handleTranscript, wakeWordOn, wakeWord]);

  // Press-to-talk + Whisper: a clean start/stop recording is transcribed
  // server-side, which catches full sentences the browser's live recognizer
  // routinely cuts off or mishears. Auto-stops ~1.5s after you stop talking,
  // and hard-stops at 15s so it can never hang open.
  const startWhisperRecording = useCallback(async () => {
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
        setMode('copilot');
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        // Nothing captured (instant stop / muted mic) — bail cleanly.
        if (blob.size < 1000) {
          setResult("Didn't catch that — tap the mic and speak.");
          setListening(false);
          setMode('idle');
          return;
        }
        const formData = new FormData();
        formData.append('audio', blob, 'command.webm');
        try {
          const { text } = await apiUpload('/copilot/voice-transcribe', formData);
          if (text?.trim()) {
            handleTranscript(text.trim());
          } else {
            setResult("Didn't catch that — try again.");
            setListening(false);
            setMode('idle');
          }
        } catch {
          setResult('Transcription failed. Check your connection.');
          setListening(false);
          setMode('idle');
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setListening(true);
      setMode('listening');

      // Hard cap: stop after 15s no matter what.
      maxTimerRef.current = setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
          recorderRef.current = null;
        }
      }, 15000);

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
          const SPEAKING = rms > 0.04;

          if (SPEAKING) {
            hasSpoken = true;
            if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = undefined; }
          } else if (hasSpoken && !silenceTimerRef.current) {
            // Gone quiet after speaking — arm the auto-stop.
            silenceTimerRef.current = setTimeout(() => {
              if (recorderRef.current && recorderRef.current.state !== 'inactive') {
                recorderRef.current.stop();
                recorderRef.current = null;
              }
            }, 1500);
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        // AudioContext unavailable — the 15s cap + manual Tap to send still work.
      }
    } catch {
      setResult('Microphone permission denied.');
    }
  }, [handleTranscript]);

  const startListening = useCallback(() => {
    if (wakeWordOn) wakeWord.stop();
    if (whisperMode) startWhisperRecording();
    else startBrowserRecognition();
  }, [whisperMode, startWhisperRecording, startBrowserRecognition, wakeWordOn, wakeWord]);

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

  if (result) {
    const lines = result.split('\n');
    const hasTranscript = lines.length > 1;
    return (
      <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[9999] max-w-lg w-full mx-4 animate-fade-up pointer-events-none">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 shadow-2xl flex flex-col gap-2">
          {hasTranscript && (
            <div className="flex items-start gap-2">
              <Mic size={14} className="text-[var(--primary)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--muted-foreground)]">{lines[0]}</p>
            </div>
          )}
          <div className="flex items-start gap-2">
            <Sparkles size={16} className="text-[var(--primary)] mt-0.5 shrink-0" />
            <p className="text-sm text-[var(--foreground)] leading-relaxed flex-1">{hasTranscript ? lines.slice(1).join('\n') : result}</p>
          </div>
        </div>
      </div>
    );
  }

  if (listening) {
    const thinking = mode === 'copilot';
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-fade-up flex flex-col items-center gap-2">
        <div className="rounded-full border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 shadow-2xl flex items-center gap-3 pointer-events-none">
          <div className="flex items-end gap-0.5 h-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-1 rounded-full bg-[var(--primary)] animate-pulse" style={{ height: `${20 + Math.random() * 60}%` }} />
            ))}
          </div>
          <span className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">
            {thinking ? 'Thinking...' : 'Listening... speak, then it sends automatically'}
          </span>
          {!thinking && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
        </div>
        {/* Big, thumb-friendly stop control. Auto-stop handles most cases, but
            this is the obvious tap target on mobile where there's no Esc key. */}
        {!thinking && (
          <button
            onClick={stopListening}
            className="flex items-center gap-2 rounded-full bg-[var(--primary)] text-white px-6 py-3 shadow-2xl active:scale-95 transition-transform"
          >
            <MicOff size={18} />
            <span className="text-sm font-medium">Tap to send</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={startListening}
        className="fixed bottom-20 right-6 z-[9999] w-12 h-12 rounded-full shadow-lg flex items-center justify-center bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] hover:scale-105 transition-all duration-200 [body.overlay-open_&]:hidden"
        title="Activate Mikey Voice (Ctrl+H)"
      >
        <Mic size={18} />
      </button>
      <button
        onClick={toggleWakeWord}
        className={`fixed bottom-20 right-20 z-[9999] w-9 h-9 rounded-full shadow-lg flex items-center justify-center border transition-all duration-200 [body.overlay-open_&]:hidden ${
          wakeWordOn ? 'bg-[var(--primary)] text-white border-transparent' : 'bg-[var(--card)] text-[var(--muted-foreground)] border-[var(--border)] hover:bg-[var(--accent)]'
        }`}
        title={wakeWordOn ? '"Okay Mikey" listening is on — click to turn off' : 'Turn on hands-free "Okay Mikey" listening'}
      >
        {wakeWordOn ? <Ear size={15} /> : <EarOff size={15} />}
      </button>
      <div className="fixed bottom-[5.5rem] right-6 z-[9999] text-[10px] text-[var(--muted-foreground)] opacity-50 text-right [body.overlay-open_&]:hidden">
        <kbd className="px-1 py-0.5 rounded bg-[var(--accent)] font-mono">Ctrl+H</kbd>
      </div>
    </>
  );
}
