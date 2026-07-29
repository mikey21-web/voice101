import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowExecutorService } from './workflow-executor.service';
import { WorkflowTriggerService } from './workflow-trigger.service';
import { WorkflowProcessor } from './workflow-processor.service';
import { SendMessageAction } from './actions/send-message.action';
import { HttpRequestAction } from './actions/http-request.action';
import { DelayAction } from './actions/delay.action';
import { ConditionAction } from './actions/condition.action';
import { CreateRecordAction } from './actions/create-record.action';
import { UpdateRecordAction } from './actions/update-record.action';
import { CodeAction } from './actions/code.action';
import { WorkflowActionFactory } from './actions/workflow-action.factory';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: 'workflow-execution' }),
  ],
  controllers: [WorkflowController],
  providers: [
    WorkflowService,
    WorkflowExecutorService,
    WorkflowTriggerService,
    WorkflowProcessor,
    SendMessageAction,
    HttpRequestAction,
    DelayAction,
    ConditionAction,
    CreateRecordAction,
    UpdateRecordAction,
    CodeAction,
    WorkflowActionFactory,
  ],
  exports: [
    WorkflowService,
    WorkflowExecutorService,
    WorkflowTriggerService,
    WorkflowActionFactory,
  ],
})
export class WorkflowModule {}
