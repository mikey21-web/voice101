import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IWorkflowAction, WorkflowActionContext, WorkflowActionResult } from './workflow-action.interface';

@Injectable()
export class SendMessageAction implements IWorkflowAction {
  type = 'SEND_MESSAGE';

  constructor(private prisma: PrismaService) {}

  async execute(ctx: WorkflowActionContext, config: Record<string, any>): Promise<WorkflowActionResult> {
    try {
      const leadId = config.leadId === 'FROM_CONTEXT' ? ctx.leadId : config.leadId;
      const channel = config.channel || 'WHATSAPP';
      const text = this.interpolate(config.body, ctx);

      await this.prisma.conversationMessage.create({
        data: { leadId, channel, direction: 'OUTBOUND', text, contactId: ctx.context.contactId },
      });

      return { stepKey: ctx.stepKey, status: 'success', output: { channel, text } };
    } catch (err: any) {
      return { stepKey: ctx.stepKey, status: 'error', error: err.message };
    }
  }

  private interpolate(template: string, ctx: WorkflowActionContext): string {
    return template.replace(/\{\{(\w+)\.(\w+)\}\}/g, (_m, obj: string, key: string) => {
      if (obj === 'lead' && ctx.context.lead) return ctx.context.lead[key] ?? `{{${obj}.${key}}}`;
      return `{{${obj}.${key}}}`;
    });
  }
}
