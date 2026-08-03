import { Test, TestingModule } from '@nestjs/testing';
import { SiteVisitsService } from './site-visits.service';
import { PrismaService } from '../prisma/prisma.service';
import { TimelineService } from '../timeline/timeline.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AutomationSchedulerService } from '../automation/automation-scheduler.service';
import { ForbiddenException } from '@nestjs/common';
import { FollowUpSchedulerService } from '../automation/follow-up-scheduler.service';

describe('SiteVisitsService', () => {
  let followUps: any;
  let service: SiteVisitsService;
  let prisma: any;

  const tenantId = 'tenant-1';
  const baseVisit = {
    id: 'visit-1',
    tenantId,
    leadId: 'lead-1',
    projectId: 'project-1',
    unitId: null,
    assignedAgentId: 'agent-1',
    startAt: new Date(Date.now() + 60 * 60 * 1000),
    endAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    status: 'SCHEDULED',
  };

  beforeEach(async () => {
    prisma = {
      lead: { findFirst: jest.fn().mockResolvedValue({ id: 'lead-1', tenantId }) },
      project: { findFirst: jest.fn().mockResolvedValue({ id: 'project-1', tenantId }) },
      unit: { findFirst: jest.fn().mockResolvedValue(null) },
      siteVisit: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...baseVisit, ...data })),
        findFirst: jest.fn().mockResolvedValue(baseVisit),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...baseVisit, ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([baseVisit]),
        count: jest.fn().mockResolvedValue(1),
      },
      task: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'task-1', ...data })) },
      scheduledAction: {
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn().mockImplementation((fn: any) => fn(prisma)),
    };

    followUps = {
      schedule: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
      cancelAllForLead: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SiteVisitsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TimelineService, useValue: { add: jest.fn() } },
        { provide: AuditLogsService, useValue: { log: jest.fn() } },
        { provide: AutomationSchedulerService, useValue: { schedule: jest.fn(), cancel: jest.fn() } },
        { provide: FollowUpSchedulerService, useValue: followUps },
      ],
    }).compile();

    service = module.get(SiteVisitsService);
  });

  it('creates a visit and schedules reminders', async () => {
    const visit = await service.create({
      tenantId,
      leadId: 'lead-1',
      projectId: 'project-1',
      startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
    expect(visit.leadId).toBe('lead-1');
    // Phase 8: scheduling goes through the one typed API, not raw prisma.
    expect(followUps.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: 'lead-1', kind: 'site_visit_reminder' }),
    );
  });

  it('creates a follow-up task when a visit is completed', async () => {
    await service.complete(tenantId, 'visit-1', { outcome: { attended: true } });
    expect(prisma.task.create).toHaveBeenCalled();
    const taskArg = prisma.task.create.mock.calls[0][0].data;
    expect(taskArg.leadId).toBe('lead-1');
    expect(taskArg.source).toBe('site_visit_completed');
  });

  it('creates a recovery task and reason on no-show', async () => {
    await service.markNoShow(tenantId, 'visit-1', 'Buyer stuck in traffic');
    const taskArg = prisma.task.create.mock.calls[0][0].data;
    expect(taskArg.source).toBe('site_visit_no_show');
    const updateArg = prisma.siteVisit.update.mock.calls[0][0].data;
    expect(updateArg.status).toBe('NO_SHOW');
    expect(updateArg.noShowReason).toBe('Buyer stuck in traffic');
  });

  it('refuses to check in a visit that is already completed', async () => {
    prisma.siteVisit.findFirst.mockResolvedValue({ ...baseVisit, status: 'COMPLETED' });
    await expect(service.confirm(tenantId, 'visit-1')).rejects.toThrow(ForbiddenException);
  });

  it('cancels pending reminders when a visit is cancelled', async () => {
    await service.cancel(tenantId, 'visit-1', 'Buyer requested cancellation');
    expect(prisma.scheduledAction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dedupeKey: { startsWith: 'sitevisit_reminder:visit-1:' },
        }),
      }),
    );
  });
});
