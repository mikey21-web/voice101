import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IWorkflowAction, WorkflowActionContext, WorkflowActionResult } from './workflow-action.interface';

@Injectable()
export class CreateRecordAction implements IWorkflowAction {
  type = 'CREATE_RECORD';
  private logger = new Logger(CreateRecordAction.name);

  constructor(private prisma: PrismaService) {}

  async execute(ctx: WorkflowActionContext, config: Record<string, any>): Promise<WorkflowActionResult> {
    try {
      const model = config.model as string;
      const data = config.data || {};

      if (data.leadId === '{{lead.id}}') data.leadId = ctx.leadId;
      if (data.tenantId === '{{tenant.id}}') data.tenantId = ctx.tenantId;

      const prismaModel = (this.prisma as any)[this.toPrismaKey(model)];
      if (!prismaModel) return { stepKey: ctx.stepKey, status: 'error', error: `Unknown model: ${model}` };

      const record = await prismaModel.create({ data });
      return { stepKey: ctx.stepKey, status: 'success', output: { id: record.id, model } };
    } catch (err: any) {
      return { stepKey: ctx.stepKey, status: 'error', error: err.message };
    }
  }

  private toPrismaKey(model: string): string {
    const map: Record<string, string> = {
      Task: 'task', Lead: 'lead', Ticket: 'ticket', Contact: 'contact',
      Campaign: 'campaign', ConversationMessage: 'conversationMessage',
      Booking: 'booking', PaymentSchedule: 'paymentSchedule',
    };
    return map[model] || model.charAt(0).toLowerCase() + model.slice(1);
  }
}
