import { Injectable, Logger } from '@nestjs/common';
import { EscalationTrigger } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Deal value above this (in the lead's own currency units) always wants a human. */
const DEFAULT_DEAL_VALUE_THRESHOLD = 10_000_000; // 1 crore
/** Below this the model is guessing, so stop guessing at a buyer. */
const DEFAULT_CONFIDENCE_FLOOR = 0.55;

/**
 * Phase 5. The `escalate` tool already existed on the lead agent, but firing it
 * was left to model judgement. These triggers are deterministic: they do not
 * ask an LLM whether this is serious.
 *
 * Raising an escalation pauses Mikey for that one lead (an unresolved row is
 * the pause) and pages the owning rep. Every raise is logged with its trigger,
 * which is the training data the coach in Phase 7 learns from.
 */
@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    private prisma: PrismaService,
    private events: EventsService,
    private notifications: NotificationsService,
  ) {}

  async raise(params: {
    tenantId: string;
    leadId: string;
    trigger: EscalationTrigger;
    detail: string;
    conversationId?: string;
  }): Promise<{ escalationId: string; alreadyPaused: boolean }> {
    const { tenantId, leadId, trigger, detail } = params;

    // One open escalation per lead is enough. A second trigger firing while a
    // rep is already on their way would page them twice for the same buyer.
    const open = await this.prisma.leadEscalation.findFirst({
      where: { tenantId, leadId, resolvedAt: null },
    });
    if (open) {
      this.logger.debug(`Lead ${leadId} already escalated (${open.trigger}); not raising ${trigger}`);
      return { escalationId: open.id, alreadyPaused: true };
    }

    const escalation = await this.prisma.leadEscalation.create({
      data: { tenantId, leadId, trigger, detail },
    });

    // A human is taking this lead. Automated nudges arriving on top of that
    // read as the company not talking to itself, so stop the clock too — the
    // autonomy gate alone would not stop work already queued.
    const cancelled = await this.prisma.scheduledAction.updateMany({
      where: { leadId, status: 'pending' },
      data: { status: 'cancelled' },
    });
    if (cancelled.count > 0) {
      this.logger.log(`Escalation on ${leadId} cancelled ${cancelled.count} queued follow-up(s)`);
    }

    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { contact: true, assignedAgent: true },
    });

    if (lead?.assignedAgentId) {
      await this.notifications
        .create({
          tenantId,
          userId: lead.assignedAgentId,
          // Already in SMS_NOTIFICATION_TYPES, so this reaches the rep as a
          // real text. An in-app row they open tomorrow is not an escalation.
          type: 'call_wants_human',
          title: `${lead.contact?.name || 'A lead'} needs a person`,
          body: `${this.describe(trigger)}: ${detail}`,
          whatsappTo: lead.assignedAgent?.phone || undefined,
        })
        .catch((e) => this.logger.error(`Escalation notify failed for ${leadId}: ${e.message}`));
    } else {
      this.logger.warn(`Lead ${leadId} escalated with no assigned agent — nobody was paged`);
    }

    await this.events.emit({
      type: 'lead.escalated',
      source: 'mikey',
      entityType: 'lead',
      entityId: leadId,
      leadId,
      payload: { trigger, detail, conversationId: params.conversationId },
      metadata: { tenantId },
    });

    return { escalationId: escalation.id, alreadyPaused: false };
  }

  /** The per-lead pause. Every autonomous path checks this before acting. */
  async isPaused(tenantId: string, leadId: string): Promise<boolean> {
    const open = await this.prisma.leadEscalation.findFirst({
      where: { tenantId, leadId, resolvedAt: null },
      select: { id: true },
    });
    return !!open;
  }

  async resolve(tenantId: string, escalationId: string, resolvedById: string): Promise<void> {
    await this.prisma.leadEscalation.updateMany({
      where: { id: escalationId, tenantId, resolvedAt: null },
      data: { resolvedAt: new Date(), resolvedById },
    });
  }

  async listOpen(tenantId: string) {
    return this.prisma.leadEscalation.findMany({
      where: { tenantId, resolvedAt: null },
      include: { lead: { include: { contact: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Deterministic checks over one turn of a conversation. Returns the trigger
   * that fired, or null. Kept free of LLM calls on purpose: this decides
   * whether a human is needed, so it must not depend on the thing that might
   * be failing.
   */
  detectTrigger(input: {
    text?: string;
    sentiment?: string | null;
    confidence?: number | null;
    dealValue?: number | null;
    dealValueThreshold?: number;
    confidenceFloor?: number;
  }): { trigger: EscalationTrigger; detail: string } | null {
    const text = (input.text || '').toLowerCase();
    const threshold = input.dealValueThreshold ?? DEFAULT_DEAL_VALUE_THRESHOLD;
    const floor = input.confidenceFloor ?? DEFAULT_CONFIDENCE_FLOOR;

    if (/\b(talk|speak|connect)\b.{0,20}\b(human|person|someone|agent|manager|sales)\b/.test(text)
      || /\breal person\b/.test(text)) {
      return { trigger: 'LEAD_REQUESTED_HUMAN', detail: 'Lead asked to speak to a person' };
    }

    if (/\b(lawyer|legal|rera|court|agreement clause|sue|refund policy)\b/.test(text)) {
      return { trigger: 'LEGAL_OR_COMMITMENT', detail: 'Legal or commitment question raised' };
    }

    if (/\b(discount|negotiat|best price|lowest|reduce the price|final price|bargain)\b/.test(text)) {
      return { trigger: 'PRICE_NEGOTIATION', detail: 'Buyer opened a price negotiation' };
    }

    if (input.sentiment && ['negative', 'angry', 'frustrated'].includes(input.sentiment.toLowerCase())) {
      return { trigger: 'NEGATIVE_SENTIMENT', detail: `Sentiment read as ${input.sentiment}` };
    }

    if (typeof input.dealValue === 'number' && input.dealValue >= threshold) {
      return {
        trigger: 'DEAL_VALUE_OVER_THRESHOLD',
        detail: `Deal value ${input.dealValue} is at or above the ${threshold} threshold`,
      };
    }

    // Checked last: a confident answer to a hostile question should escalate on
    // the hostility, not on the confidence number.
    if (typeof input.confidence === 'number' && input.confidence < floor) {
      return {
        trigger: 'LOW_MODEL_CONFIDENCE',
        detail: `Model confidence ${input.confidence} is below the ${floor} floor`,
      };
    }

    return null;
  }

  private describe(trigger: EscalationTrigger): string {
    switch (trigger) {
      case 'LEAD_REQUESTED_HUMAN': return 'Asked for a person';
      case 'DEAL_VALUE_OVER_THRESHOLD': return 'High value deal';
      case 'NEGATIVE_SENTIMENT': return 'Unhappy on the call';
      case 'LOW_MODEL_CONFIDENCE': return 'Mikey was unsure';
      case 'PRICE_NEGOTIATION': return 'Price negotiation started';
      case 'LEGAL_OR_COMMITMENT': return 'Legal or commitment question';
    }
  }
}
