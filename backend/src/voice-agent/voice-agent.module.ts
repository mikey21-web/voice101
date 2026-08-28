import { Module } from '@nestjs/common';
import { VoiceAgentService } from './voice-agent.service';
import { VoiceAgentController } from './voice-agent.controller';
import { LeadOrchestratorService } from './lead-orchestrator.service';
import { PostCallDispatchService } from './post-call-dispatch.service';
import { ResultListenerService } from './result-listener.service';
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
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleCalendarController } from './google-calendar.controller';
import { SharedModule } from '../shared/shared.module';
import { BillingModule } from '../billing/billing.module';
import {
  OutperoEmployeesController,
  OutperoCallsController,
  OutperoCampaignsController,
  OutperoLeadsController,
  OutperoBillingController,
  OutperoNumbersController,
  OutperoVoicesController,
  OutperoStatsController,
  OutperoContactListsController,
  OutperoAccountsController,
  OutperoScheduledCallsController,
  OutperoCallerMemoryController,
  OutperoLeadWebhookReceiverController,
  OutperoAdminController,
} from './outpero-compat.controller';

@Module({
  imports: [SharedModule, BillingModule],
  controllers: [VoiceAgentController, VoiceEmployeeController, VoiceCallController, VoiceLeadController, VoiceCampaignController, VoiceNumberController, VoiceBillingController, VoiceWalletController, VoiceAnalyticsController, VoiceTrainingController, TalkToBuildController, SwaraController, VoiceStoreController, GoogleCalendarController, OutperoEmployeesController, OutperoCallsController, OutperoCampaignsController, OutperoLeadsController, OutperoBillingController, OutperoNumbersController, OutperoVoicesController, OutperoStatsController, OutperoContactListsController, OutperoAccountsController, OutperoScheduledCallsController, OutperoCallerMemoryController, OutperoLeadWebhookReceiverController, OutperoAdminController],
  providers: [VoiceAgentService, LeadOrchestratorService, ResultListenerService, CallFlowGeneratorService, VoiceEmployeeService, VoiceCallService, VoiceLeadService, VoiceCampaignService, VoiceBillingService, PostCallDispatchService, VoiceAnalyticsService, CallerMemoryService, VoiceTrainingService, TalkToBuildService, SwaraService, GoogleCalendarService],
  exports: [VoiceAgentService, LeadOrchestratorService, ResultListenerService, VoiceEmployeeService, VoiceCallService, VoiceLeadService, VoiceCampaignService, VoiceBillingService, PostCallDispatchService],
})
export class VoiceAgentModule {}