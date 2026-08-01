import { Global, Module } from '@nestjs/common';
import { SignedUrlService } from './signed-url.service';
import { OutboxService } from './outbox.service';
import { WebhookSecurityService } from './webhook-security.service';
import { HealthService } from './health.service';
import { PackApplierService } from './pack-applier.service';
import { FeatureFlagsService } from './feature-flags.service';
import { AlertingService } from './alerting.service';
import { NormalizationService } from './normalization.service';
import { GracefulDegradationService } from './graceful-degradation.service';
import { HubspotAdapter, SalesforceAdapter, ZohoAdapter } from './adapters/crm.adapter';
import { CalendlyAdapter, GoogleCalendarAdapter } from './adapters/calendar.adapter';
import { WhatsAppCloudAdapter, TelegramBotAdapter } from './adapters/messaging.adapter';
import { TwilioSmsAdapter } from './adapters/sms.adapter';
import { TwilioVoiceAdapter } from './adapters/voice.adapter';
import { TwiMLGenerator } from './adapters/twiml.generator';
import { EmailAdapter } from './adapters/email.adapter';
import { HealthController } from './health.controller';
import { SentryService } from './sentry.service';
import { MoonshineService } from './moonshine.service';
import { DeepgramService } from './deepgram.service';
import { DograhService } from './dograh.service';
import { PiperTtsService } from './piper-tts.service';
import { OutboundWebhookDispatchService } from './outbound-webhook-dispatch.service';
import { LLMHealthService } from './llm-health.service';
import { LLMHealthController } from './llm-health.controller';

@Global()
@Module({
  controllers: [HealthController, LLMHealthController],
  providers: [
    SignedUrlService, WebhookSecurityService, HealthService, PackApplierService,
    FeatureFlagsService, AlertingService, NormalizationService, GracefulDegradationService,
    HubspotAdapter, SalesforceAdapter, ZohoAdapter,
    CalendlyAdapter, GoogleCalendarAdapter,
    WhatsAppCloudAdapter, TelegramBotAdapter, TwilioSmsAdapter, TwilioVoiceAdapter, TwiMLGenerator,
    EmailAdapter, OutboxService, SentryService, MoonshineService, DeepgramService, DograhService, PiperTtsService, OutboundWebhookDispatchService, LLMHealthService,
  ],
  exports: [
    SignedUrlService, WebhookSecurityService, HealthService, PackApplierService,
    FeatureFlagsService, AlertingService, NormalizationService, GracefulDegradationService,
    HubspotAdapter, SalesforceAdapter, ZohoAdapter,
    CalendlyAdapter, GoogleCalendarAdapter,
    WhatsAppCloudAdapter, TelegramBotAdapter, TwilioSmsAdapter, TwilioVoiceAdapter, TwiMLGenerator,
    EmailAdapter, OutboxService, SentryService, MoonshineService, DeepgramService, DograhService, PiperTtsService, OutboundWebhookDispatchService, LLMHealthService,
  ],
})
export class SharedModule {}
