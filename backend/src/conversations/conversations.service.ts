import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MessagePolicyService } from './message-policy.service';
import { TwilioSmsAdapter } from '../shared/adapters/sms.adapter';
import { WhatsAppCloudAdapter, TelegramBotAdapter } from '../shared/adapters/messaging.adapter';
import { EmailAdapter } from '../shared/adapters/email.adapter';
import { ConfigService } from '@nestjs/config';
import { FailuresService } from '../failures/failures.service';
import { NormalizationService } from '../shared/normalization.service';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
    private policy: MessagePolicyService,
    private smsAdapter: TwilioSmsAdapter,
    private whatsAppAdapter: WhatsAppCloudAdapter,
    private telegramAdapter: TelegramBotAdapter,
    private config: ConfigService,
    private failures: FailuresService,
    private emailAdapter: EmailAdapter,
    private normalization: NormalizationService,
  ) {}

  findAll(query: any = {}) {
    const { leadId, campaignId, channel, page = 1, limit = 50 } = query;
    const where: any = {};
    if (leadId) where.leadId = leadId;
    if (campaignId) where.campaignId = campaignId;
    if (channel) where.channel = channel;
    return Promise.all([
      this.prisma.conversationMessage.findMany({
        where, skip: (+page - 1) * +limit, take: +limit, orderBy: { createdAt: 'desc' },
        include: { lead: { include: { contact: true } } },
      }),
      this.prisma.conversationMessage.count({ where }),
    ]).then(([data, total]) => ({ data, meta: { total, page: +page, limit: +limit } }));
  }

  getByLead(leadId: string) {
    return this.prisma.conversationMessage.findMany({ where: { leadId }, orderBy: { createdAt: 'asc' } });
  }

  async create(data: any, userId?: string) {
    // Run policy gate for outbound messages
    if (data.direction === 'OUTBOUND') {
      // A reply sent shortly after the lead messaged in is reactive, not
      // proactive outreach — only unsolicited first-touch/follow-up sends
      // need the proactive-only consent/quiet-hours/rate-limit checks.
      const lastInbound = await this.prisma.conversationMessage.findFirst({
        where: { leadId: data.leadId, direction: 'INBOUND' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      const isProactive = !lastInbound
        || (Date.now() - new Date(lastInbound.createdAt).getTime()) > 24 * 60 * 60 * 1000;

      const result = await this.policy.evaluate(
        data.leadId,
        data.channel,
        data.text,
        { isProactive, templateId: data.messageTemplateId },
      );
      if (!result.allowed) {
        const msg = await this.prisma.conversationMessage.create({
          data: {
            ...data,
            deliveryStatus: 'blocked',
            metadata: { policyReason: result.reason, policyAction: result.action },
          },
        });
        await this.auditLogs.log('message_blocked', 'ConversationMessage', msg.id, userId, { reason: result.reason });
        throw new ForbiddenException(`Message blocked by policy: ${result.reason}`);
      }
    }

    const msg = await this.prisma.conversationMessage.create({ data });

    // Dispatch via channel adapter for outbound messages
    if (data.direction === 'OUTBOUND' && data.channel) {
      this.dispatchViaChannel(msg).catch(err => this.logger.error(`Channel dispatch failed: ${err.message}`));
    }

    await this.auditLogs.log('message_sent', 'ConversationMessage', msg.id, userId, { channel: data.channel, direction: data.direction });
    return msg;
  }

  private async dispatchViaChannel(msg: any): Promise<void> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: msg.leadId },
      include: { contact: true },
    });
    if (!lead?.contact) {
      this.logger.warn(`Cannot dispatch message ${msg.id}: lead or contact not found`);
      return;
    }

    const channel = (msg.channel || '').toUpperCase();
    const text = msg.text;

    if (channel === 'SMS') {
      if (!lead.contact.phone) {
        this.logger.warn(`Cannot dispatch SMS for message ${msg.id}: contact has no phone`);
        return;
      }
      const result = await this.smsAdapter.send(lead.contact.phone, text);
      if (result.success) {
        await this.prisma.conversationMessage.update({
          where: { id: msg.id },
          data: { deliveryStatus: 'delivered', providerMessageId: result.providerMessageId },
        });
      } else {
        await this.prisma.conversationMessage.update({
          where: { id: msg.id },
          data: { deliveryStatus: 'failed', metadata: { error: result.error } },
        });
      }
    } else if (channel === 'WHATSAPP') {
      if (!lead.contact.whatsapp && !lead.contact.phone) {
        this.logger.warn(`Cannot dispatch WhatsApp for message ${msg.id}: contact has no phone/whatsapp`);
        return;
      }
      const rawTo: string = lead.contact.whatsapp || lead.contact.phone || '';
      if (!rawTo) return;
      // Stored contact numbers are country-code-stripped (see webhook ingestion); restore
      // full E.164 before handing to any provider, or the send targets a nonexistent WhatsApp ID.
      const to: string = this.normalization.normalizePhone(rawTo).replace(/^\+/, '');

      // Check 24h window: find the latest inbound WhatsApp message for this lead
      const lastInbound = await this.prisma.conversationMessage.findFirst({
        where: { leadId: lead.id, channel: 'WHATSAPP', direction: 'INBOUND' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      const within24h = lastInbound ? (Date.now() - new Date(lastInbound.createdAt).getTime() < 86400000) : false;

      // A message can carry a photo/brochure/floor-plan alongside its text — e.g.
      // Mikey sending matching unit photos during a WhatsApp conversation. Passed
      // through as ordinary message metadata so no schema/DTO change was needed.
      const meta = (msg.metadata || {}) as {
        mediaUrl?: string; mediaType?: string; caption?: string;
        options?: Array<{ id: string; title: string }>;
      };
      // send_options gives us plain {id, title} pairs regardless of channel; WhatsApp
      // wants buttons (max 3) as "button" and anything larger as a "list" of rows.
      const interactiveType = meta.options?.length ? (meta.options.length <= 3 ? 'button' : 'list') : undefined;

      const config = {
        phoneNumberId: this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '',
        accessToken: this.config.get<string>('WHATSAPP_ACCESS_TOKEN') || '',
        within24h,
        templateId: !within24h ? this.config.get<string>('WHATSAPP_DEFAULT_TEMPLATE') : undefined,
        mediaUrl: meta.mediaUrl,
        mediaType: meta.mediaType,
        caption: meta.caption,
        interactiveType,
        interactiveBody: interactiveType ? text : undefined,
        interactiveButtons: interactiveType === 'button' ? meta.options : undefined,
        interactiveSections: interactiveType === 'list'
          ? [{ title: 'Options', rows: meta.options!.map(o => ({ id: o.id, title: o.title.slice(0, 24) })) }]
          : undefined,
      };
      const result = await this.whatsAppAdapter.sendMessage(to, text, config);
      if (result.success) {
        await this.prisma.conversationMessage.update({
          where: { id: msg.id },
          data: { deliveryStatus: 'delivered', providerMessageId: result.messageId },
        });
      } else {
        await this.prisma.conversationMessage.update({
          where: { id: msg.id },
          data: { deliveryStatus: 'failed', metadata: { error: result.error } },
        });
        await this.failures.record({
          type: 'WHATSAPP_SEND_FAILURE',
          severity: 'medium',
          message: result.error || 'WhatsApp send failed',
          leadId: msg.leadId,
          contactId: lead.contactId,
          provider: 'WHATSAPP',
          operation: 'send_message',
          retryable: true,
        });
      }
    } else if (channel === 'TELEGRAM') {
      if (!lead.contact.whatsapp && !lead.contact.phone) {
        this.logger.warn(`Cannot dispatch Telegram for message ${msg.id}: contact has no identifier`);
        return;
      }
      const chatId: string = lead.contact.whatsapp || lead.contact.phone || '';
      if (!chatId) return;
      const telegramMeta = (msg.metadata || {}) as { mediaUrl?: string; mediaType?: string; caption?: string; options?: Array<{ id: string; title: string }> };
      const result = await this.telegramAdapter.sendMessage(chatId, text, {
        botToken: this.config.get<string>('TELEGRAM_BOT_TOKEN'),
        mediaUrl: telegramMeta.mediaUrl,
        mediaType: telegramMeta.mediaType,
        caption: telegramMeta.caption,
        options: telegramMeta.options,
      });
      if (result.success) {
        await this.prisma.conversationMessage.update({
          where: { id: msg.id },
          data: { deliveryStatus: 'delivered', providerMessageId: result.messageId },
        });
      } else {
        await this.prisma.conversationMessage.update({
          where: { id: msg.id },
          data: { deliveryStatus: 'failed', metadata: { error: result.error } },
        });
      }
    } else if (channel === 'EMAIL') {
      if (!lead.contact.email) {
        this.logger.warn(`Cannot dispatch EMAIL for message ${msg.id}: contact has no email`);
        return;
      }
      const originalSubject = msg.metadata?.subject || '';
      const subject = originalSubject ? `Re: ${originalSubject}` : 'Message from CRM';
      const result = await this.emailAdapter.send(lead.contact.email, subject, text);
      if (result.success) {
        await this.prisma.conversationMessage.update({
          where: { id: msg.id },
          data: { deliveryStatus: 'delivered' },
        });
      } else {
        await this.prisma.conversationMessage.update({
          where: { id: msg.id },
          data: { deliveryStatus: 'failed', metadata: { error: result.error } },
        });
      }
    }
  }
}
