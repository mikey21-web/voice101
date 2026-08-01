import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import { LeadsService } from '../leads/leads.service';
import { ResolveLeadService } from '../leads/resolve-lead.service';
import { ConversationsService } from '../conversations/conversations.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AgentClientService } from '../agent/agent-client.service';
import { MetricsService } from '../monitoring/metrics.service';
import { TimelineService } from '../timeline/timeline.service';
import { envelopeDecrypt } from '../shared/crypto.util';
import { OutboundWebhookDispatchService } from '../shared/outbound-webhook-dispatch.service';
import { ConfigService } from '@nestjs/config';
import { FlowRuntimeService } from '../flows/flow-runtime.service';
import { getTenantId } from '../shared/tenant-helper';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  constructor(
    private prisma: PrismaService,
    private contactsService: ContactsService,
    private leadsService: LeadsService,
    private conversationsService: ConversationsService,
    private auditLogs: AuditLogsService,
    private agentClient: AgentClientService,
    private metrics: MetricsService,
    private timeline: TimelineService,
    private outboundDispatch: OutboundWebhookDispatchService,
    private config: ConfigService,
    private flowRuntime: FlowRuntimeService,
    private resolveLead: ResolveLeadService,
  ) {}

  // The "off switch" for the freeform AI agent — when a business has flipped to
  // FLOW mode, a configured flow drives the conversation instead of the LLM.
  // Falls back to the AI agent if FLOW mode is on but no flow actually handled
  // it (e.g. nothing configured yet), so a lead is never left hanging.
  private async tryFlow(leadId: string, contactId: string, channel: string, text: string): Promise<boolean> {
    const settings = await this.prisma.businessSettings.findFirst();
    if (settings?.agentMode !== 'FLOW') return false;
    return this.flowRuntime.handleInbound(leadId, contactId, channel, text);
  }

  private dispatchInbound(leadId: string, contactId: string, channel: string, text: string, triggerId: string, tenantId: string): void {
    this.tryFlow(leadId, contactId, channel, text)
      .then(handled => { if (!handled) this.agentClient.trigger(leadId, triggerId, channel, text, tenantId); })
      .catch(() => this.agentClient.trigger(leadId, triggerId, channel, text, tenantId));
  }

  // Stops the tap-loading spinner on the lead's phone; failure here shouldn't block the message flow.
  private async answerTelegramCallback(callbackQueryId: string): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) return;
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });
  }

  private idempotencyKey(parts: string[]): string { return parts.join(':').slice(0, 255); }
  private payloadHash(payload: any): string { return crypto.createHash('md5').update(JSON.stringify(payload, Object.keys(payload).sort())).digest('hex'); }

  async handleFormSubmit(provider: string, payload: any, req?: any) {
    const key = this.idempotencyKey([provider, 'form', payload.submissionId || this.payloadHash(payload)]);
    const existing = await this.prisma.webhookEvent.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { status: 'duplicate', result: existing.processedResult };

    // Phase 4: one resolve path. This used to dedupe the contact and then always
    // create a lead, so the same buyer arriving from four portals became four
    // leads and four salespeople rang one person.
    const resolved = await this.resolveLead.resolveLead({
      tenantId: getTenantId(req),
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      whatsapp: payload.whatsapp,
      company: payload.company,
      source: 'FORM',
      message: payload.message,
      interest: payload.interest,
      budget: payload.budget,
      metadata: payload,
      req,
    });
    if (payload.language) {
      const contactRow = await this.prisma.contact.findUnique({ where: { id: resolved.contactId } });
      await this.prisma.contact.update({
        where: { id: resolved.contactId },
        data: { metadata: { ...(contactRow?.metadata as object || {}), language: payload.language } },
      }).catch(() => {});
    }
    const contact = await this.prisma.contact.findUnique({ where: { id: resolved.contactId } });
    const lead = await this.prisma.lead.findUnique({ where: { id: resolved.leadId } });
    const result = { contact, lead, resolution: { isReturning: resolved.isReturning, reusedExistingLead: resolved.reusedExistingLead } };
    await this.prisma.webhookEvent.create({ data: { provider, eventType: 'form_submit', idempotencyKey: key, rawPayload: payload, processedResult: result } });
    await this.auditLogs.log('webhook_processed', 'WebhookEvent', key, undefined, { provider, eventType: 'form_submit' });
    this.metrics.incrementCounter('webhooks_processed_total', { provider, status: 'success' });
    return { data: result };
  }

  async handleWhatsApp(provider: string, payload: any, req?: any) {
    const entry = payload?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) return { status: 'ignored', reason: 'no webhook value' };

    // Handle status callbacks (sent, delivered, read, failed) from Meta
    if (value.statuses?.length) {
      return this.handleWhatsAppStatuses(value.statuses);
    }

    // Handle inbound messages
    const msg = value.messages?.[0];
    if (!msg) return { status: 'ignored', reason: 'no messages' };

    const msgId = msg.id;
    const key = this.idempotencyKey([provider, 'whatsapp', msgId]);
    const existing = await this.prisma.webhookEvent.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { status: 'duplicate', result: existing.processedResult };

    const fromNumber = msg.from;
    // A tapped button/list option arrives as msg.interactive, not msg.text — without this,
    // every reply to a send_options message would be read as an empty string.
    const text = msg.text?.body || msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';

    const contactName = msg.context?.name || value?.contacts?.[0]?.profile?.name || '';
    const contact = await this.contactsService.findOrCreate({ name: contactName, phone: fromNumber, whatsapp: fromNumber }, req);

    const existingLead = await this.prisma.lead.findFirst({
      where: {
        contactId: contact.id,
        status: { notIn: ['LOST', 'CONVERTED', 'SPAM'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    let lead;
    if (existingLead) {
      lead = existingLead;
    } else {
      lead = await this.leadsService.create({ contactId: contact.id, source: 'WHATSAPP', message: text, metadata: { from: fromNumber, timestamp: msg.timestamp, msgId } });
      // New lead from ad click — send qualification questions if configured
      await this.maybeSendQualificationQs(lead.id, contact.id, lead.tenantId || contact.tenantId);
    }

    const stopPattern = /^\s*(stop|unsubscribe|cancel|opt.?out)\s*$/i;
    if (stopPattern.test(text.trim())) {
      await this.prisma.contact.update({
        where: { id: contact.id },
        data: { consentStatus: 'opted_out', optedOutAt: new Date() },
      });
      await this.prisma.consentEvent.create({
        data: { contactId: contact.id, channel: 'WHATSAPP', action: 'opt_out', source: 'webhook' },
      });
      await this.conversationsService.create({
        text: "You've been unsubscribed. You won't receive further messages from us.",
        channel: 'WHATSAPP', direction: 'OUTBOUND', leadId: lead.id, contactId: contact.id,
      });
    }

    await this.conversationsService.create({
      text, channel: 'WHATSAPP', direction: 'INBOUND', providerMessageId: msgId,
      leadId: lead.id, contactId: contact.id, metadata: { from: fromNumber, timestamp: msg.timestamp },
    });

    // FAQ auto-reply: check inbound text against tenant's keyword→answer map
    await this.maybeReplyFaq(lead.id, contact.id, text, lead.tenantId || contact.tenantId);

    const result = { contact, lead };
    await this.prisma.webhookEvent.create({
      data: { provider, eventType: 'whatsapp_message', idempotencyKey: key, rawPayload: payload, processedResult: result },
    });

    this.dispatchInbound(lead.id, contact.id, 'WHATSAPP', text, msgId, lead.tenantId || contact.tenantId);

    this.metrics.incrementCounter('webhooks_processed_total', { provider, status: 'success' });
    return { data: result };
  }

  /** Send qualification questions when a new lead comes from WhatsApp (ad click). */
  private async maybeSendQualificationQs(leadId: string, contactId: string, tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const questions = (tenant?.settings as any)?.qualificationQuestions as string | undefined;
    if (!questions?.trim()) return;
    await this.conversationsService.create({ leadId, contactId, channel: 'WHATSAPP', direction: 'OUTBOUND', text: questions.trim() });
  }

  /** Check inbound message against tenant's FAQ keyword map and auto-reply if matched. */
  private async maybeReplyFaq(leadId: string, contactId: string, text: string, tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const faqs = (tenant?.settings as any)?.faqs as Record<string, string> | undefined;
    if (!faqs) return;
    const lower = text.toLowerCase();
    for (const [keywords, answer] of Object.entries(faqs)) {
      if (keywords.split(',').some(k => lower.includes(k.trim()))) {
        await this.conversationsService.create({ leadId, contactId, channel: 'WHATSAPP', direction: 'OUTBOUND', text: answer });
        return;
      }
    }
  }

  private async handleWhatsAppStatuses(statuses: any[]) {
    const results: any[] = [];
    for (const s of statuses) {
      const statusMap: Record<string, string> = {
        sent: 'sent',
        delivered: 'delivered',
        read: 'read',
        failed: 'failed',
      };
      const deliveryStatus = statusMap[s.status] || 'pending';
      const msgId = s.id;

      if (msgId) {
        const updated = await this.prisma.conversationMessage.updateMany({
          where: { providerMessageId: msgId },
          data: {
            deliveryStatus,
            metadata: {
              ...(s.conversation ? { waConversationId: s.conversation.id, waConversationExpiresAt: s.conversation.expires_at } : {}),
              waStatusTimestamp: s.timestamp,
              waStatus: s.status,
              waError: s.errors || undefined,
            } as any,
          },
        });
        if (updated.count > 0) {
          const msg = await this.prisma.conversationMessage.findFirst({ where: { providerMessageId: msgId }, select: { leadId: true } });
          if (msg) this.timeline.recordDeliveryUpdated(msg.leadId, 'WhatsApp', deliveryStatus).catch(() => {});
        }
      }
      results.push({ messageId: msgId, status: deliveryStatus });
    }
    return { data: { statuses: results } };
  }

  async handleTelegram(payload: any, req?: any) {
    // A tapped inline-keyboard button arrives as callback_query, not message — normalize
    // it into the same shape so the rest of this function needs no separate branch.
    const cb = payload?.callback_query;
    const msg = cb?.message ? { ...cb.message, from: cb.from, text: cb.data } : payload?.message;
    if (!msg?.chat?.id) return { status: 'ignored', reason: 'no chat message' };
    if (cb) this.answerTelegramCallback(cb.id).catch(() => {});

    const chatId = String(msg.chat.id);
    const text = msg.text || '';
    const msgId = cb ? `cb-${cb.id}` : String(msg.message_id);
    const key = this.idempotencyKey(['telegram', chatId, msgId]);

    const existing = await this.prisma.webhookEvent.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { status: 'duplicate', result: existing.processedResult };

    const firstName = msg.from?.first_name || msg.chat?.first_name || 'Telegram User';
    const lastName = msg.from?.last_name || '';
    const userName = msg.from?.username || '';

    const contact = await this.contactsService.findOrCreate({
      name: `${firstName}${lastName ? ' ' + lastName : ''}`.trim() || 'Telegram User',
      phone: chatId,
      whatsapp: chatId,
    }, req);

    const existingLead = await this.prisma.lead.findFirst({
      where: {
        contactId: contact.id,
        status: { notIn: ['LOST', 'CONVERTED', 'SPAM'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    let lead;
    if (existingLead) {
      lead = existingLead;
    } else {
      lead = await this.leadsService.create({ contactId: contact.id, source: 'TELEGRAM', message: text, metadata: payload });
    }

    // Auto opt-in on any inbound message (implicit consent via Telegram message)
    if (contact.consentStatus !== 'opted_in') {
      await this.prisma.contact.update({
        where: { id: contact.id },
        data: { consentStatus: 'opted_in' },
      });
      await this.prisma.consentEvent.create({
        data: { contactId: contact.id, channel: 'TELEGRAM', action: 'opt_in', source: 'webhook' },
      });
    }

    // Handle STOP commands for consent/opt-out
    const stopPattern = /^\s*(stop|unsubscribe|cancel|opt.?out)\s*$/i;
    if (stopPattern.test(text.trim())) {
      await this.prisma.contact.update({
        where: { id: contact.id },
        data: { consentStatus: 'opted_out', optedOutAt: new Date() },
      });
      await this.prisma.consentEvent.create({
        data: { contactId: contact.id, channel: 'TELEGRAM', action: 'opt_out', source: 'webhook' },
      });
      await this.conversationsService.create({
        text: "You've been unsubscribed. You won't receive further messages from us.",
        channel: 'TELEGRAM',
        direction: 'OUTBOUND',
        leadId: lead.id,
        contactId: contact.id,
      });
    }

    await this.conversationsService.create({
      text, channel: 'TELEGRAM', direction: 'INBOUND',
      providerMessageId: msgId, leadId: lead.id, contactId: contact.id,
      metadata: payload,
    });

    const result = { contact, lead };
    await this.prisma.webhookEvent.create({
      data: { provider: 'telegram', eventType: 'telegram_message', idempotencyKey: key, rawPayload: payload, processedResult: result },
    });

    this.dispatchInbound(lead.id, contact.id, 'TELEGRAM', text, msgId || key, lead.tenantId || contact.tenantId);

    this.metrics.incrementCounter('webhooks_processed_total', { provider: 'telegram', status: 'success' });
    return { data: result };
  }

  async handlePayment(provider: string, payload: any) {
    const key = this.idempotencyKey([provider, 'payment', payload.paymentId || payload.id || this.payloadHash(payload)]);
    const existing = await this.prisma.webhookEvent.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { status: 'duplicate', result: existing.processedResult };
    const result = { payment: payload, status: 'received' };
    await this.prisma.webhookEvent.create({ data: { provider, eventType: 'payment', idempotencyKey: key, rawPayload: payload, processedResult: result } });
    this.metrics.incrementCounter('webhooks_processed_total', { provider, status: 'success' });
    return { data: result };
  }

  async handleSocialWebhook(payload: any, req?: any) {
    const source = (payload.source || 'social').toLowerCase();
    const key = this.idempotencyKey([source, 'social_lead', payload.leadId || payload.email || payload.phone || this.payloadHash(payload)]);
    const existing = await this.prisma.webhookEvent.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { status: 'duplicate', result: existing.processedResult };

    const contact = await this.contactsService.findOrCreate({
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
    }, req);

    const mappedSource = this.mapSocialSource(source);

    const lead = await this.leadsService.create({
      contactId: contact.id,
      source: mappedSource,
      message: payload.message || '',
      metadata: {
        socialSource: source,
        originalPayload: payload,
        ...(payload.metadata || {}),
      },
    });

    await this.conversationsService.create({
      text: payload.message || 'Social media lead captured',
      channel: 'SOCIAL_DM',
      direction: 'INBOUND',
      leadId: lead.id,
      contactId: contact.id,
      metadata: { source, originalPayload: payload },
    });

    const result = { contact, lead };
    await this.prisma.webhookEvent.create({
      data: { provider: source, eventType: 'social_lead', idempotencyKey: key, rawPayload: payload, processedResult: result },
    });
    await this.auditLogs.log('webhook_processed', 'WebhookEvent', key, undefined, { provider: source, eventType: 'social_lead' });

    this.agentClient.trigger(lead.id, key, 'SOCIAL_DM', payload.message || '', lead.tenantId || contact.tenantId);

    this.metrics.incrementCounter('webhooks_processed_total', { provider: source, status: 'success' });
    return { data: { leadId: lead.id, contactId: contact.id } };
  }

  async handleVoiceIncoming(payload: any, req?: any) {
    const callSid = payload.CallSid || payload.callSid;
    if (!callSid) return { status: 'ignored', reason: 'no CallSid' };

    const key = this.idempotencyKey(['twilio', 'voice_incoming', callSid]);
    const existing = await this.prisma.webhookEvent.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { status: 'duplicate', result: existing.processedResult };

    const fromNumber = payload.From || payload.from || '';
    const toNumber = payload.To || payload.to || '';

    // Find or create a contact by phone number
    const contact = await this.contactsService.findOrCreate({
      name: payload.callerName || `Caller ${fromNumber}`,
      phone: fromNumber,
    }, req);

    // Check for an active lead or create one
    const existingLead = await this.prisma.lead.findFirst({
      where: {
        contactId: contact.id,
        status: { notIn: ['LOST', 'CONVERTED', 'SPAM'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    let lead;
    if (existingLead) {
      lead = existingLead;
    } else {
      lead = await this.leadsService.create({
        contactId: contact.id,
        source: 'PHONE_CALL',
        message: `Incoming call from ${fromNumber}`,
        metadata: { callSid, from: fromNumber, to: toNumber, callStatus: payload.CallStatus },
      });
    }

    await this.conversationsService.create({
      text: `Incoming call from ${fromNumber} (SID: ${callSid})`,
      channel: 'PHONE_CALL',
      direction: 'INBOUND',
      providerMessageId: callSid,
      leadId: lead.id,
      contactId: contact.id,
      metadata: payload,
    });

    const result = { contact, lead, callSid };
    await this.prisma.webhookEvent.create({
      data: { provider: 'twilio', eventType: 'voice_incoming', idempotencyKey: key, rawPayload: payload, processedResult: result },
    });
    await this.auditLogs.log('webhook_processed', 'WebhookEvent', key, undefined, { provider: 'twilio', eventType: 'voice_incoming' });

    this.agentClient.trigger(lead.id, callSid, 'PHONE_CALL', `Incoming call from ${fromNumber}`, lead.tenantId || contact.tenantId);

    this.metrics.incrementCounter('webhooks_processed_total', { provider: 'twilio', status: 'success' });
    return { data: result };
  }

  async handleVoiceStatus(payload: any) {
    const callSid = payload.CallSid || payload.callSid;
    if (!callSid) return { status: 'ignored', reason: 'no CallSid' };

    const key = this.idempotencyKey(['twilio', 'voice_status', callSid, payload.CallStatus || 'status']);
    const existing = await this.prisma.webhookEvent.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { status: 'duplicate', result: existing.processedResult };

    const result = {
      callSid,
      status: payload.CallStatus,
      direction: payload.Direction,
      from: payload.From,
      to: payload.To,
      duration: payload.CallDuration || payload.Duration,
      recordingUrl: payload.RecordingUrl,
      answeredBy: payload.AnsweredBy,
      timestamp: payload.Timestamp,
    };

    // Find the conversation message associated with this call to update delivery status
    if (payload.CallStatus === 'completed') {
      const upd = await this.prisma.conversationMessage.updateMany({
        where: { providerMessageId: callSid },
        data: { deliveryStatus: 'delivered' },
      });
      if (upd.count > 0) {
        const msg = await this.prisma.conversationMessage.findFirst({ where: { providerMessageId: callSid }, select: { leadId: true } });
        if (msg) this.timeline.recordDeliveryUpdated(msg.leadId, 'Call', 'delivered').catch(() => {});
      }
    } else if (payload.CallStatus === 'busy' || payload.CallStatus === 'failed' || payload.CallStatus === 'no-answer') {
      const upd = await this.prisma.conversationMessage.updateMany({
        where: { providerMessageId: callSid },
        data: { deliveryStatus: 'failed' },
      });
      if (upd.count > 0) {
        const msg = await this.prisma.conversationMessage.findFirst({ where: { providerMessageId: callSid }, select: { leadId: true } });
        if (msg) this.timeline.recordDeliveryUpdated(msg.leadId, 'Call', 'failed').catch(() => {});
      }
    }

    await this.prisma.webhookEvent.create({
      data: {
        provider: 'twilio',
        eventType: `voice_status_${payload.CallStatus || 'unknown'}`,
        idempotencyKey: key,
        rawPayload: payload,
        processedResult: result,
      },
    });

    // Record in lead timeline if we can find the lead
    if (payload.RecordingUrl || ['completed', 'busy', 'failed', 'no-answer'].includes(payload.CallStatus)) {
      const msg = await this.prisma.conversationMessage.findFirst({ where: { providerMessageId: callSid }, select: { leadId: true } });
      if (msg) this.timeline.recordCall(msg.leadId, payload.CallStatus, payload.RecordingUrl).catch(() => {});
    }

    this.metrics.incrementCounter('webhooks_processed_total', { provider: 'twilio', status: 'success' });
    return { data: result };
  }

  async handleWasenderWebhook(payload: any, req?: any) {
    const event = payload?.event;
    if (!event) return { status: 'ignored', reason: 'no event type' };

    const key = this.idempotencyKey(['wasender', event, payload.data?.key?.id || payload.data?.key?.remoteJid || this.payloadHash(payload)]);
    const existing = await this.prisma.webhookEvent.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { status: 'duplicate', result: existing.processedResult };

    // ── messages.update — delivery status callback ─────────────────
    if (event === 'messages.update') {
      const statusCode = payload.data?.update?.status;
      const providerMsgId = payload.data?.key?.id;
      const statusMap: Record<number, string> = { 0: 'failed', 1: 'pending', 2: 'sent', 3: 'delivered', 4: 'read', 5: 'read' };
      const deliveryStatus = statusMap[statusCode] || 'pending';

      if (providerMsgId) {
        const updated = await this.prisma.conversationMessage.updateMany({
          where: { providerMessageId: providerMsgId },
          data: {
            deliveryStatus,
            metadata: { waStatus: statusCode, waStatusTimestamp: Date.now(), wasenderEvent: event } as any,
          },
        });
        if (updated.count > 0) {
          const msg = await this.prisma.conversationMessage.findFirst({
            where: { providerMessageId: providerMsgId },
            select: { leadId: true },
          });
          if (msg) this.timeline.recordDeliveryUpdated(msg.leadId, 'WhatsApp', deliveryStatus).catch(() => {});
        }
      }

      const result = { event, providerMessageId: providerMsgId, deliveryStatus };
      await this.prisma.webhookEvent.create({
        data: { provider: 'wasender', eventType: 'messages.update', idempotencyKey: key, rawPayload: payload, processedResult: result },
      });
      this.metrics.incrementCounter('webhooks_processed_total', { provider: 'wasender', status: 'success' });
      return { data: result };
    }

    // ── messages.upsert — inbound message ──────────────────────────
    if (event === 'messages.upsert') {
      const msg = payload.data?.message || payload.data?.messages?.[0];
      if (!msg) return { status: 'ignored', reason: 'no message in upsert' };

      const remoteJid: string = msg.key?.remoteJid || '';
      const fromNumber = remoteJid.replace(/[^0-9]/g, '').replace(/^91/, '');
      const msgId: string = msg.key?.id || '';
      const text: string = msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || msg.message?.imageMessage?.caption
        || '';

      const contactName = payload.data?.name || `Wasender User ${fromNumber.slice(-4)}`;
      const contact = await this.contactsService.findOrCreate({
        name: contactName,
        phone: fromNumber,
        whatsapp: fromNumber,
      }, req);

      const existingLead = await this.prisma.lead.findFirst({
        where: { contactId: contact.id, status: { notIn: ['LOST', 'CONVERTED', 'SPAM'] } },
        orderBy: { createdAt: 'desc' },
      });

      const lead = existingLead || await this.leadsService.create({
        contactId: contact.id,
        source: 'WHATSAPP',
        message: text,
        metadata: { from: fromNumber, timestamp: Date.now(), msgId, provider: 'wasender' },
      });

      const stopPattern = /^\s*(stop|unsubscribe|cancel|opt.?out)\s*$/i;
      if (text && stopPattern.test(text.trim())) {
        await this.prisma.contact.update({
          where: { id: contact.id },
          data: { consentStatus: 'opted_out', optedOutAt: new Date() },
        });
        await this.prisma.consentEvent.create({
          data: { contactId: contact.id, channel: 'WHATSAPP', action: 'opt_out', source: 'wasender_webhook' },
        });
      }

      await this.conversationsService.create({
        text, channel: 'WHATSAPP', direction: 'INBOUND', providerMessageId: msgId,
        leadId: lead.id, contactId: contact.id,
        metadata: { from: fromNumber, timestamp: Date.now(), provider: 'wasender' },
      });

      const result = { contact, lead, providerMessageId: msgId };
      await this.prisma.webhookEvent.create({
        data: { provider: 'wasender', eventType: 'messages.upsert', idempotencyKey: key, rawPayload: payload, processedResult: result },
      });

      this.dispatchInbound(lead.id, contact.id, 'WHATSAPP', text, msgId || key, lead.tenantId || contact.tenantId);
      this.metrics.incrementCounter('webhooks_processed_total', { provider: 'wasender', status: 'success' });
      return { data: result };
    }

    // ── catch-all — audit unknown events ───────────────────────────
    const result = { received: true, event };
    await this.prisma.webhookEvent.create({
      data: { provider: 'wasender', eventType: event, idempotencyKey: key, rawPayload: payload, processedResult: result },
    });
    this.metrics.incrementCounter('webhooks_processed_total', { provider: 'wasender', status: 'success' });
    return { data: result };
  }

  // ─── OpenWA (self-hosted WhatsApp gateway) ─────────────────────────
  async handleOpenwaWebhook(payload: any) {
    const event = payload?.event;
    if (!event) return { status: 'ignored', reason: 'no event type' };

    const key = this.idempotencyKey(['openwa', event, payload.idempotencyKey || payload.data?.id || this.payloadHash(payload)]);
    const existing = await this.prisma.webhookEvent.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { status: 'duplicate', result: existing.processedResult };

    if (event === 'message.ack' || event === 'message.failed') {
      const providerMsgId = payload.data?.messageId || payload.data?.id;
      const deliveryStatus = payload.data?.status || 'pending';

      if (providerMsgId) {
        const updated = await this.prisma.conversationMessage.updateMany({
          where: { providerMessageId: providerMsgId },
          data: { deliveryStatus, metadata: { openwaEvent: event } as any },
        });
        if (updated.count > 0) {
          const msg = await this.prisma.conversationMessage.findFirst({
            where: { providerMessageId: providerMsgId },
            select: { leadId: true },
          });
          if (msg) this.timeline.recordDeliveryUpdated(msg.leadId, 'WhatsApp', deliveryStatus).catch(() => {});
        }
      }

      const result = { event, providerMessageId: providerMsgId, deliveryStatus };
      await this.prisma.webhookEvent.create({
        data: { provider: 'openwa', eventType: event, idempotencyKey: key, rawPayload: payload, processedResult: result },
      });
      this.metrics.incrementCounter('webhooks_processed_total', { provider: 'openwa', status: 'success' });
      return { data: result };
    }

    if (event === 'message.received') {
      const msg = payload.data;
      if (!msg) return { status: 'ignored', reason: 'no message data' };

      const fromNumber = String(msg.from || '').replace(/[^0-9]/g, '').replace(/^91/, '');
      const msgId: string = msg.id || '';
      const text: string = msg.body || '';

      const contactName = msg.contact?.name || msg.contact?.pushname || `WhatsApp User ${fromNumber.slice(-4)}`;
      const contact = await this.contactsService.findOrCreate({
        name: contactName,
        phone: fromNumber,
        whatsapp: fromNumber,
      });

      const existingLead = await this.prisma.lead.findFirst({
        where: { contactId: contact.id, status: { notIn: ['LOST', 'CONVERTED', 'SPAM'] } },
        orderBy: { createdAt: 'desc' },
      });

      const lead = existingLead || await this.leadsService.create({
        contactId: contact.id,
        source: 'WHATSAPP',
        message: text,
        metadata: { from: fromNumber, timestamp: Date.now(), msgId, provider: 'openwa' },
      });

      const stopPattern = /^\s*(stop|unsubscribe|cancel|opt.?out)\s*$/i;
      if (text && stopPattern.test(text.trim())) {
        await this.prisma.contact.update({
          where: { id: contact.id },
          data: { consentStatus: 'opted_out', optedOutAt: new Date() },
        });
        await this.prisma.consentEvent.create({
          data: { contactId: contact.id, channel: 'WHATSAPP', action: 'opt_out', source: 'openwa_webhook' },
        });
      }

      await this.conversationsService.create({
        text, channel: 'WHATSAPP', direction: 'INBOUND', providerMessageId: msgId,
        leadId: lead.id, contactId: contact.id,
        metadata: { from: fromNumber, timestamp: Date.now(), provider: 'openwa' },
      });

      const result = { contact, lead, providerMessageId: msgId };
      await this.prisma.webhookEvent.create({
        data: { provider: 'openwa', eventType: event, idempotencyKey: key, rawPayload: payload, processedResult: result },
      });

      this.dispatchInbound(lead.id, contact.id, 'WHATSAPP', text, msgId || key, lead.tenantId || contact.tenantId);
      this.metrics.incrementCounter('webhooks_processed_total', { provider: 'openwa', status: 'success' });
      return { data: result };
    }

    // ── catch-all — audit unknown/uninteresting events (session.*, group.*, etc.) ──
    const result = { received: true, event };
    await this.prisma.webhookEvent.create({
      data: { provider: 'openwa', eventType: event, idempotencyKey: key, rawPayload: payload, processedResult: result },
    });
    this.metrics.incrementCounter('webhooks_processed_total', { provider: 'openwa', status: 'success' });
    return { data: result };
  }

  async handleGeneric(provider: string, eventType: string, payload: any) {
    const key = this.idempotencyKey([provider, eventType, payload.id || payload.eventId || this.payloadHash(payload)]);
    const existing = await this.prisma.webhookEvent.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { status: 'duplicate', result: existing.processedResult };

    // For chatbot messages, create contact+lead+conversation and trigger agent
    if (provider === 'chatbot' && eventType === 'chatbot_message') {
      const text = payload.message || payload.text || '';
      const contactName = payload.name || payload.contactName || 'Chat Visitor';
      const contact = await this.contactsService.findOrCreate({
        name: contactName,
        email: payload.email,
        phone: payload.phone || payload.telephone,
      });

      const existingLead = await this.prisma.lead.findFirst({
        where: {
          contactId: contact.id,
          status: { notIn: ['LOST', 'CONVERTED', 'SPAM'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      let lead;
      if (existingLead) {
        lead = existingLead;
      } else {
        lead = await this.leadsService.create({
          contactId: contact.id,
          source: 'CHATBOT',
          message: text,
          metadata: { ...payload, channel: 'chat_widget' },
        });
      }

      await this.conversationsService.create({
        text,
        channel: 'CHATBOT',
        direction: 'INBOUND',
        leadId: lead.id,
        contactId: contact.id,
        metadata: payload,
      });

      const result = { contact, lead };
      await this.prisma.webhookEvent.create({
        data: { provider, eventType, idempotencyKey: key, rawPayload: payload, processedResult: result },
      });

      this.agentClient.trigger(lead.id, key, 'CHATBOT', text, lead.tenantId || contact.tenantId);

      this.metrics.incrementCounter('webhooks_processed_total', { provider, status: 'success' });
      return { data: result };
    }

    // Mobile app events range from app-open pings to a user actually submitting contact
    // info. Only worth a lead when there's something to act on, an email or phone.
    if (provider === 'mobile-app' && (payload.email || payload.phone)) {
      const contact = await this.contactsService.findOrCreate({
        name: payload.name || 'App User',
        email: payload.email,
        phone: payload.phone,
      });

      const existingLead = await this.prisma.lead.findFirst({
        where: { contactId: contact.id, status: { notIn: ['LOST', 'CONVERTED', 'SPAM'] } },
        orderBy: { createdAt: 'desc' },
      });

      const lead = existingLead || await this.leadsService.create({
        contactId: contact.id,
        source: 'MOBILE_APP',
        message: payload.message,
        metadata: { ...payload, channel: 'mobile_app' },
      });

      if (payload.message) {
        await this.conversationsService.create({
          text: payload.message,
          channel: 'SYSTEM',
          direction: 'INBOUND',
          leadId: lead.id,
          contactId: contact.id,
          metadata: payload,
        });
      }

      const result = { contact, lead };
      await this.prisma.webhookEvent.create({
        data: { provider, eventType, idempotencyKey: key, rawPayload: payload, processedResult: result },
      });
      this.metrics.incrementCounter('webhooks_processed_total', { provider, status: 'success' });
      return { data: result };
    }

    const result = { received: true, eventType };
    await this.prisma.webhookEvent.create({ data: { provider, eventType, idempotencyKey: key, rawPayload: payload, processedResult: result } });
    this.metrics.incrementCounter('webhooks_processed_total', { provider, status: 'success' });
    return { data: result };
  }

  // -- Private helpers --

  private mapSocialSource(source: string): any {
    const map: Record<string, any> = {
      facebook: 'SOCIAL_MEDIA',
      instagram: 'SOCIAL_MEDIA',
      linkedin: 'SOCIAL_MEDIA',
      twitter: 'SOCIAL_MEDIA',
      tiktok: 'SOCIAL_MEDIA',
      social: 'SOCIAL_MEDIA',
    };
    return map[source] || 'SOCIAL_MEDIA';
  }

  async findWebhookStatuses() {
    const providers = ['whatsapp', 'telegram', 'social', 'voice', 'forms', 'chatbot', 'mobile-app', 'payments', 'indiamart', '99acres', 'justdial', 'magicbricks', 'housing', 'tradeindia', 'wasender'];
    const apiUrl = process.env.API_URL || 'http://localhost:3001';

    const results = await Promise.all(
      providers.map(async (type) => {
        const lastEvent = await this.prisma.webhookEvent.findFirst({
          where: { provider: type },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, status: true },
        });

        const integration = await this.prisma.integration.findFirst({
          where: {
            OR: [
              { type: type.toUpperCase() },
              { type: { contains: type, mode: 'insensitive' } },
            ],
          },
          select: { isActive: true, status: true, config: true },
        });

        const hasEvents = lastEvent !== null;
        const isConfigured = integration?.isActive ?? hasEvents;

        // Probe external connectivity for configured integrations
        let connectivityStatus: 'ok' | 'unreachable' | 'unknown' = 'unknown';
        if (integration?.isActive) {
          connectivityStatus = await this.probeProvider(type, integration.config as any);
        }

        return {
          type,
          url: `${apiUrl}/webhooks/${type}`,
          status: isConfigured ? (hasEvents ? 'active' : 'configured') : 'available',
          lastReceived: lastEvent?.createdAt?.toISOString() || null,
          connectivity: connectivityStatus,
        };
      }),
    );

    return results;
  }

  private async probeProvider(type: string, config: any): Promise<'ok' | 'unreachable' | 'unknown'> {
    const decrypted = typeof config === 'object' ? config : {};
    const timeoutMs = 5000;

    try {
      switch (type) {
        case 'whatsapp': {
          const token = decrypted?.WHATSAPP_ACCESS_TOKEN || decrypted?.accessToken;
          const phoneId = decrypted?.WHATSAPP_PHONE_ID || decrypted?.phoneId;
          if (!token || !phoneId) return 'unknown';
          const resp = await this.fetchWithTimeout(
            `https://graph.facebook.com/v18.0/${phoneId}`,
            { headers: { Authorization: `Bearer ${token}` }, timeout: timeoutMs },
          );
          return resp?.status === 200 ? 'ok' : 'unreachable';
        }
        case 'telegram': {
          const botToken = decrypted?.TELEGRAM_BOT_TOKEN || decrypted?.botToken;
          if (!botToken) return 'unknown';
          const resp = await this.fetchWithTimeout(
            `https://api.telegram.org/bot${botToken}/getMe`,
            { timeout: timeoutMs },
          );
          return resp?.status === 200 ? 'ok' : 'unreachable';
        }
        case 'payments': {
          const secretKey = decrypted?.STRIPE_SECRET_KEY || decrypted?.secretKey;
          if (!secretKey) return 'unknown';
          const resp = await this.fetchWithTimeout(
            `https://api.stripe.com/v1/account`,
            { headers: { Authorization: `Bearer ${secretKey}` }, timeout: timeoutMs },
          );
          return resp?.status === 200 ? 'ok' : 'unreachable';
        }
        case 'wasender': {
          const token = decrypted?.WHATSAPP_ACCESS_TOKEN || decrypted?.accessToken;
          if (!token) return 'unknown';
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            const resp = await fetch('https://wasenderapi.com/api/send-message', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ to: 'validate', text: '' }),
              signal: controller.signal,
            });
            clearTimeout(timer);
            return resp.status !== 401 && resp.status !== 422 ? 'ok' : 'unreachable';
          } catch { return 'unreachable'; }
        }
        case 'voice': {
          const accountSid = decrypted?.TWILIO_ACCOUNT_SID || decrypted?.accountSid;
          const authToken = decrypted?.TWILIO_AUTH_TOKEN || decrypted?.authToken;
          if (!accountSid || !authToken) return 'unknown';
          const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
          const resp = await this.fetchWithTimeout(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
            { headers: { Authorization: `Basic ${auth}` }, timeout: timeoutMs },
          );
          return resp?.status === 200 ? 'ok' : 'unreachable';
        }
        default:
          return 'unknown';
      }
    } catch {
      return 'unreachable';
    }
  }

  private async fetchWithTimeout(url: string, opts: { headers?: Record<string, string>; timeout: number }): Promise<Response | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeout);
      const response = await fetch(url, {
        headers: opts.headers,
        signal: controller.signal,
      });
      clearTimeout(timer);
      return response;
    } catch {
      return null;
    }
  }

  // === Outbound webhook subscriptions ===
  async createOutboundWebhook(data: { name: string; url: string; events: string[]; secret?: string }) {
    if (!data.url || !data.events?.length) throw new BadRequestException('url and events are required');
    return this.prisma.outboundWebhook.create({
      data: { name: data.name, url: data.url, events: data.events, secret: data.secret || '', tenantId: 'default-tenant' },
    });
  }

  async listOutboundWebhooks() {
    return this.prisma.outboundWebhook.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async updateOutboundWebhook(id: string, data: { name?: string; url?: string; events?: string[]; secret?: string; active?: boolean }) {
    const existing = await this.prisma.outboundWebhook.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Webhook not found');
    return this.prisma.outboundWebhook.update({ where: { id }, data });
  }

  async deleteOutboundWebhook(id: string) {
    await this.prisma.outboundWebhook.delete({ where: { id } });
    return { deleted: true };
  }

  async testOutboundWebhook(id: string) {
    const wh = await this.prisma.outboundWebhook.findUnique({ where: { id } });
    if (!wh) throw new NotFoundException('Webhook not found');
    return this.outboundDispatch.send(wh, { event: 'test', data: { message: 'This is a test event from DeploySafe CRM' } });
  }

  // Called by the event system when any AutomationEvent fires
  async dispatchToOutboundWebhooks(eventType: string, payload: any) {
    const results = await this.outboundDispatch.dispatch(eventType, payload);
    return { dispatched: results.length, results: results.map((r) => r.status) };
  }

  // === Inbound generic webhook ===
  async handleInboundWebhook(integrationId: string, payload: any) {
    const integration = await this.prisma.integration.findUnique({ where: { id: integrationId } });
    if (!integration) throw new NotFoundException('Integration not found');

    const config = typeof integration.config === 'object' ? integration.config as Record<string, any> : {};

    // Map external fields to lead fields using the integration's field mappings
    const name = payload.name || payload.contactName || payload.Name || payload.full_name || '';
    const email = payload.email || payload.Email || payload.EmailAddress || '';
    const phone = payload.phone || payload.Phone || payload.PhoneNumber || '';
    const message = payload.message || payload.Message || payload.body || payload.Body || '';

    const contact = await this.contactsService.findOrCreate({ name, email, phone }, undefined);
    const lead = await this.leadsService.create({
      contactId: contact.id,
      source: (config.sourceType as any) || 'FORM',
      message,
      metadata: { integrationId, originalPayload: payload, ...config },
    });
    return { leadId: lead.id, contactId: contact.id };
  }

  async testWebhookEndpoint(type: string) {
    const lastEvent = await this.prisma.webhookEvent.findFirst({
      where: { provider: type },
      orderBy: { createdAt: 'desc' },
    });

    const integration = await this.prisma.integration.findFirst({
      where: {
        OR: [
          { type: type.toUpperCase() },
          { type: { contains: type, mode: 'insensitive' } },
        ],
      },
      select: { isActive: true, config: true },
    });

    const connectivity = await this.probeProvider(type, integration?.config as any || {});
    const isReachable = lastEvent || integration?.isActive;

    return {
      status: isReachable ? 'ok' : 'not_configured',
      message: isReachable
        ? `${type} webhook is configured and receiving data`
        : `${type} webhook is not yet configured. Set up the endpoint URL in your external service.`,
      lastEvent: lastEvent?.createdAt?.toISOString() || null,
      connectivity,
    };
  }
}
