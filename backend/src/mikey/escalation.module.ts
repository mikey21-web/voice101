import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { EscalationService } from './escalation.service';
import { EscalationController } from './escalation.controller';

/**
 * EscalationService on its own, separate from the full MikeyModule.
 *
 * Escalation has to be callable from wherever a buyer actually says something
 * — inbound webhooks, call transcripts — and those modules pulling in all of
 * MikeyModule to get it would create import cycles. Its only real dependencies
 * are Prisma, Events, and Notifications (global).
 */
@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [EscalationController],
  providers: [EscalationService],
  exports: [EscalationService],
})
export class EscalationModule {}
