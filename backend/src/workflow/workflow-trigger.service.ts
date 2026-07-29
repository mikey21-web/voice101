import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowExecutorService } from './workflow-executor.service';

@Injectable()
export class WorkflowTriggerService {
  private logger = new Logger(WorkflowTriggerService.name);

  constructor(
    private prisma: PrismaService,
    private executor: WorkflowExecutorService,
  ) {}

  async fireDbEvent(event: { table: string; event: string; recordId: string; tenantId: string; data?: any }) {
    const triggers = await this.prisma.workflowTrigger.findMany({
      where: {
        type: 'DB_EVENT',
        version: { status: 'active', workflow: { active: true } },
      },
      include: { version: { include: { workflow: true } } },
    });

    for (const trigger of triggers) {
      const cfg = trigger.config as any;
      if (cfg.table !== event.table || cfg.event !== event.event) continue;
      if (cfg.filters) {
        const matches = Object.entries(cfg.filters).every(([k, v]) => event.data?.[k] === v);
        if (!matches) continue;
      }

      await this.executor.startWorkflow({
        workflowId: trigger.version.workflowId,
        versionId: trigger.versionId,
        triggerId: trigger.id,
        tenantId: event.tenantId,
        leadId: event.data?.leadId || undefined,
        context: { record: event.data, ...event.data },
      }).catch(err => this.logger.error(`DB event trigger failed: ${err.message}`));
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkScheduledTriggers() {
    const now = new Date();
    const triggers = await this.prisma.workflowTrigger.findMany({
      where: { type: 'CRON', version: { status: 'active', workflow: { active: true } } },
      include: { version: { include: { workflow: true } } },
    });

    for (const trigger of triggers) {
      const cfg = trigger.config as any;
      if (!cfg.expression) continue;
      try {
        if (this.matchesCron(cfg.expression, now)) {
          await this.executor.startWorkflow({
            workflowId: trigger.version.workflowId,
            versionId: trigger.versionId,
            triggerId: trigger.id,
            tenantId: trigger.version.workflow.tenantId,
            context: { triggeredAt: now.toISOString() },
          }).catch(err => this.logger.error(`Cron trigger failed: ${err.message}`));
        }
      } catch (err: any) {
        this.logger.error(`Cron eval error for trigger ${trigger.id}: ${err.message}`);
      }
    }
  }

  private matchesCron(expression: string, date: Date): boolean {
    const parts = expression.trim().split(/\s+/);
    if (parts.length < 5) return false;

    const match = (field: string, value: number): boolean => {
      if (field === '*') return true;
      if (field.includes('/')) {
        const [, step] = field.split('/');
        return value % parseInt(step) === 0;
      }
      if (field.includes(',')) return field.split(',').map(Number).includes(value);
      if (field.includes('-')) {
        const [min, max] = field.split('-').map(Number);
        return value >= min && value <= max;
      }
      return parseInt(field) === value;
    };

    return match(parts[0], date.getMinutes()) &&
      match(parts[1], date.getHours()) &&
      match(parts[2], date.getDate()) &&
      match(parts[3], date.getMonth() + 1) &&
      match(parts[4], date.getDay());
  }
}
