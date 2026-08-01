import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { CallTrackingService } from './call-tracking.service';
import { CallTrackingController } from './call-tracking.controller';
import { CallSummaryService } from './call-summary.service';
import { RecordingCleanupService } from './recording-cleanup.service';
import { WorkforceService } from './workforce.service';
import { WorkforceController } from './workforce.controller';
import { DeviceAuthGuard } from './device-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { ContactsModule } from '../contacts/contacts.module';
import { LeadsModule } from '../leads/leads.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CoachModule } from '../coach/coach.module';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, ContactsModule, LeadsModule, RealtimeModule, HttpModule, CoachModule],
  controllers: [CallTrackingController, WorkforceController],
  providers: [CallTrackingService, CallSummaryService, RecordingCleanupService, WorkforceService, DeviceAuthGuard],
  exports: [CallTrackingService, CallSummaryService, WorkforceService],
})
export class CallTrackingModule {}
