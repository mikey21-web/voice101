import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DograhService } from '../shared/dograh.service';
import { CallerMemoryService } from './caller-memory.service';
import { lintTranscript } from './call-quality';

/**
 * Calls and leads produced by the VoiceEmployee engine. Deliberately separate from CallLog/Lead
 * (the CRM's own models, used by the human-agent Twilio path) — these carry the AI-specific
 * shape Outpero's /calls and /leads endpoints expose: disposition, structured outcome,
 * transcript, and an automated quality score.
 */
@Injectable()
export class VoiceCallService {
  private readonly logger = new Logger(VoiceCallService.name);

  constructor(private prisma: PrismaService, private dograh: DograhService, private memory: CallerMemoryService) {}

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
    return { ...call, quality: call.transcript ? lintTranscript(call.transcript) : null };
  }

  /** No live-call streaming in this engine yet (Dograh doesn't expose an in-progress-call feed
   * over this API) — returns the shape Outpero's /calls/live exposes, always empty for now
   * rather than omitting the endpoint, so a frontend built against that contract doesn't 404. */
  async listLive(_tenantId: string) {
    return [];
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

    this.logger.log(`Ingested call ${call.id} for employee ${employee.id} (${employee.name})`);
    return { received: true, callId: call.id };
  }
}
