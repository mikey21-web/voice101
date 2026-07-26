import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DograhService } from '../shared/dograh.service';

@Injectable()
export class VoiceAgentService {
  private readonly logger = new Logger(VoiceAgentService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private dograh: DograhService,
  ) {}

  async callLead(leadId: string, userId: string, language = 'te'): Promise<{ success: boolean; callSid?: string; message?: string }> {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, include: { contact: true } });
    if (!lead?.contact?.phone) return { success: false, message: 'Lead has no phone number' };

    try {
      const workflowUuid = this.dograh.workflowUuidFor(language);
      const call = await this.dograh.triggerCall(workflowUuid, lead.contact.phone, {
        first_name: lead.contact.name || 'there',
        interest: lead.interest || 'properties',
        lead_id: lead.id,
        company_name: this.config.get('COMPANY_NAME', 'Diyaa'),
      });
      const callSid = String(call.workflow_run_id);

      await this.prisma.callLog.create({
        data: { leadId, tenantId: lead.tenantId, direction: 'OUTBOUND', fromNumber: this.config.get('TWILIO_PHONE_NUMBER', ''), toNumber: lead.contact.phone, status: 'INITIATED', providerSid: callSid, agentId: userId },
      });
      this.logger.log(`Dograh call initiated to ${lead.contact.name} (${lead.contact.phone}) — run ${callSid}`);
      return { success: true, callSid };
    } catch (e: any) {
      this.logger.error(`Dograh call failed: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  async getCallHistory(tenantId: string, limit = 20) {
    return this.prisma.callLog.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: limit, include: { lead: { include: { contact: { select: { name: true, phone: true } } } } } });
  }

  async getSettings(language = 'te') {
    return this.dograh.getSettings(language);
  }

  async updateSettings(language: string, changes: { greeting?: string; persona?: string; antiEarlyHangupEnabled?: boolean; checklistCopy?: string }) {
    await this.dograh.updateSettings(language, changes);
    return this.dograh.getSettings(language);
  }

  async toggleAmd(enabled: boolean) {
    await this.dograh.setTelephonyAmd(enabled);
    return { voicemailDetectionEnabled: enabled };
  }

  /** Bare 10-digit Indian mobile numbers are assumed +91; anything with a country code (leading +, or 11+ digits) is left as-is. */
  private normalizePhone(raw: string): string {
    const digits = raw.replace(/[\s\-()]/g, '');
    if (digits.startsWith('+')) return digits;
    if (digits.length === 10) return `+91${digits}`;
    if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
    return digits.startsWith('+') ? digits : `+${digits}`;
  }

  async createCampaign(
    tenantId: string,
    name: string,
    leadIds: string[],
    language = 'te',
    options?: {
      maxConcurrency?: number;
      retryConfig?: { enabled: boolean; maxRetries: number; retryDelaySeconds: number; retryOnBusy: boolean; retryOnNoAnswer: boolean; retryOnVoicemail: boolean };
      scheduleConfig?: { enabled: boolean; timezone: string; slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }> };
      contacts?: Array<{ phone: string; name?: string; [key: string]: any }>;
    },
  ): Promise<{ campaignId: number; leadCount: number }> {
    let rows: string[][];
    const companyName = this.config.get('COMPANY_NAME', 'Diyaa');

    if (options?.contacts && options.contacts.length > 0) {
      const valid = options.contacts.filter((c) => c.phone && c.phone.trim());
      if (valid.length === 0) throw new BadRequestException('No contacts with a phone number found in the upload');
      rows = [['phone_number', 'first_name', 'lead_id', 'interest', 'company_name']];
      for (const c of valid) {
        rows.push([
          this.normalizePhone(c.phone),
          (c.name || 'there').replace(/,/g, ' '),
          '',
          'properties',
          companyName,
        ]);
      }
    } else {
      const leads = await this.prisma.lead.findMany({
        where: { id: { in: leadIds }, tenantId },
        include: { contact: true },
      });
      const callable = leads.filter((l) => l.contact?.phone);
      if (callable.length === 0) throw new BadRequestException('None of the selected leads have a phone number');

      rows = [['phone_number', 'first_name', 'lead_id', 'interest', 'company_name']];
      for (const lead of callable) {
        rows.push([
          lead.contact!.phone!,
          (lead.contact!.name || 'there').replace(/,/g, ' '),
          lead.id,
          (lead.interest || 'properties').replace(/,/g, ' '),
          companyName,
        ]);
      }
    }
    const csv = rows.map((r) => r.join(',')).join('\n');

    let campaignId: number;
    try {
      ({ campaignId } = await this.dograh.createCampaignFromCsv(name, language, csv, options));
      await this.dograh.startCampaign(campaignId);
    } catch (e: any) {
      if (String(e.message).includes('telephony_configuration_not_found')) {
        throw new BadRequestException('Voice calling isn\'t fully set up yet — telephony isn\'t configured. Contact your admin.');
      }
      // Dograh's own validation messages (concurrency caps, quota, etc.) are already
      // safe and specific — surface them directly instead of a blanket generic error.
      if (String(e.message).startsWith('Dograh campaign create failed') || String(e.message).includes('Dograh')) {
        throw new BadRequestException('Could not start the campaign — the voice agent service is unavailable.');
      }
      throw new BadRequestException(e.message);
    }
    const leadCount = rows.length - 1;
    this.logger.log(`Campaign "${name}" created (id ${campaignId}) with ${leadCount} contacts`);
    return { campaignId, leadCount };
  }

  async listCampaigns() {
    return this.dograh.listCampaigns();
  }

  async getCampaignProgress(campaignId: number) {
    return this.dograh.getCampaignProgress(campaignId);
  }

  async pauseCampaign(campaignId: number) {
    return this.dograh.pauseCampaign(campaignId);
  }

  async resumeCampaign(campaignId: number) {
    return this.dograh.resumeCampaign(campaignId);
  }

  private static readonly NEGATIVE_DISPOSITIONS = ['no_answer', 'busy', 'failed', 'voicemail', 'no-answer'];

  /**
   * Dograh's /organizations/usage/runs and /campaign/{id}/runs endpoints return two
   * different response shapes for what's conceptually the same "call" object — this
   * normalizes both into one shape the frontend can rely on regardless of source.
   */
  private normalizeRun(r: any) {
    const disposition = r.disposition || r.gathered_context?.mapped_call_disposition || 'unknown';
    return {
      id: r.id,
      workflowId: r.workflow_id,
      workflowName: r.workflow_name || r.name,
      createdAt: r.created_at,
      durationSeconds: r.call_duration_seconds ?? r.usage_info?.call_duration_seconds ?? r.cost_info?.call_duration_seconds ?? 0,
      calledNumber: r.called_number ?? r.initial_context?.phone_number ?? null,
      callerNumber: r.caller_number ?? null,
      disposition,
      answered: !VoiceAgentService.NEGATIVE_DISPOSITIONS.includes(String(disposition).toLowerCase()),
      leadName: r.initial_context?.first_name || null,
      leadId: r.initial_context?.lead_id || null,
      recordingUrl: r.recording_public_url || r.recording_url || null,
      transcriptUrl: r.transcript_public_url || r.transcript_url || null,
      summary: r.summary || r.call_summary || r.gathered_context?.summary || r.gathered_context?.call_summary || null,
      transcript: r.transcript || r.call_transcript || r.gathered_context?.transcript || r.gathered_context?.call_transcript || null,
      gatheredContext: r.gathered_context || {},
    };
  }

  async getCampaignRuns(campaignId: number, page = 1, limit = 50) {
    const data = await this.dograh.getCampaignRuns(campaignId, page, limit);
    return { runs: (data.runs || []).map((r: any) => this.normalizeRun(r)), totalCount: data.total_count, page: data.page, limit: data.limit, totalPages: data.total_pages };
  }

  async getCampaignReportCsv(campaignId: number) {
    return this.dograh.getCampaignReportCsv(campaignId);
  }

  async getCallLogs(page = 1, limit = 50, startDate?: string, endDate?: string) {
    const data = await this.dograh.getUsageRuns({ page, limit, startDate, endDate });
    const runs = (data.runs || []).map((r: any) => this.normalizeRun(r));
    return { runs, totalCount: data.total_count, page: data.page, limit: data.limit, totalPages: data.total_pages, totalDurationSeconds: data.total_duration_seconds };
  }

  // ponytail: answerRate/dispositionCounts are computed from the first 100 runs only
  // (Dograh caps page size at 100); totalCalls/duration are true all-time aggregates
  // from the API. Upgrade to a full pagination loop if that sampling skew matters.
  async getDashboardStats(startDate?: string, endDate?: string) {
    const data = await this.dograh.getUsageRuns({ page: 1, limit: 100, startDate, endDate });
    const runs: any[] = data.runs || [];
    const totalCalls = data.total_count || 0;
    const answered = runs.filter((r) => !VoiceAgentService.NEGATIVE_DISPOSITIONS.includes(String(r.disposition).toLowerCase()));
    const answerRate = runs.length > 0 ? Math.round((answered.length / runs.length) * 100) : 0;
    const totalDurationSeconds = data.total_duration_seconds || 0;
    const avgDurationSeconds = totalCalls > 0 ? Math.round(totalDurationSeconds / totalCalls) : 0;
    const dispositionCounts: Record<string, number> = {};
    for (const r of runs) {
      const key = r.disposition || 'unknown';
      dispositionCounts[key] = (dispositionCounts[key] || 0) + 1;
    }
    return {
      totalCalls,
      answerRate,
      avgDurationSeconds,
      totalMinutesUsed: Math.round(totalDurationSeconds / 60),
      dispositionCounts,
    };
  }

  async uploadKnowledgeBaseDocument(file: { originalname: string; mimetype: string; buffer: Buffer }, language = 'te') {
    const doc = await this.dograh.uploadKnowledgeBaseDocument(file.originalname, file.mimetype, file.buffer);
    await this.dograh.setWorkflowKnowledgeBase(language, doc.document_uuid, true);
    return doc;
  }

  async listKnowledgeBaseDocuments() {
    return this.dograh.listKnowledgeBaseDocuments();
  }

  async deleteKnowledgeBaseDocument(documentUuid: string) {
    await this.dograh.deleteKnowledgeBaseDocument(documentUuid);
    return { deleted: true };
  }

  async getCustomFields(language = 'te') {
    return this.dograh.getCustomFields(language);
  }

  async addCustomField(language: string, field: { name: string; type: 'string' | 'number' | 'boolean'; prompt: string }) {
    await this.dograh.addCustomField(language, field);
    return this.dograh.getCustomFields(language);
  }

  async deleteCustomField(language: string, fieldName: string) {
    await this.dograh.deleteCustomField(language, fieldName);
    return this.dograh.getCustomFields(language);
  }
}
