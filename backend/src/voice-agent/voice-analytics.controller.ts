import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { VoiceAnalyticsService } from './voice-analytics.service';

@Controller('voice-analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoiceAnalyticsController {
  constructor(private analytics: VoiceAnalyticsService) {}

  @Get('overview')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  getTenantAnalytics(@Req() req: any, @Query('hours') hours?: string) {
    const dateRangeHours = parseInt(hours || '24', 10);
    return this.analytics.getTenantAnalytics(req.user.tenantId, dateRangeHours);
  }
}
