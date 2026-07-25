import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { MoonshineService } from '../shared/moonshine.service';
import OpenAI from 'openai';
import * as fs from 'fs';

@Injectable()
export class CallSummaryService {
  private readonly logger = new Logger(CallSummaryService.name);
  private openaiClient: OpenAI | null = null;
  private deepseekClient: OpenAI | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
    private moonshine: MoonshineService,
  ) {
    const openaiApiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiApiKey) {
      this.openaiClient = new OpenAI({ apiKey: openaiApiKey });
    }

    const deepseekApiKey = this.config.get<string>('DEEPSEEK_API_KEY');
    const deepseekBaseURL = this.config.get<string>('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com/v1';
    if (deepseekApiKey) {
      this.deepseekClient = new OpenAI({ apiKey: deepseekApiKey, baseURL: deepseekBaseURL });
    }
  }

  async transcribe(filePath: string): Promise<string> {
    try {
      const buf = fs.readFileSync(filePath);
      return await this.moonshine.transcribe(buf);
    } catch (e: any) {
      this.logger.warn(`Moonshine failed (${e.message}), falling back to Sarvam`);
    }
    const sarvamApiKey = this.config.get<string>('SARVAM_API_KEY');
    if (sarvamApiKey) {
      try {
        return await this.transcribeWithSarvam(filePath, sarvamApiKey);
      } catch (e: any) {
        this.logger.warn(`Sarvam STT failed (${e.message}), falling back to Whisper`);
      }
    }
    if (!this.openaiClient) throw new Error('Neither SARVAM_API_KEY nor OPENAI_API_KEY configured');
    const transcription = await this.openaiClient.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
    });
    return transcription.text;
  }

  private async transcribeWithSarvam(filePath: string, apiKey: string): Promise<string> {
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(filePath)]), 'audio.webm');
    form.append('model', 'saaras:v3');
    form.append('mode', 'transcribe');
    form.append('language_code', 'unknown');

    const res = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: { 'api-subscription-key': apiKey },
      body: form,
    });
    if (!res.ok) throw new Error(`Sarvam STT ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { transcript?: string };
    return data.transcript || '';
  }

  async summarize(transcript: string): Promise<string> {
    if (!this.deepseekClient) throw new Error('DEEPSEEK_API_KEY not configured');
    const response = await this.deepseekClient.chat.completions.create({
      model: this.config.get<string>('AGENT_MODEL') || 'deepseek-v4-flash',
      messages: [
        {
          role: 'system',
          content: 'Summarize this sales call transcript in exactly 2 sentences: what was discussed, and any next step or outcome.',
        },
        { role: 'user', content: transcript },
      ],
    });
    return response.choices[0]?.message?.content || 'Summary unavailable.';
  }

  async summarizeRecording(callLogId: string) {
    const callLog = await this.prisma.callLog.findUnique({ where: { id: callLogId } });
    if (!callLog) {
      this.logger.warn(`Call log ${callLogId} not found for summarization`);
      return;
    }

    if (!callLog.recordingUrl) {
      await this.prisma.callLog.update({
        where: { id: callLogId },
        data: { summaryStatus: 'SKIPPED' },
      });
      return;
    }

    if (!this.openaiClient) {
      await this.prisma.callLog.update({
        where: { id: callLogId },
        data: { summaryStatus: 'SKIPPED' },
      });
      return;
    }

    try {
      const storagePath = this.config.get<string>('STORAGE_PATH') || './uploads';
      const filePath = `${storagePath}${callLog.recordingUrl}`;

      if (!fs.existsSync(filePath)) {
        this.logger.warn(`Recording file not found: ${filePath}`);
        await this.prisma.callLog.update({
          where: { id: callLogId },
          data: { summaryStatus: 'FAILED' },
        });
        return;
      }

      const transcript = await this.transcribe(filePath);
      let summary: string | null = null;
      let summaryStatus = 'DONE';

      if (this.deepseekClient && transcript) {
        try {
          summary = await this.summarize(transcript);
        } catch (err: any) {
          this.logger.error(`Summarization failed for call ${callLogId}: ${err.message}`);
          summaryStatus = 'FAILED';
        }
      }

      await this.prisma.callLog.update({
        where: { id: callLogId },
        data: { transcript, summary, summaryStatus },
      });

      if (summary) {
        this.realtime.emitToTenant(callLog.tenantId, 'call.summarized', {
          callLogId,
          summary,
          transcript,
        });
      }
    } catch (err: any) {
      this.logger.error(`Summarization failed for call ${callLogId}: ${err.message}`);
      await this.prisma.callLog.update({
        where: { id: callLogId },
        data: { summaryStatus: 'FAILED' },
      });
    }
  }
}
