import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';

export interface DeepgramSession {
  sendAudio: (chunk: Buffer) => void;
  close: () => void;
}

/** Streaming STT for continuous-listening voice sessions (realtime.gateway.ts).
 * Separate from moonshine.service.ts's batch transcription, which stays the
 * tap-to-talk path — Deepgram is a new paid vendor added specifically for the
 * always-on mic case, since Moonshine/Sarvam/Whisper are all whole-file only. */
@Injectable()
export class DeepgramService {
  private readonly logger = new Logger(DeepgramService.name);

  constructor(private config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('DEEPGRAM_API_KEY');
  }

  /** Opens one Deepgram streaming session. onTranscript fires once per complete
   * utterance — Deepgram's own guidance is to concatenate `is_final: true`
   * segments and only emit once `speech_final: true` arrives, rather than
   * acting on every interim/final fragment individually, since a long
   * utterance can carry several is_final chunks before speech genuinely ends.
   * onInterim fires on every result (including non-final, low-latency but
   * unstable) purely for a live "you're saying..." caption — never used to
   * trigger a reply, only onTranscript's speech_final does that. */
  connect(onTranscript: (text: string) => void, onError: (err: Error) => void, onInterim?: (text: string) => void): DeepgramSession {
    const apiKey = this.config.get<string>('DEEPGRAM_API_KEY');
    if (!apiKey) throw new Error('DEEPGRAM_API_KEY not configured');

    const url = 'wss://api.deepgram.com/v1/listen'
      + '?encoding=linear16&sample_rate=16000&channels=1'
      + '&model=nova-3&punctuate=true'
      + '&interim_results=true&endpointing=300&utterance_end_ms=1000';

    const socket = new WebSocket(url, { headers: { Authorization: `Token ${apiKey}` } });

    let open = false;
    let closed = false;
    const pending: Buffer[] = [];
    let utteranceBuffer = '';

    socket.on('open', () => {
      open = true;
      for (const chunk of pending) socket.send(chunk);
      pending.length = 0;
    });

    socket.on('message', (data: any) => {
      let msg: any;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (msg.type !== 'Results') return;
      const alt = msg.channel?.alternatives?.[0];
      if (!alt) return;
      if (alt.transcript) {
        const preview = utteranceBuffer ? `${utteranceBuffer} ${alt.transcript}` : alt.transcript;
        onInterim?.(preview.trim());
      }
      if (msg.is_final && alt.transcript) {
        utteranceBuffer += (utteranceBuffer ? ' ' : '') + alt.transcript;
      }
      if (msg.speech_final && utteranceBuffer.trim()) {
        onTranscript(utteranceBuffer.trim());
        utteranceBuffer = '';
      }
    });

    socket.on('error', (err: Error) => {
      this.logger.warn(`Deepgram session error: ${err.message}`);
      onError(err);
    });
    socket.on('close', () => { open = false; });

    return {
      sendAudio: (chunk: Buffer) => {
        if (closed) return;
        if (open) socket.send(chunk); else pending.push(chunk);
      },
      close: () => {
        if (closed) return;
        closed = true;
        try { socket.send(JSON.stringify({ type: 'CloseStream' })); } catch {}
        try { socket.close(); } catch {}
      },
    };
  }
}
