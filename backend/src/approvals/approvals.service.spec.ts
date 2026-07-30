import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalsService } from './approvals.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { EventsService } from '../events/events.service';
import { ForbiddenException } from '@nestjs/common';

describe('ApprovalsService', () => {
  let service: ApprovalsService;
  let prisma: any;

  const tenantId = 't1';
  const request = { id: 'ar-1', tenantId, type: 'PRICE_OVERRIDE', entityType: 'Unit', entityId: 'unit-1', status: 'PENDING', expiresAt: null, reason: 'x' };

  beforeEach(async () => {
    prisma = {
      approvalRequest: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'ar-1', status: 'PENDING', ...data })),
        findFirst: jest.fn().mockResolvedValue(request),
        findMany: jest.fn().mockResolvedValue([request]),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...request, ...data })),
      },
      approvalPolicy: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApprovalsService, { provide: PrismaService, useValue: prisma }, { provide: AuditLogsService, useValue: { log: jest.fn() } }, { provide: EventsService, useValue: { emit: jest.fn() } }],
    }).compile();
    service = module.get(ApprovalsService);
  });

  it('creates a pending approval request', async () => {
    const r = await service.request(tenantId, { type: 'PRICE_OVERRIDE', entityType: 'Unit', entityId: 'unit-1' });
    expect(r.status).toBe('PENDING');
  });

  it('refuses to decide a request twice', async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue({ ...request, status: 'APPROVED' });
    await expect(service.decide(tenantId, 'ar-1', 'APPROVED', undefined, 'owner-1', 'OWNER')).rejects.toThrow(ForbiddenException);
  });

  it('expires and refuses a decision on a past-due request', async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue({ ...request, expiresAt: new Date(Date.now() - 1000) });
    await expect(service.decide(tenantId, 'ar-1', 'APPROVED', undefined, 'owner-1', 'OWNER')).rejects.toThrow(ForbiddenException);
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'EXPIRED' }) }),
    );
  });

  it('applies the matching policy snapshot at request time (highest threshold <= amount)', async () => {
    prisma.approvalPolicy.findMany.mockResolvedValue([
      { id: 'pol-high', minAmountPaise: 10000000n, requiredRole: 'OWNER' },
      { id: 'pol-low', minAmountPaise: 0n, requiredRole: 'MANAGER' },
    ]);
    const r = await service.request(tenantId, { type: 'PRICE_OVERRIDE', entityType: 'Unit', entityId: 'unit-1', amountPaise: 5000000 });
    expect(r.policySnapshot).toEqual({ requiredRole: 'MANAGER', minAmountPaise: '0', policyId: 'pol-low' });
  });

  it('refuses a decision from a role below the policy-required role', async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue({ ...request, policySnapshot: { requiredRole: 'OWNER' } });
    await expect(service.decide(tenantId, 'ar-1', 'APPROVED', undefined, 'mgr-1', 'MANAGER')).rejects.toThrow(ForbiddenException);
  });
});
