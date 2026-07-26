import { Module } from '@nestjs/common';
import { FlowsController } from './flows.controller';
import { FlowsService } from './flows.service';
import { FlowRuntimeService } from './flow-runtime.service';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [ConversationsModule],
  controllers: [FlowsController],
  providers: [FlowsService, FlowRuntimeService],
  exports: [FlowRuntimeService],
})
export class FlowsModule {}
