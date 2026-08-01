import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { FeatureFlagsService } from '../shared/feature-flags.service';
import { TemporalStrategyService } from './temporal-strategy.service';
import { StaffAwarenessService } from './staff-awareness.service';
import { NicheScannerService } from './niche-scanner.service';
import { NicheActionService } from './niche-action.service';
import { BookingLifecycleService } from '../bookings/booking-lifecycle.service';
import { SiteVisitsService } from '../site-visits/site-visits.service';
import { UnitHoldsService } from '../unit-holds/unit-holds.service';
import { SlaBreachService } from '../sla/sla-breach.service';
import { MorningDigestService } from './morning-digest.service';
import { SalienceEngineService } from './salience-engine.service';
import { MikeyService } from './mikey.service';
import { MemoryService } from './memory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MetricsService } from '../monitoring/metrics.service';
import type { SchedulerFinding } from './mikey-scheduler.types';

/** Section 5: a captured lead gets a call attempt inside this many seconds. */
const FIRST_CONTACT_SLA_SECONDS = 30;
const BUSINESS_HOURS_START = 9;
const BUSINESS_HOURS_END = 21;

@Injectable()
export class MikeySchedulerService {
  private readonly logger = new Logger(MikeySchedulerService.name);
  private lastFindings: SchedulerFinding[] = [];

  // Health/heartbeat state, exposed via getHealth() so a stuck or repeatedly
  // failing scan is visible to a human instead of just sitting in logs.
  private scanning = false;
  private totalScans = 0;
  private lastScanAt: Date | null = null;
  private lastScanDurationMs: number | null = null;
  private lastScanError: string | null = null;
  private consecutiveFailures = 0;
  private findingsCount = 0;

  getHealth() {
    return {
      scanning: this.scanning,
      totalScans: this.totalScans,
      lastScanAt: this.lastScanAt,
      lastScanDurationMs: this.lastScanDurationMs,
      lastScanError: this.lastScanError,
      consecutiveFailures: this.consecutiveFailures,
      findingsCount: this.findingsCount,
      healthy: this.consecutiveFailures < 3,
    };
  }

  private backoffUntil: Date | null = null;

  /** Returns scan-specific health — same as getHealth but with pause state, so a dashboard or external watchdog can see everything in one shot. */
  async getScanHealth(): Promise<{
    scanning: boolean; totalScans: number; lastScanAt: Date | null; lastScanDurationMs: number | null;
    lastScanError: string | null; consecutiveFailures: number; findingsCount: number; healthy: boolean;
    isPaused: boolean;
  }> {
    const isPaused = await this.featureFlags.isEnabled('mikey_paused');
    return { ...this.getHealth(), isPaused };
  }

  constructor(
    private prisma: PrismaService,
    private events: EventsService,
    private featureFlags: FeatureFlagsService,
    private temporal: TemporalStrategyService,
    private staff: StaffAwarenessService,
    private nicheScanner: NicheScannerService,
    private nicheAction: NicheActionService,
    private memory: MemoryService,
    private bookingLifecycle: BookingLifecycleService,
    private siteVisits: SiteVisitsService,
    private unitHolds: UnitHoldsService,
    private slaBreaches: SlaBreachService,
    private morningDigest: MorningDigestService,
    private salienceEngine: SalienceEngineService,
    private mikey: MikeyService,
    private notifications: NotificationsService,
    private metrics: MetricsService,
  ) {}

  onApplicationBootstrap(): void {
    this.logger.log('Mikey Scheduler starting — scanning every 5 minutes via @Cron');
    this.scan();
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleScheduledScan(): Promise<void> {
    await this.scan();
  }

  @Cron('0 8 * * *')
  async handleMorningDigest(): Promise<void> {
    try {
      await this.morningDigest.sendDailyDigests();
    } catch (err: any) {
      this.logger.error(`Morning digest failed: ${err.message}`);
    }
  }

  @Cron('0 8 1 * *')
  async handleMonthlyDigest(): Promise<void> {
    try {
      await this.morningDigest.sendDailyDigests(30);
    } catch (err: any) {
      this.logger.error(`Monthly digest failed: ${err.message}`);
    }
  }

  @Cron('15 0 * * *')
  async handleMidnightReflexion(): Promise<void> {
    this.logger.log('Running daily peak Mikey jobs');
    await this.runReflexionOnRecentOutcomes();
  }

  /** Runs one check and swallows its error so a single broken query can't take down the rest of the scan cycle. */
  private lastPushAt = 0;

  /** Push critical findings to the dashboard in real time — no waiting for the morning digest. */
  private async pushCriticalFindings(findings: SchedulerFinding[]): Promise<void> {
    const critical = findings.filter(f => f.severity === 'critical');
    if (critical.length === 0) return;
    // Don't spam — at most once per 30 minutes
    if (Date.now() - this.lastPushAt < 30 * 60 * 1000) return;
    this.lastPushAt = Date.now();
    for (const f of critical) {
      await this.events.emit({
        type: `mikey.${f.type}`,
        source: 'mikey-scheduler',
        payload: { severity: f.severity, title: f.title, description: f.description, count: f.count, leadIds: f.metadata?.leadIds },
      });
    }
    this.logger.log(`Pushed ${critical.length} critical finding(s) to dashboard`);
  }

  private async runCheck(name: string, check: () => Promise<SchedulerFinding[]>): Promise<SchedulerFinding[]> {
    try {
      return await check();
    } catch (err: any) {
      this.logger.error(`Scheduler check "${name}" failed: ${err.message}`);
      return [];
    }
  }

  private async scan(): Promise<void> {
    if (await this.featureFlags.isEnabled('mikey_paused')) {
      this.logger.debug('Mikey is paused via mikey_paused flag — skipping scan cycle');
      return;
    }
    if (this.scanning) {
      this.logger.warn('Scan already in progress — skipping this tick (previous scan is still running)');
      return;
    }
    if (this.backoffUntil && new Date() < this.backoffUntil) {
      this.logger.warn(`Circuit breaker active — skipping scan until ${this.backoffUntil.toISOString()} (${this.consecutiveFailures} consecutive failures)`);
      return;
    }
    this.scanning = true;
    const startedAt = Date.now();
    try {
      const findings: SchedulerFinding[] = [];
      const [staleHot, staleNew, overdue, unassigned, missedCalls, portalFails, weakSales, sourceDrops, executedTasks] = await Promise.all([
        this.runCheck('checkStaleHotLeads', () => this.checkStaleHotLeads()),
        this.runCheck('checkStaleNewLeads', () => this.checkStaleNewLeads()),
        this.runCheck('checkFirstContactSlaBreaches', () => this.checkFirstContactSlaBreaches()),
        this.runCheck('checkOverdueTasks', () => this.checkOverdueTasks()),
        this.runCheck('checkUnassignedHotLeads', () => this.checkUnassignedHotLeads()),
        this.runCheck('scanMissedCalls', () => this.scanMissedCalls()),
        this.runCheck('scanFailedPortalLeads', () => this.scanFailedPortalLeads()),
        this.runCheck('scanWeakSalespeople', () => this.scanWeakSalespeople()),
        this.runCheck('scanSourceDrops', () => this.scanSourceDrops()),
        this.runCheck('executeFollowUpTasks', () => this.executeFollowUpTasks()),
      ]);
      findings.push(...staleHot, ...staleNew, ...overdue, ...unassigned, ...missedCalls, ...portalFails, ...weakSales, ...sourceDrops);
      if (executedTasks.length > 0) findings.push(...executedTasks);

      // Triage core: hand findings with an unambiguous, safe remedy straight
      // to the salience engine so Mikey acts on them without being asked,
      // instead of just logging that they exist.
      for (const finding of [...staleHot, ...unassigned, ...staleNew, ...overdue]) {
        try {
          const outcome = await this.salienceEngine.route(finding);
          if (outcome.acted) this.logger.log(`Salience engine acted: ${outcome.summary}`);
        } catch (err: any) {
          this.logger.error(`Salience engine failed for ${finding.type}: ${err.message}`);
        }
      }

      const [conversionAnomaly, sourceShift] = await Promise.all([
        this.runCheck('checkConversionAnomaly', () => this.checkConversionAnomaly()),
        this.runCheck('checkLeadSourceShift', () => this.checkLeadSourceShift()),
      ]);
      findings.push(...conversionAnomaly, ...sourceShift);

      // Detect site-visit / appointment no-shows and queue reschedule nudges.
      try {
        await this.bookingLifecycle.scanNoShows();
      } catch (err: any) {
        this.logger.error(`No-show scan failed: ${err.message}`);
      }

      // Flag overdue payment milestones and queue collection nudges.
      try {
        await this.bookingLifecycle.scanOverduePayments();
      } catch (err: any) {
        this.logger.error(`Overdue-payment scan failed: ${err.message}`);
      }

      // Detect dedicated SiteVisit no-shows (separate from the legacy Booking-based ones above).
      try {
        await this.siteVisits.scanNoShows();
      } catch (err: any) {
        this.logger.error(`Site-visit no-show scan failed: ${err.message}`);
      }

      // Release unit holds whose expiry has passed.
      try {
        await this.unitHolds.scanExpiredHolds();
      } catch (err: any) {
        this.logger.error(`Unit-hold expiry scan failed: ${err.message}`);
      }

      // Proactive push: notify owner immediately for critical findings
      await this.pushCriticalFindings(findings);

      if (new Date().getMinutes() % 15 === 0) {
        try {
          const nicheFindings = await this.nicheScanner.scanAll();
          for (const nf of nicheFindings) {
            findings.push(nf as any);
          }
        } catch (err: any) {
          this.logger.error(`Niche scan failed: ${err.message}`);
        }
      }

      if (new Date().getMinutes() % 15 === 0) {
        try {
          const tenants = await this.prisma.tenant.findMany({ where: { active: true }, select: { id: true } });
          let taskCount = 0;
          for (const t of tenants) {
            taskCount += await this.mikey.generateProactiveTasksForAllLeads(t.id);
          }
          if (taskCount > 0) {
            this.logger.log(`Mikey auto-generated ${taskCount} proactive tasks across ${tenants.length} tenants`);
            findings.push({
              type: 'proactive_tasks_generated',
              severity: 'info',
              title: `Mikey created ${taskCount} stage-based tasks`,
              description: `Auto-generated ${taskCount} tasks based on lead stages — team should review and assign.`,
              count: taskCount,
              metadata: { tenants: tenants.length },
            });
          }
        } catch (err: any) {
          this.logger.error(`Proactive task generation failed: ${err.message}`);
        }
      }

      try {
        const temporalInsights = await this.temporal.scan();
        if (temporalInsights.length > 0) {
          findings.push({
            type: 'conversion_anomaly',
            severity: 'warning',
            title: 'Temporal conversion pattern detected',
            description: temporalInsights[0].recommendation,
            count: temporalInsights.length,
            metadata: { insights: temporalInsights.slice(0, 3) },
          });


        }
      } catch (err: any) {
        this.logger.error(`Temporal scan failed: ${err.message}`);
      }

      if (new Date().getMinutes() % 15 === 0) {
        try {
          const staffProfiles = await this.staff.scan();
          if (staffProfiles.length > 0) {
            const topPerformer = staffProfiles.reduce((best, p) => p.conversionRate > (best?.conversionRate || 0) ? p : best, staffProfiles[0]);
            findings.push({
              type: 'staff_performance_update',
              severity: 'info',
              title: 'Staff performance scan',
              description: `${staffProfiles.length} active agents. Top: ${topPerformer.name} at ${(topPerformer.conversionRate * 100).toFixed(0)}% conversion.`,
              count: staffProfiles.length,
              metadata: { agents: staffProfiles.map(p => ({ name: p.name, rate: p.conversionRate, leads: p.totalLeadsHandled })) },
            });
          }
        } catch (err: any) {
          this.logger.error(`Staff performance scan failed: ${err.message}`);
        }
      }

      const newFindings = findings.filter(f => {
        const prev = this.lastFindings.find(p => p.type === f.type);
        return !prev || prev.count !== f.count || prev.severity !== f.severity;
      });

      for (const finding of newFindings) {
        try {
          await this.events.emit({
            type: `mikey.${finding.type}`,
            source: 'mikey-scheduler',
            payload: finding as any,
          });

            this.logger.warn(`[${finding.severity}] ${finding.title}: ${finding.description}`);

          if (finding.severity === 'info') {
            const result = await this.nicheAction.execute(finding);
            if (result.executed) {
              this.logger.log(`Auto-executed action for ${finding.type}: ${result.result}`);
            }
          }

          if (finding.severity === 'critical') {
            await this.notifyOwnersOfCriticalFinding(finding);
          }
        } catch (err: any) {
          this.logger.error(`Failed to process finding "${finding.type}": ${err.message}`);
        }
      }

      this.lastFindings = findings;
      this.findingsCount = findings.length;
      this.lastScanError = null;
      this.consecutiveFailures = 0;
      this.backoffUntil = null;
      this.metrics.incrementCounter('agent_runs_total', { result: 'success' });
    } catch (err: any) {
      this.logger.error(`Scheduler scan failed: ${err.message}`);
      this.lastScanError = err.message;
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= 3) {
        this.backoffUntil = new Date(Date.now() + 15 * 60 * 1000);
        this.logger.warn(`Circuit breaker: ${this.consecutiveFailures} consecutive failures, backoff 15min until ${this.backoffUntil.toISOString()}`);
      }
      this.metrics.incrementCounter('agent_runs_total', { result: 'error' });
    } finally {
      this.scanning = false;
      this.totalScans++;
      this.lastScanAt = new Date();
      this.lastScanDurationMs = Date.now() - startedAt;
    }
  }

  private async checkStaleHotLeads(): Promise<SchedulerFinding[]> {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const stale = await this.prisma.lead.findMany({
      where: {
        segment: 'HOT',
        status: { notIn: ['CONVERTED', 'LOST', 'SPAM'] },
        updatedAt: { lt: twoHoursAgo },
        assignedAgentId: { not: null },
      },
      include: { assignedAgent: true, contact: true },
      take: 10,
    });

    try {
      await this.slaBreaches.reconcile('lead', 'stale_hot_lead', stale.map(l => ({ tenantId: l.tenantId, entityId: l.id, leadId: l.id })));
    } catch (err: any) {
      this.logger.error(`SLA breach reconcile (stale_hot_lead) failed: ${err.message}`);
    }

    if (stale.length === 0) return [];
    return [{
      type: 'stale_hot_leads',
      severity: stale.length > 5 ? 'critical' : 'warning',
      title: `Hot leads untouched`,
      description: `${stale.length} hot lead(s) haven't been contacted in over 2 hours. ${stale.slice(0, 3).map(l => l.contact?.name || 'Unknown').join(', ')}${stale.length > 3 ? ` and ${stale.length - 3} more` : ''}`,
      count: stale.length,
      metadata: { leadIds: stale.map(l => l.id) },
    }];
  }

  /**
   * Section 5's 30 second SLA. A lead captured during business hours must have
   * an outbound call attempted within FIRST_CONTACT_SLA_SECONDS. Anything past
   * that is speed-to-lead we have already paid for and not used.
   */
  private async checkFirstContactSlaBreaches(): Promise<SchedulerFinding[]> {
    const hour = new Date().getHours();
    if (hour < BUSINESS_HOURS_START || hour >= BUSINESS_HOURS_END) return [];

    const cutoff = new Date(Date.now() - FIRST_CONTACT_SLA_SECONDS * 1000);
    // Only look back an hour: older misses are history, not something a rep can
    // still rescue, and they would re-fire this alert every 5 minutes forever.
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const breached = await this.prisma.lead.findMany({
      where: {
        firstContactAttemptedAt: null,
        createdAt: { lt: cutoff, gte: since },
        status: { notIn: ['SPAM', 'LOST'] },
      },
      include: { contact: true },
      take: 10,
    });
    if (breached.length === 0) return [];
    return [{
      type: 'first_contact_sla_breach',
      severity: breached.length > 3 ? 'critical' : 'warning',
      title: `Leads not called within ${FIRST_CONTACT_SLA_SECONDS}s`,
      description: `${breached.length} lead(s) captured in business hours with no call attempted. ${breached.slice(0, 3).map(l => l.contact?.name || 'Unknown').join(', ')}${breached.length > 3 ? ` and ${breached.length - 3} more` : ''}`,
      count: breached.length,
      metadata: { leadIds: breached.map(l => l.id) },
    }];
  }

  private async checkStaleNewLeads(): Promise<SchedulerFinding[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stale = await this.prisma.lead.findMany({
      where: { status: 'NEW', createdAt: { lt: oneDayAgo } },
      include: { contact: true },
      take: 10,
    });
    if (stale.length === 0) return [];
    return [{
      type: 'stale_new_leads',
      severity: stale.length > 10 ? 'critical' : 'warning',
      title: `New leads not contacted`,
      description: `${stale.length} lead(s) still in NEW status for over 24 hours. ${stale.slice(0, 3).map(l => l.contact?.name || 'Unknown').join(', ')}${stale.length > 3 ? ` and ${stale.length - 3} more` : ''}`,
      count: stale.length,
      metadata: { leadIds: stale.map(l => l.id) },
    }];
  }

  private async checkOverdueTasks(): Promise<SchedulerFinding[]> {
    const now = new Date();
    const overdue = await this.prisma.task.findMany({
      where: { dueAt: { lt: now }, status: { not: 'completed' } },
      include: { lead: { include: { contact: true } } },
      take: 10,
    });

    try {
      const withTenant = overdue.filter(t => t.lead?.tenantId);
      await this.slaBreaches.reconcile('task', 'overdue_task', withTenant.map(t => ({ tenantId: t.lead!.tenantId, entityId: t.id, leadId: t.leadId || undefined })));
    } catch (err: any) {
      this.logger.error(`SLA breach reconcile (overdue_task) failed: ${err.message}`);
    }

    if (overdue.length === 0) return [];
    return [{
      type: 'overdue_tasks',
      severity: overdue.length > 5 ? 'critical' : 'warning',
      title: `Overdue tasks`,
      description: `${overdue.length} task(s) past due. ${overdue.slice(0, 3).map(t => t.title.slice(0, 40)).join(', ')}${overdue.length > 3 ? ` and ${overdue.length - 3} more` : ''}`,
      count: overdue.length,
      metadata: { taskIds: overdue.map(t => t.id) },
    }];
  }

  private async executeFollowUpTasks(): Promise<SchedulerFinding[]> {
    const now = new Date();
    const tasks = await this.prisma.task.findMany({
      where: {
        dueAt: { lte: now },
        status: 'pending',
        createdBy: 'mikey-auto',
      },
      include: { lead: { include: { contact: true } } },
      take: 10,
    });
    if (tasks.length === 0) return [];

    let executed = 0;
    for (const task of tasks) {
      try {
        const title = task.title.toLowerCase();
        const lead = task.lead;
        if (!lead) continue;
        const leadId = lead.id;
        const tenantId = lead.tenantId;
        if (!leadId || !tenantId) continue;

        const finding: SchedulerFinding = {
          type: 'auto_follow_up',
          severity: 'info',
          title: task.title,
          description: `Auto-follow-up: ${task.title}`,
          count: 1,
          metadata: { leadId, taskId: task.id, tenantId },
        };
        const outcome = await this.salienceEngine.route(finding);
        if (outcome.acted) {
          await this.prisma.task.update({
            where: { id: task.id },
            data: { status: 'completed' },
          });
          executed++;
        } else {
          await this.prisma.task.update({
            where: { id: task.id },
            data: { status: 'in_progress' },
          });
        }
      } catch (err: any) {
        this.logger.error(`Failed to execute follow-up task ${task.id}: ${err.message}`);
      }
    }

    return executed > 0 ? [{
      type: 'auto_follow_ups_executed',
      severity: 'info',
      title: `Mikey auto-executed ${executed} follow-up(s)`,
      description: `${executed} of ${tasks.length} pending auto-follow-ups were executed`,
      count: executed,
      metadata: { total: tasks.length },
    }] : [];
  }

  private async checkUnassignedHotLeads(): Promise<SchedulerFinding[]> {
    const unassigned = await this.prisma.lead.findMany({
      where: { segment: 'HOT', assignedAgentId: null, status: { notIn: ['CONVERTED', 'LOST', 'SPAM'] } },
      include: { contact: true },
      take: 10,
    });

    try {
      await this.slaBreaches.reconcile('lead', 'unassigned_hot_lead', unassigned.map(l => ({ tenantId: l.tenantId, entityId: l.id, leadId: l.id })));
    } catch (err: any) {
      this.logger.error(`SLA breach reconcile (unassigned_hot_lead) failed: ${err.message}`);
    }

    if (unassigned.length === 0) return [];

    const oldest = Math.min(...unassigned.map(l => l.createdAt.getTime()));
    const hoursUnassigned = (Date.now() - oldest) / 3600000;
    // ponytail: flat severity tiers based on oldest lead wait time. Replace with per-lead SLA tracking if managers need per-agent escalation visibility.
    const severity = hoursUnassigned > 8 ? 'critical' : hoursUnassigned > 4 ? 'warning' : 'info';

    return [{
      type: 'unassigned_hot_leads',
      severity,
      title: `Unassigned hot leads`,
      description: `${unassigned.length} hot lead(s) have no assigned agent. ${unassigned.slice(0, 3).map(l => l.contact?.name || 'Unknown').join(', ')}${unassigned.length > 3 ? ` and ${unassigned.length - 3} more` : ''}`,
      count: unassigned.length,
      metadata: { leadIds: unassigned.map(l => l.id) },
    }];
  }

  private async checkConversionAnomaly(): Promise<SchedulerFinding[]> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [todayConversions, weekConversions, todayLeads, weekLeads] = await Promise.all([
      this.prisma.lead.count({ where: { status: 'CONVERTED', updatedAt: { gte: todayStart } } }),
      this.prisma.lead.count({ where: { status: 'CONVERTED', updatedAt: { gte: sevenDaysAgo, lt: todayStart } } }),
      this.prisma.lead.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.lead.count({ where: { createdAt: { gte: sevenDaysAgo, lt: todayStart } } }),
    ]);

    const todayRate = todayLeads > 0 ? todayConversions / todayLeads : 0;
    const weekRate = weekLeads > 0 ? weekConversions / weekLeads : 0;
    const drop = weekRate > 0 ? ((todayRate - weekRate) / weekRate) * 100 : 0;

    if (Math.abs(drop) < 10) return [];
    return [{
      type: 'conversion_anomaly',
      severity: drop < -20 ? 'critical' : 'warning',
      title: `Conversion rate ${drop > 0 ? 'up' : 'down'} ${Math.abs(drop).toFixed(1)}%`,
      description: `Today's conversion rate (${(todayRate * 100).toFixed(1)}%) vs 7-day average (${(weekRate * 100).toFixed(1)}%). ${drop > 0 ? 'Upward trend' : 'Investigation recommended'}.`,
      count: Math.abs(Math.round(drop)),
      metadata: { todayRate, weekRate, drop },
    }];
  }

  // ── P4: Reflexion on recent outcomes ──────────────────────────────────
  private async runReflexionOnRecentOutcomes(): Promise<void> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [converted, lost] = await Promise.all([
        this.prisma.lead.findMany({
          where: { status: 'CONVERTED', updatedAt: { gte: oneHourAgo } },
          select: { id: true, tenantId: true },
          take: 10,
        }),
        this.prisma.lead.findMany({
          where: { status: 'LOST', updatedAt: { gte: oneHourAgo } },
          select: { id: true, tenantId: true },
          take: 10,
        }),
      ]);

      for (const lead of converted) {
        try {
          await this.memory.reflectOnOutcome(lead.tenantId, 'lead_converted', lead.id);
          this.logger.log(`Reflexion: lead_converted ${lead.id}`);
        } catch (err: any) {
          this.logger.warn(`Reflexion failed for lead_converted ${lead.id}: ${err.message}`);
        }
      }
      for (const lead of lost) {
        try {
          await this.memory.reflectOnOutcome(lead.tenantId, 'lead_lost', lead.id);
          this.logger.log(`Reflexion: lead_lost ${lead.id}`);
        } catch (err: any) {
          this.logger.warn(`Reflexion failed for lead_lost ${lead.id}: ${err.message}`);
        }
      }

      const [confirmedBookings, cancelledBookings] = await Promise.all([
        this.prisma.booking.findMany({
          where: { status: 'CONFIRMED', updatedAt: { gte: oneHourAgo } },
          select: { id: true, tenantId: true },
          take: 10,
        }),
        this.prisma.booking.findMany({
          where: { status: 'CANCELLED', updatedAt: { gte: oneHourAgo } },
          select: { id: true, tenantId: true },
          take: 10,
        }),
      ]);
      for (const booking of [...confirmedBookings, ...cancelledBookings]) {
        try {
          await this.memory.reflectOnOutcome(booking.tenantId, 'booking_outcome', booking.id);
          this.logger.log(`Reflexion: booking_outcome ${booking.id}`);
        } catch (err: any) {
          this.logger.warn(`Reflexion failed for booking_outcome ${booking.id}: ${err.message}`);
        }
      }

      const deactivatedCampaigns = await this.prisma.campaign.findMany({
        where: { active: false, updatedAt: { gte: oneHourAgo } },
        select: { id: true, tenantId: true },
        take: 10,
      });
      for (const campaign of deactivatedCampaigns) {
        try {
          await this.memory.reflectOnOutcome(campaign.tenantId, 'campaign_result', campaign.id);
          this.logger.log(`Reflexion: campaign_result ${campaign.id}`);
        } catch (err: any) {
          this.logger.warn(`Reflexion failed for campaign_result ${campaign.id}: ${err.message}`);
        }
      }

      const totalReflected = converted.length + lost.length + confirmedBookings.length + cancelledBookings.length + deactivatedCampaigns.length;
      if (totalReflected > 0) {
        await this.events.emit({
          type: 'mikey.reflexion_completed',
          source: 'mikey-scheduler',
          payload: {
            converted: converted.length, lost: lost.length,
            bookings: confirmedBookings.length + cancelledBookings.length,
            campaigns: deactivatedCampaigns.length,
          },
        });
      }
    } catch (err: any) {
      this.logger.error(`Reflexion scan failed: ${err.message}`);
    }
  }

  private async checkLeadSourceShift(): Promise<SchedulerFinding[]> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    const sources = await this.prisma.lead.groupBy({
      by: ['source'],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: { id: true },
    });

    const total = sources.reduce((s, g) => s + g._count.id, 0);
    if (total === 0) return [];

    const topSource = sources.reduce((best, g) => g._count.id > (best?._count.id || 0) ? g : best, sources[0]);
    const topPercent = (topSource._count.id / total) * 100;

    if (topPercent < 30) return [];
    return [{
      type: 'lead_source_shift',
      severity: 'info',
      title: `Lead source concentration`,
      description: `${topSource.source} accounts for ${topPercent.toFixed(0)}% of leads this week (${topSource._count.id}/${total}). ${topPercent > 60 ? 'High dependency — consider diversifying.' : 'Healthy distribution with a strong channel.'}`,
      count: topSource._count.id,
      metadata: { source: topSource.source, percent: topPercent, total },
    }];
  }

  // ── P6: Missed call detection ─────────────────────────────────────────
  private async scanMissedCalls(): Promise<SchedulerFinding[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const missed = await this.prisma.callLog.findMany({
      where: { direction: 'INBOUND', status: { in: ['NO_ANSWER', 'MISSED'] }, createdAt: { gte: oneDayAgo } },
      select: { id: true, fromNumber: true, leadId: true, tenantId: true },
    });
    if (missed.length === 0) return [];

    const callerCounts = new Map<string, { count: number; leadIds: Set<string> }>();
    for (const call of missed) {
      const key = call.fromNumber || call.leadId || 'unknown';
      if (!callerCounts.has(key)) callerCounts.set(key, { count: 0, leadIds: new Set() });
      const entry = callerCounts.get(key)!;
      entry.count++;
      if (call.leadId) entry.leadIds.add(call.leadId);
    }

    const repeatCallers = Array.from(callerCounts.entries()).filter(([, v]) => v.count >= 2);
    if (repeatCallers.length === 0) return [];

    return [{
      type: 'missed_call',
      severity: 'warning',
      title: `${repeatCallers.length} caller(s) missed 2+ times in 24h`,
      description: `${repeatCallers.length} repeat caller(s) went unanswered. Top: ${repeatCallers.slice(0, 3).map(([k]) => k).join(', ')}`,
      count: repeatCallers.length,
      metadata: { callers: repeatCallers.map(([k, v]) => ({ caller: k, missedCount: v.count })) },
    }];
  }

  // ── P7: Failed portal lead ingestion ──────────────────────────────────
  private async scanFailedPortalLeads(): Promise<SchedulerFinding[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const failures = await this.prisma.failureRecord.findMany({
      where: { type: 'PORTAL_LEAD_INGESTION', status: 'open', createdAt: { gte: oneDayAgo } },
      select: { id: true, provider: true },
    });
    if (failures.length < 3) return [];

    const providerCounts = new Map<string, number>();
    for (const f of failures) {
      const provider = f.provider || 'unknown';
      providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
    }
    const failingProviders = Array.from(providerCounts.entries()).filter(([, c]) => c >= 3);
    if (failingProviders.length === 0) return [];

    return failingProviders.map(([provider, count]) => ({
      type: 'portal_lead_failure' as const,
      severity: 'critical' as const,
      title: `Portal failures: ${provider}`,
      description: `${count} open PORTAL_LEAD_INGESTION failures from ${provider} in 24h.`,
      count,
      metadata: { provider, failures: count },
    }));
  }

  // ── P8: Weak salesperson detection ────────────────────────────────────
  private async scanWeakSalespeople(): Promise<SchedulerFinding[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const agents = await this.prisma.user.findMany({
      where: { active: true, role: 'SALES_AGENT' },
      select: { id: true, name: true },
    });
    if (agents.length === 0) return [];

    const agentIds = agents.map(a => a.id);
    const [totalLeads, convertedLeads, recentConverted] = await Promise.all([
      this.prisma.lead.groupBy({ by: ['assignedAgentId'], where: { assignedAgentId: { in: agentIds } }, _count: { id: true } }),
      this.prisma.lead.groupBy({ by: ['assignedAgentId'], where: { assignedAgentId: { in: agentIds }, status: 'CONVERTED' }, _count: { id: true } }),
      this.prisma.lead.groupBy({ by: ['assignedAgentId'], where: { assignedAgentId: { in: agentIds }, status: 'CONVERTED', updatedAt: { gte: thirtyDaysAgo } }, _count: { id: true } }),
    ]);

    const totalMap = new Map(totalLeads.map(s => [s.assignedAgentId, s._count.id]));
    const convertedMap = new Map(convertedLeads.map(s => [s.assignedAgentId, s._count.id]));
    const recentMap = new Map(recentConverted.map(s => [s.assignedAgentId, s._count.id]));

    const weak: Array<{ id: string; name: string; totalLeads: number; converted: number; rate: number }> = [];
    for (const agent of agents) {
      const total = totalMap.get(agent.id) || 0;
      const converted = convertedMap.get(agent.id) || 0;
      const recentConv = recentMap.get(agent.id) || 0;
      const rate = total > 0 ? converted / total : 0;
      if ((total > 10 && rate < 0.1) || (total > 5 && recentConv === 0)) {
        weak.push({ ...agent, totalLeads: total, converted, rate });
      }
    }
    if (weak.length === 0) return [];

    return [{
      type: 'weak_salesperson',
      severity: 'warning',
      title: `${weak.length} agent(s) with weak conversion`,
      description: `${weak.slice(0, 3).map(a => `${a.name}: ${(a.rate * 100).toFixed(0)}% (${a.totalLeads} leads)`).join(', ')}${weak.length > 3 ? ` and ${weak.length - 3} more` : ''}`,
      count: weak.length,
      metadata: { agents: weak.map(a => ({ id: a.id, name: a.name, totalLeads: a.totalLeads, converted: a.converted, rate: a.rate })) },
    }];
  }

  // ── P9: Lead source drop detection ────────────────────────────────────
  private async scanSourceDrops(): Promise<SchedulerFinding[]> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [recentCounts, prevCounts] = await Promise.all([
      this.prisma.lead.groupBy({ by: ['source'], where: { createdAt: { gte: sevenDaysAgo } }, _count: { id: true } }),
      this.prisma.lead.groupBy({ by: ['source'], where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } }, _count: { id: true } }),
    ]);

    const recentMap = new Map(recentCounts.map(s => [s.source, s._count.id]));
    const prevMap = new Map(prevCounts.map(s => [s.source, s._count.id]));
    const allSources = new Set([...recentMap.keys(), ...prevMap.keys()]);

    const drops: Array<{ source: string; recent: number; prev: number; dropPercent: number }> = [];
    for (const source of allSources) {
      const recent = recentMap.get(source) || 0;
      const prev = prevMap.get(source) || 0;
      if (prev > 0) {
        const dropPercent = ((prev - recent) / prev) * 100;
        if (dropPercent > 50) drops.push({ source: source as string, recent, prev, dropPercent });
      }
    }
    if (drops.length === 0) return [];

    return drops.map(d => ({
      type: 'source_drop',
      severity: 'critical',
      title: `Lead source drop: ${d.source}`,
      description: `${d.source} dropped ${d.dropPercent.toFixed(0)}% (${d.prev} → ${d.recent} leads/wk).`,
      count: 1,
      metadata: { source: d.source, recent: d.recent, prev: d.prev, dropPercent: d.dropPercent },
    }));
  }

  /**
   * Critical findings (currently just unassigned hot leads) were only ever
   * logged and, at best, turned into auto-created tasks — nothing showed up
   * in the notification bell. This creates a real Notification per affected
   * tenant's OWNER/ADMIN/MANAGER so it's actually visible in the dashboard.
   */
  private async notifyOwnersOfCriticalFinding(finding: SchedulerFinding): Promise<void> {
    const leadIds: string[] = (finding.metadata as any)?.leadIds;
    if (!leadIds?.length) return;

    const leads = await this.prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true, tenantId: true },
    });
    const tenantIds = [...new Set(leads.map(l => l.tenantId))];

    for (const tenantId of tenantIds) {
      const recipients = await this.prisma.user.findMany({
        where: { tenantId, role: { in: ['OWNER', 'ADMIN', 'MANAGER'] }, active: true },
        select: { id: true },
      });
      for (const user of recipients) {
        await this.notifications.create({
          tenantId,
          userId: user.id,
          type: 'lead_hot',
          title: finding.title,
          body: finding.description,
          link: '#/leads',
        });
      }
    }
  }
}

