import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PostCallDispatchService, POST_CALL_TEMPLATE_NAME } from './post-call-dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagePolicyService } from '../conversations/message-policy.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('PostCallDispatchService (section 5.5)', () => {
  let service: PostCallDispatchService;
  let prisma: any;
  let conversations: any;
  let policy: any;
  let notifications: any;

  const lead = {
    id: 'lead-1',
    tenantId: 't1',
    contactId: 'c1',
    interest: '2BHK',
    budget: '7800000',
    metadata: { project: 'Kompally Residency' },
    message: 'Looking for a 2BHK in Kompally under 80 lakhs',
    contact: { name: 'Ravi', phone: '9000000000', whatsapp: null },
    assignedAgent: { phone: '9100000000' },
    assignedAgentId: 'agent-1',
  };

  beforeEach(async () => {
    prisma = {
      callLog: {
        findUnique: jest.fn().mockResolvedValue({ id: 'call-1', summary: 'Wants 2BHK in Kompally, budget 78L', recordingUrl: 'https://rec.example/call-1.mp3' }),
      },
      lead: { findUnique: jest.fn().mockResolvedValue(lead) },
      messageTemplate: { findFirst: jest.fn().mockResolvedValue({ id: 'tpl-1' }) },
    };
    conversations = { create: jest.fn().mockResolvedValue({ id: 'msg-1' }) };
    policy = { evaluate: jest.fn().mockResolvedValue({ allowed: true, requiresTemplate: false }) };
    notifications = { create: jest.fn().mockResolvedValue({ id: 'n-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostCallDispatchService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConversationsService, useValue: conversations },
        { provide: MessagePolicyService, useValue: policy },
        { provide: NotificationsService, useValue: notifications },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    service = module.get(PostCallDispatchService);
  });

  it('delivers WhatsApp to the confirmed number, referencing what was discussed', async () => {
    await service.dispatchAfterCall({ tenantId: 't1', leadId: 'lead-1', callLogId: 'call-1' });

    const sent = conversations.create.mock.calls[0][0];
    expect(sent.channel).toBe('WHATSAPP');
    expect(sent.direction).toBe('OUTBOUND');
    expect(sent.text).toMatch(/2BHK/); // references the unit type discussed
    expect(sent.text).toMatch(/Kompally/); // and the project
    expect(sent.metadata.postCallDispatch).toBe(true);
    expect(sent.metadata.callLogId).toBe('call-1');
  });

  it('still sends on contact.whatsapp unset (falls through to phone downstream)', async () => {
    await service.dispatchAfterCall({ tenantId: 't1', leadId: 'lead-1', callLogId: 'call-1' });
    const sent = conversations.create.mock.calls[0][0];
    expect(sent.channel).toBe('WHATSAPP');
  });

  it('uses the named post-call template when the 24h window requires one', async () => {
    policy.evaluate.mockResolvedValue({ allowed: false, requiresTemplate: true, reason: 'outside_window_no_template' });

    await service.dispatchAfterCall({ tenantId: 't1', leadId: 'lead-1', callLogId: 'call-1' });

    const sent = conversations.create.mock.calls[0][0];
    expect(sent.messageTemplateId).toBe('tpl-1');
    // MessageTemplate has no tenantId, so "any active WhatsApp template" could
    // send another tenant's payment-overdue copy to a brand new buyer.
    expect(prisma.messageTemplate.findFirst).toHaveBeenCalledWith({
      where: { channel: 'WHATSAPP', active: true, name: POST_CALL_TEMPLATE_NAME },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('sends nothing and alerts the rep when the window is closed and the template is missing', async () => {
    policy.evaluate.mockResolvedValue({ allowed: false, requiresTemplate: true, reason: 'outside_window_no_template' });
    prisma.messageTemplate.findFirst.mockResolvedValue(null);

    await service.dispatchAfterCall({ tenantId: 't1', leadId: 'lead-1', callLogId: 'call-1' });

    expect(conversations.create).not.toHaveBeenCalled();
    const n = notifications.create.mock.calls[0][0];
    expect(n.type).toBe('sla_breach'); // reaches the rep as a real text
    expect(n.title).toMatch(/NOT delivered/);
    expect(n.body).toMatch(new RegExp(POST_CALL_TEMPLATE_NAME));
  });

  it('alerts the rep when the send itself throws', async () => {
    conversations.create.mockRejectedValue(new Error('Message blocked by policy: opted_out'));

    await service.dispatchAfterCall({ tenantId: 't1', leadId: 'lead-1', callLogId: 'call-1' });

    const n = notifications.create.mock.calls[0][0];
    expect(n.type).toBe('sla_breach');
    expect(n.body).toMatch(/opted_out/);
  });

  it('never sends to a lead with no phone and no whatsapp', async () => {
    prisma.lead.findUnique.mockResolvedValue({ ...lead, contact: { ...lead.contact, phone: null, whatsapp: null } });
    await service.dispatchAfterCall({ tenantId: 't1', leadId: 'lead-1', callLogId: 'call-1' });
    expect(conversations.create).not.toHaveBeenCalled();
  });

  it('notifies the assigned rep with the summary and recording link', async () => {
    await service.dispatchAfterCall({ tenantId: 't1', leadId: 'lead-1', callLogId: 'call-1' });

    const n = notifications.create.mock.calls[0][0];
    expect(n.userId).toBe('agent-1');
    expect(n.link).toBe('https://rec.example/call-1.mp3');
    expect(n.body).toMatch(/Kompally/);
    expect(n.whatsappTo).toBe('9100000000');
  });
});
