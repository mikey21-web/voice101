import { Injectable } from '@nestjs/common';
import { IWorkflowAction, WorkflowActionContext, WorkflowActionResult } from './workflow-action.interface';

@Injectable()
export class CodeAction implements IWorkflowAction {
  type = 'CODE';

  async execute(ctx: WorkflowActionContext, config: Record<string, any>): Promise<WorkflowActionResult> {
    try {
      const code = config.code || '';
      const fn = new Function('ctx', `"use strict"; ${code}`);
      const result = fn(ctx);
      return { stepKey: ctx.stepKey, status: 'success', output: { result } };
    } catch (err: any) {
      return { stepKey: ctx.stepKey, status: 'error', error: err.message };
    }
  }
}
