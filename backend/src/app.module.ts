import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';

import { PrismaModule } from './prisma/prisma.module';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './auth/auth.module';
import { BusinessSettingsModule } from './business-settings/business-settings.module';
import { UsersModule } from './users/users.module';
import { ContactsModule } from './contacts/contacts.module';
import { LeadsModule } from './leads/leads.module';
import { ConversationsModule } from './conversations/conversations.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AdvancedFeaturesModule } from './advanced-features/advanced-features.module';
import { EventsModule } from './events/events.module';
import { TimelineModule } from './timeline/timeline.module';
import { FailuresModule } from './failures/failures.module';
import { BootstrapModule } from './bootstrap/bootstrap.module';
import { AgentModule } from './agent/agent.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { MetricsInterceptor } from './monitoring/metrics.interceptor';
import { TenantsModule } from './tenants/tenants.module';
import { RealtimeModule } from './realtime/realtime.module';
import { NotificationsModule } from './notifications/notifications.module';
import { KhojClientModule } from './khoj-client/khoj-client.module';
import { MikeyModule } from './mikey/mikey.module';
import { PosthogModule } from './posthog/posthog.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { VoiceAgentModule } from './voice-agent/voice-agent.module';
import { CoachModule } from './coach/coach.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [() => ({ khoj: { baseUrl: process.env.KHOJ_BASE_URL || 'http://localhost:42111', timeout: parseInt(process.env.KHOJ_TIMEOUT || '30000', 10) } })] }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRATION', '24h') },
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>('REDIS_URL') },
      }),
    }),
    PrismaModule,
    SharedModule,
    AuthModule,
    BusinessSettingsModule,
    UsersModule,
    ContactsModule,
    LeadsModule,
    ConversationsModule,
    AuditLogsModule,
    AdvancedFeaturesModule,
    EventsModule,
    TimelineModule,
    FailuresModule,
    BootstrapModule,
    AgentModule,
    MonitoringModule,
    TenantsModule,
    RealtimeModule,
    NotificationsModule,
    KhojClientModule,
    MikeyModule,
    PosthogModule,
    ApprovalsModule,
    VoiceAgentModule,
    CoachModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
})
export class AppModule {}
