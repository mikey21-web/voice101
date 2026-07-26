import { IsString, IsOptional, IsEmail, IsObject, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WebhookPayloadDto {
  @ApiProperty({ description: 'Raw webhook payload' })
  @IsObject()
  payload: Record<string, unknown>;
}

export class FormWebhookDto {
  @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() whatsapp?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() message?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() interest?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() budget?: string;
  @ApiPropertyOptional({ description: 'ISO 639-1 language code for voice/WhatsApp follow-up, e.g. te for Telugu' })
  @IsString() @IsOptional() language?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() campaignId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() formId?: string;
  @ApiPropertyOptional() @IsObject() @IsOptional() metadata?: Record<string, unknown>;
}

export class WhatsAppWebhookDto {
  @ApiPropertyOptional() @IsObject() @IsOptional() entry?: unknown;
  @ApiPropertyOptional() @IsString() @IsOptional() object?: string;
}

export class GenericWebhookDto {
  @ApiPropertyOptional() @IsObject() @IsOptional() data?: unknown;
  @ApiPropertyOptional() @IsString() @IsOptional() event?: string;
  // Declared explicitly so the global ValidationPipe's whitelist doesn't strip them —
  // the chatbot/mobile-app handlers in WebhooksService read these flat, not off `data`.
  @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() message?: string;
}

export class TelegramWebhookDto {
  @ApiProperty() @IsOptional() update_id?: number;
  @ApiPropertyOptional() @IsOptional() @IsObject() message?: {
    message_id: number;
    from?: { id: number; first_name?: string; last_name?: string; username?: string };
    chat: { id: number; type: string; first_name?: string; username?: string };
    text?: string;
    date: number;
  };
  // A tapped inline-keyboard button (send_options) arrives as this instead of `message`.
  @ApiPropertyOptional() @IsOptional() @IsObject() callback_query?: {
    id: string;
    from?: { id: number; first_name?: string; last_name?: string; username?: string };
    message?: { message_id: number; chat: { id: number; type?: string; first_name?: string; username?: string }; date?: number };
    data?: string;
  };
}

export class SocialWebhookDto {
  @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() message?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() source?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() leadId?: string;
  @ApiPropertyOptional() @IsObject() @IsOptional() metadata?: Record<string, unknown>;
}

export class VoiceIncomingWebhookDto {
  @ApiPropertyOptional() @IsString() @IsOptional() CallSid?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() From?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() To?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() CallStatus?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() Direction?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() callerName?: string;
  @ApiPropertyOptional() @IsObject() @IsOptional() metadata?: Record<string, unknown>;
}

export class VoiceStatusWebhookDto {
  @ApiPropertyOptional() @IsString() @IsOptional() CallSid?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() From?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() To?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() CallStatus?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() Direction?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() Duration?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() RecordingUrl?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() RecordingSid?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() AnsweredBy?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() CallDuration?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() Timestamp?: string;
  @ApiPropertyOptional() @IsObject() @IsOptional() metadata?: Record<string, unknown>;
}

export class CreateOutboundWebhookDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() url: string;
  @ApiProperty() @IsArray() events: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() secret?: string;
}

export class UpdateOutboundWebhookDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() url?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() events?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() secret?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

export class WasenderWebhookDto {
  @ApiProperty({ description: 'Event type (e.g. messages.upsert, messages.update)' })
  @IsString()
  event!: string;

  @ApiPropertyOptional({ description: 'Wasender session ID' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Event payload data' })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Event timestamp' })
  @IsOptional()
  timestamp?: number;
}

export class OpenwaWebhookDto {
  @ApiProperty({ description: 'Event type (e.g. message.received, message.ack)' })
  @IsString()
  event!: string;

  @ApiPropertyOptional({ description: 'OpenWA session ID' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Idempotency key for at-least-once delivery' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Event payload data' })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Event dispatch timestamp (ISO-8601)' })
  @IsOptional()
  @IsString()
  timestamp?: string;
}
