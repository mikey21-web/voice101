import { Injectable } from '@nestjs/common';
import { IWorkflowAction, WorkflowActionContext, WorkflowActionResult } from './workflow-action.interface';

@Injectable()
export class HttpRequestAction implements IWorkflowAction {
  type = 'HTTP_REQUEST';

  async execute(ctx: WorkflowActionContext, config: Record<string, any>): Promise<WorkflowActionResult> {
    try {
      const url = config.url;
      const method = (config.method || 'GET').toUpperCase();
      const headers = config.headers || {};
      const body = config.body ? (typeof config.body === 'string' ? config.body : JSON.stringify(config.body)) : undefined;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: ['GET', 'HEAD'].includes(method) ? undefined : body,
        signal: AbortSignal.timeout(30000),
      });

      const responseBody = await res.text();
      const parsed = this.tryParse(responseBody);

      return {
        stepKey: ctx.stepKey,
        status: res.ok ? 'success' : 'error',
        output: { statusCode: res.status, body: parsed ?? responseBody },
        error: res.ok ? undefined : `HTTP ${res.status}: ${responseBody.slice(0, 500)}`,
      };
    } catch (err: any) {
      return { stepKey: ctx.stepKey, status: 'error', error: err.message };
    }
  }

  private tryParse(text: string): any {
    try { return JSON.parse(text); } catch { return null; }
  }
}
