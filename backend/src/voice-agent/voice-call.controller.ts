import { Controller, Get, Post, Param, Query, Body, Req, Headers, UseGuards, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { WebhookSecurityService } from '../shared/webhook-security.service';
import { VoiceCallService } from './voice-call.service';
import { VoiceLeadService } from './voice-lead.service';

@Controller('voice-calls')
export class VoiceCallController {
  constructor(private calls: VoiceCallService, private security: WebhookSecurityService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  list(@Req() req: any, @Query('employeeId') employeeId?: string, @Query('campaignId') campaignId?: string, @Query('disposition') disposition?: string, @Query('limit') limit?: string) {
    return this.calls.list(req.user.tenantId, { employeeId, campaignId, disposition, limit: limit ? parseInt(limit, 10) : undefined });
  }

  @Get('live')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  listLive(@Req() req: any) {
    return this.calls.listLive(req.user.tenantId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  get(@Req() req: any, @Param('id') id: string) {
    return this.calls.get(req.user.tenantId, id);
  }

  @Post(':id/redial')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  redial(@Req() req: any, @Param('id') id: string) {
    return this.calls.redial(req.user.tenantId, id);
  }

  /** Dograh's post_call_outcome webhook, one per employee's compiled workflow (see
   * DograhService.compileEmployeeDefinition). Same secret-header verification pattern as the
   * existing single-workflow webhook/call-completed endpoint. */
  @Public()
  @Post('webhook/employee-call-completed')
  async webhook(@Body() body: any, @Headers('x-webhook-secret') secret?: string) {
    if (!this.security.verifyWebhookApiKey(secret || '', 'dograh')) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
    return this.calls.handleWebhook(body);
  }
}

@Controller('voice-leads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoiceLeadController {
  constructor(private leads: VoiceLeadService) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  list(@Req() req: any, @Query('employeeId') employeeId?: string, @Query('outcome') outcome?: string, @Query('limit') limit?: string) {
    return this.leads.list(req.user.tenantId, { employeeId, outcome, limit: limit ? parseInt(limit, 10) : undefined });
  }

  @Get(':id')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  get(@Req() req: any, @Param('id') id: string) {
    return this.leads.get(req.user.tenantId, id);
  }
}
