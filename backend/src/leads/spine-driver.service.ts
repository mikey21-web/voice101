import { Injectable, Logger } from '@nestjs/common';
import { LeadStatus } from '@prisma/client';
import { AdvanceStageService } from './advance-stage.service';

/**
 * Section 2's rule: "Mikey operates the spine. It does not watch it."
 *
 * Stages 0 to 4 were already Mikey-driven. Stages 5 to 10 were not: a lead
 * only reached BOOKED or REGISTERED because a person opened the dashboard and
 * changed a dropdown. The tools existed, but nothing made Mikey the driver.
 *
 * This closes that. Every lifecycle service already writes a timeline entry
 * when a real business fact happens — a cost sheet goes out, a visit is
 * booked, a bank sanctions a loan. That is the single chokepoint they all
 * share, so the mapping lives here once rather than being repeated as a
 * status write in six services.
 *
 * The lead's stage is therefore a consequence of what actually happened,
 * never of someone remembering to update it.
 */
@Injectable()
export class SpineDriverService {
  private readonly logger = new Logger(SpineDriverService.name);

  /** Timeline event -> the stage that fact proves the lead has reached. */
  private static readonly EVENT_STAGE: Record<string, LeadStatus> = {
    // Stage 5, MATCH: a priced unit has gone to the buyer.
    cost_sheet_created: 'PROPOSAL_SENT',
    cost_sheet_sent: 'PROPOSAL_SENT',
    unit_hold_created: 'PROPOSAL_SENT',
    // Stage 6, SITE_VISIT.
    site_visit_scheduled: 'APPOINTMENT_BOOKED',
    site_visit_confirmed: 'APPOINTMENT_BOOKED',
    // Stage 8, BOOKING. Money has changed hands.
    booking_confirmed: 'BOOKED',
    // Stage 10, POST_SALE.
    handed_over: 'POSSESSION',
  };

  /** Post-sales runs its own stage machine; these are the points that move the lead. */
  private static readonly POST_SALES_STAGE: Record<string, LeadStatus> = {
    AGREEMENT_IN_PROGRESS: 'AGREEMENT',
    AGREEMENT_REGISTERED: 'REGISTERED',
    PAYMENT_ACTIVE: 'LOAN_PROCESSING',
    HANDED_OVER: 'POSSESSION',
  };

  constructor(private advanceStage: AdvanceStageService) {}

  /**
   * Called from TimelineService.add for every lifecycle fact.
   *
   * Never throws: a stage that cannot advance must not take down the booking
   * or site visit that triggered it. Backward moves are already rejected by
   * advanceStage, so an out-of-order event is a no-op rather than a
   * corruption.
   */
  async onLifecycleEvent(entry: {
    type: string;
    leadId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!entry.leadId) return;

    const to = this.stageFor(entry);
    if (!to) return;

    try {
      const lead = await this.advanceStage.getLead(entry.leadId);
      if (!lead) return;

      await this.advanceStage.advanceStage({
        tenantId: lead.tenantId,
        leadId: entry.leadId,
        to,
        actor: 'mikey',
        reason: `${entry.type} observed`,
      });
      this.logger.log(`Mikey advanced lead ${entry.leadId} to ${to} on ${entry.type}`);
    } catch (err: any) {
      // An illegal (backward or same-stage) transition is the normal case for
      // repeat events, so it is logged at debug rather than as a failure.
      this.logger.debug(`No stage advance for ${entry.type} on ${entry.leadId}: ${err.message}`);
    }
  }

  private stageFor(entry: { type: string; metadata?: Record<string, unknown> }): LeadStatus | null {
    const direct = SpineDriverService.EVENT_STAGE[entry.type];
    if (direct) return direct;

    if (entry.type === 'post_sales_stage_changed') {
      const toStage = String(entry.metadata?.toStage ?? '');
      return SpineDriverService.POST_SALES_STAGE[toStage] ?? null;
    }
    return null;
  }
}
