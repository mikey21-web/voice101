import { Controller, Get, Post, Param, Query, Body, Req, Headers, UseGuards, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { WebhookSecurityService } from '../shared/webhook-security.service';
import { VoiceCallService } from './voice-call.service';
import { VoiceLeadService } from './voice-lead.service';
import { lintTranscript } from './call-quality';

@Controller('voice-calls')
export class VoiceCallController {
  constructor(private calls: VoiceCallService, private security: WebhookSecurityService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  list(@Req() req: any, @Query('employeeId') employeeId?: string, @Query('campaignId') campaignId?: string, @Query('disposition') disposition?: string, @Query('direction') direction?: string, @Query('limit') limit?: string) {
    return this.calls.list(req.user.tenantId, { employeeId, campaignId, disposition, direction, limit: limit ? parseInt(limit, 10) : undefined });
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

  @Get(':id/struggles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  async getStruggles(@Req() req: any, @Param('id') id: string) {
    const call = await this.calls.get(req.user.tenantId, id);
    if (!call.transcript) return { struggles: [], teachable: [] };

    const report = lintTranscript(call.transcript);
    const teachable = report.violations
      .filter((v) => v.severity === 'high')
      .map((v) => ({
        issue: v.rule,
        detail: v.detail,
        turn: v.turn,
        excerpt: v.excerpt,
      }));

    return { struggles: report.violations, score: report.score, teachable };
  }

  /** Dograh's post_call_outcome webhook, one per employee's compiled workflow (see
   * DograhService.compileEmployeeDefinition). Accepts the secret via query param — confirmed
   * empirically that Dograh's webhook node does not actually send configured custom_headers at
   * runtime (the definition stores them, but the real outbound request omits them), so the
   * header-only check silently 401'd every real call while working fine via manual curl. The
   * query param is embedded directly in endpoint_url, which Dograh always sends verbatim. */
  @Public()
  @Post('webhook/employee-call-completed')
  async webhook(@Body() body: any, @Query('secret') querySecret?: string, @Headers('x-webhook-secret') headerSecret?: string) {
    if (!this.security.verifyWebhookApiKey(querySecret || headerSecret || '', 'dograh')) {
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
