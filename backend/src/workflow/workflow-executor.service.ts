import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowActionFactory } from './actions/workflow-action.factory';
import { WorkflowActionContext } from './actions/workflow-action.interface';

interface ExecuteStepJob {
  instanceId: string;
  stepKey: string;
  tenantId: string;
  leadId?: string;
  context: Record<string, any>;
}

@Injectable()
export class WorkflowExecutorService {
  private logger = new Logger(WorkflowExecutorService.name);

  constructor(
    @InjectQueue('workflow-execution') private queue: Queue,
    private prisma: PrismaService,
    private actionFactory: WorkflowActionFactory,
  ) {}

  async startWorkflow(params: {
    workflowId: string;
    versionId: string;
    triggerId: string;
    tenantId: string;
    leadId?: string;
    contactId?: string;
    context?: Record<string, any>;
  }) {
    const version = await this.prisma.workflowVersion.findUnique({
      where: { id: params.versionId },
      include: { steps: { orderBy: { displayOrder: 'asc' } }, edges: true },
    });
    if (!version) throw new Error('Workflow version not found');

    const instance = await this.prisma.workflowInstance.create({
      data: {
        workflowId: params.workflowId,
        versionId: params.versionId,
        triggerId: params.triggerId,
        leadId: params.leadId,
        contactId: params.contactId,
        status: 'running',
        context: params.context || {},
        currentStepKey: version.steps[0]?.stepKey || null,
      },
    });

    const firstStep = version.steps[0];
    if (!firstStep) return instance;

    await this.enqueueStep({
      instanceId: instance.id,
      stepKey: firstStep.stepKey,
      tenantId: params.tenantId,
      leadId: params.leadId,
      context: params.context || {},
    });

    return instance;
  }

  async executeStep(job: Job<ExecuteStepJob>) {
    const { instanceId, stepKey, tenantId, leadId, context } = job.data;

    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id: instanceId },
    });
    if (!instance || instance.status !== 'running' || !instance.versionId) return;

    const version = await this.prisma.workflowVersion.findUnique({
      where: { id: instance.versionId },
      include: { steps: { orderBy: { displayOrder: 'asc' } }, edges: true },
    });
    if (!version) return;

    const step = version.steps.find(s => s.stepKey === stepKey);
    if (!step) return;

    const action = this.actionFactory.get(step.actionType);
    if (!action) {
      await this.failInstance(instanceId, `Unknown action type: ${step.actionType}`);
      return;
    }

    const stepRun = await this.prisma.workflowStepRun.create({
      data: {
        workflowInstanceId: instanceId,
        stepId: step.id,
        stepKey: step.stepKey,
        status: 'running',
        input: { config: step.config, context },
        startedAt: new Date(),
      },
    });

    const actionCtx: WorkflowActionContext = { stepKey, leadId, tenantId, context };

    try {
      const result = await action.execute(actionCtx, step.config as Record<string, any>);

      const mergedContext = { ...context, [`${stepKey}_output`]: result.output };

      await this.prisma.workflowStepRun.update({
        where: { id: stepRun.id },
        data: { status: result.status === 'success' ? 'completed' : 'failed', output: result.output, error: result.error, completedAt: new Date() },
      });

      if (result.status === 'error') {
        await this.failInstance(instanceId, result.error);
        return;
      }

      const nextKeys = result.nextKeys || this.resolveNextSteps(stepKey, version.edges, result);
      const nextStep = nextKeys.length > 0 ? version.steps.find(s => s.stepKey === nextKeys[0]) : null;

      if (nextStep) {
        await this.prisma.workflowInstance.update({
          where: { id: instanceId },
          data: { currentStepKey: nextStep.stepKey, context: mergedContext },
        });
        await this.enqueueStep({ instanceId, stepKey: nextStep.stepKey, tenantId, leadId, context: mergedContext });
      } else {
        await this.prisma.workflowInstance.update({
          where: { id: instanceId }, data: { status: 'completed', currentStepKey: null, completedAt: new Date(), context: mergedContext },
        });
      }
    } catch (err: any) {
      await this.prisma.workflowStepRun.update({
        where: { id: stepRun.id }, data: { status: 'failed', error: err.message, completedAt: new Date() },
      });
      await this.failInstance(instanceId, err.message);
    }
  }

  private resolveNextSteps(currentKey: string, edges: any[], result: any): string[] {
    const outgoing = edges.filter(e => e.sourceKey === currentKey);
    if (outgoing.length === 0) return [];
    if (outgoing.length === 1) return [outgoing[0].targetKey];

    const trueEdge = outgoing.find(e => e.label === 'true');
    const falseEdge = outgoing.find(e => e.label === 'false');
    if (trueEdge && falseEdge) {
      return [result.output?.result ? trueEdge.targetKey : falseEdge.targetKey];
    }

    return [outgoing[0].targetKey];
  }

  private async enqueueStep(data: ExecuteStepJob) {
    await this.queue.add('execute-step', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }

  private async failInstance(instanceId: string, reason?: string) {
    await this.prisma.workflowInstance.update({
      where: { id: instanceId },
      data: { status: 'failed', failedAt: new Date(), failureReason: reason },
    });
  }
}
