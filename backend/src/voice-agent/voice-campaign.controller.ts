import { Controller, Get, Post, Param, Query, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { VoiceCampaignService, CampaignContact } from './voice-campaign.service';

@Controller('voice-campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoiceCampaignController {
  constructor(private service: VoiceCampaignService) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  list(@Req() req: any, @Query('employeeId') employeeId?: string) {
    return this.service.list(req.user.tenantId, employeeId);
  }

  @Get(':id')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  get(@Req() req: any, @Param('id') id: string) {
    return this.service.get(req.user.tenantId, id);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  create(@Req() req: any, @Body() body: {
    employeeId: string; name: string; contacts: CampaignContact[];
    maxConcurrency?: number;
    retryConfig?: { enabled: boolean; maxRetries: number; retryDelaySeconds: number; retryOnBusy: boolean; retryOnNoAnswer: boolean; retryOnVoicemail: boolean };
    scheduleConfig?: { enabled: boolean; timezone: string; slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }> };
  }) {
    return this.service.create(req.user.tenantId, body.employeeId, body.name, body.contacts, {
      maxConcurrency: body.maxConcurrency, retryConfig: body.retryConfig, scheduleConfig: body.scheduleConfig,
    });
  }

  @Post(':id/pause')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  pause(@Req() req: any, @Param('id') id: string) {
    return this.service.pause(req.user.tenantId, id);
  }

  @Post(':id/resume')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  resume(@Req() req: any, @Param('id') id: string) {
    return this.service.resume(req.user.tenantId, id);
  }

  @Get(':id/progress')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  progress(@Req() req: any, @Param('id') id: string) {
    return this.service.progress(req.user.tenantId, id);
  }

  @Get(':id/runs')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  runs(@Req() req: any, @Param('id') id: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.runs(req.user.tenantId, id, page ? parseInt(page, 10) : 1, limit ? parseInt(limit, 10) : 50);
  }
}
