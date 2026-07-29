import { Injectable } from '@nestjs/common';
import { IWorkflowAction, WorkflowActionContext, WorkflowActionResult } from './workflow-action.interface';

@Injectable()
export class DelayAction implements IWorkflowAction {
  type = 'DELAY';

  async execute(ctx: WorkflowActionContext, config: Record<string, any>): Promise<WorkflowActionResult> {
    const seconds = config.durationSeconds || 0;
    if (seconds > 0) await new Promise(r => setTimeout(r, Math.min(seconds * 1000, 86400000)));
    return { stepKey: ctx.stepKey, status: 'success', output: { delayedSeconds: seconds } };
  }
}
