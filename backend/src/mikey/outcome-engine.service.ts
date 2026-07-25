import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

export interface OutcomeStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  tool?: string;
  args?: any;
  result?: string;
  pendingActionId?: string;
}

export interface OutcomeGoal {
  id: string;
  tenantId: string;
  userId: string;
  conversationId: string | null;
  goal: string;
  metric: string;
  target: number;
  current: number;
  status: 'active' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
  steps: OutcomeStep[];
  createdAt: Date;
  updatedAt: Date;
}

// Persistence + CRUD layer for Jarvis outcomes. Deliberately has no dependency
// on CopilotService — actually *running* steps (calling the copilot's tool
// pipeline) lives in CopilotService.runOutcome, since CopilotService already
// depends on this service and a two-way dependency would be circular.
@Injectable()
export class OutcomeEngineService {
  private readonly logger = new Logger(OutcomeEngineService.name);

  constructor(
    private prisma: PrismaService,
    private events: EventsService,
  ) {}

  private toGoal(row: any): OutcomeGoal {
    return { ...row, steps: row.steps as OutcomeStep[] };
  }

  async defineOutcome(params: {
    tenantId: string;
    userId: string;
    goal: string;
    metric: string;
    target: number;
    current: number;
  }): Promise<OutcomeGoal> {
    const steps = this.breakDownGoal(params.goal, params.metric, params.target, params.current);

    const row = await this.prisma.jarvisOutcome.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        goal: params.goal,
        metric: params.metric,
        target: params.target,
        current: params.current,
        status: 'active',
        steps: steps as any,
      },
    });

    await this.events.emit({
      type: 'mikey.outcome_defined',
      source: 'outcome-engine',
      payload: { id: row.id, goal: row.goal, steps: steps.map(s => s.description) },
    });

    this.logger.log(`Outcome defined: "${row.goal}" — ${steps.length} steps`);
    return this.toGoal(row);
  }

  // ponytail: template-based decomposition, not LLM-based. Covers the three
  // goal shapes Mikey actually surfaces today (conversion, lead volume,
  // generic). Upgrade to an LLM planning call if a goal doesn't fit any of
  // these buckets in practice.
  private breakDownGoal(goal: string, metric: string, target: number, current: number): OutcomeStep[] {
    const gap = target - current;
    const steps: OutcomeStep[] = [];
    const mk = (i: number, description: string, tool?: string): OutcomeStep =>
      ({ id: `s${i}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, description, status: 'pending', tool });

    if (metric === 'conversion_rate' || goal.toLowerCase().includes('conversion')) {
      steps.push(mk(1, `Analyze current conversion funnel to identify bottlenecks (current: ${(current * 100).toFixed(1)}%, target: ${(target * 100).toFixed(1)}%)`));
      steps.push(mk(2, `Review scoring rules and adjust thresholds for high-converting lead sources`, 'scoring_rules'));
      steps.push(mk(3, `Find stale leads stuck in qualifying status and re-engage them`, 'search_leads'));
      steps.push(mk(4, `Review routing so qualified leads go to the agents with the best close rates`, 'routing_rules'));
      if (gap > 0.1) {
        steps.push(mk(5, `Launch a targeted re-engagement campaign for stalled leads`, 'campaigns'));
      }
    } else if (metric === 'lead_volume' || goal.toLowerCase().includes('lead')) {
      steps.push(mk(1, `Analyze which channels bring the most qualified leads`));
      steps.push(mk(2, `Increase spend or effort on the top-performing channels`, 'campaigns'));
      steps.push(mk(3, `Review nurture sequences and optimize them for conversion`, 'nurture_sequences'));
    } else {
      steps.push(mk(1, `Research the current state of: ${goal}`));
      steps.push(mk(2, `Analyze current performance (${metric}: ${current}/${target})`));
      steps.push(mk(3, `Recommend and take concrete next actions`));
    }

    return steps;
  }

  async getOutcome(id: string, tenantId: string): Promise<OutcomeGoal> {
    const row = await this.prisma.jarvisOutcome.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Outcome not found');
    return this.toGoal(row);
  }

  async listOutcomes(tenantId: string, userId?: string): Promise<OutcomeGoal[]> {
    const rows = await this.prisma.jarvisOutcome.findMany({
      where: { tenantId, ...(userId ? { userId } : {}) },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return rows.map(r => this.toGoal(r));
  }

  async setConversationId(id: string, conversationId: string): Promise<void> {
    await this.prisma.jarvisOutcome.update({ where: { id }, data: { conversationId } });
  }

  async setStatus(id: string, status: OutcomeGoal['status']): Promise<void> {
    await this.prisma.jarvisOutcome.update({ where: { id }, data: { status } });
    await this.events.emit({ type: `mikey.outcome_${status}`, source: 'outcome-engine', payload: { id, status } });
  }

  async updateStep(outcomeId: string, tenantId: string, stepId: string, patch: Partial<OutcomeStep>): Promise<OutcomeGoal> {
    const row = await this.prisma.jarvisOutcome.findFirst({ where: { id: outcomeId, tenantId } });
    if (!row) throw new NotFoundException('Outcome not found');
    const steps = row.steps as unknown as OutcomeStep[];
    const step = steps.find(s => s.id === stepId);
    if (!step) throw new NotFoundException('Step not found');
    Object.assign(step, patch);

    const updated = await this.prisma.jarvisOutcome.update({
      where: { id: outcomeId },
      data: { steps: steps as any },
    });
    return this.toGoal(updated);
  }

  // Convenience for CopilotService.runOutcome: the first step still pending,
  // in declaration order.
  nextPendingStep(outcome: OutcomeGoal): OutcomeStep | null {
    return outcome.steps.find(s => s.status === 'pending') ?? null;
  }

  async cancelOutcome(id: string, tenantId: string, userId: string): Promise<void> {
    const row = await this.prisma.jarvisOutcome.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Outcome not found');
    if (row.userId !== userId) throw new ForbiddenException('This outcome belongs to another user');
    await this.setStatus(id, 'cancelled');
  }
}
