import { Test, TestingModule } from '@nestjs/testing';
import { EscalationService } from './escalation.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('EscalationService (Phase 5)', () => {
  let service: EscalationService;
  let prisma: any;
  let events: any;
  let notifications: any;

  beforeEach(async () => {
    prisma = {
      leadEscalation: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'esc-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      lead: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'lead-1',
          assignedAgentId: 'agent-1',
          contact: { name: 'Ravi' },
          assignedAgent: { phone: '9100000000' },
        }),
      },
    };
    events = { emit: jest.fn().mockResolvedValue(undefined) };
    notifications = { create: jest.fn().mockResolvedValue({ id: 'n-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscalationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsService, useValue: events },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(EscalationService);
  });

  describe('raise', () => {
    it('records the escalation and pages the owning rep by text', async () => {
      const res = await service.raise({
        tenantId: 't1', leadId: 'lead-1',
        trigger: 'LEAD_REQUESTED_HUMAN', detail: 'Lead asked to speak to a person',
      });

      expect(res.alreadyPaused).toBe(false);
      expect(prisma.leadEscalation.create).toHaveBeenCalled();
      const n = notifications.create.mock.calls[0][0];
      expect(n.userId).toBe('agent-1');
      expect(n.type).toBe('call_wants_human'); // in SMS_NOTIFICATION_TYPES
      expect(n.whatsappTo).toBe('9100000000');
      expect(events.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'lead.escalated' }));
    });

    it('does not page the rep twice for the same lead', async () => {
      prisma.leadEscalation.findFirst.mockResolvedValue({ id: 'esc-open', trigger: 'NEGATIVE_SENTIMENT' });

      const res = await service.raise({
        tenantId: 't1', leadId: 'lead-1',
        trigger: 'PRICE_NEGOTIATION', detail: 'asked for a discount',
      });

      expect(res.alreadyPaused).toBe(true);
      expect(prisma.leadEscalation.create).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('still records the escalation when no rep is assigned', async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: 'lead-1', assignedAgentId: null, contact: { name: 'Ravi' } });

      await service.raise({ tenantId: 't1', leadId: 'lead-1', trigger: 'NEGATIVE_SENTIMENT', detail: 'angry' });

      expect(prisma.leadEscalation.create).toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('a failing notification does not lose the escalation', async () => {
      notifications.create.mockRejectedValue(new Error('SMS provider down'));

      const res = await service.raise({
        tenantId: 't1', leadId: 'lead-1', trigger: 'LEAD_REQUESTED_HUMAN', detail: 'x',
      });

      expect(res.escalationId).toBe('esc-1');
      expect(events.emit).toHaveBeenCalled();
    });
  });

  describe('isPaused', () => {
    it('is paused while an escalation is unresolved', async () => {
      prisma.leadEscalation.findFirst.mockResolvedValue({ id: 'esc-1' });
      expect(await service.isPaused('t1', 'lead-1')).toBe(true);
    });

    it('is not paused once resolved', async () => {
      prisma.leadEscalation.findFirst.mockResolvedValue(null);
      expect(await service.isPaused('t1', 'lead-1')).toBe(false);
    });
  });

  describe('detectTrigger', () => {
    it('fires when the lead asks for a person', () => {
      expect(service.detectTrigger({ text: 'can I talk to a human please' })?.trigger)
        .toBe('LEAD_REQUESTED_HUMAN');
      expect(service.detectTrigger({ text: 'let me speak to someone' })?.trigger)
        .toBe('LEAD_REQUESTED_HUMAN');
    });

    it('fires on legal questions', () => {
      expect(service.detectTrigger({ text: 'is this RERA registered' })?.trigger)
        .toBe('LEGAL_OR_COMMITMENT');
    });

    it('fires when a price negotiation opens', () => {
      expect(service.detectTrigger({ text: 'what is your best price' })?.trigger)
        .toBe('PRICE_NEGOTIATION');
      expect(service.detectTrigger({ text: 'can you give some discount' })?.trigger)
        .toBe('PRICE_NEGOTIATION');
    });

    it('fires on negative sentiment', () => {
      expect(service.detectTrigger({ text: 'ok', sentiment: 'negative' })?.trigger)
        .toBe('NEGATIVE_SENTIMENT');
    });

    it('fires on a deal at or above the threshold', () => {
      expect(service.detectTrigger({ dealValue: 10_000_000 })?.trigger)
        .toBe('DEAL_VALUE_OVER_THRESHOLD');
      expect(service.detectTrigger({ dealValue: 9_999_999 })).toBeNull();
    });

    it('fires when the model is guessing', () => {
      expect(service.detectTrigger({ text: 'hmm', confidence: 0.2 })?.trigger)
        .toBe('LOW_MODEL_CONFIDENCE');
    });

    it('prefers the hostile question over a low confidence score', () => {
      // A confident answer is no comfort if the buyer is asking about lawyers.
      expect(service.detectTrigger({ text: 'I will get my lawyer', confidence: 0.1 })?.trigger)
        .toBe('LEGAL_OR_COMMITMENT');
    });

    it('stays quiet on an ordinary message', () => {
      expect(service.detectTrigger({ text: 'yes 2BHK sounds good', confidence: 0.9 })).toBeNull();
    });
  });
});
