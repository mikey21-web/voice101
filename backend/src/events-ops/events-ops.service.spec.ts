import { Test, TestingModule } from '@nestjs/testing';
import { EventsOpsService } from './events-ops.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('EventsOpsService', () => {
  let service: EventsOpsService;
  let prisma: any;

  const mockContact = { id: 'contact-1', name: 'Priya' };

  const mockEvent = {
    id: 'event-1',
    title: 'Test Wedding',
    type: 'Wedding',
    status: 'PLANNING',
    eventDate: new Date('2026-12-15T00:00:00Z'),
    venue: 'Taj Palace',
    expectedGuests: 200,
    budget: 500000,
    contactId: 'contact-1',
    leadId: null,
    tenantId: 'default-tenant',
    createdAt: new Date('2026-07-13T00:00:00Z'),
    updatedAt: new Date('2026-07-13T00:00:00Z'),
    contact: mockContact,
  };

  beforeEach(async () => {
    prisma = {
      event: {
        findMany: jest.fn().mockResolvedValue([mockEvent]),
        findUnique: jest.fn().mockResolvedValue(mockEvent),
        create: jest.fn().mockResolvedValue(mockEvent),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...mockEvent, ...data })),
        count: jest.fn().mockResolvedValue(1),
      },
      paymentMilestone: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'ms-1', ...data })),
      },
      eventExpense: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'exp-1', ...data })),
      },
      task: { findMany: jest.fn().mockResolvedValue([]) },
      siteVisit: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EventsOpsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<EventsOpsService>(EventsOpsService);
  });

  describe('findAll', () => {
    it('should return paginated events', async () => {
      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by status', async () => {
      await service.findAll({ status: 'PLANNING' });
      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'PLANNING' }) }),
      );
    });

    it('should filter by contactId', async () => {
      await service.findAll({ contactId: 'contact-1' });
      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ contactId: 'contact-1' }) }),
      );
    });
  });

  describe('findOne', () => {
    it('should return an event with contact and lead included', async () => {
      const event = await service.findOne('event-1');
      expect(event.id).toBe('event-1');
      expect(prisma.event.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'event-1' }, include: { contact: true, lead: true } }),
      );
    });

    it('should throw NotFoundException when event not found', async () => {
      prisma.event.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create an event', async () => {
      const event = await service.create({ title: 'Test Wedding', type: 'Wedding' });
      expect(event.title).toBe('Test Wedding');
      expect(prisma.event.create).toHaveBeenCalledWith({ data: { title: 'Test Wedding', type: 'Wedding' } });
    });
  });

  describe('update', () => {
    it('should update an existing event', async () => {
      const event = await service.update('event-1', { status: 'UPCOMING' });
      expect(event.status).toBe('UPCOMING');
    });

    it('should throw NotFoundException when updating a non-existent event', async () => {
      prisma.event.findUnique.mockResolvedValue(null);
      await expect(service.update('nonexistent', { status: 'UPCOMING' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFinancials', () => {
    it('should compute the funnel with zero milestones and expenses', async () => {
      const fin = await service.getFinancials('event-1');
      expect(fin.budget).toBe(500000);
      expect(fin.invoiced).toBe(0);
      expect(fin.expenses).toBe(0);
      expect(fin.projectedProfit).toBe(500000);
      expect(fin.collectionRate).toBe(0);
    });

    it('should sum milestones into invoiced and expenses into totalExpenses', async () => {
      prisma.paymentMilestone.findMany.mockResolvedValue([{ amount: 100000 }, { amount: 50000 }]);
      prisma.eventExpense.findMany.mockResolvedValue([{ amount: 20000 }]);
      const fin = await service.getFinancials('event-1');
      expect(fin.invoiced).toBe(150000);
      expect(fin.expenses).toBe(20000);
      expect(fin.projectedProfit).toBe(500000 - 20000);
    });

    it('should flag risk when margin is below threshold', async () => {
      prisma.eventExpense.findMany.mockResolvedValue([{ amount: 480000 }]);
      const fin = await service.getFinancials('event-1');
      expect(fin.risk).toBe(true);
    });

    it('should throw NotFoundException for a non-existent event', async () => {
      prisma.event.findUnique.mockResolvedValue(null);
      await expect(service.getFinancials('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCalendar', () => {
    it('should merge events and tasks within the date range', async () => {
      const result = await service.getCalendar('2026-12-01', '2026-12-31');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].kind).toBe('event');
      expect(result.tasks).toHaveLength(0);
    });
  });
});
