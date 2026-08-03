import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TimelineService } from '../timeline/timeline.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AutomationSchedulerService } from '../automation/automation-scheduler.service';
import { SiteVisitStatus } from '@prisma/client';
import { FollowUpSchedulerService } from '../automation/follow-up-scheduler.service';

const OPEN_STATUSES: SiteVisitStatus[] = [SiteVisitStatus.SCHEDULED, SiteVisitStatus.CONFIRMED];
// Grace period past a visit's scheduled end before the heartbeat treats it as a no-show.
const NO_SHOW_GRACE_MS = 30 * 60 * 1000;

@Injectable()
export class SiteVisitsService {
  private readonly logger = new Logger(SiteVisitsService.name);

  constructor(
    private prisma: PrismaService,
    private timeline: TimelineService,
    private auditLogs: AuditLogsService,
    private automationScheduler: AutomationSchedulerService,
    private followUps: FollowUpSchedulerService,
  ) {}

  async create(data: {
    tenantId: string;
    leadId: string;
    projectId: string;
    unitId?: string;
    assignedAgentId?: string;
    createdById?: string;
    startAt: Date;
    endAt?: Date;
    meetingPoint?: string;
    mapsUrl?: string;
    attendeeCount?: number;
    transportNote?: string;
    language?: string;
    confirmationChannel?: string;
  }) {
    const lead = await this.prisma.lead.findFirst({ where: { id: data.leadId, tenantId: data.tenantId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const project = await this.prisma.project.findFirst({ where: { id: data.projectId, tenantId: data.tenantId } });
    if (!project) throw new NotFoundException('Project not found');

    if (data.unitId) {
      const unit = await this.prisma.unit.findFirst({ where: { id: data.unitId, tenantId: data.tenantId } });
      if (!unit) throw new NotFoundException('Unit not found');
    }

    const visit = await this.prisma.siteVisit.create({
      data: {
        tenantId: data.tenantId,
        leadId: data.leadId,
        projectId: data.projectId,
        unitId: data.unitId,
        assignedAgentId: data.assignedAgentId,
        createdById: data.createdById,
        startAt: data.startAt,
        endAt: data.endAt || new Date(data.startAt.getTime() + 60 * 60000),
        meetingPoint: data.meetingPoint,
        mapsUrl: data.mapsUrl,
        attendeeCount: data.attendeeCount,
        transportNote: data.transportNote,
        language: data.language,
        confirmationChannel: data.confirmationChannel,
      },
    });

    try {
      await this.scheduleReminders(visit);
    } catch (e: any) {
      this.logger.warn(`Failed to schedule reminders for visit ${visit.id}: ${e.message}`);
    }

    await this.timeline.add({
      type: 'site_visit_scheduled',
      title: `Site visit scheduled for ${this.formatWhen(visit.startAt)}`,
      leadId: visit.leadId,
      metadata: { siteVisitId: visit.id, projectId: visit.projectId, unitId: visit.unitId },
      createdById: data.createdById,
    });
    await this.auditLogs.log('CREATE', 'SiteVisit', visit.id, data.createdById, { after: visit });

    try {
      await this.scheduleConfirmation(visit, data.createdById);
    } catch (e: any) {
      this.logger.warn(`Failed to schedule confirmation for visit ${visit.id}: ${e.message}`);
    }

    return visit;
  }

  async findAll(tenantId: string, query: {
    status?: string;
    projectId?: string;
    assignedAgentId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, projectId, assignedAgentId, from, to, page = 1, limit = 20 } = query;
    const where: any = { tenantId };
    if (status) where.status = status;
    if (projectId) where.projectId = projectId;
    if (assignedAgentId) where.assignedAgentId = assignedAgentId;
    if (from || to) {
      where.startAt = {};
      if (from) where.startAt.gte = new Date(from);
      if (to) where.startAt.lte = new Date(to);
    }

    const [data, total] = await Promise.all([
      this.prisma.siteVisit.findMany({
        where,
        skip: (+page - 1) * +limit,
        take: +limit,
        orderBy: { startAt: 'asc' },
        include: {
          lead: { select: { id: true, contact: { select: { name: true, phone: true } } } },
          project: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNumber: true } },
          assignedAgent: { select: { id: true, name: true } },
        },
      }),
      this.prisma.siteVisit.count({ where }),
    ]);

    return { data, meta: { total, page: +page, limit: +limit } };
  }

  async findOne(tenantId: string, id: string) {
    const visit = await this.prisma.siteVisit.findFirst({
      where: { id, tenantId },
      include: {
        lead: { select: { id: true, contact: { select: { name: true, phone: true } } } },
        project: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNumber: true } },
        assignedAgent: { select: { id: true, name: true } },
      },
    });
    if (!visit) throw new NotFoundException('Site visit not found');
    return visit;
  }

  async update(tenantId: string, id: string, data: any, actorId?: string) {
    const visit = await this.requireOpen(tenantId, id);
    const updated = await this.prisma.siteVisit.update({ where: { id: visit.id }, data });
    await this.auditLogs.log('UPDATE', 'SiteVisit', id, actorId, { before: visit, after: updated });
    return updated;
  }

  async confirm(tenantId: string, id: string, actorId?: string) {
    const visit = await this.requireOpen(tenantId, id);
    const updated = await this.prisma.siteVisit.update({
      where: { id: visit.id },
      data: { status: SiteVisitStatus.CONFIRMED, confirmationAt: new Date() },
    });
    await this.timeline.add({
      type: 'site_visit_confirmed',
      title: 'Site visit confirmed',
      leadId: visit.leadId,
      metadata: { siteVisitId: id },
      createdById: actorId,
    });
    await this.auditLogs.log('CONFIRM', 'SiteVisit', id, actorId, { before: visit, after: updated });
    return updated;
  }

  async checkIn(tenantId: string, id: string, actorId?: string, lat?: number, lng?: number) {
    const visit = await this.findOne(tenantId, id);
    if (!OPEN_STATUSES.includes(visit.status)) {
      throw new BadRequestException(`Cannot check in a visit in status ${visit.status}`);
    }
    const updated = await this.prisma.siteVisit.update({
      where: { id },
      data: { checkedInAt: new Date() },
    });
    await this.prisma.visitAttendance.create({
      data: {
        tenantId,
        siteVisitId: id,
        checkedInById: actorId,
        method: lat !== undefined && lng !== undefined ? 'GPS' : 'MANUAL',
        lat: lat ?? undefined,
        lng: lng ?? undefined,
      },
    });
    await this.timeline.add({
      type: 'site_visit_checked_in',
      title: 'Buyer checked in for site visit',
      leadId: visit.leadId,
      metadata: { siteVisitId: id, method: lat !== undefined ? 'GPS' : 'MANUAL' },
      createdById: actorId,
    });
    return updated;
  }

  async checkOut(tenantId: string, id: string, actorId?: string) {
    const visit = await this.findOne(tenantId, id);
    if (visit.status !== SiteVisitStatus.COMPLETED && !visit.checkedInAt) {
      throw new BadRequestException('Buyer must check in before checking out');
    }
    const updated = await this.prisma.siteVisit.update({
      where: { id },
      data: { checkedOutAt: new Date() },
    });
    await this.timeline.add({
      type: 'site_visit_checked_out',
      title: 'Buyer checked out from site visit',
      leadId: visit.leadId,
      metadata: { siteVisitId: id },
      createdById: actorId,
    });
    return updated;
  }

  /**
   * Completing a visit must create the next follow-up task before the outcome
   * form can close (spec 48.6) — a completed visit with no next action is a
   * dead end the salesperson will forget about.
   */
  async complete(tenantId: string, id: string, data: {
    outcome?: Record<string, unknown>;
    nextActionAt?: Date;
  }, actorId?: string) {
    const visit = await this.requireOpen(tenantId, id);

    const nextActionAt = data.nextActionAt || new Date(Date.now() + 24 * 60 * 60 * 1000);

    const updated = await this.prisma.$transaction(async (tx) => {
      const v = await tx.siteVisit.update({
        where: { id: visit.id },
        data: {
          status: SiteVisitStatus.COMPLETED,
          checkedOutAt: new Date(),
          outcome: (data.outcome || {}) as any,
          nextActionAt,
        },
      });
      await tx.task.create({
        data: {
          title: `Follow up after visit: ${visit.leadId}`,
          description: 'Post-visit follow-up created automatically when the visit was marked completed.',
          dueAt: nextActionAt,
          leadId: visit.leadId,
          assigneeId: visit.assignedAgentId || undefined,
          createdBy: actorId || 'system',
          source: 'site_visit_completed',
        },
      });
      return v;
    });

    await this.cancelReminders(id);
    try {
      await this.schedulePostVisitNurture(visit.id, visit.leadId, visit.assignedAgentId || actorId);
    } catch (e: any) {
      this.logger.warn(`Failed to schedule post-visit nurture for visit ${id}: ${e.message}`);
    }
    await this.timeline.add({
      type: 'site_visit_completed',
      title: 'Site visit completed',
      leadId: visit.leadId,
      metadata: { siteVisitId: id, outcome: data.outcome || {} },
      createdById: actorId,
    });
    await this.auditLogs.log('COMPLETE', 'SiteVisit', id, actorId, { before: visit, after: updated });
    return updated;
  }

  async markNoShow(tenantId: string, id: string, noShowReason?: string, actorId?: string) {
    const visit = await this.requireOpen(tenantId, id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const v = await tx.siteVisit.update({
        where: { id: visit.id },
        data: { status: SiteVisitStatus.NO_SHOW, noShowReason },
      });
      await tx.task.create({
        data: {
          title: `Recover no-show visit: ${visit.leadId}`,
          description: noShowReason || 'Buyer did not attend the scheduled site visit.',
          dueAt: new Date(),
          leadId: visit.leadId,
          assigneeId: visit.assignedAgentId || undefined,
          createdBy: actorId || 'system',
          source: 'site_visit_no_show',
        },
      });
      return v;
    });

    await this.cancelReminders(id);

    const base = Date.now();
    try {
      await this.automationScheduler.schedule(visit.leadId, 'no_show_recovery', new Date(base + 60 * 60 * 1000), { siteVisitId: id, step: 'we_missed_you', stepIndex: 1 });
    } catch (e: any) {
      this.logger.warn(`Failed to schedule no-show recovery +1h: ${e.message}`);
    }
    try {
      await this.automationScheduler.schedule(visit.leadId, 'no_show_recovery', new Date(base + 24 * 60 * 60 * 1000), { siteVisitId: id, step: 'reschedule_offer', stepIndex: 2 });
    } catch (e: any) {
      this.logger.warn(`Failed to schedule no-show recovery +24h: ${e.message}`);
    }
    try {
      await this.automationScheduler.schedule(visit.leadId, 'no_show_recovery', new Date(base + 72 * 60 * 60 * 1000), { siteVisitId: id, step: 'escalate_to_manager', stepIndex: 3 });
    } catch (e: any) {
      this.logger.warn(`Failed to schedule no-show recovery +72h: ${e.message}`);
    }

    await this.timeline.add({
      type: 'site_visit_no_show',
      title: 'Site visit no-show',
      leadId: visit.leadId,
      metadata: { siteVisitId: id, noShowReason },
      createdById: actorId,
    });
    await this.auditLogs.log('NO_SHOW', 'SiteVisit', id, actorId, { before: visit, reason: noShowReason });
    return updated;
  }

  async reschedule(tenantId: string, id: string, startAt: Date, endAt: Date | undefined, reason: string | undefined, actorId?: string) {
    const visit = await this.requireOpen(tenantId, id);
    const updated = await this.prisma.siteVisit.update({
      where: { id: visit.id },
      data: {
        status: SiteVisitStatus.RESCHEDULED,
        startAt,
        endAt: endAt || new Date(startAt.getTime() + 60 * 60000),
        rescheduleReason: reason,
        confirmationAt: null,
      },
    });
    // A reschedule is really "still scheduled" going forward — flip it back so
    // it shows up in the active queues and gets fresh reminders.
    const active = await this.prisma.siteVisit.update({
      where: { id: visit.id },
      data: { status: SiteVisitStatus.SCHEDULED },
    });

    await this.cancelReminders(id);
    try {
      await this.scheduleReminders(active);
    } catch (e: any) {
      this.logger.warn(`Failed to reschedule reminders for visit ${id}: ${e.message}`);
    }

    await this.timeline.add({
      type: 'site_visit_rescheduled',
      title: `Site visit rescheduled to ${this.formatWhen(startAt)}`,
      leadId: visit.leadId,
      metadata: { siteVisitId: id, reason },
      createdById: actorId,
    });
    await this.auditLogs.log('RESCHEDULE', 'SiteVisit', id, actorId, { before: visit, after: active });
    return active;
  }

  async cancel(tenantId: string, id: string, reason: string | undefined, actorId?: string) {
    const visit = await this.requireOpen(tenantId, id);
    const updated = await this.prisma.siteVisit.update({
      where: { id: visit.id },
      data: { status: SiteVisitStatus.CANCELLED, rescheduleReason: reason },
    });
    await this.cancelReminders(id);
    await this.timeline.add({
      type: 'site_visit_cancelled',
      title: 'Site visit cancelled',
      leadId: visit.leadId,
      metadata: { siteVisitId: id, reason },
      createdById: actorId,
    });
    await this.auditLogs.log('CANCEL', 'SiteVisit', id, actorId, { before: visit, reason });
    return updated;
  }

  /**
   * Heartbeat scan (mirrors BookingLifecycleService.scanNoShows): mark visits
   * past their end time + grace as NO_SHOW and queue a reschedule nudge.
   */
  async scanNoShows(): Promise<number> {
    const cutoff = new Date(Date.now() - NO_SHOW_GRACE_MS);
    const overdue = await this.prisma.siteVisit.findMany({
      where: { status: { in: OPEN_STATUSES }, endAt: { lt: cutoff } },
      take: 50,
      select: { id: true, tenantId: true, leadId: true },
    });

    let marked = 0;
    for (const v of overdue) {
      const claim = await this.prisma.siteVisit.updateMany({
        where: { id: v.id, status: { in: OPEN_STATUSES } },
        data: { status: SiteVisitStatus.NO_SHOW },
      });
      if (claim.count === 0) continue;
      await this.cancelReminders(v.id);
      await this.timeline.add({
        type: 'site_visit_no_show',
        title: 'Site visit no-show (auto-detected)',
        leadId: v.leadId,
        metadata: { siteVisitId: v.id },
      });
      marked++;
    }
    if (marked > 0) this.logger.log(`Site-visit no-show scan: marked ${marked} visit(s)`);
    return marked;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async leadFirstName(leadId: string): Promise<string> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { contact: { select: { name: true } } },
    });
    const full = lead?.contact?.name?.trim();
    if (!full) return 'there';
    return full.split(/\s+/)[0];
  }

  private async scheduleConfirmation(visit: { id: string; leadId: string; startAt: Date; projectId: string }, actorId?: string) {
    const name = await this.leadFirstName(visit.leadId);
    const when = this.formatWhen(visit.startAt);
    const project = await this.prisma.project.findUnique({ where: { id: visit.projectId }, select: { name: true } });
    const text = `Hi ${name}, your site visit at ${project?.name || 'the project'} is confirmed for ${when}. We look forward to showing you around! Reply here if you need any help.`;
    // revive:true — a rescheduled visit re-arms its confirmation.
    await this.followUps.schedule({
      leadId: visit.leadId,
      kind: 'site_visit_reminder',
      runAt: new Date(Date.now() + 5000),
      dedupeKey: `sv_conf:${visit.id}`,
      payload: { siteVisitId: visit.id, channel: 'WHATSAPP', text },
      revive: true,
    });
  }

  private async schedulePostVisitNurture(visitId: string, leadId: string, actorId?: string) {
    const name = await this.leadFirstName(leadId);
    const steps: { offsetMs: number; suffix: string; text: string }[] = [
      { offsetMs: 4 * 60 * 60 * 1000, suffix: 'evening', text: `Hi ${name}, thanks for visiting today! Which part of the property felt most like home? Happy to answer any questions that came up.` },
      { offsetMs: 2 * 24 * 60 * 60 * 1000, suffix: 'day2', text: `Hi ${name}, just checking in after your visit. If it helps, I can share the pricing, floor plan, or nearby options so you can compare with confidence.` },
      { offsetMs: 4 * 24 * 60 * 60 * 1000, suffix: 'day4', text: `Hi ${name}, a couple of similar options just opened up that match what you liked. Want me to send them across?` },
      { offsetMs: 7 * 24 * 60 * 60 * 1000, suffix: 'day7', text: `Hi ${name}, no pressure at all — just wanted to keep the door open. Whenever you're ready to take the next step, I'm here to help.` },
    ];
    const base = Date.now();
    for (const s of steps) {
      await this.followUps.schedule({
        leadId,
        kind: 'post_visit_followup',
        runAt: new Date(base + s.offsetMs),
        dedupeKey: `pv_nurture:${visitId}:${s.suffix}`,
        payload: { siteVisitId: visitId, channel: 'WHATSAPP', text: s.text },
        revive: true,
      });
    }
  }

  private async requireOpen(tenantId: string, id: string) {
    const visit = await this.findOne(tenantId, id);
    if (!OPEN_STATUSES.includes(visit.status)) {
      throw new ForbiddenException(`Visit ${id} is ${visit.status} and can no longer be modified this way`);
    }
    return visit;
  }

  private async scheduleReminders(visit: { id: string; leadId: string; startAt: Date }) {
    const now = Date.now();
    const offsets: { ms: number; suffix: string }[] = [
      { ms: 24 * 60 * 60 * 1000, suffix: '24h' },
      { ms: 2 * 60 * 60 * 1000, suffix: '2h' },
    ];
    for (const o of offsets) {
      const runAt = new Date(visit.startAt.getTime() - o.ms);
      if (runAt.getTime() <= now) continue;
      await this.followUps.schedule({
        leadId: visit.leadId,
        kind: 'site_visit_reminder',
        runAt,
        dedupeKey: `sitevisit_reminder:${visit.id}:${o.suffix}`,
        payload: { siteVisitId: visit.id, channel: 'WHATSAPP' },
        revive: true,
      });
    }
  }

  private async cancelReminders(visitId: string) {
    const prefixes = [`sitevisit_reminder:${visitId}:`, `sv_conf:${visitId}`, `pv_nurture:${visitId}:`];
    for (const p of prefixes) {
      await this.prisma.scheduledAction.updateMany({
        where: { status: 'pending', dedupeKey: { startsWith: p } },
        data: { status: 'cancelled' },
      });
    }
  }

  private formatWhen(dt: Date): string {
    try {
      return dt.toLocaleString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: 'numeric', minute: '2-digit', hour12: true,
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      return dt.toISOString();
    }
  }
}
