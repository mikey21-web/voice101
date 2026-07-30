import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MessagePolicyService } from './message-policy.service';
import { TwilioSmsAdapter } from '../shared/adapters/sms.adapter';
import { WhatsAppCloudAdapter, TelegramBotAdapter } from '../shared/adapters/messaging.adapter';
import { ConfigService } from '@nestjs/config';
import { FailuresService } from '../failures/failures.service';
import { EmailAdapter } from '../shared/adapters/email.adapter';
import { NormalizationService } from '../shared/normalization.service';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let prisma: any;
  let auditLogs: any;
  let policy: any;
  let smsAdapter: any;
  let whatsAppAdapter: any;
  let telegramAdapter: any;
  let configService: any;
  let failuresService: any;
  let emailAdapter: any;

  const mockMessage = {
    id: 'msg-1',
    text: 'Hello there',
    channel: 'CHATBOT',
    direction: 'INBOUND',
    leadId: 'lead-1',
    contactId: 'contact-1',
    campaignId: null,
    deliveryStatus: 'sent',
    metadata: null,
    createdAt: new Date('2025-06-15T10:00:00Z'),
    updatedAt: new Date('2025-06-15T10:00:00Z'),
  };

  const mockLead = {
    id: 'lead-1',
    contact: {
      id: 'contact-1',
      phone: '+1234567890',
      whatsapp: '+1234567890',
    },
  };

  beforeEach(async () => {
    prisma = {
      conversationMessage: {
        findMany: jest.fn().mockResolvedValue([mockMessage]),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue(mockMessage),
        update: jest.fn().mockResolvedValue(mockMessage),
      },
      lead: {
        findUnique: jest.fn().mockResolvedValue(mockLead),
      },
    };

    auditLogs = {
      log: jest.fn().mockResolvedValue({}),
    };

    policy = {
      evaluate: jest.fn().mockResolvedValue({ allowed: true }),
    };

    smsAdapter = {
      send: jest.fn().mockResolvedValue({ success: true, providerMessageId: 'sms-id-123' }),
    };

    whatsAppAdapter = {
      sendMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'wa-id-123' }),
    };

    telegramAdapter = {
      sendMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'tg-id-123' }),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'WHATSAPP_PHONE_NUMBER_ID') return 'whatsapp-phone-id';
        if (key === 'WHATSAPP_ACCESS_TOKEN') return 'wa-token';
        if (key === 'TELEGRAM_BOT_TOKEN') return 'tg-bot-token';
        return undefined;
      }),
    };

    failuresService = { create: jest.fn(), resolve: jest.fn() };
    emailAdapter = { send: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: auditLogs },
        { provide: MessagePolicyService, useValue: policy },
        { provide: TwilioSmsAdapter, useValue: smsAdapter },
        { provide: WhatsAppCloudAdapter, useValue: whatsAppAdapter },
        { provide: TelegramBotAdapter, useValue: telegramAdapter },
        { provide: ConfigService, useValue: configService },
        { provide: FailuresService, useValue: failuresService },
        { provide: EmailAdapter, useValue: emailAdapter },
        { provide: NormalizationService, useValue: { normalizePhone: (p: string) => p } },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
  });

  // ─── findAll ────────────────────────────────────────────────────

  it('should find all messages with pagination', async () => {
    const result = await service.findAll({ page: 1, limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(20);
    expect(prisma.conversationMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('should filter messages by leadId', async () => {
    await service.findAll({ leadId: 'lead-1' });

    expect(prisma.conversationMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ leadId: 'lead-1' }),
      }),
    );
  });

  it('should filter messages by channel', async () => {
    await service.findAll({ channel: 'WHATSAPP' });

    expect(prisma.conversationMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ channel: 'WHATSAPP' }),
      }),
    );
  });

  it('should filter messages by campaignId', async () => {
    await service.findAll({ campaignId: 'camp-1' });

    expect(prisma.conversationMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ campaignId: 'camp-1' }),
      }),
    );
  });

  it('should apply default pagination when not specified', async () => {
    await service.findAll({});

    expect(prisma.conversationMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 50 }),
    );
    expect(prisma.conversationMessage.count).toHaveBeenCalled();
  });

  // ─── getByLead ──────────────────────────────────────────────────

  it('should get messages by lead sorted ascending', async () => {
    const result = await service.getByLead('lead-1');

    expect(prisma.conversationMessage.findMany).toHaveBeenCalledWith({
      where: { leadId: 'lead-1' },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toHaveLength(1);
  });

  it('should return empty array when lead has no messages', async () => {
    prisma.conversationMessage.findMany.mockResolvedValue([]);

    const result = await service.getByLead('lead-empty');
    expect(result).toEqual([]);
  });

  // ─── create (INBOUND - no policy check) ─────────────────────────

  it('should create an inbound message', async () => {
    const data = {
      text: 'Hello',
      channel: 'CHATBOT',
      direction: 'INBOUND',
      leadId: 'lead-1',
      contactId: 'contact-1',
    };

    const result = await service.create(data);

    expect(policy.evaluate).not.toHaveBeenCalled();
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({ data });
    expect(auditLogs.log).toHaveBeenCalledWith(
      'message_sent',
      'ConversationMessage',
      'msg-1',
      undefined,
      { channel: 'CHATBOT', direction: 'INBOUND' },
    );
    expect(result).toEqual(mockMessage);
  });

  it('should create inbound message with userId for audit log', async () => {
    const data = {
      text: 'Hello',
      channel: 'CHATBOT',
      direction: 'INBOUND',
      leadId: 'lead-1',
      contactId: 'contact-1',
    };

    await service.create(data, 'user-42');

    expect(auditLogs.log).toHaveBeenCalledWith(
      'message_sent',
      'ConversationMessage',
      'msg-1',
      'user-42',
      expect.any(Object),
    );
  });

  // ─── create (OUTBOUND - policy gated) ─────────────────────────

  it('should create an outbound message when policy allows', async () => {
    const data = {
      text: 'We have a special offer for you!',
      channel: 'SMS',
      direction: 'OUTBOUND',
      leadId: 'lead-1',
      contactId: 'contact-1',
    };

    const dispatchSpy = jest.spyOn(service as any, 'dispatchViaChannel').mockResolvedValue(undefined);

    const result = await service.create(data);

    expect(policy.evaluate).toHaveBeenCalledWith(
      'lead-1', 'SMS', 'We have a special offer for you!',
      { isProactive: true, templateId: undefined },
    );
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({ data });
    expect(auditLogs.log).toHaveBeenCalledWith(
      'message_sent',
      'ConversationMessage',
      'msg-1',
      undefined,
      expect.objectContaining({ channel: 'SMS', direction: 'OUTBOUND' }),
    );
    expect(dispatchSpy).toHaveBeenCalledWith(mockMessage);
    expect(result).toEqual(mockMessage);

    dispatchSpy.mockRestore();
  });

  it('should pass messageTemplateId to policy evaluation', async () => {
    const data = {
      text: 'Your appointment is confirmed!',
      channel: 'WHATSAPP',
      direction: 'OUTBOUND',
      leadId: 'lead-1',
      contactId: 'contact-1',
      messageTemplateId: 'template-42',
    };

    jest.spyOn(service as any, 'dispatchViaChannel').mockResolvedValue(undefined);

    await service.create(data);

    expect(policy.evaluate).toHaveBeenCalledWith(
      'lead-1', 'WHATSAPP', 'Your appointment is confirmed!',
      { isProactive: true, templateId: 'template-42' },
    );
  });

  it('should block outbound message when policy disallows', async () => {
    policy.evaluate.mockResolvedValue({
      allowed: false,
      reason: 'no_consent',
      action: 'block',
    });

    const blockedMsg = {
      ...mockMessage,
      deliveryStatus: 'blocked',
      metadata: { policyReason: 'no_consent', policyAction: 'block' },
    };
    prisma.conversationMessage.create.mockResolvedValue(blockedMsg);

    const data = {
      text: 'Spam message',
      channel: 'SMS',
      direction: 'OUTBOUND',
      leadId: 'lead-1',
      contactId: 'contact-1',
    };

    await expect(service.create(data)).rejects.toThrow(ForbiddenException);

    expect(prisma.conversationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deliveryStatus: 'blocked',
          metadata: { policyReason: 'no_consent', policyAction: 'block' },
        }),
      }),
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      'message_blocked',
      'ConversationMessage',
      'msg-1',
      undefined,
      { reason: 'no_consent' },
    );
  });

  it('should include policy reason in ForbiddenException message', async () => {
    policy.evaluate.mockResolvedValue({
      allowed: false,
      reason: 'opted_out',
      action: 'block',
    });
    prisma.conversationMessage.create.mockResolvedValue({
      ...mockMessage,
      deliveryStatus: 'blocked',
    });

    await expect(service.create({
      text: 'Hi',
      channel: 'SMS',
      direction: 'OUTBOUND',
      leadId: 'lead-1',
      contactId: 'contact-1',
    })).rejects.toThrow('Message blocked by policy: opted_out');
  });

  it('should handle quiet_hours policy action', async () => {
    const rescheduleAt = new Date(Date.now() + 3600000);
    policy.evaluate.mockResolvedValue({
      allowed: false,
      reason: 'quiet_hours',
      action: 'reschedule',
      rescheduleAt,
    });
    prisma.conversationMessage.create.mockResolvedValue({
      ...mockMessage,
      deliveryStatus: 'blocked',
      metadata: { policyReason: 'quiet_hours', policyAction: 'reschedule' },
    });

    await expect(service.create({
      text: 'Night message',
      channel: 'SMS',
      direction: 'OUTBOUND',
      leadId: 'lead-1',
      contactId: 'contact-1',
    })).rejects.toThrow(ForbiddenException);
  });

  // ─── Channel dispatch ─────────────────────────────────────────

  it('should dispatch SMS for outbound SMS message', async () => {
    jest.spyOn(service as any, 'dispatchViaChannel').mockRestore();
    prisma.lead.findUnique.mockResolvedValue(mockLead);
    prisma.conversationMessage.create.mockResolvedValue({ ...mockMessage, channel: 'SMS', text: 'SMS text' });

    const data = {
      text: 'SMS text',
      channel: 'SMS',
      direction: 'OUTBOUND',
      leadId: 'lead-1',
      contactId: 'contact-1',
    };

    await service.create(data);
    await new Promise(process.nextTick);

    expect(smsAdapter.send).toHaveBeenCalledWith('+1234567890', 'SMS text');
    expect(prisma.conversationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'msg-1' },
        data: { deliveryStatus: 'delivered', providerMessageId: 'sms-id-123' },
      }),
    );
  });

  it('should dispatch WhatsApp for outbound WhatsApp message', async () => {
    jest.spyOn(service as any, 'dispatchViaChannel').mockRestore();
    prisma.lead.findUnique.mockResolvedValue(mockLead);
    prisma.conversationMessage.create.mockResolvedValue({ ...mockMessage, channel: 'WHATSAPP', text: 'WhatsApp message' });

    const data = {
      text: 'WhatsApp message',
      channel: 'WHATSAPP',
      direction: 'OUTBOUND',
      leadId: 'lead-1',
      contactId: 'contact-1',
    };

    await service.create(data);
    await new Promise(process.nextTick);

    // WhatsApp Cloud API's "to" field is digits-only (no leading +) — the service
    // strips it after normalizePhone() puts the number in E.164 form.
    expect(whatsAppAdapter.sendMessage).toHaveBeenCalledWith(
      '1234567890',
      'WhatsApp message',
      expect.objectContaining({
        phoneNumberId: 'whatsapp-phone-id',
        accessToken: 'wa-token',
      }),
    );
  });

  it('should dispatch Telegram for outbound Telegram message', async () => {
    jest.spyOn(service as any, 'dispatchViaChannel').mockRestore();
    prisma.lead.findUnique.mockResolvedValue(mockLead);
    prisma.conversationMessage.create.mockResolvedValue({ ...mockMessage, channel: 'TELEGRAM', text: 'Telegram message' });

    const data = {
      text: 'Telegram message',
      channel: 'TELEGRAM',
      direction: 'OUTBOUND',
      leadId: 'lead-1',
      contactId: 'contact-1',
    };

    await service.create(data);
    await new Promise(process.nextTick);

    expect(telegramAdapter.sendMessage).toHaveBeenCalledWith(
      '+1234567890',
      'Telegram message',
      expect.objectContaining({ botToken: 'tg-bot-token' }),
    );
  });

  it('should handle SMS dispatch failure gracefully', async () => {
    jest.spyOn(service as any, 'dispatchViaChannel').mockRestore();
    prisma.lead.findUnique.mockResolvedValue(mockLead);
    smsAdapter.send.mockResolvedValue({ success: false, error: 'Provider error' });
    prisma.conversationMessage.create.mockResolvedValue({ ...mockMessage, channel: 'SMS', text: 'Will fail' });

    const data = {
      text: 'Will fail',
      channel: 'SMS',
      direction: 'OUTBOUND',
      leadId: 'lead-1',
      contactId: 'contact-1',
    };

    await service.create(data);
    await new Promise(process.nextTick);

    expect(prisma.conversationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'msg-1' },
        data: { deliveryStatus: 'failed', metadata: { error: 'Provider error' } },
      }),
    );
  });

  it('should skip dispatch when lead or contact not found', async () => {
    jest.spyOn(service as any, 'dispatchViaChannel').mockRestore();
    prisma.lead.findUnique.mockResolvedValue(null);

    const data = {
      text: 'No contact',
      channel: 'SMS',
      direction: 'OUTBOUND',
      leadId: 'lead-missing',
      contactId: 'contact-missing',
    };

    await service.create(data);
    await new Promise(process.nextTick);

    expect(smsAdapter.send).not.toHaveBeenCalled();
  });

  it('should skip dispatch when contact has no phone for SMS channel', async () => {
    jest.spyOn(service as any, 'dispatchViaChannel').mockRestore();
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      contact: { id: 'contact-1', phone: null, whatsapp: null },
    });

    const data = {
      text: 'No phone',
      channel: 'SMS',
      direction: 'OUTBOUND',
      leadId: 'lead-1',
      contactId: 'contact-1',
    };

    await service.create(data);
    await new Promise(process.nextTick);

    expect(smsAdapter.send).not.toHaveBeenCalled();
  });

  it('should use whatsapp field over phone for WhatsApp dispatch', async () => {
    jest.spyOn(service as any, 'dispatchViaChannel').mockRestore();
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      contact: { id: 'contact-1', phone: '+1111111111', whatsapp: '+2222222222' },
    });
    prisma.conversationMessage.create.mockResolvedValue({ ...mockMessage, channel: 'WHATSAPP', text: 'WhatsApp msg' });

    const data = {
      text: 'WhatsApp msg',
      channel: 'WHATSAPP',
      direction: 'OUTBOUND',
      leadId: 'lead-1',
      contactId: 'contact-1',
    };

    await service.create(data);
    await new Promise(process.nextTick);

    expect(whatsAppAdapter.sendMessage).toHaveBeenCalledWith('2222222222', 'WhatsApp msg', expect.any(Object));
  });

  it('should not dispatch for non-standard channels like EMAIL', async () => {
    jest.spyOn(service as any, 'dispatchViaChannel').mockRestore();
    prisma.lead.findUnique.mockResolvedValue(mockLead);

    const data = {
      text: 'Email body',
      channel: 'EMAIL',
      direction: 'OUTBOUND',
      leadId: 'lead-1',
      contactId: 'contact-1',
    };

    await service.create(data);
    await new Promise(process.nextTick);

    expect(smsAdapter.send).not.toHaveBeenCalled();
    expect(whatsAppAdapter.sendMessage).not.toHaveBeenCalled();
    expect(telegramAdapter.sendMessage).not.toHaveBeenCalled();
  });
});
