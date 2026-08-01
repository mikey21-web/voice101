import { Test, TestingModule } from '@nestjs/testing';
import { AutonomyGuardrailsService } from './autonomy-guardrails.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AutonomyGuardrailsService', () => {
  let service: AutonomyGuardrailsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ settings: {} }),
        update: jest.fn().mockResolvedValue({}),
      },
      mikeyAutonomousAction: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
      leadEscalation: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AutonomyGuardrailsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AutonomyGuardrailsService);
  });

  it('defaults every category to observe when nothing is configured', async () => {
    const levels = await service.getAllCategoryLevels('t1');
    expect(levels).toEqual({
      lead_assignment: 'observe', lead_messaging: 'observe', task_escalation: 'observe',
      money: 'observe', inventory: 'observe', scheduling: 'observe', documents: 'observe',
    });
  });

  it('seeds the split categories from a tenant\'s old jarvis_tools dial', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ settings: { mikeyAutonomyCategories: { jarvis_tools: 'autonomous' } } });
    const levels = await service.getAllCategoryLevels('t1');

    expect(levels.inventory).toBe('autonomous');
    expect(levels.scheduling).toBe('autonomous');
    expect(levels.documents).toBe('autonomous');
    // Their old dial meant site visits and unit holds, never demand letters.
    expect(levels.money).toBe('observe');
  });

  it('an escalated lead is left alone even when the dial says autonomous', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      settings: { mikeyAutonomyCategories: { lead_messaging: 'autonomous' }, leadAutoSendMode: 'enabled' },
    });
    prisma.leadEscalation.findFirst.mockResolvedValue({ id: 'esc-1' });

    const gate = await service.canMessageLeadAutonomously('t1', 'lead_messaging', 'lead-1');
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain('escalated');

    // auto-send mode 'enabled' skips quiet hours and caps, but not this.
    const send = await service.canAutoSend('t1', 'lead-1');
    expect(send.allowed).toBe(false);
    expect(send.reason).toContain('escalated');
  });

  it('turning off money leaves scheduling free to act', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      settings: { mikeyAutonomyCategories: { money: 'off', scheduling: 'autonomous' } },
    });

    expect((await service.canActInternally('t1', 'money')).allowed).toBe(false);
    expect((await service.canActInternally('t1', 'scheduling')).allowed).toBe(true);
  });

  it('blocks an internal action once its category is turned off', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ settings: { mikeyAutonomyCategories: { task_escalation: 'off' } } });
    const gate = await service.canActInternally('t1', 'task_escalation');
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain('turned off');
  });

  it('does not block a different category when only one is turned off', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ settings: { mikeyAutonomyCategories: { task_escalation: 'off' } } });
    const gate = await service.canActInternally('t1', 'lead_assignment');
    expect(gate.allowed).toBe(true);
  });

  it('blocks in observe mode without touching the daily-cap check', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ settings: { mikeyAutonomyCategories: { lead_messaging: 'observe' } } });
    const gate = await service.canMessageLeadAutonomously('t1', 'lead_messaging', 'lead-1');
    expect(gate.allowed).toBe(false);
    expect(prisma.mikeyAutonomousAction.count).not.toHaveBeenCalled();
  });

  it('setCategoryLevel persists alongside existing settings without clobbering them', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ settings: { autonomyDailyCap: 25, mikeyAutonomyCategories: { lead_assignment: 'off' } } });
    await service.setCategoryLevel('t1', 'lead_messaging', 'off');
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { settings: { autonomyDailyCap: 25, mikeyAutonomyCategories: { lead_assignment: 'off', lead_messaging: 'off' } } },
    });
  });
});
