import { Controller, Post, Get, Param, Query, Body, Logger, UseGuards, HttpCode, Req } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FeatureFlagsService } from '../shared/feature-flags.service';
import { MikeyService } from './mikey.service';
import { OutcomeEngineService } from './outcome-engine.service';
import { TemporalStrategyService } from './temporal-strategy.service';
import { StaffAwarenessService } from './staff-awareness.service';
import { DailyBriefService } from './daily-brief.service';
import { EventsService } from '../events/events.service';
import { MikeySchedulerService } from './mikey-scheduler.service';
import { AutonomyGuardrailsService, AutonomyCategory, AutonomyLevel } from './autonomy-guardrails.service';
import { MemoryService } from './memory.service';

@Controller('mikey')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
export class MikeyController {
  private readonly logger = new Logger(MikeyController.name);

  constructor(
    private Mikey: MikeyService,
    private outcomes: OutcomeEngineService,
    private temporal: TemporalStrategyService,
    private staff: StaffAwarenessService,
    private dailyBrief: DailyBriefService,
    private events: EventsService,
    private scheduler: MikeySchedulerService,
    private guardrails: AutonomyGuardrailsService,
    private memory: MemoryService,
    private featureFlags: FeatureFlagsService,
  ) {}

  /** Learning tab data (spec 56.5): decision/impact stats, generalized patterns, and reflexion outcome breakdown — the evidence behind "is Mikey actually helping". */
  @Get('learning')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  async getLearning(@Query('tenantId') tenantId: string) {
    const reflexionStats = await this.memory.getReflexionStats(tenantId);
    return { reflexionStats };
  }

  /** Is the always-on scan loop actually alive and healthy? Surfaces a stuck or repeatedly-failing scan instead of hiding it in logs (spec invariant: every failed job becomes visible to a human). */
  @Get('health')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  async getHealth() {
    return this.scheduler.getHealth();
  }

  /** Scan-specific health endpoint with pause state and findings count — for the dashboard pause toggle and external watchdog. */
  @Get('scan-health')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  async getScanHealth() {
    return this.scheduler.getScanHealth();
  }

  /** Per-category autonomy dial (spec 56.4) — the owner controls what Mikey is allowed to act on, not one global switch. */
  @Get('autonomy-policies')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  async getAutonomyPolicies(@Query('tenantId') tenantId: string) {
    return this.guardrails.getAllCategoryLevels(tenantId);
  }

  @Post('autonomy-policies/:category')
  async setAutonomyPolicy(
    @Param('category') category: AutonomyCategory,
    @Body() body: { tenantId: string; level: AutonomyLevel },
  ) {
    await this.guardrails.setCategoryLevel(body.tenantId, category, body.level);
    return this.guardrails.getAllCategoryLevels(body.tenantId);
  }

  /**
   * Everything Mikey has noticed and done, persisted (SystemEvent rows with a
   * `mikey.` type prefix) so it survives a restart and isn't limited to whatever
   * happens to be in the live socket buffer.
   */
  @Get('activity')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  async getActivity(@Query('limit') limit?: string) {
    const events = await this.events.findByTypePrefix('mikey.', limit ? parseInt(limit, 10) : 50);
    return events.map(e => ({
      id: e.id,
      type: e.type,
      severity: (e.payload as any)?.severity || 'info',
      title: (e.payload as any)?.title || e.type.replace('mikey.', '').replace(/_/g, ' '),
      description: (e.payload as any)?.description || '',
      payload: e.payload,
      createdAt: e.createdAt,
    }));
  }

  @Post('outcome')
  async defineOutcome(@Body() params: { goal: string; metric: string; target: number; current: number }, @Req() req) {
    return this.outcomes.defineOutcome({ ...params, tenantId: req.user.tenantId || 'default-tenant', userId: req.user.sub });
  }

  @Get('outcomes')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  async listOutcomes(@Req() req) {
    return this.outcomes.listOutcomes(req.user.tenantId || 'default-tenant');
  }

  @Get('outcomes/:id')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  async getOutcome(@Param('id') id: string, @Req() req) {
    return this.outcomes.getOutcome(id, req.user.tenantId || 'default-tenant');
  }

  @Post('outcomes/:id/step/:stepId')
  async updateStep(@Param('id') id: string, @Param('stepId') stepId: string, @Body() body: { status: string; result?: string }, @Req() req) {
    return this.outcomes.updateStep(id, req.user.tenantId || 'default-tenant', stepId, { status: body.status as any, result: body.result });
  }

  @Get('actions')
  async getActionRules() {
    return this.Mikey.getActionRules();
  }

  @Post('actions/run')
  async runAction(@Body() params: { leadId?: string; action: string; args: any }) {
    return this.Mikey.runAutonomousAction(params);
  }

  @Get('temporal-insights')
  async getTemporalInsights() {
    return this.temporal.getInsights();
  }

  @Post('temporal-insights/scan')
  async scanTemporalInsights() {
    return this.temporal.scan();
  }

  @Get('staff')
  async getStaffProfiles() {
    return this.staff.getProfiles();
  }

  @Post('staff/scan')
  async scanStaff() {
    return this.staff.scan();
  }

  @Get('staff/recommend-route')
  async recommendRoute(@Query('leadId') leadId?: string) {
    return this.staff.recommendRoute(leadId);
  }

  @Get('status')
  async getStatus(@Req() req) {
    const outcomes = await this.outcomes.listOutcomes(req.user.tenantId || 'default-tenant');
    const active = outcomes.filter(o => o.status === 'active');
    const completed = outcomes.filter(o => o.status === 'completed');
    return {
      activeOutcomes: active.length,
      completedOutcomes: completed.length,
      totalOutcomes: outcomes.length,
      outcomes: outcomes.map(o => ({ id: o.id, goal: o.goal, status: o.status, steps: o.steps.length, progress: o.steps.filter(s => s.status === 'completed').length })),
    };
  }

  @Get('daily-brief')
  @ApiOperation({ summary: 'Mikey\'s daily command center brief — everything the owner needs to know in one response' })
  async getDailyBrief(@Query('tenantId') tenantId: string) {
    return this.dailyBrief.getDailyBrief(tenantId || 'default-tenant');
  }

  @Post('pause')
  @HttpCode(200)
  @ApiOperation({ summary: 'Globally pause the Mikey agent (emergency kill-switch)' })
  async pause() {
    await this.featureFlags.enable('mikey_paused');
    this.logger.warn('Mikey agent PAUSED via API');
    return { status: 'paused' };
  }

  @Post('unpause')
  @HttpCode(200)
  @ApiOperation({ summary: 'Unpause the Mikey agent' })
  async unpause() {
    await this.featureFlags.disable('mikey_paused');
    this.logger.log('Mikey agent UNPAUSED via API');
    return { status: 'unpaused' };
  }
}

