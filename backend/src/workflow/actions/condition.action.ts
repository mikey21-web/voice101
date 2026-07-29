import { Injectable } from '@nestjs/common';
import { IWorkflowAction, WorkflowActionContext, WorkflowActionResult } from './workflow-action.interface';

@Injectable()
export class ConditionAction implements IWorkflowAction {
  type = 'CONDITION';

  async execute(ctx: WorkflowActionContext, config: Record<string, any>): Promise<WorkflowActionResult> {
    try {
      const expression = config.expression || '';
      const matched = this.evaluate(expression, ctx);
      return {
        stepKey: ctx.stepKey,
        status: 'success',
        output: { expression, result: matched },
        nextKeys: matched ? [config.trueStep] : [config.falseStep],
      };
    } catch (err: any) {
      return { stepKey: ctx.stepKey, status: 'error', error: err.message };
    }
  }

  private evaluate(expr: string, ctx: WorkflowActionContext): boolean {
    const context = ctx.context;
    const resolve = (path: string): any => {
      const parts = path.split('.');
      let val: any = context;
      for (const p of parts) val = val?.[p];
      return val;
    };

    const comparison = expr.match(/^([\w.]+)\s*(>=|<=|!=|==|>|<)\s*(.+)$/);
    if (comparison) {
      const field = resolve(comparison[1].trim());
      const op = comparison[2];
      const rawVal = comparison[3].trim().replace(/^['"]|['"]$/g, '');
      const numVal = Number(rawVal);
      const cmpVal = isNaN(numVal) ? rawVal : numVal;

      switch (op) {
        case '==': return field == cmpVal;
        case '!=': return field != cmpVal;
        case '>': return Number(field) > Number(cmpVal);
        case '<': return Number(field) < Number(cmpVal);
        case '>=': return Number(field) >= Number(cmpVal);
        case '<=': return Number(field) <= Number(cmpVal);
      }
    }

    const existence = expr.match(/^([\w.]+)\s*(exists|not_exists)$/);
    if (existence) {
      const val = resolve(existence[1].trim());
      return existence[2] === 'exists' ? val != null : val == null;
    }

    if (expr.includes('&&') || expr.includes('||')) {
      const parts = expr.split(/(&&|\|\|)/);
      let result = this.evaluate(parts[0].trim(), ctx);
      for (let i = 1; i < parts.length; i += 2) {
        const op = parts[i];
        const right = this.evaluate(parts[i + 1].trim(), ctx);
        result = op === '&&' ? result && right : result || right;
      }
      return result;
    }

    return false;
  }
}
