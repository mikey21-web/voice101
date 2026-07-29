export interface WorkflowActionContext {
  stepKey: string;
  leadId?: string;
  tenantId: string;
  context: Record<string, any>;
}

export interface WorkflowActionResult {
  stepKey: string;
  status: 'success' | 'error' | 'skipped';
  output?: Record<string, any>;
  error?: string;
  nextKeys?: string[];
}

export interface IWorkflowAction {
  type: string;
  execute(ctx: WorkflowActionContext, config: Record<string, any>): Promise<WorkflowActionResult>;
}
