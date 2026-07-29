import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IWorkflowAction, WorkflowActionContext, WorkflowActionResult } from './workflow-action.interface';

@Injectable()
export class UpdateRecordAction implements IWorkflowAction {
  type = 'UPDATE_RECORD';

  constructor(private prisma: PrismaService) {}

  async execute(ctx: WorkflowActionContext, config: Record<string, any>): Promise<WorkflowActionResult> {
    try {
      const model = config.model as string;
      const id = config.id === '{{lead.id}}' ? ctx.leadId : config.id;
      const data = config.data || {};

      const prismaModel = (this.prisma as any)['lead'];
      if (!prismaModel) return { stepKey: ctx.stepKey, status: 'error', error: `Unknown model: ${model}` };

      const record = await prismaModel.update({ where: { id }, data });
      return { stepKey: ctx.stepKey, status: 'success', output: { id: record.id, model } };
    } catch (err: any) {
      return { stepKey: ctx.stepKey, status: 'error', error: err.message };
    }
  }
}
