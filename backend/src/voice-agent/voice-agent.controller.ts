import { Controller, Post, Get, Patch, Delete, Param, Req, UseGuards, UseInterceptors, UploadedFile, Query, Res, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { VoiceAgentService } from './voice-agent.service';
import { LeadOrchestratorService } from './lead-orchestrator.service';
import { PiperTtsService } from '../shared/piper-tts.service';
import { WebhookSecurityService } from '../shared/webhook-security.service';
import { Public } from '../auth/public.decorator';
import { Response } from 'express';

@Controller('voice-agent')
export class VoiceAgentController {
  constructor(
    private service: VoiceAgentService,
    private orchestrator: LeadOrchestratorService,
    private piper: PiperTtsService,
    private security: WebhookSecurityService,
  ) {}

  @Get('tts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  async tts(@Query('text') text: string, @Query('lang') lang: string, @Res() res: Response) {
    if (!text) return res.status(400).json({ error: 'no text' });
    try {
      const audio = await this.piper.speak(text, lang || 'te');
      res.set({ 'Content-Type': 'audio/x-wav', 'Content-Length': audio.length.toString() });
      res.send(audio);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  @Post('call/:leadId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  async callLead(@Param('leadId') leadId: string, @Req() req: any, @Query('lang') lang?: string) {
    return this.service.callLead(leadId, req.user.sub, lang || 'te');
  }

  @Get('history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  async history(@Req() req: any, @Query('limit') limit?: string) {
    return this.service.getCallHistory(req.user.tenantId, limit ? parseInt(limit) : 20);
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async getSettings(@Query('lang') lang?: string) {
    return this.service.getSettings(lang || 'te');
  }

  @Patch('settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async updateSettings(@Body() body: { greeting?: string; persona?: string; antiEarlyHangupEnabled?: boolean; checklistCopy?: string }, @Query('lang') lang?: string) {
    return this.service.updateSettings(lang || 'te', body);
  }

  @Patch('settings/amd')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async toggleAmd(@Body() body: { enabled: boolean }) {
    return this.service.toggleAmd(body.enabled);
  }

  @Post('campaigns')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  async createCampaign(
    @Body() body: {
      name: string;
      leadIds: string[];
      lang?: string;
      maxConcurrency?: number;
      retryConfig?: { enabled: boolean; maxRetries: number; retryDelaySeconds: number; retryOnBusy: boolean; retryOnNoAnswer: boolean; retryOnVoicemail: boolean };
      scheduleConfig?: { enabled: boolean; timezone: string; slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }> };
      contacts?: Array<{ phone: string; name?: string }>;
    },
    @Req() req: any,
  ) {
    return this.service.createCampaign(req.user.tenantId, body.name, body.leadIds || [], body.lang || 'te', {
      maxConcurrency: body.maxConcurrency,
      retryConfig: body.retryConfig,
      scheduleConfig: body.scheduleConfig,
      contacts: body.contacts,
    });
  }

  @Get('campaigns')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  async listCampaigns() {
    return this.service.listCampaigns();
  }

  @Get('campaigns/:id/progress')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  async getCampaignProgress(@Param('id') id: string) {
    return this.service.getCampaignProgress(parseInt(id, 10));
  }

  @Post('campaigns/:id/pause')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  async pauseCampaign(@Param('id') id: string) {
    return this.service.pauseCampaign(parseInt(id, 10));
  }

  @Post('campaigns/:id/resume')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  async resumeCampaign(@Param('id') id: string) {
    return this.service.resumeCampaign(parseInt(id, 10));
  }

  @Get('campaigns/:id/runs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  async getCampaignRuns(@Param('id') id: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.getCampaignRuns(parseInt(id, 10), page ? parseInt(page, 10) : 1, limit ? parseInt(limit, 10) : 50);
  }

  @Get('campaigns/:id/report')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  async getCampaignReport(@Param('id') id: string, @Res() res: Response) {
    const { buffer, contentType } = await this.service.getCampaignReportCsv(parseInt(id, 10));
    res.set({ 'Content-Type': contentType, 'Content-Disposition': `attachment; filename="campaign-${id}-report.csv"` });
    res.send(buffer);
  }

  @Get('call-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  async getCallLogs(@Query('page') page?: string, @Query('limit') limit?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.service.getCallLogs(page ? parseInt(page, 10) : 1, limit ? parseInt(limit, 10) : 50, startDate, endDate);
  }

  @Get('dashboard-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  async getDashboardStats(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.service.getDashboardStats(startDate, endDate);
  }

  @Post('knowledge-base/documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadKnowledgeBaseDocument(@UploadedFile() file: Express.Multer.File, @Query('lang') lang?: string) {
    return this.service.uploadKnowledgeBaseDocument(file, lang || 'te');
  }

  @Get('knowledge-base/documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async listKnowledgeBaseDocuments() {
    return this.service.listKnowledgeBaseDocuments();
  }

  @Delete('knowledge-base/documents/:uuid')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async deleteKnowledgeBaseDocument(@Param('uuid') uuid: string) {
    return this.service.deleteKnowledgeBaseDocument(uuid);
  }

  @Get('custom-fields')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async getCustomFields(@Query('lang') lang?: string) {
    return this.service.getCustomFields(lang || 'te');
  }

  @Post('custom-fields')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async addCustomField(@Body() body: { name: string; type: 'string' | 'number' | 'boolean'; prompt: string }, @Query('lang') lang?: string) {
    return this.service.addCustomField(lang || 'te', body);
  }

  @Delete('custom-fields/:name')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async deleteCustomField(@Param('name') name: string, @Query('lang') lang?: string) {
    return this.service.deleteCustomField(lang || 'te', name);
  }

  @Public()
  @Post('webhook/call-completed')
  async webhookCallCompleted(@Body() body: any, @Headers('x-webhook-secret') secret?: string) {
    if (!this.security.verifyWebhookApiKey(secret || '', 'dograh')) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
    await this.orchestrator.handleCallWebhook(body);
    return { ok: true };
  }
}
