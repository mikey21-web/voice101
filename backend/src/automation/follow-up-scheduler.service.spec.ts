import { Test, TestingModule } from '@nestjs/testing';
import { FollowUpSchedulerService, KIND_STAGE, FOLLOWUP_KINDS } from './follow-up-scheduler.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FollowUpSchedulerService (Phase 8)', () => {
  let service: FollowUpSchedulerService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      scheduledAction: {
        upsert: jest.fn().mockResolvedValue({ id: 'sa-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [FollowUpSchedulerService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(FollowUpSchedulerService);
  });

  it('schedules work on the shared clock', async () => {
    const runAt = new Date('2026-08-02T10:00:00Z');
    await service.schedule({
      leadId: 'lead-1', kind: 'site_visit_reminder', runAt,
      dedupeKey: 'sv_conf:visit-1', payload: { text: 'see you Sunday' },
    });

    const call = prisma.scheduledAction.upsert.mock.calls[0][0];
    expect(call.where.dedupeKey).toBe('sv_conf:visit-1');
    expect(call.create.status).toBe('pending');
    expect(call.create.kind).toBe('site_visit_reminder');
  });

  it('rescheduling the same key moves the row instead of sending twice', async () => {
    await service.schedule({ leadId: 'l1', kind: 'followup', runAt: new Date(), dedupeKey: 'k1' });
    const call = prisma.scheduledAction.upsert.mock.calls[0][0];
    expect(call.update).toBeDefined();
    expect(call.update.status).toBeUndefined(); // never resurrects a claimed row
  });

  it('a scheduling failure never breaks the caller', async () => {
    prisma.scheduledAction.upsert.mockRejectedValue(new Error('DB down'));
    // The booking that triggered this must still complete.
    await expect(
      service.schedule({ leadId: 'l1', kind: 'payment_reminder', runAt: new Date(), dedupeKey: 'k2' }),
    ).resolves.toBeUndefined();
  });

  it('cancels everything pending for a lead', async () => {
    const n = await service.cancelAllForLead('lead-1');

    expect(n).toBe(2);
    const where = prisma.scheduledAction.updateMany.mock.calls[0][0].where;
    expect(where.status).toBe('pending'); // never touches claimed or done rows
    expect(prisma.scheduledAction.updateMany.mock.calls[0][0].data.status).toBe('cancelled');
  });

  it('can cancel just one stage worth of chasing', async () => {
    await service.cancelAllForLead('lead-1', ['site_visit_reminder', 'no_show_recovery']);
    const where = prisma.scheduledAction.updateMany.mock.calls[0][0].where;
    expect(where.kind.in).toEqual(['site_visit_reminder', 'no_show_recovery']);
  });

  it('lists what one spine stage owns', async () => {
    await service.pendingForStage('MONEY_TRAIL');
    const where = prisma.scheduledAction.findMany.mock.calls[0][0].where;
    expect(where.kind.in).toEqual(expect.arrayContaining(['payment_reminder', 'payment_escalation']));
    expect(where.kind.in).not.toContain('site_visit_reminder');
  });

  it('every kind the poller runs is mapped to a stage', () => {
    // An unmapped kind would be invisible to pendingForStage and belong to nobody.
    for (const kind of FOLLOWUP_KINDS) {
      expect(KIND_STAGE[kind]).toBeDefined();
    }
  });
});
