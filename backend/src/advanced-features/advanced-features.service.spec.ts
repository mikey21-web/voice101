import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdvancedFeaturesService } from './advanced-features.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ContactsService } from '../contacts/contacts.service';
import { LeadsService } from '../leads/leads.service';

describe('AdvancedFeaturesService — blocklist & SLA', () => {
  let service: AdvancedFeaturesService;
  let prisma: any;
  const auditLogs = { log: jest.fn().mockResolvedValue({}) };
  const contacts = { findOrCreate: jest.fn().mockResolvedValue({ id: 'contact-1' }) };
  const leadsService = { create: jest.fn().mockResolvedValue({ id: 'lead-1' }) };

  const mockBlockEntry = { id: 'bl-1', type: 'email', value: 'spam@test.com', reason: 'Known spam' };
  const mockSlaRule = { id: 'sla-1', name: 'Urgent Response', condition: { status: 'NEW' }, responseTimeMinutes: 60, escalationAfterMinutes: 120, escalationUserId: 'user-1', active: true };

  beforeEach(async () => {
    prisma = {
      blocklistEntry: {
        findMany: jest.fn().mockResolvedValue([mockBlockEntry]),
        findUnique: jest.fn().mockResolvedValue(mockBlockEntry),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(d => d.data || d),
        delete: jest.fn().mockResolvedValue({}),
      },
      slaRule: {
        findMany: jest.fn().mockResolvedValue([mockSlaRule]),
        findUnique: jest.fn().mockResolvedValue(mockSlaRule),
        create: jest.fn().mockResolvedValue(mockSlaRule),
        update: jest.fn().mockResolvedValue(mockSlaRule),
        delete: jest.fn().mockResolvedValue({}),
      },
      lead: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'lead-1', ...data })),
      },
      pipelineStage: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      savedFilter: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        delete: jest.fn(),
      },
      internalNote: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(d => d),
        upsert: jest.fn().mockImplementation(({ create }) => create),
      },
      leadOwnershipHistory: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      contact: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      lead_count: { updateMany: jest.fn() },
      revenueRecord: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      importExportLog: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: 'log-1', userId: 'user-1' }),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      automationEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      conversationMessage: { updateMany: jest.fn() },
      mediaFile: { updateMany: jest.fn() },
      customFieldValue: { updateMany: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
      $transaction: jest.fn(cb => cb()),
    };

    const module = await Test.createTestingModule({
      providers: [
        AdvancedFeaturesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: auditLogs },
        { provide: ContactsService, useValue: contacts },
        { provide: LeadsService, useValue: leadsService },
      ],
    }).compile();
    service = module.get<AdvancedFeaturesService>(AdvancedFeaturesService);
  });

  describe('blocklist', () => {
    it('should detect blocked email', async () => {
      prisma.blocklistEntry.findFirst.mockResolvedValue(mockBlockEntry);
      const blocked = await service.checkBlocklist('spam@test.com');
      expect(blocked).toBe(true);
    });

    it('should allow clean email', async () => {
      prisma.blocklistEntry.findFirst.mockResolvedValue(null);
      const blocked = await service.checkBlocklist('clean@test.com');
      expect(blocked).toBe(false);
    });

    it('should detect blocked phone', async () => {
      prisma.blocklistEntry.findFirst.mockResolvedValue({ ...mockBlockEntry, type: 'phone', value: '1234567890' });
      const blocked = await service.checkBlocklist(undefined, '1234567890');
      expect(blocked).toBe(true);
    });

    it('should add to blocklist', async () => {
      const result = await service.addToBlocklist('email', 'bad@test.com', 'Spam');
      expect(result.type).toBe('email');
      expect(result.value).toBe('bad@test.com');
    });
  });

  describe('SLA rules', () => {
    it('should evaluate SLA rules and find breaches', async () => {
      prisma.lead.findMany.mockResolvedValue([
        { id: 'lead-1', createdAt: new Date(Date.now() - 120 * 60000), contact: { name: 'Test', email: 'test@test.com' }, conversations: [] },
      ]);
      const result = await service.evaluateSlaRules();
      expect(result.breaches.length).toBe(1);
      expect(result.breaches[0].breached).toBe(true);
    });

    it('should return empty when no leads breach SLA', async () => {
      prisma.lead.findMany.mockResolvedValue([]);
      const result = await service.evaluateSlaRules();
      expect(result.breaches.length).toBe(0);
    });
  });

  describe('failure inbox', () => {
    it('should list failed events', async () => {
      prisma.automationEvent.findMany.mockResolvedValue([
        { id: 'ev-1', type: 'CRM_PUSH_REQUESTED', status: 'failed', payload: {}, attempts: 3, lastError: 'network error' },
      ]);
      const inbox = await service.getFailureInbox();
      expect(inbox.length).toBe(1);
      expect(inbox[0].status).toBe('failed');
    });

    it('should retry a failed event', async () => {
      prisma.automationEvent.findUnique.mockResolvedValue({
        id: 'ev-1', type: 'CRM_PUSH_REQUESTED', status: 'failed', attempts: 2, maxAttempts: 5,
      });
      const result = await service.retryFailedEvent('ev-1');
      expect(result.status).toBe('retrying');
    });
  });

  describe('sandbox test', () => {
    it('should run sandbox test', async () => {
      const result = await service.sandboxTest();
      expect(result.checks.database).toBe('ok');
    });
  });

  describe('processImport — leads from an external CRM export', () => {
    it('finds-or-creates the contact by email/name/phone when no contactId is given', async () => {
      const result = await service.processImport('log-1', [
        { contactName: 'Ramesh Kumar', contactEmail: 'ramesh@test.com', contactPhone: '+911234567890', source: 'MANUAL', message: 'Interested in 3BHK' },
      ], 'lead');

      expect(contacts.findOrCreate).toHaveBeenCalledWith({ name: 'Ramesh Kumar', email: 'ramesh@test.com', phone: '+911234567890' });
      // Lead creation is delegated to LeadsService (validation/scoring/events),
      // not a raw prisma.lead.create — see leadsService.create call in
      // advanced-features.service.ts's processImport().
      expect(leadsService.create).toHaveBeenCalledWith({
        source: 'MANUAL', message: 'Interested in 3BHK', interest: undefined, budget: undefined, urgency: undefined,
        contactId: 'contact-1', metadata: { _bulkImport: true },
      });
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('still supports a raw contactId for backward compatibility', async () => {
      contacts.findOrCreate.mockClear();
      const result = await service.processImport('log-1', [
        { contactId: 'existing-contact-id', source: 'REFERRAL' },
      ], 'lead');

      expect(contacts.findOrCreate).not.toHaveBeenCalled();
      expect(leadsService.create).toHaveBeenCalledWith({
        source: 'REFERRAL', message: undefined, interest: undefined, budget: undefined, urgency: undefined,
        contactId: 'existing-contact-id', metadata: { _bulkImport: true },
      });
      expect(result.processed).toBe(1);
    });

    it('fails the row when there is no contactId and no contact info to match or create one', async () => {
      const result = await service.processImport('log-1', [
        { source: 'MANUAL', message: 'no contact info here' },
      ], 'lead');

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toContain('no contact name/email/phone');
    });
  });
});
