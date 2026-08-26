import { Module, forwardRef } from '@nestjs/common';
import { VoiceAgentService } from './voice-agent.service';
import { VoiceAgentController } from './voice-agent.controller';
import { LeadOrchestratorService } from './lead-orchestrator.service';
import { PostCallDispatchService } from './post-call-dispatch.service';
import { ConversationsModule } from '../conversations/conversations.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { TimelineModule } from '../timeline/timeline.module';
import { MikeyModule } from '../mikey/mikey.module';
import { ResultListenerService } from './result-listener.service';
import { LeadsModule } from '../leads/leads.module';
import { AgentModule } from '../agent/agent.module';
import { CallFlowGeneratorService } from './call-flow-generator.service';
import { VoiceEmployeeService } from './voice-employee.service';
import { VoiceEmployeeController } from './voice-employee.controller';
import { VoiceCallService } from './voice-call.service';
import { VoiceLeadService } from './voice-lead.service';
import { VoiceCallController, VoiceLeadController } from './voice-call.controller';
import { VoiceCampaignService } from './voice-campaign.service';
import { VoiceCampaignController } from './voice-campaign.controller';
import { VoiceBillingService } from './voice-billing.service';
import { VoiceNumberController, VoiceBillingController, VoiceWalletController } from './voice-billing.controller';
import { VoiceAnalyticsService } from './voice-analytics.service';
import { VoiceAnalyticsController } from './voice-analytics.controller';
import { CallerMemoryService } from './caller-memory.service';
import { VoiceTrainingService } from './voice-training.service';
import { VoiceTrainingController } from './voice-training.controller';
import { TalkToBuildService } from './talk-to-build.service';
import { TalkToBuildController } from './talk-to-build.controller';
import { SwaraService } from './swara.service';
import { SwaraController } from './swara.controller';
import { VoiceStoreController } from './voice-store.controller';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [ConversationsModule, ApprovalsModule, TimelineModule, forwardRef(() => MikeyModule), forwardRef(() => LeadsModule), AgentModule, SharedModule],
  controllers: [VoiceAgentController, VoiceEmployeeController, VoiceCallController, VoiceLeadController, VoiceCampaignController, VoiceNumberController, VoiceBillingController, VoiceWalletController, VoiceAnalyticsController, VoiceTrainingController, TalkToBuildController, SwaraController, VoiceStoreController],
  providers: [VoiceAgentService, LeadOrchestratorService, ResultListenerService, CallFlowGeneratorService, VoiceEmployeeService, VoiceCallService, VoiceLeadService, VoiceCampaignService, VoiceBillingService, PostCallDispatchService, VoiceAnalyticsService, CallerMemoryService, VoiceTrainingService, TalkToBuildService, SwaraService],
  exports: [VoiceAgentService, LeadOrchestratorService, ResultListenerService, VoiceEmployeeService, VoiceCallService, VoiceLeadService, VoiceCampaignService, VoiceBillingService, PostCallDispatchService],
})
export class VoiceAgentModule {}
