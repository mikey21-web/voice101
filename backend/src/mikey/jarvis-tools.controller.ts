import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { JarvisToolsService } from './jarvis-tools.service';

/**
 * Direct invocation surface for Jarvis's typed tools (spec 56.6) — used by
 * staff for manual testing/override and by the agent-service (via the
 * shared x-service-key, which JwtAuthGuard already elevates to OWNER) for
 * autonomous calls. Every call still passes through the same guardrail +
 * audit envelope as an unprompted Jarvis action.
 */
@ApiTags('Jarvis Tools')
@Controller('jarvis/tools')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles('OWNER', 'ADMIN', 'MANAGER')
export class JarvisToolsController {
  constructor(private tools: JarvisToolsService) {}

  @Post('create-site-visit')
  createSiteVisit(@Body() body: { leadId: string; projectId: string; unitId?: string; startAt: string }, @Req() req: any) {
    return this.tools.createSiteVisit(req.user.tenantId, body);
  }

  @Post('confirm-site-visit')
  confirmSiteVisit(@Body() body: { siteVisitId: string }, @Req() req: any) {
    return this.tools.confirmSiteVisit(req.user.tenantId, body);
  }

  @Post('hold-unit')
  holdUnit(@Body() body: { unitId: string; leadId: string; holdHours?: number }, @Req() req: any) {
    return this.tools.holdUnit(req.user.tenantId, body);
  }

  @Post('release-hold')
  releaseHold(@Body() body: { unitHoldId: string; reason?: string }, @Req() req: any) {
    return this.tools.releaseHold(req.user.tenantId, body);
  }

  @Post('generate-cost-sheet')
  generateCostSheet(@Body() body: { leadId: string; unitId: string; projectId: string }, @Req() req: any) {
    return this.tools.generateCostSheet(req.user.tenantId, body);
  }

  @Post('request-discount-approval')
  requestDiscountApproval(@Body() body: { costSheetId: string; discountPaise?: number; discountPercent?: number; reason: string }, @Req() req: any) {
    return this.tools.requestDiscountApproval(req.user.tenantId, body);
  }

  @Post('create-demand-letter')
  createDemandLetter(@Body() body: { paymentScheduleId: string }, @Req() req: any) {
    return this.tools.createDemandLetter(req.user.tenantId, body);
  }

  @Post('send-payment-reminder')
  sendPaymentReminder(@Body() body: { leadId: string; paymentScheduleId: string; reason?: string }, @Req() req: any) {
    return this.tools.sendPaymentReminder(req.user.tenantId, body);
  }

  @Post('create-customer-ticket')
  createCustomerTicket(@Body() body: { leadId: string; subject: string; description: string; priority?: string }, @Req() req: any) {
    return this.tools.createCustomerTicket(req.user.tenantId, body);
  }

  @Post('create-partner-lead-registration')
  createPartnerLeadRegistration(@Body() body: { channelPartnerId: string; phone: string; leadId?: string }, @Req() req: any) {
    return this.tools.createPartnerLeadRegistration(req.user.tenantId, body);
  }

  @Post('search-properties')
  searchProperties(@Body() body: any, @Req() req: any) {
    return this.tools.searchProperties(req.user.tenantId, body);
  }

  @Post('create-property')
  createProperty(@Body() body: any, @Req() req: any) {
    return this.tools.createProperty(req.user.tenantId, body);
  }

  @Post('update-property')
  updateProperty(@Body() body: { propertyId: string; data: Record<string, unknown> }, @Req() req: any) {
    return this.tools.updateProperty(req.user.tenantId, body);
  }

  @Post('search-projects')
  searchProjects(@Body() body: any, @Req() req: any) {
    return this.tools.searchProjects(req.user.tenantId, body);
  }

  @Post('create-project')
  createProject(@Body() body: any, @Req() req: any) {
    return this.tools.createProject(req.user.tenantId, body);
  }

  @Post('update-project')
  updateProject(@Body() body: { projectId: string; data: Record<string, unknown> }, @Req() req: any) {
    return this.tools.updateProject(req.user.tenantId, body);
  }

  @Post('search-channel-partners')
  searchChannelPartners(@Body() body: any, @Req() req: any) {
    return this.tools.searchChannelPartners(req.user.tenantId, body);
  }

  @Post('create-channel-partner')
  createChannelPartner(@Body() body: any, @Req() req: any) {
    return this.tools.createChannelPartner(req.user.tenantId, body);
  }

  @Post('update-channel-partner')
  updateChannelPartner(@Body() body: { partnerId: string; data: Record<string, unknown> }, @Req() req: any) {
    return this.tools.updateChannelPartner(req.user.tenantId, body);
  }

  @Post('search-campaigns')
  searchCampaigns(@Body() body: any, @Req() req: any) {
    return this.tools.searchCampaigns(req.user.tenantId, body);
  }

  @Post('create-campaign')
  createCampaign(@Body() body: any, @Req() req: any) {
    return this.tools.createCampaign(req.user.tenantId, body);
  }

  @Post('update-campaign')
  updateCampaign(@Body() body: { campaignId: string; data: Record<string, unknown> }, @Req() req: any) {
    return this.tools.updateCampaign(req.user.tenantId, body);
  }

  @Post('update-ticket')
  updateTicket(@Body() body: { ticketId: string; data: Record<string, unknown> }, @Req() req: any) {
    return this.tools.updateTicket(req.user.tenantId, body);
  }
}
