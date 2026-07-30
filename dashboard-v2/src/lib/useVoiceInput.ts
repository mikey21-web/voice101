import { useEffect, useState, useCallback } from 'react';

interface VoiceInputState {
  supported: boolean;
  listening: boolean;
  wakeWordDetected: boolean;
  transcript: string;
  error: string | null;
  debug: string;
}

let recognition: any = null;
let listeners: Array<() => void> = [];
let voiceState: VoiceInputState = {
  supported: typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
  listening: false,
  wakeWordDetected: false,
  transcript: '',
  error: null,
  debug: '',
};
let wakeWordPending = false;
// Whether we intend to keep listening. Chrome fires `onend` after every
// utterance / silence gap even with continuous=true, so we must restart.
let shouldListen = false;
let restartTimer: any = null;
const WAKE_WORD = 'okay mikey';

function notify() { listeners.forEach(l => l()); }

function updateState(partial: Partial<VoiceInputState>) {
  voiceState = { ...voiceState, ...partial };
  notify();
}

function log(msg: string) {
  console.log('[MikeyVoice]', msg);
  voiceState.debug = msg;
}

export function useVoiceInput() {
  const [state, setState] = useState<VoiceInputState>(voiceState);

  useEffect(() => {
    const updater = () => setState({ ...voiceState });
    listeners.push(updater);
    return () => { listeners = listeners.filter(l => l !== updater); };
  }, []);

  const clearTranscript = useCallback(() => { updateState({ transcript: '' }); }, []);

  const start = useCallback(async () => {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) {
      log('Speech recognition not supported in this browser');
      updateState({ error: 'Not supported' });
      return;
    }

    if (recognition) {
      try { recognition.stop(); } catch {}
      recognition = null;
    }

    const r = new Ctor();
    r.continuous = true;
    r.interimResults = false;
    r.lang = 'en-US';

    r.onstart = () => {
      log('Listening started');
      updateState({ listening: true, wakeWordDetected: false, error: null });
    };

    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const text = e.results[i][0].transcript.toLowerCase().trim();
        log('Heard: ' + text);
        if (!text) continue;

        if (!wakeWordPending) {
          if (text.includes(WAKE_WORD)) {
            wakeWordPending = true;
            updateState({ wakeWordDetected: true });
            const after = text.replace(WAKE_WORD, '').trim();
            if (after) {
              wakeWordPending = false;
              log('Command: ' + after);
              updateState({ transcript: after, wakeWordDetected: false });
            }
            return;
          }
          // No wake word in this utterance and no pending "okay mikey" from a prior
          // one — this is background noise (or, without the caller pausing us while
          // Mikey talks, Mikey's own voice bleeding back through the mic), not a
          // command. Sending it here was the actual bug: "hands-free" mode was
          // forwarding every single thing the mic ever heard, wake word or not.
          log('Ignored (no wake word): ' + text);
          continue;
        }

        wakeWordPending = false;
        updateState({ wakeWordDetected: false });
        const after = text.replace(WAKE_WORD, '').trim();
        log('Command: ' + (after || text));
        updateState({ transcript: after || text });
      }
    };

    r.onerror = (e: any) => {
      log('Error: ' + (e.error || 'unknown'));
      // Permission problems must not be retried in a loop.
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        shouldListen = false;
        updateState({ error: 'Microphone permission denied', listening: false });
        return;
      }
      // 'aborted' / 'no-speech' are normal; onend will restart us.
      if (e.error === 'aborted' || e.error === 'no-speech') return;
      updateState({ error: e.error || 'Voice error' });
    };

    r.onend = () => {
      log('Recognition ended');
      // Chrome ends recognition after each result/silence. Restart so the
      // mic keeps listening for the next command instead of silently dying.
      if (shouldListen) {
        if (restartTimer) clearTimeout(restartTimer);
        restartTimer = setTimeout(() => {
          if (!shouldListen) return;
          try {
            r.start();
            log('Auto-restarted');
          } catch (err: any) {
            // "already started" is harmless; anything else means we stopped.
            if (!/already started/i.test(err?.message || '')) {
              log('Restart failed: ' + err?.message);
              updateState({ listening: false });
            }
          }
        }, 250);
        return;
      }
      updateState({ listening: false });
    };

    try {
      shouldListen = true;
      r.start();
      recognition = r;
    } catch (err: any) {
      log('Start failed: ' + err.message);
      shouldListen = false;
      updateState({ error: err.message || 'Failed to start' });
    }
  }, []);

  const stop = useCallback(() => {
    shouldListen = false;
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
    try { recognition?.stop(); } catch {}
    recognition = null;
    wakeWordPending = false;
    updateState({ listening: false, wakeWordDetected: false });
    log('Stopped');
  }, []);

  const toggle = useCallback(() => {
    if (voiceState.listening) stop();
    else start();
  }, [start, stop]);

  return {
    supported: state.supported,
    listening: state.listening,
    wakeWordDetected: state.wakeWordDetected,
    transcript: state.transcript,
    error: state.error,
    debug: state.debug,
    start, stop, toggle, clearTranscript,
  };
}
