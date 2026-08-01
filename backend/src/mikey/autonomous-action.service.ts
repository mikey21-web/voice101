import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The audit trail + undo primitive for everything Mikey does on its own.
 * Every autonomous write is recorded here before or immediately after it
 * happens, with enough of the prior state captured to reverse it. This is
 * what makes expanding autonomy safe: nothing autonomous is a black box,
 * and nothing (that can be) is permanent without a human confirming it.
 */
@Injectable()
export class AutonomousActionService {
  private readonly logger = new Logger(AutonomousActionService.name);

  constructor(private prisma: PrismaService) {}

  async record(entry: {
    tenantId: string;
    findingType: string;
    tool: string;
    leadId?: string;
    args?: Record<string, unknown>;
    result?: string;
    undoable?: boolean;
    undoData?: Record<string, unknown>;
  }) {
    const action = await this.prisma.mikeyAutonomousAction.create({
      data: {
        tenantId: entry.tenantId,
        findingType: entry.findingType,
        tool: entry.tool,
        leadId: entry.leadId,
        args: (entry.args as any) || {},
        result: entry.result,
        undoable: entry.undoable ?? false,
        undoData: (entry.undoData as any) ?? undefined,
      },
    });
    this.logger.log(`Autonomous action recorded: ${entry.tool} (${entry.findingType})${entry.leadId ? ` on lead ${entry.leadId}` : ''}`);
    return action;
  }

  async findRecent(tenantId: string, sinceHours = 24) {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    return this.prisma.mikeyAutonomousAction.findMany({
      where: { tenantId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async countToday(tenantId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return this.prisma.mikeyAutonomousAction.count({ where: { tenantId, createdAt: { gte: todayStart } } });
  }

  /**
   * Reverse an autonomous action. Only actions marked undoable carry a
   * undoData snapshot; what "undo" means depends on the tool (e.g. revert
   * assignedAgentId for assign_lead_to_agent). A sent WhatsApp message can
   * never be truly unsent, so send-type actions are logged but not undoable.
   */
  async undo(id: string, undoneById: string) {
    const action = await this.prisma.mikeyAutonomousAction.findUnique({ where: { id } });
    if (!action) throw new NotFoundException('Autonomous action not found');
    if (action.undone) throw new BadRequestException('Action was already undone');
    if (!action.undoable) throw new BadRequestException('This action cannot be undone');

    const undoData = (action.undoData as any) || {};

    switch (action.tool) {
      case 'assign_lead_to_agent':
        await this.prisma.lead.update({
          where: { id: action.leadId! },
          data: { assignedAgentId: undoData.previousAgentId ?? null },
        });
        break;
      case 'escalate_task_priority':
        await this.prisma.task.update({
          where: { id: undoData.taskId },
          data: { priority: undoData.previousPriority ?? 'medium' },
        });
        break;
      // advanceStage is strict-forward, so a reversal cannot go back through it.
      // This is the explicit backward path spine-stage.ts points at.
      case 'advance_stage':
        if (!undoData.previousStatus) {
          throw new BadRequestException('No previous status recorded for this transition');
        }
        await this.prisma.lead.update({
          where: { id: action.leadId! },
          data: { status: undoData.previousStatus },
        });
        break;
      default:
        throw new BadRequestException(`No undo handler for tool "${action.tool}"`);
    }

    return this.prisma.mikeyAutonomousAction.update({
      where: { id },
      data: { undone: true, undoneAt: new Date(), undoneById },
    });
  }
}
