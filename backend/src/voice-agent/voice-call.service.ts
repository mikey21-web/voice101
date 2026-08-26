import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DograhService } from '../shared/dograh.service';
import { CallerMemoryService } from './caller-memory.service';
import { lintTranscript } from './call-quality';
import { LeadOrchestratorService } from './lead-orchestrator.service';

/**
 * Calls and leads produced by the VoiceEmployee engine. Deliberately separate from CallLog/Lead
 * (the CRM's own models, used by the human-agent Twilio path) — these carry the AI-specific
 * shape Outpero's /calls and /leads endpoints expose: disposition, structured outcome,
 * transcript, and an automated quality score.
 */
@Injectable()
export class VoiceCallService {
  private readonly logger = new Logger(VoiceCallService.name);

  constructor(
    private prisma: PrismaService,
    private dograh: DograhService,
    private memory: CallerMemoryService,
    private orchestrator: LeadOrchestratorService,
    private config: ConfigService,
  ) {}

  async list(tenantId: string, filters: { employeeId?: string; campaignId?: string; disposition?: string; direction?: string; limit?: number } = {}) {
    const calls = await this.prisma.voiceCall.findMany({
      where: {
        tenantId,
        employeeId: filters.employeeId,
        campaignId: filters.campaignId,
        disposition: filters.disposition,
        direction: filters.direction,
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
      include: { employee: { select: { name: true } } },
    });
    // Scored on read (see call-quality.ts's own rationale) — cheap for list-page volumes, and
    // means an improved linter re-scores every past call automatically with no backfill job.
    return calls.map((c) => ({ ...c, quality: c.transcript ? lintTranscript(c.transcript) : null }));
  }

  async get(tenantId: string, id: string) {
    const call = await this.prisma.voiceCall.findFirst({ where: { id, tenantId }, include: { employee: { select: { name: true, role: true } } } });
    if (!call) throw new NotFoundException('Call not found');
    const transcriptText = this.transcriptToText(call.transcript);
    let insights = { talkRatio: call.talkRatio as any, sentiment: call.sentiment, recommendedNextStep: call.recommendedNextStep };
    if (transcriptText && (!call.sentiment || !call.talkRatio || !call.recommendedNextStep)) {
      try {
        insights = await this.analyzeTranscript(transcriptText, call.disposition || 'completed');
        await this.prisma.voiceCall.update({
          where: { id: call.id },
          data: { talkRatio: insights.talkRatio as any, sentiment: insights.sentiment, recommendedNextStep: insights.recommendedNextStep },
        });
      } catch (err: any) {
        this.logger.warn(`AI insight generation failed for call ${call.id}: ${err.message}`);
      }
    }
    return { ...call, quality: call.transcript ? lintTranscript(call.transcript) : null, ...insights };
  }

  /** No live-call streaming in this engine yet (Dograh doesn't expose an in-progress-call feed
   * over this API) - returns the shape Outpero's /calls/live exposes, always empty for now
   * rather than omitting the endpoint, so a frontend built against that contract doesn't 404. */
  async listLive(_tenantId: string) {
    return [];
  }

  private transcriptToText(transcript: any): string {
    if (!transcript) return '';
    if (typeof transcript === 'string') return transcript;
    if (Array.isArray(transcript)) {
      return transcript
        .map((m) => {
          const role = typeof m === 'string' ? '' : m?.role === 'agent' ? 'Agent' : m?.role === 'caller' ? 'Caller' : m?.role === 'user' ? 'Caller' : '';
          const text = typeof m === 'string' ? m : m?.text || m?.content || '';
          return role ? `${role}: ${text}` : text;
        })
        .filter(Boolean)
        .join('\n');
    }
    if (typeof transcript === 'object' && transcript.messages) return this.transcriptToText(transcript.messages);
    return JSON.stringify(transcript);
  }

  private async analyzeTranscript(transcript: string, disposition: string): Promise<{ talkRatio: { agent: number; caller: number }; sentiment: string; recommendedNextStep: string }> {
    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY');
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');
    const baseUrl = this.config.get<string>('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com/v1';
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: this.config.get<string>('AGENT_MODEL') || 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content:
              'You analyze a phone-call transcript between an AI voice agent and a caller. Estimate the talk ratio, overall sentiment, and the recommended next step. Output ONLY JSON: {"talkRatio":{"agent":number,"caller":number},"sentiment":"positive|neutral|negative","recommendedNextStep":"one short actionable line"}. talkRatio should sum to roughly 100. Keep recommendedNextStep concrete and specific to this conversation.',
          },
          { role: 'user', content: `Disposition: ${disposition}\n\nTranscript:\n${transcript.slice(0, 12000)}` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI insight generation failed: ${res.status} ${await res.text()}`);
    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in AI insight response');
    const parsed = JSON.parse(match[0]);
    return {
      talkRatio: { agent: Number(parsed.talkRatio?.agent ?? 50), caller: Number(parsed.talkRatio?.caller ?? 50) },
      sentiment: ['positive', 'neutral', 'negative'].includes(parsed.sentiment) ? parsed.sentiment : 'neutral',
      recommendedNextStep: parsed.recommendedNextStep || 'Follow up with the caller.',
    };
  }

  async redial(tenantId: string, id: string) {
    const call = await this.prisma.voiceCall.findFirst({ where: { id, tenantId }, include: { employee: true } });
    if (!call) throw new NotFoundException('Call not found');
    if (!call.employee.dograhWorkflowUuid) throw new BadRequestException('Employee has no published workflow to call through');
    const result = await this.dograh.triggerCall(call.employee.dograhWorkflowUuid, call.toNumber, {});
    return { success: true, callSid: String(result.workflow_run_id) };
  }

  /**
   * Ingests Dograh's post_call_outcome webhook (see the compiler's outboundWebhookUrl) into a
   * VoiceCall + linked VoiceLead. This is the write side that makes /calls and /leads populate
   * automatically — no separate sync job, the webhook IS the ingestion path, same as Outpero's
   * own architecture (their lead-webhook + call completion both feed the same tables).
   */
  async handleWebhook(payload: any) {
    const employeeId = payload.employee_id || payload.employeeId;
    if (!employeeId) {
      this.logger.warn(`Employee call webhook missing employee_id: ${JSON.stringify(payload).slice(0, 200)}`);
      return { ignored: true };
    }
    const employee = await this.prisma.voiceEmployee.findUnique({ where: { id: employeeId } });
    if (!employee) { this.logger.warn(`Employee call webhook for unknown employee ${employeeId}`); return { ignored: true }; }

    const outcome = payload.outcome || {};
    const call = await this.prisma.voiceCall.create({
      data: {
        tenantId: employee.tenantId,
        employeeId: employee.id,
        toNumber: payload.to_number || outcome.phone || 'unknown',
        durationS: payload.duration_seconds ? Math.round(payload.duration_seconds) : null,
        recordingUrl: payload.recording_url,
        transcript: payload.transcript,
        summary: payload.summary,
        disposition: outcome.call_status || payload.status || 'completed',
        outcome,
        dograhRunId: payload.call_sid ? String(payload.call_sid) : null,
      },
    });

    await this.prisma.voiceLead.create({
      data: {
        tenantId: employee.tenantId,
        employeeId: employee.id,
        callId: call.id,
        phone: call.toNumber,
        source: 'instant_webhook',
        outcome: call.disposition,
        captured: outcome,
        summary: call.summary,
      },
    });

    // Merge extracted variables into caller memory for future calls from this number
    if (call.toNumber && outcome && Object.keys(outcome).length > 0) {
      try {
        await this.memory.mergeFacts(employee.tenantId, call.toNumber, outcome);
      } catch (err) {
        this.logger.warn(`Failed to merge caller facts: ${err.message}`);
      }
    }

    // The webhook payload itself carries no transcript/recording, but Dograh's runs API does —
    // best-effort enrich so the dashboard shows the recording link + duration. Runs are listed
    // newest-first, and this call just completed, so it's on page 1.
    // ponytail: fire-and-forget so the webhook returns fast — a slow runs API / DeepSeek call
    // could otherwise time out on Dograh's side and trigger a duplicate webhook.
    if (payload.call_sid) {
      this.enrichCallFromRuns(call, payload.call_sid).catch((err) =>
        this.logger.warn(`Failed to enrich call ${call.id} from runs API: ${err.message}`),
      );
    }

    // When the call came from the lead pipeline (initial_context.lead_id was set by
    // callLead), also run the CRM side: update the CallLog + fire the post-call WhatsApp
    // through the same orchestrator path the legacy workflow uses. Test calls carry no
    // lead_id, so they stay voiceCall-only.
    if (payload.lead_id) {
      this.orchestrator
        .handleCallWebhook({
          call_sid: payload.call_sid,
          lead_id: payload.lead_id,
          status: payload.status || 'completed',
          outcome,
        })
        .catch((err) => this.logger.warn(`CRM handling for lead ${payload.lead_id} failed: ${err.message}`));
    }

    this.logger.log(`Ingested call ${call.id} for employee ${employee.id} (${employee.name})`);
    return { received: true, callId: call.id };
  }

  private async enrichCallFromRuns(call: any, callSid: string): Promise<void> {
    const { runs } = await this.dograh.getUsageRuns({ page: 1, limit: 50 });
    const run = (runs || []).find((r: any) => String(r.id) === String(callSid));
    if (run?.recording_public_url) {
      await this.prisma.voiceCall.update({
        where: { id: call.id },
        data: {
          recordingUrl: run.recording_public_url,
          durationS: run.call_duration_seconds ? Math.round(run.call_duration_seconds) : undefined,
        },
      });
    }
    // The runs API also exposes the transcript as a text download — pull it and have DeepSeek
    // summarise it, so the dashboard's Call Logs / Conversations views are not empty even though
    // the webhook itself carries no transcript or summary.
    const transcriptUrl = run?.transcript_public_url || run?.transcript_url;
    if (transcriptUrl && !call.transcript) {
      const transcript = await this.fetchTranscriptText(transcriptUrl);
      let summary = call.summary;
      if (transcript && !summary) {
        summary = await this.summarizeTranscript(transcript);
      }
      if (transcript || summary) {
        await this.prisma.voiceCall.update({
          where: { id: call.id },
          data: { transcript: transcript || undefined, summary: summary || undefined },
        });
      }
    }
  }

  private async fetchTranscriptText(url: string): Promise<string> {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Transcript download failed: ${res.status}`);
    return await res.text();
  }

  private async summarizeTranscript(transcript: string): Promise<string> {
    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY');
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');
    const baseUrl = this.config.get<string>('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com/v1';
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: this.config.get<string>('AGENT_MODEL') || 'deepseek-v4-flash',
        messages: [
          {
            role: 'system',
            content:
              'You are a sales call summariser. Summarise the transcript in exactly 2 sentences: what the caller was looking for and the outcome/next step.',
          },
          { role: 'user', content: transcript.slice(0, 12000) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`DeepSeek summarise failed: ${res.status} ${await res.text()}`);
    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content || 'Summary unavailable.';
  }
}
