import { Test, TestingModule } from '@nestjs/testing';
import { CostSheetsService } from './cost-sheets.service';
import { PrismaService } from '../prisma/prisma.service';
import { TimelineService } from '../timeline/timeline.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AutomationSchedulerService } from '../automation/automation-scheduler.service';
import { ForbiddenException } from '@nestjs/common';

describe('CostSheetsService', () => {
  let service: CostSheetsService;
  let prisma: any;

  const tenantId = 'tenant-1';
  const baseSheet = {
    id: 'sheet-1',
    tenantId,
    leadId: 'lead-1',
    unitId: 'unit-1',
    status: 'DRAFT',
    totalPaise: BigInt(500000000),
    lineItems: [{ id: 'li-1', code: 'BASE', label: 'Base', amountPaise: BigInt(500000000), calculationType: 'FLAT', taxable: false, displayOrder: 0 }],
  };

  beforeEach(async () => {
    prisma = {
      unit: { findFirst: jest.fn().mockResolvedValue({ id: 'unit-1', tenantId, price: 5000000 }) },
      lead: { findFirst: jest.fn().mockResolvedValue({ id: 'lead-1', tenantId }) },
      costSheet: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({
          ...baseSheet,
          ...data,
          lineItems: data.lineItems.create.map((li: any, i: number) => ({ id: `li-${i}`, ...li })),
        })),
        findFirst: jest.fn().mockResolvedValue(baseSheet),
        findUniqueOrThrow: jest.fn().mockResolvedValue(baseSheet),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...baseSheet, ...data })),
        findMany: jest.fn().mockResolvedValue([baseSheet]),
        count: jest.fn().mockResolvedValue(1),
      },
      costSheetLineItem: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn().mockImplementation((ops: any) => Array.isArray(ops) ? Promise.all(ops) : ops(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostSheetsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TimelineService, useValue: { add: jest.fn() } },
        { provide: AuditLogsService, useValue: { log: jest.fn() } },
        { provide: AutomationSchedulerService, useValue: { schedule: jest.fn(), cancel: jest.fn() } },
      ],
    }).compile();

    service = module.get(CostSheetsService);
  });

  it('seeds a draft from the unit base price when no line items are given', async () => {
    const sheet = await service.create({ tenantId, leadId: 'lead-1', unitId: 'unit-1', projectId: 'project-1' });
    expect(sheet.lineItems[0].code).toBe('BASE');
    expect(sheet.totalPaise).toBe('500000000');
  });

  it('supersedes any still-open sheet for the same lead/unit before creating a new one', async () => {
    await service.create({ tenantId, leadId: 'lead-1', unitId: 'unit-1', projectId: 'project-1' });
    expect(prisma.costSheet.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'SUPERSEDED' } }),
    );
  });

  it('refuses to edit line items once a sheet has left DRAFT', async () => {
    prisma.costSheet.findFirst.mockResolvedValue({ ...baseSheet, status: 'SENT' });
    await expect(
      service.replaceLineItems(tenantId, 'sheet-1', [{ code: 'BASE', label: 'Base', amountPaise: 1 }]),
    ).rejects.toThrow(ForbiddenException);
  });

  it('refuses to approve a sheet that is not PENDING_APPROVAL', async () => {
    prisma.costSheet.findFirst.mockResolvedValue({ ...baseSheet, status: 'DRAFT' });
    await expect(service.approve(tenantId, 'sheet-1')).rejects.toThrow(ForbiddenException);
  });

  it('snapshots line items on approval', async () => {
    prisma.costSheet.findFirst.mockResolvedValue({ ...baseSheet, status: 'PENDING_APPROVAL' });
    await service.approve(tenantId, 'sheet-1', 'manager-1');
    const call = prisma.costSheet.update.mock.calls[0][0];
    expect(call.data.status).toBe('APPROVED');
    expect(call.data.snapshot).toBeDefined();
  });
});
