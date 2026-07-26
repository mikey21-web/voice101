import { Module, forwardRef } from '@nestjs/common';
import { VoiceAgentService } from './voice-agent.service';
import { VoiceAgentController } from './voice-agent.controller';
import { LeadOrchestratorService } from './lead-orchestrator.service';
import { ConversationsModule } from '../conversations/conversations.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { TimelineModule } from '../timeline/timeline.module';
import { MikeyModule } from '../mikey/mikey.module';
import { ResultListenerService } from './result-listener.service';
import { LeadsModule } from '../leads/leads.module';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [ConversationsModule, ApprovalsModule, TimelineModule, forwardRef(() => MikeyModule), forwardRef(() => LeadsModule), AgentModule],
  controllers: [VoiceAgentController],
  providers: [VoiceAgentService, LeadOrchestratorService, ResultListenerService],
  exports: [VoiceAgentService, LeadOrchestratorService, ResultListenerService],
})
export class VoiceAgentModule {}
