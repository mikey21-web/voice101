import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { VoiceAgentService } from './voice-agent.service';
import { ConversationsService } from '../conversations/conversations.service';
import { OutboundWebhookDispatchService } from '../shared/outbound-webhook-dispatch.service';
import { AutonomyGuardrailsService } from '../mikey/autonomy-guardrails.service';
import { AutonomousActionService } from '../mikey/autonomous-action.service';
import { PermissionGateService } from '../mikey/permission-gate.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PostCallDispatchService } from './post-call-dispatch.service';
import { LeadsService } from '../leads/leads.service';
import { AdvanceStageService } from '../leads/advance-stage.service';
import { AgentClientService } from '../agent/agent-client.service';
import { WhatsAppCloudAdapter } from '../shared/adapters/messaging.adapter';

interface ActionPlan {
  call?: { priority: number; lang: string };
  whatsapp?: { priority: number; text: string; templateId?: string };
  sms?: { priority: number; text: string };
  telegram?: { priority: number; text: string };
  email?: { priority: number; subject: string; html: string };
  waitHours?: number;
}

@Injectable()
export class LeadOrchestratorService {
  private readonly logger = new Logger(LeadOrchestratorService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private voiceAgent: VoiceAgentService,
    private conversations: ConversationsService,
    private outboundDispatch: OutboundWebhookDispatchService,
    @Inject(forwardRef(() => AutonomyGuardrailsService)) private guardrails: AutonomyGuardrailsService,
    @Inject(forwardRef(() => AutonomousActionService)) private autonomousAction: AutonomousActionService,
    @Inject(forwardRef(() => PermissionGateService)) private permissionGate: PermissionGateService,
    private approvals: ApprovalsService,
    private notifications: NotificationsService,
    @Inject(forwardRef(() => LeadsService)) private leadsService: LeadsService,
    private advanceStage: AdvanceStageService,
    private agentClient: AgentClientService,
    private whatsAppAdapter: WhatsAppCloudAdapter,
    private postCallDispatch: PostCallDispatchService,
  ) {}

  async onLeadCreated(leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { contact: true, campaign: true, tenant: { select: { settings: true } } },
    });
    if (!lead) { this.logger.warn(`Lead ${leadId} not found`); return; }

    const plan = await this.buildActionPlan(lead);
    if (!plan) return;

    const userId = lead.assignedAgentId || 'mikey-auto';

    const actions: Array<() => Promise<void>> = [];
    if (plan.call) actions.push(() => this.executeCall(lead, plan.call!.lang, lead.assignedAgentId || null));
    if (plan.whatsapp) actions.push(() => this.executeWhatsApp(lead, plan.whatsapp!.text, userId, plan.whatsapp!.templateId));
    if (plan.sms) actions.push(() => this.executeSms(lead, plan.sms!.text, userId));
    if (plan.telegram) actions.push(() => this.executeTelegram(lead, plan.telegram!.text, userId));
    if (plan.email) actions.push(() => this.executeEmail(lead, plan.email!.subject, plan.email!.html, userId));

    for (const action of actions) {
      try { await action(); } catch (e: any) { this.logger.error(`Action failed for lead ${leadId}: ${e.message}`); }
      if (plan.waitHours) await new Promise(r => setTimeout(r, plan.waitHours! * 1000));
    }
  }

  private async buildActionPlan(lead: any): Promise<ActionPlan | null> {
    const tenantSettings = (lead.tenant?.settings || {}) as any;
    const source = lead.source as string;
    const campaign = lead.campaign;
    const phone = lead.contact?.phone;
    const whatsapp = lead.contact?.whatsapp || phone;
    const metadata = (lead.metadata || {}) as any;
    const context = metadata._context || {};
    const aiIntent = context.aiIntent ?? 50;
    const aiUrgency = context.aiUrgency ?? 50;
    const segment = lead.segment;

    // Next best action logic based on lead context
    const campaignActions = this.campaignAutoActions(campaign);

    // Campaign actions override everything
    if (campaignActions && campaignActions.length > 0) {
      return this.buildPlanFromActions(campaignActions, lead, phone, whatsapp);
    }

    // A filled-out form is a deliberate, high-intent signal on its own — always call,
    // regardless of the generic aiIntent/aiUrgency heuristic below (which defaults to
    // a neutral 50/50 before context enrichment finishes and would otherwise route
    // this into the WhatsApp-only "warm" branch).
    if (source === 'FORM' && phone) {
      return this.buildPlanFromActions(this.sourceDefaults('FORM'), lead, phone, whatsapp);
    }

    // A Telegram lead only ever gets created because of an inbound message, and
    // webhooks.service.ts's dispatchInbound() already sends that message to the
    // conversational AI agent for a live reply — issuing our own canned greeting
    // here on top of it double-texts the lead on their very first message.
    if (source === 'TELEGRAM') {
      return null;
    }

    // Source defaults
    const sourceDefaults = this.sourceDefaults(source);

    // Lead-context-aware action selection
    const contextualActions: Array<{ type: string; priority: number; text?: string; lang?: string }> = [];

    // Hot leads with high urgency: call first
    if ((segment === 'HOT' || aiIntent >= 70) && aiUrgency >= 60 && phone) {
      contextualActions.push({ type: 'call', priority: 1, lang: this.detectLanguage(lead) });
      contextualActions.push({ type: 'whatsapp', priority: 2, text: this.immediateFollowUpText(lead) });
    }

    // Warm + high intent: WhatsApp first with details
    if (aiIntent >= 50 && aiIntent < 70 && whatsapp) {
      contextualActions.push({ type: 'whatsapp', priority: 1, text: this.defaultWhatsAppText(lead) });
    }

    // Cold or low intent: WhatsApp + SMS, no call
    if (segment === 'COLD' || aiIntent < 30) {
      if (whatsapp) contextualActions.push({ type: 'whatsapp', priority: 1, text: this.defaultWhatsAppText(lead) });
      if (phone) contextualActions.push({ type: 'sms', priority: 2, text: this.defaultSmsText(lead) });
    }

    // Fallback: source defaults
    const finalActions = contextualActions.length > 0 ? contextualActions : sourceDefaults;
    if (finalActions.length === 0) {
      if (phone && tenantSettings.autoCallOnLead !== false) {
        return { call: { priority: 1, lang: this.detectLanguage(lead) } };
      }
      return null;
    }

    return this.buildPlanFromActions(finalActions, lead, phone, whatsapp);
  }

  private buildPlanFromActions(actions: any[], lead: any, phone: string, whatsapp: string): ActionPlan | null {
    const plan: ActionPlan = {};
    for (const action of actions) {
      if (action.type === 'call' && phone) {
        plan.call = { priority: action.priority || 1, lang: action.lang || this.detectLanguage(lead) };
      }
      if (action.type === 'whatsapp' && whatsapp) {
        plan.whatsapp = { priority: action.priority || 2, text: action.text || this.defaultWhatsAppText(lead), templateId: action.templateId };
      }
      if (action.type === 'sms' && phone) {
        plan.sms = { priority: action.priority || 3, text: action.text || this.defaultSmsText(lead) };
      }
      if (action.type === 'telegram' && (whatsapp || phone)) {
        plan.telegram = { priority: action.priority || 1, text: action.text || this.defaultWhatsAppText(lead) };
      }
      if (action.type === 'email' && lead.contact?.email) {
        plan.email = { priority: action.priority || 4, subject: action.subject || 'Thanks for your interest', html: action.html || this.defaultEmailHtml(lead) };
      }
    }
    return Object.keys(plan).length ? plan : null;
  }

  private campaignAutoActions(campaign: any): any[] {
    if (!campaign) return [];
    const channels = (typeof campaign.channels === 'string' ? JSON.parse(campaign.channels) : campaign.channels) as any[];
    const actions = channels.filter((c: any) => c.autoAction || c.onLeadCreate);
    if (actions.length) return actions;
    const raw = (campaign as any).autoActions || campaign.metadata?.autoActions || null;
    if (raw) return typeof raw === 'string' ? JSON.parse(raw) : raw;
    return [];
  }

  private sourceDefaults(source: string): any[] {
    const map: Record<string, any[]> = {
      META_ADS: [{ type: 'whatsapp', priority: 1, text: 'Hi! Thanks for reaching out via our ad. How can I help you today?' }],
      GOOGLE_ADS: [{ type: 'whatsapp', priority: 1, text: 'Thanks for your inquiry! Let me know if you need more details.' }],
      WHATSAPP: [{ type: 'call', priority: 1 }],
      FORM: [{ type: 'call', priority: 1 }, { type: 'whatsapp', priority: 2, text: 'Thanks for your interest! Shall I share more details?' }],
      PHONE_CALL: [{ type: 'whatsapp', priority: 1, text: 'We missed your call. Let us know how we can help!' }],
      PORTAL: [{ type: 'call', priority: 1 }],
      CHATBOT: [{ type: 'call', priority: 1 }],
      TELEGRAM: [{ type: 'telegram', priority: 1, text: 'Hi! Thanks for reaching out on Telegram. I\'m Mikey, your virtual assistant. How can I help you with properties today?' }],
    };
    return map[source] || [];
  }

  private async executeCall(lead: any, lang: string, userId: string | null): Promise<void> {
    if (!lead.contact?.phone) return;
    const gate = await this.permissionGate.evaluate(lead.id, 'outbound_call', 'VOICE');
    if (gate.verdict === 'BLOCK') {
      this.logger.warn(`Call blocked by gate for lead ${lead.id}: ${gate.reason}`);
      return;
    }
    if (gate.verdict === 'REQUIRE_APPROVAL') {
      // Queue for approval instead of executing
      await this.createApprovalRequest(lead.id, 'call', 'Outbound call', lead.contact?.phone);
      this.logger.log(`Call queued for approval for lead ${lead.id}`);
      return;
    }
    this.logger.log(`Auto-calling lead ${lead.id} (${lead.contact.name}) in ${lang}`);
    const result = await this.voiceAgent.callLead(lead.id, userId, lang);
    if (!result.success) this.logger.warn(`Auto-call failed for ${lead.id}: ${result.message}`);
  }

  private async executeWhatsApp(lead: any, text: string, userId: string, templateId?: string): Promise<void> {
    const to = lead.contact?.whatsapp || lead.contact?.phone;
    if (!to) return;
    const gate = await this.permissionGate.evaluate(lead.id, 'whatsapp_reply', 'WHATSAPP', { text, templateId });
    if (gate.verdict === 'BLOCK') {
      this.logger.warn(`WhatsApp blocked by gate for lead ${lead.id}: ${gate.reason}`);
      return;
    }
    if (gate.verdict === 'REQUIRE_APPROVAL') {
      await this.createApprovalRequest(lead.id, 'whatsapp', text, to);
      return;
    }
    this.logger.log(`Auto-WhatsApp to lead ${lead.id}`);
    try {
      await this.conversations.create({ text, channel: 'WHATSAPP', direction: 'OUTBOUND', leadId: lead.id, contactId: lead.contactId }, userId);
    } catch (e: any) {
      if (e.name !== 'ForbiddenException') throw e;
      this.logger.warn(`WhatsApp blocked by policy for lead ${lead.id}: ${e.message}`);
    }
  }

  private async executeSms(lead: any, text: string, userId: string): Promise<void> {
    if (!lead.contact?.phone) return;
    const gate = await this.permissionGate.evaluate(lead.id, 'sms_reminder', 'SMS', { text });
    if (gate.verdict !== 'ALLOW') return;
    this.logger.log(`Auto-SMS to lead ${lead.id}`);
    try {
      await this.conversations.create({ text, channel: 'SMS', direction: 'OUTBOUND', leadId: lead.id, contactId: lead.contactId }, userId);
    } catch (e: any) {
      if (e.name !== 'ForbiddenException') throw e;
    }
  }

  private async executeTelegram(lead: any, text: string, userId: string): Promise<void> {
    const to = lead.contact?.whatsapp || lead.contact?.phone;
    if (!to) return;
    const gate = await this.permissionGate.evaluate(lead.id, 'telegram_reply', 'TELEGRAM', { text });
    if (gate.verdict === 'BLOCK') {
      this.logger.warn(`Telegram blocked by gate for lead ${lead.id}: ${gate.reason}`);
      return;
    }
    if (gate.verdict === 'REQUIRE_APPROVAL') {
      await this.createApprovalRequest(lead.id, 'telegram', text, to);
      return;
    }
    this.logger.log(`Auto-Telegram to lead ${lead.id}`);
    try {
      await this.conversations.create({ text, channel: 'TELEGRAM', direction: 'OUTBOUND', leadId: lead.id, contactId: lead.contactId }, userId);
    } catch (e: any) {
      if (e.name !== 'ForbiddenException') throw e;
      this.logger.warn(`Telegram blocked by policy for lead ${lead.id}: ${e.message}`);
    }
  }

  private async executeEmail(lead: any, subject: string, html: string, userId: string): Promise<void> {
    if (!lead.contact?.email) return;
    const gate = await this.permissionGate.evaluate(lead.id, 'email_followup', 'EMAIL', { text: subject });
    if (gate.verdict !== 'ALLOW') return;
    this.logger.log(`Auto-email to lead ${lead.id}`);
    try {
      await this.conversations.create({ text: html, subject, channel: 'EMAIL', direction: 'OUTBOUND', leadId: lead.id, contactId: lead.contactId }, userId);
    } catch (e: any) {
      if (e.name !== 'ForbiddenException') throw e;
    }
  }

  private async createApprovalRequest(leadId: string, action: string, detail: string, target: string): Promise<void> {
    try {
      const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, select: { tenantId: true } });
      if (!lead) return;
      await this.approvals.request(lead.tenantId, {
        type: `mikey_${action}`,
        entityType: 'lead',
        entityId: leadId,
        reason: `Mikey needs approval to ${action}: ${detail}`,
        requestedById: 'mikey-auto',
      });
    } catch {}
  }

  async handleCallWebhook(payload: any): Promise<void> {
    const { call_sid, lead_id, status, transcript, summary, duration_seconds, ended_reason } = payload;
    if (!lead_id) return;

    const lead = await this.prisma.lead.findUnique({
      where: { id: lead_id },
      select: { id: true, tenantId: true, assignedAgentId: true, contactId: true },
    });
    if (!lead) { this.logger.warn(`Call webhook: lead ${lead_id} not found`); return; }

    // The caller confirmed a WhatsApp number during the call (employee engine outcome) —
    // record it on the contact so the post-call dispatch goes to the number they actually
    // confirmed rather than the one the lead was captured with.
    const confirmedWhatsApp = payload.outcome?.whatsapp_number;
    if (confirmedWhatsApp && lead.contactId) {
      await this.prisma.contact.update({
        where: { id: lead.contactId },
        data: { whatsapp: String(confirmedWhatsApp) },
      }).catch((e) => this.logger.warn(`Failed to record confirmed WhatsApp for lead ${lead_id}: ${e.message}`));
    }

    const callStatus = this.mapCallStatus(status || 'COMPLETED', ended_reason);

    const existingCall = await this.prisma.callLog.findFirst({
      where: { leadId: lead_id, providerSid: call_sid },
      select: { id: true },
    });

    await this.prisma.callLog.updateMany({
      where: { leadId: lead_id, providerSid: call_sid },
      data: {
        status: callStatus,
        durationSec: duration_seconds ? Math.round(duration_seconds) : undefined,
        recordingUrl: payload.recording_url,
        transcript: transcript || undefined,
        summary: summary || undefined,
        outcome: payload.outcome || undefined,
      },
    });

    const userId = lead.assignedAgentId || (await this.prisma.user.findFirst({
      where: { tenantId: lead.tenantId, role: 'OWNER' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }))?.id || 'system';

    await this.prisma.internalNote.create({
      data: {
        leadId: lead_id,
        userId,
        content: `Call completed (${duration_seconds || '?'}s)\nTranscript: ${(transcript || 'N/A').slice(0, 2000)}\nSummary: ${(summary || 'N/A').slice(0, 1000)}`,
      },
    });

    if (payload.outcome || summary) {
      await this.processCallOutcome(lead_id, payload, userId);
    }

    this.outboundDispatch.dispatch('call.completed', {
      leadId: lead_id, callSid: call_sid, status: callStatus,
      durationSec: duration_seconds ? Math.round(duration_seconds) : undefined,
      transcript, summary, outcome: payload.outcome,
    }).catch((e) => this.logger.warn(`Outbound webhook dispatch failed for lead ${lead_id}: ${e.message}`));

    // Re-enter the decision loop: after a call, Mikey re-evaluates what to do next
    this.onLeadCreated(lead_id).catch((e: any) =>
      this.logger.warn(`Re-trigger orchestrator for lead ${lead_id} after call: ${e.message}`)
    );

    // Section 5 post-call send: WhatsApp the discussed details within 60s and
    // notify the assigned rep. Only on completed calls with a transcript/summary.
    if (callStatus === 'COMPLETED' && existingCall) {
      this.postCallDispatch.dispatchAfterCall({
        tenantId: lead.tenantId,
        leadId: lead_id,
        callLogId: existingCall.id,
      }).catch((e) => this.logger.warn(`Post-call dispatch failed for lead ${lead_id}: ${e.message}`));
    }

    this.logger.log(`Call webhook processed for lead ${lead_id}`);
  }

  private isTruthy(v: any): boolean {
    return v === true || v === 'true' || v === 'True';
  }

  /** Caller explicitly asked for a human mid-call (IVR handoff) — escalate immediately instead of waiting for the normal follow-up cadence. */
  private async escalateToHuman(leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, select: { tenantId: true, assignedAgentId: true, contact: { select: { name: true, phone: true } } } });
    if (!lead) return;

    await this.prisma.task.create({
      data: {
        leadId,
        title: `Callback requested — ${lead.contact?.name || 'caller'} asked to speak with a human`,
        priority: 'HIGH',
        dueAt: new Date(),
        status: 'pending',
        createdBy: 'mikey-auto',
      },
    }).catch(() => {});

    const recipients = lead.assignedAgentId
      ? [{ id: lead.assignedAgentId }]
      : await this.prisma.user.findMany({ where: { tenantId: lead.tenantId, role: { in: ['OWNER', 'ADMIN', 'MANAGER'] }, active: true }, select: { id: true } });

    for (const user of recipients) {
      await this.notifications.create({
        tenantId: lead.tenantId,
        userId: user.id,
        type: 'call_wants_human',
        title: 'Caller asked for a human',
        body: `${lead.contact?.name || 'A caller'} (${lead.contact?.phone || 'unknown number'}) asked the voice agent to be transferred to a real person.`,
        link: `#/leads/${leadId}`,
      }).catch(() => {});
    }
  }

  private async processCallOutcome(leadId: string, payload: any, userId: string): Promise<void> {
    if (this.isTruthy(payload.outcome?.wants_human)) {
      await this.escalateToHuman(leadId);
    }
    const outcome = payload.outcome
      ? this.mapStructuredOutcome(payload.outcome)
      : this.parseCallOutcome(payload.summary || '', payload.transcript || '');
    if (outcome.status) {
      const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, select: { tenantId: true } });
      if (lead) {
        await this.advanceStage.advanceStage({
          tenantId: lead.tenantId,
          leadId,
          to: outcome.status as any,
          actor: 'system',
          reason: 'voice call outcome',
        }).catch(() => {});
      }
    }
    if (outcome.followUpDays) {
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + outcome.followUpDays);
      await this.prisma.task.create({
        data: {
          leadId,
          title: outcome.followUpTitle || `Follow-up (${outcome.followUpDays}d)`,
          priority: outcome.followUpDays <= 2 ? 'HIGH' : 'MEDIUM',
          dueAt, status: 'pending', createdBy: 'mikey-auto',
        },
      }).catch(() => {});
    }
    if (payload.transcript) {
      try {
        await this.prisma.lead.update({
          where: { id: leadId },
          data: { metadata: { ...payload.metadata, _lastCallTranscript: (payload.transcript || '').slice(0, 5000) } },
        });
      } catch {}
    }

    // What the caller actually said (budget/interest/urgency) only becomes known once the
    // call finishes — write it into the same first-class fields the form/WhatsApp intake
    // path uses, then re-score, so a qualifying call can move a lead's segment just like
    // qualifying info from any other channel does.
    const fields = this.extractCallFields(payload.outcome || {}, payload.summary || '', payload.transcript || '');
    const { location, ...leadFields } = fields;
    if (leadFields.budget || leadFields.interest || leadFields.urgency || location) {
      const existingLead = await this.prisma.lead.findUnique({ where: { id: leadId }, select: { metadata: true } });
      const existingMeta = (existingLead?.metadata || {}) as any;
      await this.prisma.lead.update({
        where: { id: leadId },
        data: {
          ...leadFields,
          ...(location ? { metadata: { ...existingMeta, location } } : {}),
        },
      }).catch(() => {});
    }
    await this.leadsService.score(leadId).catch((e: any) =>
      this.logger.warn(`Post-call re-score failed for lead ${leadId}: ${e.message}`)
    );

    // Send matching property cards on every answered call — not just QUALIFIED/APPOINTMENT_BOOKED.
    // The lead already told us what they want on the call; waiting for a status gate means
    // they get nothing if Dograh maps the outcome differently than expected.
    if (outcome.status !== 'LOST') {
      this.sendPropertyMedia(leadId, payload.outcome || {}, payload.summary || '', payload.transcript || '').catch((e: any) =>
        this.logger.warn(`Property media send failed for lead ${leadId}: ${e.message}`)
      );
    }
  }

  private async sendPropertyMedia(leadId: string, outcome: any = {}, summary = '', transcript = ''): Promise<void> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        tenantId: true, interest: true, budget: true, metadata: true,
        contact: { select: { name: true, whatsapp: true, phone: true } },
      },
    });
    const to = lead?.contact?.whatsapp || lead?.contact?.phone;
    if (!to) return;

    const waConfig = {
      phoneNumberId: this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '',
      accessToken: this.config.get<string>('WHATSAPP_ACCESS_TOKEN') || '',
    };
    if (!waConfig.phoneNumberId || !waConfig.accessToken) {
      this.logger.warn('WhatsApp creds not set — skipping property media send');
      return;
    }

    // Extract all context: structured outcome → lead fields → transcript regex
    const extracted = this.extractCallFields(outcome, summary, transcript);
    const interest = extracted.interest || lead?.interest || '';
    const budget = extracted.budget || lead?.budget || '';
    const location = extracted.location || (lead?.metadata as any)?.location || '';

    // Search properties: match on type/config + location
    const PROPERTY_TYPES = ['APARTMENT', 'VILLA', 'PLOT', 'COMMERCIAL', 'PENTHOUSE', 'DUPLEX', 'STUDIO'];
    const bhkMatch = interest.match(/(\d)\s?bhk/i);
    const bedroomCount = bhkMatch ? parseInt(bhkMatch[1]) : undefined;
    const normalizedType = interest.replace(/\s+/g, '').replace(/\d+bhk/i, '').toUpperCase();
    const matchedType = PROPERTY_TYPES.includes(normalizedType) ? normalizedType : 'APARTMENT';

    const whereConditions: any[] = [];
    if (interest) whereConditions.push({ title: { contains: interest, mode: 'insensitive' as const } });
    if (matchedType) whereConditions.push({ propertyType: matchedType as any });
    if (bedroomCount) whereConditions.push({ bedrooms: bedroomCount });
    if (location) {
      whereConditions.push({ location: { contains: location, mode: 'insensitive' as const } });
      whereConditions.push({ title: { contains: location, mode: 'insensitive' as const } });
    }

    const properties = await this.prisma.property.findMany({
      where: {
        tenantId: lead!.tenantId,
        status: { not: 'SOLD' as any },
        OR: whereConditions.length ? whereConditions : [{ tenantId: lead!.tenantId }],
      },
      include: { images: { orderBy: { orderIndex: 'asc' }, take: 3 } },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    if (!properties.length) {
      this.logger.warn(`No matching properties for lead ${leadId} (interest="${interest}", location="${location}")`);
      return;
    }

    const firstName = lead!.contact!.name?.split(' ')[0] || 'there';
    const locationPart = location ? ` in ${location}` : '';
    const budgetPart = budget ? ` within ${budget}` : '';
    const configPart = interest ? interest : 'property';

    // Text summary first
    const intro = `Hi ${firstName}! Based on our call, here are ${properties.length} matching ${configPart}${locationPart}${budgetPart} options for you:\n\n` +
      properties.map((p, i) => {
        const price = p.price ? `₹${(Number(p.price) / 100).toLocaleString('en-IN')}` : 'Price on request';
        const loc = (p as any).location || '';
        return `${i + 1}. *${p.title}*\n   📍 ${loc || 'Location details shared separately'}\n   💰 ${price}\n   ${p.description ? p.description.slice(0, 80) + '...' : ''}`;
      }).join('\n\n') +
      '\n\nReply with a number to know more, or just call us back anytime! 🏠';

    await this.whatsAppAdapter.sendMessage(to, intro, waConfig);

    // Send up to 3 photos across all matched properties
    for (const property of properties) {
      const photo = property.images.find((i: any) => i.isPrimary) || property.images[0];
      if (photo?.url) {
        const caption = `${property.title}${(property as any).location ? ' — ' + (property as any).location : ''}`;
        await this.whatsAppAdapter.sendMessage(to, caption, {
          ...waConfig, mediaUrl: photo.url, mediaType: 'image', caption,
        }).catch((e: any) => this.logger.warn(`Photo send failed for ${property.id}: ${e.message}`));
      }
      if ((property as any).brochureUrl) {
        await this.whatsAppAdapter.sendMessage(to, `${property.title} — Brochure`, {
          ...waConfig,
          mediaUrl: (property as any).brochureUrl,
          mediaType: 'document',
          fileName: `${property.title.replace(/\s+/g, '_')}.pdf`,
        }).catch((e: any) => this.logger.warn(`Brochure send failed for ${property.id}: ${e.message}`));
      }
    }

    this.logger.log(`Property media sent to ${to} for lead ${leadId}: ${properties.map(p => p.title).join(', ')}`);
  }

  private extractCallFields(outcome: any, summary: string, transcript: string): { budget?: string; interest?: string; urgency?: string; location?: string } {
    const fields: { budget?: string; interest?: string; urgency?: string; location?: string } = {};
    // Structured outcome from Dograh takes priority — it's already parsed by the AI
    if (outcome.budget || outcome.budget_bracket) fields.budget = String(outcome.budget || outcome.budget_bracket);
    if (outcome.property_type || outcome.interest || outcome.configuration_requirement) fields.interest = String(outcome.property_type || outcome.interest || outcome.configuration_requirement);
    if (outcome.timeline) fields.urgency = String(outcome.timeline);
    if (outcome.location || outcome.preferred_location || outcome.area || outcome.locality) {
      fields.location = String(outcome.location || outcome.preferred_location || outcome.area || outcome.locality);
    }
    if (fields.budget && fields.interest && fields.urgency && fields.location) return fields;

    const text = `${summary} ${transcript}`.toLowerCase();
    if (!fields.budget) {
      const m = text.match(/([\d.]+)\s*(cr|crore|l|lakh)\b/i);
      if (m) fields.budget = m[0];
    }
    if (!fields.interest) {
      const m = text.match(/\b(\d\s?bhk|studio|villa|plot|penthouse|apartment|flat)\b/i);
      if (m) fields.interest = m[0];
    }
    if (!fields.urgency) {
      if (/\b(immediate|urgent|asap|this week|right away)\b/.test(text)) fields.urgency = 'immediate';
      else if (/\b(3 months|next quarter|soon)\b/.test(text)) fields.urgency = '3_months';
      else if (/\b(6 months|exploring|just looking)\b/.test(text)) fields.urgency = '6_months';
    }
    if (!fields.location) {
      // Common Hyderabad/Indian real-estate locality patterns — extend as needed
      const LOCALITY_PATTERN = /\b(gachibowli|hitech\s*city|madhapur|kondapur|nallagandla|kokapet|narsingi|financial\s*district|banjara\s*hills|jubilee\s*hills|manikonda|puppalaguda|tellapur|miyapur|kukatpally|bachupally|kompally|shamirpet|medchal|shadnagar|shamshabad|adibatla|tukkuguda|srisailam\s*highway|outer\s*ring\s*road|orr|whitefield|sarjapur|electronic\s*city|hsr\s*layout|koramangala|indiranagar|hebbal|devanahalli|yelahanka|jp\s*nagar|bannerghatta)\b/i;
      const m = text.match(LOCALITY_PATTERN);
      if (m) fields.location = m[0];
    }
    return fields;
  }

  private mapCallStatus(status: string, endedReason?: string): any {
    if (status === 'completed' || status === 'COMPLETED') return 'COMPLETED';
    if (status === 'failed' || status === 'FAILED') return 'FAILED';
    if (status === 'no-answer' || endedReason === 'no_answer') return 'NO_ANSWER';
    if (status === 'busy' || status === 'BUSY') return 'BUSY';
    return 'COMPLETED';
  }

  /** Mikey speaks Telugu only for this deployment - no per-lead language switching. */
  private detectLanguage(_lead: any): string {
    return 'te';
  }

  private mapStructuredOutcome(outcome: any): { status?: string; followUpDays?: number; followUpTitle?: string } {
    const callStatus = outcome.call_status;
    if (callStatus === 'wrong_number' || callStatus === 'not_interested') return { status: 'LOST' };
    if (outcome.wants_site_visit || outcome.site_visit_date) return { status: 'APPOINTMENT_BOOKED', followUpDays: 1, followUpTitle: 'Confirm site visit' };
    if (outcome.timeline === 'immediate' || outcome.timeline === '3_months') return { status: 'QUALIFIED', followUpDays: 1, followUpTitle: 'Send project details' };
    if (outcome.timeline === '6_months') return { followUpDays: 5, followUpTitle: 'Follow-up call' };
    return { followUpDays: 3, followUpTitle: 'Follow-up call' };
  }

  private parseCallOutcome(summary: string, transcript: string): { status?: string; followUpDays?: number; followUpTitle?: string } {
    const lower = (summary + ' ' + transcript).toLowerCase();
    if (lower.includes('not interested') || lower.includes('no thanks')) return { status: 'LOST' };
    if (lower.includes('site visit') || lower.includes('visit')) return { status: 'APPOINTMENT_BOOKED', followUpDays: 1, followUpTitle: 'Confirm site visit' };
    if (lower.includes('budget') || lower.includes('price') || lower.includes('cost')) return { followUpDays: 2, followUpTitle: 'Share pricing' };
    if (lower.includes('follow') || lower.includes('call back') || lower.includes('later')) return { followUpDays: 3, followUpTitle: 'Follow-up call' };
    if (lower.includes('interested') || lower.includes('yes') || lower.includes('want')) return { status: 'QUALIFIED', followUpDays: 1, followUpTitle: 'Send project details' };
    return { followUpDays: 3, followUpTitle: 'Follow-up call' };
  }

  private immediateFollowUpText(lead: any): string {
    return `Hi ${lead.contact?.name || 'there'}! I just tried calling you. Let me know the best time to reach you or if you have any questions right away.`;
  }

  private defaultWhatsAppText(lead: any): string {
    return `Hi ${lead.contact?.name || 'there'}! Thanks for your interest. I'm Mikey, your virtual assistant. How can I help you with properties today?`;
  }

  private defaultSmsText(lead: any): string {
    return `Hi ${lead.contact?.name || 'there'}! Thanks for reaching out. Reply anytime or call us for more details.`;
  }

  private defaultEmailHtml(lead: any): string {
    return `<p>Hi ${lead.contact?.name || 'there'},</p><p>Thanks for your interest! We'll be in touch shortly with more details.</p>`;
  }
}
