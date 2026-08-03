import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus } from '@prisma/client';
import { FollowUpSchedulerService, FollowupKind } from '../automation/follow-up-scheduler.service';

/**
 * BookingLifecycleService
 *
 * Drives the site-visit / appointment lifecycle on top of the existing
 * ScheduledAction primitive (durable, atomic-claim, dedupe-keyed) that the
 * FollowupProcessorService already drains and sends over WhatsApp/Telegram/Email.
 *
 * It only ever writes ScheduledAction rows + booking status — it never sends a
 * message itself. The followup processor picks up the new `kind`s and dispatches.
 *
 *   site_visit_reminder  → 24h + 2h before the visit, plus the no-show reschedule nudge
 *   post_visit_followup  → same-evening, day-2, day-4, day-7 nurture cadence
 *
 * Research basis: a buyer who visits is 4-8x more likely to book, ~40% drop off
 * from disorganised scheduling, and two automated reminders cut no-shows ~40%.
 */
@Injectable()
export class BookingLifecycleService {
  private readonly logger = new Logger(BookingLifecycleService.name);

  // How long past the visit end time before we treat it as a no-show.
  private readonly NO_SHOW_GRACE_MS = 30 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private followUps: FollowUpSchedulerService,
  ) {}

  // ── Scheduling ────────────────────────────────────────────────────────────

  /** Schedule 24h + 2h reminders for an upcoming site visit. Idempotent. */
  async scheduleSiteVisitReminders(booking: {
    id: string;
    leadId: string;
    title: string;
    startTime: Date;
    propertyId?: string | null;
  }): Promise<void> {
    const name = await this.leadFirstName(booking.leadId);
    const when = this.formatWhen(booking.startTime);
    const label = booking.title || 'your site visit';

    const reminders: { offsetMs: number; suffix: string; text: string }[] = [
      {
        offsetMs: 24 * 60 * 60 * 1000,
        suffix: '24h',
        text: `Hi ${name}, a reminder that ${label} is scheduled for ${when}. Reply CONFIRM to keep it, or RESCHEDULE if another time works better.`,
      },
      {
        offsetMs: 2 * 60 * 60 * 1000,
        suffix: '2h',
        text: `Hi ${name}, ${label} is coming up at ${when}. We're looking forward to seeing you — reply here if you're running late.`,
      },
    ];

    const now = Date.now();
    for (const r of reminders) {
      const runAt = new Date(booking.startTime.getTime() - r.offsetMs);
      // Only schedule reminders that land in the future.
      if (runAt.getTime() <= now) continue;
      await this.upsertAction({
        leadId: booking.leadId,
        kind: 'site_visit_reminder',
        runAt,
        dedupeKey: `sv_reminder:${booking.id}:${r.suffix}`,
        payload: { bookingId: booking.id, channel: 'WHATSAPP', text: r.text },
      });
    }
    this.logger.log(`Scheduled site-visit reminders for booking ${booking.id}`);
  }

  /** Schedule the post-visit nurture cadence once a visit is completed. Idempotent. */
  async schedulePostVisitFollowups(booking: {
    id: string;
    leadId: string;
    title: string;
  }): Promise<void> {
    const name = await this.leadFirstName(booking.leadId);
    const label = booking.title || 'the property';

    const steps: { offsetMs: number; suffix: string; text: string }[] = [
      {
        offsetMs: 4 * 60 * 60 * 1000,
        suffix: 'evening',
        text: `Hi ${name}, thanks for visiting today! Which part of ${label} felt most like home? Happy to answer any questions that came up.`,
      },
      {
        offsetMs: 2 * 24 * 60 * 60 * 1000,
        suffix: 'day2',
        text: `Hi ${name}, just checking in after your visit. If it helps, I can share the pricing, floor plan, or nearby options so you can compare with confidence.`,
      },
      {
        offsetMs: 4 * 24 * 60 * 60 * 1000,
        suffix: 'day4',
        text: `Hi ${name}, a couple of similar options just opened up that match what you liked. Want me to send them across?`,
      },
      {
        offsetMs: 7 * 24 * 60 * 60 * 1000,
        suffix: 'day7',
        text: `Hi ${name}, no pressure at all — just wanted to keep the door open. Whenever you're ready to take the next step, I'm here to help.`,
      },
    ];

    const base = Date.now();
    for (const s of steps) {
      await this.upsertAction({
        leadId: booking.leadId,
        kind: 'post_visit_followup',
        runAt: new Date(base + s.offsetMs),
        dedupeKey: `pv_followup:${booking.id}:${s.suffix}`,
        payload: { bookingId: booking.id, channel: 'WHATSAPP', text: s.text },
      });
    }
    this.logger.log(`Scheduled post-visit follow-ups for booking ${booking.id}`);
  }

  /** Cancel any pending lifecycle actions for a booking (on cancel / reschedule). */
  async cancelBookingActions(bookingId: string, prefixes: string[] = ['sv_reminder', 'pv_followup', 'sv_noshow']): Promise<void> {
    for (const prefix of prefixes) {
      await this.prisma.scheduledAction.updateMany({
        where: {
          status: 'pending',
          dedupeKey: { startsWith: `${prefix}:${bookingId}:` },
        },
        data: { status: 'cancelled' },
      });
    }
  }

  // ── Payment schedule reminders ─────────────────────────────────────────────

  /** Schedule "3 days before" + "on due date" reminders for a payment milestone. */
  async schedulePaymentReminders(ps: {
    id: string;
    leadId: string;
    label: string;
    amount: number;
    currency: string;
    dueDate: Date | null;
  }): Promise<void> {
    if (!ps.dueDate) return;
    const name = await this.leadFirstName(ps.leadId);
    const amountStr = this.formatMoney(ps.amount, ps.currency);
    const dueStr = this.formatDate(ps.dueDate);
    const now = Date.now();

    const reminders: { runAt: Date; suffix: string; text: string }[] = [
      {
        runAt: new Date(ps.dueDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        suffix: 'due7d',
        text: `Hi ${name}, this is a heads-up that your ${ps.label} payment of ${amountStr} is due on ${dueStr}. Let me know if you need any assistance.`,
      },
      {
        runAt: new Date(ps.dueDate.getTime() - 3 * 24 * 60 * 60 * 1000),
        suffix: 'due3d',
        text: `Hi ${name}, a friendly reminder that your ${ps.label} payment of ${amountStr} is due on ${dueStr}. Let me know if you'd like the payment details or any help.`,
      },
      {
        runAt: ps.dueDate,
        suffix: 'due',
        text: `Hi ${name}, your ${ps.label} payment of ${amountStr} is due today (${dueStr}). Reply here and I'll share the payment options right away.`,
      },
    ];

    for (const r of reminders) {
      if (r.runAt.getTime() <= now) continue;
      await this.upsertAction({
        leadId: ps.leadId,
        kind: 'payment_reminder',
        runAt: r.runAt,
        dedupeKey: `pay_reminder:${ps.id}:${r.suffix}`,
        payload: { paymentScheduleId: ps.id, channel: 'WHATSAPP', text: r.text },
      });
    }
    this.logger.log(`Scheduled payment reminders for schedule ${ps.id}`);
  }

  /** Cancel pending reminders for a payment milestone (on paid / waived / delete). */
  async cancelPaymentReminders(paymentScheduleId: string): Promise<void> {
    await this.prisma.scheduledAction.updateMany({
      where: { status: 'pending', dedupeKey: { startsWith: `pay_reminder:${paymentScheduleId}:` } },
      data: { status: 'cancelled' },
    });
  }

  // ── Booking token follow-up ──────────────────────────────────────────────────

  async scheduleBookingTokenFollowups(booking: {
    id: string;
    leadId: string;
    status: string;
    title: string;
  }): Promise<void> {
    if (booking.status !== 'PENDING') return;

    const name = await this.leadFirstName(booking.leadId);
    const base = Date.now();

    await this.upsertAction({
      leadId: booking.leadId,
      kind: 'booking_token_reminder',
      runAt: new Date(base + 24 * 60 * 60 * 1000),
      dedupeKey: `booking_token:${booking.id}:24h`,
      payload: {
        bookingId: booking.id,
        channel: 'WHATSAPP',
        text: `Hi ${name}, a reminder to complete your token payment for ${booking.title}. Your booking is confirmed once the payment is received.`,
      },
    });

    await this.upsertAction({
      leadId: booking.leadId,
      kind: 'booking_token_reminder',
      runAt: new Date(base + 72 * 60 * 60 * 1000),
      dedupeKey: `booking_token:${booking.id}:72h`,
      payload: {
        bookingId: booking.id,
        channel: 'WHATSAPP',
        text: `Hi ${name}, we're still holding your slot for ${booking.title}. Please complete the token payment at your earliest convenience to confirm the booking.`,
      },
    });

    const holdExists = await this.prisma.unitHold.findFirst({
      where: { leadId: booking.leadId, status: 'ACTIVE' },
    });
    if (holdExists) {
      await this.upsertAction({
        leadId: booking.leadId,
        kind: 'booking_hold_warning',
        runAt: new Date(base + 7 * 24 * 60 * 60 * 1000),
        dedupeKey: `booking_hold:${booking.id}:7d`,
        payload: {
          bookingId: booking.id,
          channel: 'WHATSAPP',
          text: `Hi ${name}, the unit hold for ${booking.title} will be released if the token payment is not completed within the next 3 days. Please get in touch to arrange payment.`,
        },
      });
    }

    const lead = await this.prisma.lead.findUnique({
      where: { id: booking.leadId },
      select: { assignedAgentId: true, contact: { select: { name: true } } },
    });
    if (lead?.assignedAgentId) {
      await this.prisma.task.create({
        data: {
          title: `Follow up on token payment for ${lead.contact?.name || booking.leadId}`,
          description: `Token payment follow-up for booking ${booking.id}. Payment link sent on ${new Date().toISOString().slice(0, 10)}.`,
          priority: 'high',
          leadId: booking.leadId,
          assigneeId: lead.assignedAgentId,
          dueAt: new Date(base + 24 * 60 * 60 * 1000),
          createdBy: 'system',
          source: 'booking_token_followup',
        },
      });
    }

    this.logger.log(`Scheduled token payment follow-ups for booking ${booking.id}`);
  }

  /**
   * Mark overdue payment milestones and queue an overdue nudge. Called on the
   * Mikey heartbeat alongside no-show detection. Recovers the ~30% of buyers who
   * delay payments simply because nobody reminded them.
   */
  async scanOverduePayments(): Promise<number> {
    const now = new Date();
    const overdue = await this.prisma.paymentSchedule.findMany({
      where: { status: 'PENDING', dueDate: { lt: now } },
      take: 50,
      select: { id: true, leadId: true, label: true, amount: true, currency: true, dueDate: true },
    });

    let marked = 0;
    for (const p of overdue) {
      const claim = await this.prisma.paymentSchedule.updateMany({
        where: { id: p.id, status: 'PENDING' },
        data: { status: 'OVERDUE' },
      });
      if (claim.count === 0) continue;

      const name = await this.leadFirstName(p.leadId);
      const amountStr = this.formatMoney(p.amount, p.currency);
      await this.upsertAction({
        leadId: p.leadId,
        kind: 'payment_reminder',
        runAt: new Date(),
        dedupeKey: `pay_overdue:${p.id}:nudge`,
        payload: {
          paymentScheduleId: p.id,
          channel: 'WHATSAPP',
          text: `Hi ${name}, just a gentle nudge that your ${p.label} payment of ${amountStr} is now past its due date. If there's anything holding it up, let me know — happy to help sort it out.`,
        },
      });

      if (p.dueDate) {
        const dueTs = p.dueDate.getTime();
        await this.upsertAction({
          leadId: p.leadId,
          kind: 'payment_escalation',
          runAt: new Date(dueTs + 4 * 24 * 60 * 60 * 1000),
          dedupeKey: `pay_escalation:${p.id}:task`,
          payload: { paymentScheduleId: p.id, stage: 'agent_task', label: p.label, amount: p.amount, currency: p.currency },
        });
        await this.upsertAction({
          leadId: p.leadId,
          kind: 'payment_escalation',
          runAt: new Date(dueTs + 8 * 24 * 60 * 60 * 1000),
          dedupeKey: `pay_escalation:${p.id}:manager`,
          payload: { paymentScheduleId: p.id, stage: 'manager_notify', label: p.label, amount: p.amount, currency: p.currency },
        });
        await this.upsertAction({
          leadId: p.leadId,
          kind: 'payment_escalation',
          runAt: new Date(dueTs + 14 * 24 * 60 * 60 * 1000),
          dedupeKey: `pay_escalation:${p.id}:collections`,
          payload: { paymentScheduleId: p.id, stage: 'collections', label: p.label, amount: p.amount, currency: p.currency },
        });
      }

      marked++;
    }

    if (marked > 0) this.logger.log(`Overdue-payment scan: flagged ${marked} milestone(s) and queued nudges`);
    return marked;
  }

  // ── No-show detection ──────────────────────────────────────────────────────

  /**
   * Find visits that are past their end time + grace and were never completed,
   * mark them NO_SHOW, and queue a friendly reschedule nudge. Meant to be called
   * on a periodic heartbeat (the Mikey scheduler runs every 5 min).
   */
  async scanNoShows(): Promise<number> {
    const cutoff = new Date(Date.now() - this.NO_SHOW_GRACE_MS);

    const overdue = await this.prisma.booking.findMany({
      where: {
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        endTime: { lt: cutoff },
      },
      take: 50,
      select: { id: true, leadId: true, title: true },
    });

    let marked = 0;
    for (const b of overdue) {
      // Atomic transition so two heartbeats can't double-process the same booking.
      const claim = await this.prisma.booking.updateMany({
        where: { id: b.id, status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] } },
        data: { status: BookingStatus.NO_SHOW },
      });
      if (claim.count === 0) continue;

      // Cancel any still-pending reminders for this now-past visit.
      await this.cancelBookingActions(b.id, ['sv_reminder']);

      const name = await this.leadFirstName(b.leadId);
      await this.upsertAction({
        leadId: b.leadId,
        kind: 'site_visit_reminder',
        runAt: new Date(),
        dedupeKey: `sv_noshow:${b.id}:reschedule`,
        payload: {
          bookingId: b.id,
          channel: 'WHATSAPP',
          text: `Hi ${name}, we missed you at ${b.title || 'your site visit'} today — no worries at all! Would you like to reschedule? Just reply with a day and time that suits you.`,
        },
      });
      marked++;
    }

    if (marked > 0) this.logger.log(`No-show scan: marked ${marked} booking(s) NO_SHOW and queued reschedule nudges`);
    return marked;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Create a ScheduledAction, or revive/replace a superseded one with the same dedupe key. */
  private async upsertAction(a: {
    leadId: string;
    kind: string;
    runAt: Date;
    dedupeKey: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    try {
      // Phase 8: one typed API over the shared clock. revive:true keeps the
      // original behaviour here, where a booking whose date moves re-arms its
      // reminder rather than staying superseded.
      await this.followUps.schedule({
        leadId: a.leadId,
        kind: a.kind as FollowupKind,
        runAt: a.runAt,
        dedupeKey: a.dedupeKey,
        payload: a.payload,
        revive: true,
      });
    } catch (e: any) {
      this.logger.warn(`Failed to upsert scheduled action ${a.dedupeKey}: ${e.message}`);
    }
  }

  private async leadFirstName(leadId: string): Promise<string> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { contact: { select: { name: true } } },
    });
    const full = lead?.contact?.name?.trim();
    if (!full) return 'there';
    return full.split(/\s+/)[0];
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

  private formatDate(dt: Date): string {
    try {
      return dt.toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      return dt.toISOString().slice(0, 10);
    }
  }

  private formatMoney(amount: number, currency: string): string {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${currency} ${amount}`;
    }
  }
}
