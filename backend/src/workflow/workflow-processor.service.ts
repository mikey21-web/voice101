import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { WorkflowExecutorService } from './workflow-executor.service';

@Processor('workflow-execution')
export class WorkflowProcessor extends WorkerHost {
  constructor(private executor: WorkflowExecutorService) {
    super();
  }

  async process(job: Job): Promise<any> {
    if (job.name === 'execute-step') {
      await this.executor.executeStep(job);
    }
  }
}
