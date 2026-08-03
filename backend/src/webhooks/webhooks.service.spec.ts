import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import { LeadsService } from '../leads/leads.service';
import { ResolveLeadService } from '../leads/resolve-lead.service';
import { EscalationService } from '../mikey/escalation.service';
import { ConversationsService } from '../conversations/conversations.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AgentClientService } from '../agent/agent-client.service';
import { MetricsService } from '../monitoring/metrics.service';
import { TimelineService } from '../timeline/timeline.service';
import { OutboundWebhookDispatchService } from '../shared/outbound-webhook-dispatch.service';
import { ConfigService } from '@nestjs/config';
import { FlowRuntimeService } from '../flows/flow-runtime.service';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let prisma: any;
  let contacts: any;
  let leads: any;
  let conversations: any;
  let resolveLead: any;
  let escalation: any;
  const auditLogs = { log: jest.fn().mockResolvedValue({}) };
  const agentClient = { trigger: jest.fn().mockResolvedValue(undefined) };
  const metrics = { incrementCounter: jest.fn() };
  const timeline = { recordDeliveryUpdated: jest.fn().mockResolvedValue(undefined) };

  const mockContact = { id: 'contact-1', name: 'John', phone: '+1234567890' };
  const mockLead = { id: 'lead-1', status: 'NEW', contactId: 'contact-1' };

  beforeEach(async () => {
    prisma = {
      webhookEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ settings: {} }),
      },
      lead: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(mockLead),
      },
      contact: {
        findUnique: jest.fn().mockResolvedValue(mockContact),
        update: jest.fn().mockResolvedValue(mockContact),
      },
    };
    escalation = {
      detectTrigger: jest.fn().mockReturnValue(null),
      raise: jest.fn().mockResolvedValue({ escalationId: 'esc-1', alreadyPaused: false }),
    };
    resolveLead = {
      resolveLead: jest.fn().mockResolvedValue({
        leadId: mockLead.id, contactId: mockContact.id,
        isReturning: false, reusedExistingLead: false,
        segment: 'WARM', assignedRepId: null,
        history: { previousLeads: 0, conversations: 0, callsAnswered: 0, callsMissed: 0, campaigns: [] },
      }),
    };
    contacts = {
      findOrCreate: jest.fn().mockResolvedValue(mockContact),
    };
    leads = {
      create: jest.fn().mockResolvedValue(mockLead),
    };
    conversations = {
      create: jest.fn().mockResolvedValue({}),
    };

    const module = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: PrismaService, useValue: prisma },
        { provide: ContactsService, useValue: contacts },
        { provide: LeadsService, useValue: leads },
        { provide: ConversationsService, useValue: conversations },
        { provide: AuditLogsService, useValue: auditLogs },
        { provide: AgentClientService, useValue: agentClient },
        { provide: MetricsService, useValue: metrics },
        { provide: TimelineService, useValue: timeline },
        { provide: OutboundWebhookDispatchService, useValue: { send: jest.fn().mockResolvedValue(undefined), dispatch: jest.fn().mockResolvedValue([]) } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: FlowRuntimeService, useValue: { handleInbound: jest.fn().mockResolvedValue(undefined) } },
        { provide: ResolveLeadService, useValue: resolveLead },
        { provide: EscalationService, useValue: escalation },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
  });

  it('should handle form submission webhook', async () => {
    const result: any = await service.handleFormSubmit('external', {
      name: 'John', email: 'john@test.com', phone: '+1234567890', message: 'Interested',
    });
    expect(result.data.contact.id).toBe('contact-1');
    expect(result.data.lead.id).toBe('lead-1');
  });

  it('should prevent duplicate webhook processing', async () => {
    prisma.webhookEvent.findUnique.mockResolvedValue({
      idempotencyKey: 'external:{"name":"John"}',
      processedResult: { status: 'duplicate' },
    });
    const result: any = await service.handleFormSubmit('external', { name: 'John' });
    expect(result.status).toBe('duplicate');
  });

  it('should handle WhatsApp webhook', async () => {
    const result: any = await service.handleWhatsApp('whatsapp', {
      entry: [{
        changes: [{
          value: {
            messages: [{ id: 'msg-1', from: '+1234567890', text: { body: 'Hello' }, timestamp: '1234567890' }],
            contacts: [{ profile: { name: 'John' } }],
          },
        }],
      }],
    });
    expect(result.data.lead.id).toBe('lead-1');
  });

  // ── mobile-app generic webhook ──────────────────

  it('should create a lead from a mobile app event with contact info', async () => {
    const result: any = await service.handleGeneric('mobile-app', 'app_event', {
      name: 'Jane', email: 'jane@test.com', message: 'Interested in premium plan',
    });
    expect(contacts.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Jane', email: 'jane@test.com' }),
    );
    expect(leads.create).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'MOBILE_APP' }),
    );
    expect(conversations.create).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Interested in premium plan', channel: 'SYSTEM' }),
    );
    expect(result.data.lead.id).toBe('lead-1');
  });

  it('should reuse an existing open lead instead of creating a new one', async () => {
    prisma.lead.findFirst.mockResolvedValue(mockLead);
    await service.handleGeneric('mobile-app', 'app_event', { phone: '+1234567890' });
    expect(leads.create).not.toHaveBeenCalled();
  });

  it('should not create a lead for a mobile app event with no contact info', async () => {
    const result: any = await service.handleGeneric('mobile-app', 'app_event', { event: 'app_opened' });
    expect(leads.create).not.toHaveBeenCalled();
    expect(contacts.findOrCreate).not.toHaveBeenCalled();
    expect(result.data.received).toBe(true);
  });

  it('should not create a conversation message when the mobile app event has no message', async () => {
    await service.handleGeneric('mobile-app', 'app_event', { email: 'jane@test.com' });
    expect(conversations.create).not.toHaveBeenCalled();
  });
});



describe('WebhooksService — Rail C on inbound messages', () => {
  // dispatchInbound is the one chokepoint every channel flows through, so
  // these cover WhatsApp, Telegram and ad-click in one place.
  const makeService = (trigger: any) => {
    const escalation = {
      detectTrigger: jest.fn().mockReturnValue(trigger),
      raise: jest.fn().mockResolvedValue({ escalationId: 'esc-1', alreadyPaused: false }),
    };
    const agentClient = { trigger: jest.fn() };
    const flowRuntime = { handleInbound: jest.fn().mockResolvedValue(false) };
    const prisma = { businessSettings: { findFirst: jest.fn().mockResolvedValue({ agentMode: 'AI' }) } };
    const svc: any = Object.create(require('./webhooks.service').WebhooksService.prototype);
    svc.escalation = escalation;
    svc.agentClient = agentClient;
    svc.flowRuntime = flowRuntime;
    svc.prisma = prisma;
    svc.logger = { error: jest.fn() };
    return { svc, escalation, agentClient };
  };

  it('escalates and does not let the AI answer when a lead asks for a person', async () => {
    const { svc, escalation, agentClient } = makeService({
      trigger: 'LEAD_REQUESTED_HUMAN', detail: 'Lead asked to speak to a person',
    });

    svc.dispatchInbound('lead-1', 'c1', 'WHATSAPP', 'can I talk to a human', 'msg-1', 't1');
    await new Promise(r => setImmediate(r));

    expect(escalation.raise).toHaveBeenCalledWith(expect.objectContaining({
      leadId: 'lead-1', trigger: 'LEAD_REQUESTED_HUMAN',
    }));
    // Two answers to "can I speak to someone" is worse than one slower one.
    expect(agentClient.trigger).not.toHaveBeenCalled();
  });

  it('leaves an ordinary message to the AI', async () => {
    const { svc, escalation, agentClient } = makeService(null);

    svc.dispatchInbound('lead-1', 'c1', 'WHATSAPP', 'yes 2BHK sounds good', 'msg-1', 't1');
    await new Promise(r => setImmediate(r));

    expect(escalation.raise).not.toHaveBeenCalled();
    expect(agentClient.trigger).toHaveBeenCalled();
  });
});
