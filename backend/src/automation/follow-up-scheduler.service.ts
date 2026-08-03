import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SpineStage } from '../leads/spine-stage';

/**
 * Every kind the one poller (`followup-processor.service.ts`) knows how to run.
 * Scheduling a kind that is not in this list creates a row nothing will ever
 * pick up, which is why callers should not pass raw strings.
 */
export const FOLLOWUP_KINDS = [
  'followup', 're_engage', 'send_retry', 'site_visit_reminder', 'post_visit_followup',
  'payment_reminder', 'notification', 'cost_sheet_followup', 'cost_sheet_followup_2',
  'cost_sheet_escalation', 'no_show_recovery', 'booking_token_reminder',
  'booking_hold_warning', 'payment_escalation',
] as const;
export type FollowupKind = (typeof FOLLOWUP_KINDS)[number];

/** Which spine stage each kind belongs to, so a stage can ask what it owns. */
export const KIND_STAGE: Record<FollowupKind, SpineStage> = {
  followup: 'QUALIFY',
  re_engage: 'QUALIFY',
  send_retry: 'ENGAGE',
  notification: 'ENGAGE',
  site_visit_reminder: 'SITE_VISIT',
  post_visit_followup: 'SITE_VISIT',
  no_show_recovery: 'SITE_VISIT',
  cost_sheet_followup: 'MATCH',
  cost_sheet_followup_2: 'MATCH',
  cost_sheet_escalation: 'MATCH',
  booking_token_reminder: 'BOOKING',
  booking_hold_warning: 'BOOKING',
  payment_reminder: 'MONEY_TRAIL',
  payment_escalation: 'MONEY_TRAIL',
};

/**
 * Phase 8. One way to put work on the clock.
 *
 * The clock itself was never the problem: `ScheduledAction` is already a single
 * table with a single poller. What was duplicated is the *calling* — five
 * services each hand-rolling a `kind` string and a `dedupeKey` format, with
 * nothing stopping a typo from scheduling work no poller runs.
 *
 * Existing dedupeKey formats are preserved exactly, so callers can move over
 * one at a time with no data migration and no double-sends to in-flight rows.
 */
@Injectable()
export class FollowUpSchedulerService {
  private readonly logger = new Logger(FollowUpSchedulerService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Schedule (or reschedule) one follow-up. Idempotent on dedupeKey: calling
   * twice moves the existing row rather than sending the lead two messages.
   */
  async schedule(params: {
    leadId: string;
    kind: FollowupKind;
    runAt: Date;
    dedupeKey: string;
    payload?: Record<string, unknown>;
    /**
     * Put a superseded or finished row back into `pending`.
     *
     * Off by default, because reviving a row the poller may already have
     * claimed can send the same nudge twice. Callers that legitimately need it
     * — rescheduling a site visit, re-arming a booking reminder after the date
     * moves — pass it explicitly so the risk is visible at the call site.
     */
    revive?: boolean;
  }): Promise<void> {
    const { leadId, kind, runAt, dedupeKey } = params;
    const payload = (params.payload ?? {}) as any;

    try {
      await this.prisma.scheduledAction.upsert({
        where: { dedupeKey },
        create: { leadId, kind, runAt, dedupeKey, payload, status: 'pending' },
        update: params.revive ? { runAt, payload, status: 'pending' } : { runAt, payload },
      });
    } catch (err: any) {
      // A follow-up that fails to schedule must never take down the booking or
      // site visit that triggered it.
      this.logger.error(`Failed to schedule ${kind} for lead ${leadId}: ${err.message}`);
    }
  }

  /** Cancel pending work, e.g. the lead replied so the chase is moot. */
  async cancel(dedupeKey: string): Promise<void> {
    await this.prisma.scheduledAction.updateMany({
      where: { dedupeKey, status: 'pending' },
      data: { status: 'cancelled' },
    });
  }

  /** Cancel everything still pending for a lead, e.g. on escalation or LOST. */
  async cancelAllForLead(leadId: string, kinds?: FollowupKind[]): Promise<number> {
    const res = await this.prisma.scheduledAction.updateMany({
      where: {
        leadId,
        status: 'pending',
        ...(kinds ? { kind: { in: kinds as unknown as string[] } } : {}),
      },
      data: { status: 'cancelled' },
    });
    return res.count;
  }

  /** What is still queued for one lead. */
  async pendingForLead(leadId: string) {
    return this.prisma.scheduledAction.findMany({
      where: { leadId, status: 'pending' },
      orderBy: { runAt: 'asc' },
    });
  }

  /** Everything queued for one spine stage, so a stage can see its own clock. */
  async pendingForStage(stage: SpineStage) {
    const kinds = (Object.keys(KIND_STAGE) as FollowupKind[]).filter((k) => KIND_STAGE[k] === stage);
    if (kinds.length === 0) return [];
    return this.prisma.scheduledAction.findMany({
      where: { status: 'pending', kind: { in: kinds as unknown as string[] } },
      orderBy: { runAt: 'asc' },
    });
  }
}
