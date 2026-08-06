import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DograhService } from '../shared/dograh.service';
import { composeGlobalPrompt } from './style-pack';
import { lintTranscript } from './call-quality';
import { CallFlowGeneratorService, GeneratedFlowDraft } from './call-flow-generator.service';

/** Raw, uncomposed voice-agent config — the source of truth, stored per-tenant per-language in
 * Tenant.settings.voiceAgentPersona. The compiled globalNode prompt Dograh actually runs is
 * rebuilt from this on every save (see composeGlobalPrompt); it is never itself read back as
 * state, which is what let old settings silently compound on repeated saves. */
interface RawPersonaConfig {
  persona: string;
  stylePackEnabled: boolean;
  aiAcknowledgementEnabled: boolean;
  antiEarlyHangupEnabled: boolean;
}

const DEFAULT_RAW_CONFIG: RawPersonaConfig = {
  persona: '',
  stylePackEnabled: true,
  aiAcknowledgementEnabled: true,
  antiEarlyHangupEnabled: false,
};

@Injectable()
export class VoiceAgentService {
  private readonly logger = new Logger(VoiceAgentService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private dograh: DograhService,
    private flowGenerator: CallFlowGeneratorService,
  ) {}

  async callLead(leadId: string, userId: string | null, language = 'te'): Promise<{ success: boolean; callSid?: string; message?: string }> {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, include: { contact: true } });
    if (!lead?.contact?.phone) return { success: false, message: 'Lead has no phone number' };

    const toNumber = this.normalizePhone(lead.contact.phone);
    try {
      // Prefer the tenant's active voice employee when one exists — their compiled workflow
      // (voice, script, webhook) wins over the shared legacy language workflow, so a form
      // submit calls through the same engine the "test call" button uses. Falls back to the
      // legacy workflow when no employee is active, keeping the old path intact.
      const activeEmployee = await this.prisma.voiceEmployee.findFirst({
        where: { tenantId: lead.tenantId, status: 'active', isPublished: true, dograhWorkflowUuid: { not: null } },
        orderBy: { updatedAt: 'desc' },
      });
      const workflowUuid = activeEmployee?.dograhWorkflowUuid || this.dograh.workflowUuidFor(language);
      const call = await this.dograh.triggerCall(workflowUuid, toNumber, {
        first_name: lead.contact.name || 'there',
        interest: lead.interest || 'properties',
        lead_id: lead.id,
        company_name: this.config.get('COMPANY_NAME', 'Diyaa'),
      });
      const callSid = String(call.workflow_run_id);

      await this.prisma.callLog.create({
        data: { leadId, tenantId: lead.tenantId, direction: 'OUTBOUND', fromNumber: this.config.get('TWILIO_PHONE_NUMBER', ''), toNumber, status: 'INITIATED', providerSid: callSid, agentId: userId || undefined },
      });
      this.logger.log(`Dograh call initiated to ${lead.contact.name} (${toNumber}) — run ${callSid}`);
      return { success: true, callSid };
    } catch (e: any) {
      this.logger.error(`Dograh call failed: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  async getCallHistory(tenantId: string, limit = 20) {
    const calls = await this.prisma.callLog.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: limit, include: { lead: { include: { contact: { select: { name: true, phone: true } } } } } });
    // Scored on read rather than stored on write: the linter is new and this way it can be
    // improved and re-run against every past transcript at any time, with no migration and no
    // backfill job needed. Revisit if call volume makes on-read scoring measurably slow.
    return calls.map((call) => ({ ...call, quality: call.transcript ? lintTranscript(call.transcript) : null }));
  }

  /** Reads (and, on first run for a tenant/language, seeds) the raw persona config that is the
   * source of truth — never parsed back out of the compiled prompt Dograh runs. */
  private async getRawConfig(tenantId: string, language: string): Promise<RawPersonaConfig> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const stored = (tenant?.settings as any)?.voiceAgentPersona?.[language];
    if (stored) return { ...DEFAULT_RAW_CONFIG, ...stored };

    // First read after this refactor: seed from whatever is currently live so an existing
    // configured persona isn't silently reset to blank. Old hangup-guard text that may have
    // been string-appended onto the prompt by an earlier implementation is stripped, since
    // that guard is now applied structurally via antiEarlyHangupEnabled instead.
    //
    // Stripped by PATTERN, not by an exact match against the current HANGUP_GUARD constant —
    // confirmed against live production data that at least one earlier script
    // (workflow-build/build-telugu.mjs) baked in a differently-worded variant of this same
    // guard. An exact-string strip silently failed to remove it, which would have made the
    // very first live-config save re-append the new guard on top of the old one: the exact
    // compounding bug this refactor exists to fix. Match loosely on the recognizable core
    // ("Do not end the call or mark the lead as not interested ... hung up.") plus any
    // immediately-following sentence about hesitant callers, however it happens to be worded.
    const HANGUP_GUARD_PATTERN = /\s*Do not end the call or mark the lead as not interested[\s\S]*?hung up\.(?:\s*A hesitant[\s\S]*?reason to give up on the call\.)?/;
    const live = await this.dograh.getRawGlobalPrompt(language).catch(() => '');
    const seeded: RawPersonaConfig = {
      ...DEFAULT_RAW_CONFIG,
      persona: live.replace(HANGUP_GUARD_PATTERN, '').trim(),
      antiEarlyHangupEnabled: live.includes('Do not end the call'),
    };
    await this.saveRawConfig(tenantId, language, seeded);
    return seeded;
  }

  private async saveRawConfig(tenantId: string, language: string, config: RawPersonaConfig): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const settings = (tenant?.settings as any) || {};
    settings.voiceAgentPersona = { ...(settings.voiceAgentPersona || {}), [language]: config };
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { settings } });
  }

  async getSettings(tenantId: string, language = 'te') {
    const [raw, meta] = await Promise.all([
      this.getRawConfig(tenantId, language),
      this.dograh.getWorkflowMeta(language),
    ]);
    return {
      greeting: meta.greeting,
      persona: raw.persona,
      voicemailDetectionEnabled: meta.voicemailDetectionEnabled,
      antiEarlyHangupEnabled: raw.antiEarlyHangupEnabled,
      stylePackEnabled: raw.stylePackEnabled,
      aiAcknowledgementEnabled: raw.aiAcknowledgementEnabled,
      checklistCopy: meta.checklistCopy,
    };
  }

  async updateSettings(
    tenantId: string,
    language: string,
    changes: { greeting?: string; persona?: string; antiEarlyHangupEnabled?: boolean; checklistCopy?: string; stylePackEnabled?: boolean; aiAcknowledgementEnabled?: boolean },
  ) {
    const current = await this.getRawConfig(tenantId, language);
    const next: RawPersonaConfig = {
      persona: changes.persona ?? current.persona,
      stylePackEnabled: changes.stylePackEnabled ?? current.stylePackEnabled,
      aiAcknowledgementEnabled: changes.aiAcknowledgementEnabled ?? current.aiAcknowledgementEnabled,
      antiEarlyHangupEnabled: changes.antiEarlyHangupEnabled ?? current.antiEarlyHangupEnabled,
    };
    await this.saveRawConfig(tenantId, language, next);

    // Every save is a clean rebuild from the raw config, never a mutation of the previous
    // compiled text — this is what makes repeated saves idempotent.
    const composed = composeGlobalPrompt({ ...next, language });
    const tasks: Promise<void>[] = [this.dograh.setGlobalPrompt(language, composed)];
    if (changes.greeting !== undefined) tasks.push(this.dograh.updateGreeting(language, changes.greeting));
    if (changes.checklistCopy !== undefined) tasks.push(this.dograh.updateChecklistCopy(language, changes.checklistCopy));
    await Promise.all(tasks);

    return this.getSettings(tenantId, language);
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
    const transcript = r.transcript || r.call_transcript || r.gathered_context?.transcript || r.gathered_context?.call_transcript || null;
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
      transcript,
      gatheredContext: r.gathered_context || {},
      // Automated naturalness score (see call-quality.ts) — same instrument the style pack
      // was tuned against, so a prompt regression shows up here on the very next call.
      quality: transcript ? lintTranscript(transcript) : null,
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

  async listVoices(provider: string, language?: string) {
    return this.dograh.listVoices(provider, language);
  }

  async getVoiceConfig() {
    const cfg = await this.dograh.getModelConfiguration();
    return {
      provider: cfg?.tts?.provider ?? null,
      voice: cfg?.tts?.voice ?? null,
      speed: cfg?.tts?.speed ?? null,
      language: cfg?.tts?.language ?? null,
    };
  }

  async setVoice(provider: string, voiceId: string, speed?: number, language?: string) {
    await this.dograh.setTtsVoice(provider, voiceId, speed, language);
    return this.getVoiceConfig();
  }

  async setStt(provider: string, model: string, language?: string) {
    await this.dograh.setStt(provider, model, language);
    const cfg = await this.dograh.getModelConfiguration();
    return { provider: cfg?.stt?.provider ?? null, model: cfg?.stt?.model ?? null, language: cfg?.stt?.language ?? null };
  }

  async getAmbientNoiseUploadUrl(language: string, filename: string, fileSize: number, mimeType?: string) {
    return this.dograh.getAmbientNoiseUploadUrl(language, filename, fileSize, mimeType);
  }

  async getAmbientNoise(language: string) {
    return this.dograh.getAmbientNoise(language);
  }

  async setAmbientNoise(language: string, changes: { enabled?: boolean; volume?: number; storageKey?: string }) {
    await this.dograh.setAmbientNoise(language, changes);
    return this.dograh.getAmbientNoise(language);
  }

  /** "Describe it, we build it" — pure draft generation, nothing touches the live call flow
   * yet. The caller must review this (and, for non-English drafts, get native sign-off) before
   * calling applyCallFlow. */
  async generateCallFlow(description: string, businessName?: string): Promise<GeneratedFlowDraft> {
    return this.flowGenerator.generate(description, businessName);
  }

  /** Replaces the live call-flow graph for a language with the (reviewed, possibly
   * user-edited) draft. Persona goes through the same raw-config + style-pack composition path
   * as the settings page, so it stays consistent with whatever style/hangup/AI-disclosure
   * toggles are already set for this tenant rather than being a second, divergent copy. */
  async applyCallFlow(tenantId: string, language: string, draft: GeneratedFlowDraft) {
    const raw = await this.getRawConfig(tenantId, language);
    const nextRaw: RawPersonaConfig = { ...raw, persona: draft.persona };
    await this.saveRawConfig(tenantId, language, nextRaw);
    const composed = composeGlobalPrompt(nextRaw);
    await this.dograh.applyGeneratedFlow(language, composed, draft);
    return this.getSettings(tenantId, language);
  }
}
