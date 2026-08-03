import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnitHoldsService } from './unit-holds.service';
import { PrismaService } from '../prisma/prisma.service';
import { TimelineService } from '../timeline/timeline.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ConflictException } from '@nestjs/common';
import { FollowUpSchedulerService } from '../automation/follow-up-scheduler.service';

describe('UnitHoldsService', () => {
  let service: UnitHoldsService;
  let prisma: any;

  const tenantId = 'tenant-1';
  const unit = { id: 'unit-1', tenantId, unitNumber: '101', status: 'AVAILABLE', version: 0 };

  beforeEach(async () => {
    prisma = {
      unit: {
        findFirst: jest.fn().mockResolvedValue(unit),
        findUnique: jest.fn().mockResolvedValue(unit),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(unit),
      },
      unitHold: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'hold-1', status: 'ACTIVE', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'hold-1', status: 'RELEASED' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
      },
      lead: { findFirst: jest.fn().mockResolvedValue({ id: 'lead-1', tenantId }) },
      unitStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation((fn: any) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnitHoldsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: (_k: string, d?: any) => d } },
        { provide: TimelineService, useValue: { add: jest.fn() } },
        { provide: AuditLogsService, useValue: { log: jest.fn() } },
        { provide: FollowUpSchedulerService, useValue: {
          schedule: jest.fn().mockResolvedValue(undefined),
          cancel: jest.fn().mockResolvedValue(undefined),
          cancelAllForLead: jest.fn().mockResolvedValue(0),
        } },
      ],
    }).compile();

    service = module.get(UnitHoldsService);
  });

  it('creates a hold and flips the unit to ON_HOLD conditioned on version', async () => {
    await service.requestHold({ tenantId, unitId: 'unit-1', leadId: 'lead-1', requestedById: 'agent-1' });
    expect(prisma.unit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'unit-1', version: 0, status: 'AVAILABLE' },
      }),
    );
  });

  it('throws UNIT_NOT_AVAILABLE when the conditional update loses the race', async () => {
    prisma.unit.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.requestHold({ tenantId, unitId: 'unit-1', leadId: 'lead-1' }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'UNIT_NOT_AVAILABLE' }) });
  });

  it('refuses to hold a unit that is already ON_HOLD', async () => {
    prisma.unit.findFirst.mockResolvedValue({ ...unit, status: 'ON_HOLD' });
    await expect(
      service.requestHold({ tenantId, unitId: 'unit-1', leadId: 'lead-1' }),
    ).rejects.toThrow(ConflictException);
  });

  it('refuses a second hold when one is already active', async () => {
    prisma.unitHold.findFirst.mockResolvedValue({ id: 'existing-hold', status: 'ACTIVE' });
    await expect(
      service.requestHold({ tenantId, unitId: 'unit-1', leadId: 'lead-1' }),
    ).rejects.toThrow(ConflictException);
  });

  it('only releases the unit back to AVAILABLE if it is still ON_HOLD', async () => {
    prisma.unitHold.findFirst.mockResolvedValue({ id: 'hold-1', tenantId, unitId: 'unit-1', status: 'ACTIVE' });
    prisma.unit.findUnique.mockResolvedValue({ ...unit, status: 'BOOKED' });
    await service.release(tenantId, 'hold-1', 'buyer backed out', 'manager-1');
    expect(prisma.unit.update).not.toHaveBeenCalled();
  });
});
