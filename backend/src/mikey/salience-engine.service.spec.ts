import { Test, TestingModule } from '@nestjs/testing';
import { SalienceEngineService } from './salience-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { EventsService } from '../events/events.service';
import { AutonomyGuardrailsService } from './autonomy-guardrails.service';
import { AutonomousActionService } from './autonomous-action.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { MemoryService } from './memory.service';

describe('SalienceEngineService', () => {
  let service: SalienceEngineService;
  let prisma: any;
  let guardrails: any;
  let actions: any;

  beforeEach(async () => {
    prisma = {
      lead: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      task: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    guardrails = {
      canActInternally: jest.fn().mockResolvedValue({ allowed: true }),
      canMessageLeadAutonomously: jest.fn().mockResolvedValue({ allowed: true }),
    };
    actions = { record: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalienceEngineService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConversationsService, useValue: { create: jest.fn() } },
        { provide: EventsService, useValue: { emit: jest.fn().mockResolvedValue(undefined) } },
        { provide: AutonomyGuardrailsService, useValue: guardrails },
        { provide: AutonomousActionService, useValue: actions },
        { provide: ApprovalsService, useValue: { request: jest.fn(), decide: jest.fn() } },
        { provide: MemoryService, useValue: { recallRecent: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    service = module.get(SalienceEngineService);
  });

  it('escalates overdue tasks to high priority and records an undoable action', async () => {
    prisma.task.findMany.mockResolvedValueOnce([{ id: 't1', priority: 'medium', leadId: 'l1' }]);

    const result = await service.route({
      type: 'overdue_tasks', severity: 'warning', title: '', description: '', count: 1,
      metadata: { taskIds: ['t1'] },
    } as any);

    expect(result.acted).toBe(true);
    expect(prisma.task.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { priority: 'high' } });
    expect(actions.record).toHaveBeenCalledWith(expect.objectContaining({
      tool: 'escalate_task_priority',
      undoable: true,
      undoData: { taskId: 't1', previousPriority: 'medium' },
    }));
  });

  it('does not escalate a task already at high priority', async () => {
    prisma.task.findMany.mockResolvedValueOnce([]); // where clause excludes priority: 'high', so nothing comes back

    const result = await service.route({
      type: 'overdue_tasks', severity: 'warning', title: '', description: '', count: 1,
      metadata: { taskIds: ['t1'] },
    } as any);

    expect(result.acted).toBe(false);
  });

  it('respects the guardrail gate for overdue-task escalation', async () => {
    guardrails.canActInternally.mockResolvedValueOnce({ allowed: false, reason: 'daily cap reached' });

    const result = await service.route({
      type: 'overdue_tasks', severity: 'warning', title: '', description: '', count: 1,
      metadata: { taskIds: ['t1'] },
    } as any);

    expect(result.acted).toBe(false);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('auto-assigns stale new leads that have no agent yet, skipping ones already assigned', async () => {
    prisma.lead.findMany.mockResolvedValueOnce([
      { id: 'l1', assignedAgentId: null },
      { id: 'l2', assignedAgentId: 'existing-agent' },
    ]);
    prisma.user.findMany.mockResolvedValueOnce([
      { id: 'a1', name: 'Agent One', assignedLeads: [] },
    ]);

    const result = await service.route({
      type: 'stale_new_leads', severity: 'warning', title: '', description: '', count: 2,
      metadata: { leadIds: ['l1', 'l2'] },
    } as any);

    expect(result.acted).toBe(true);
    expect(prisma.lead.update).toHaveBeenCalledTimes(1);
    expect(prisma.lead.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { assignedAgentId: 'a1' } });
  });
});
