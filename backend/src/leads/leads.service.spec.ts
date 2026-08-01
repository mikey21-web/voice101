import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AdvancedFeaturesService } from '../advanced-features/advanced-features.service';
import { EventsService } from '../events/events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ContactsService } from '../contacts/contacts.service';
import { MetricsService } from '../monitoring/metrics.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { LeadOrchestratorService } from '../voice-agent/lead-orchestrator.service';
import { LeadContextService } from './lead-context.service';
import { AdvanceStageService } from './advance-stage.service';

describe('LeadsService', () => {
  let service: LeadsService;
  let prisma: any;
  const advanceStage = { advanceStage: jest.fn().mockResolvedValue({ from: 'NEW', to: 'SPAM', stage: 'CLOSED_LOST' }) };
  const auditLogs = { log: jest.fn().mockResolvedValue({}) };
  const advanced = { checkBlocklist: jest.fn().mockResolvedValue(false) };
  const events = { emit: jest.fn().mockResolvedValue({}) };
  const notifications = { create: jest.fn().mockResolvedValue(undefined) };
  const contacts = { findOrCreate: jest.fn().mockResolvedValue({ id: 'contact-1' }) };
  const metrics = { incrementCounter: jest.fn() };

  const mockLead = {
    id: 'lead-1',
    status: 'NEW',
    segment: 'COLD',
    source: 'FORM',
    score: 0,
    contactId: 'contact-1',
    contact: { id: 'contact-1', name: 'John', email: 'john@test.com', phone: '+1234567890' },
  };

  beforeEach(async () => {
    // findOne() queries via findFirst while other call sites use findUnique for the
    // same row — sharing one jest.fn() keeps both in sync with whatever a test sets
    // the lead's existence to (see the identical fix in campaigns.service.spec.ts).
    const findLeadOne = jest.fn().mockResolvedValue(mockLead);
    prisma = {
      lead: {
        findMany: jest.fn().mockResolvedValue([mockLead]),
        findUnique: findLeadOne,
        findFirst: findLeadOne,
        create: jest.fn().mockResolvedValue(mockLead),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...mockLead, ...data })),
        count: jest.fn().mockResolvedValue(1),
      },
      contact: {
        findUnique: jest.fn().mockResolvedValue({ tenantId: 'default-tenant' }),
      },
      scoringRule: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      scoreLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(prisma)),
    };

    const module = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: auditLogs },
        { provide: AdvancedFeaturesService, useValue: advanced },
        { provide: EventsService, useValue: events },
        { provide: NotificationsService, useValue: notifications },
        { provide: ContactsService, useValue: contacts },
        { provide: MetricsService, useValue: metrics },
        { provide: RealtimeGateway, useValue: { broadcastLeadUpdate: jest.fn(), sendToUser: jest.fn(), emitToTenant: jest.fn() } },
        { provide: LeadOrchestratorService, useValue: { onLeadCreated: jest.fn().mockResolvedValue(undefined) } },
        { provide: LeadContextService, useValue: { enrich: jest.fn().mockResolvedValue(undefined) } },
        { provide: AdvanceStageService, useValue: advanceStage },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  it('should create a lead', async () => {
    const lead = await service.create({ contactId: 'contact-1', source: 'FORM' });
    expect(lead.status).toBe('NEW');
    expect(lead.source).toBe('FORM');
  });

  it('should find leads with pagination', async () => {
    const result = await service.findAll({ page: 1, limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('should find lead by id', async () => {
    const lead = await service.findOne('lead-1');
    expect(lead.contact.name).toBe('John');
  });

  it('should throw on non-existent lead', async () => {
    prisma.lead.findUnique.mockResolvedValue(null);
    await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('should score a lead', async () => {
    const scored = await service.score('lead-1');
    expect(scored.score).toBe(0);
    expect(scored.segment).toBe('UNQUALIFIED');
  });

  it('should mark lead as spam through advanceStage', async () => {
    const spam = await service.markSpam('lead-1');
    expect(advanceStage.advanceStage).toHaveBeenCalledWith(expect.objectContaining({ to: 'SPAM', reason: 'marked as spam' }));
    expect(spam.segment).toBe('UNQUALIFIED');
    expect(spam.score).toBe(-100);
  });
});

