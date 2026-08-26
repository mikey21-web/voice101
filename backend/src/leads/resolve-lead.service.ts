import { Injectable, Logger } from '@nestjs/common';
import { LeadSegment, LeadStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import { NormalizationService } from '../shared/normalization.service';
import { LeadOrchestratorService } from '../voice-agent/lead-orchestrator.service';

/** A lead that went nowhere. Re-enquiring after one of these is a RECONNECT. */
const DEAD_STATUSES: LeadStatus[] = ['LOST', 'COLD', 'SPAM'];
/** A lead that bought. Re-enquiring after one of these is an EXISTING_CUSTOMER. */
const PURCHASED_STATUSES: LeadStatus[] = [
  'CONVERTED',
];
/** How much a repeat enquiry is worth. Someone who comes back twice is serious. */
const RETURNING_SCORE_BUMP = 15;

export interface LeadEngagement {
  previousLeads: number;
  conversations: number;
  callsAnswered: number;
  callsMissed: number;
  campaigns: string[];
  lastInterest?: string | null;
}

export interface ResolveLeadResult {
  leadId: string;
  contactId: string;
  isReturning: boolean;
  /** True when an existing open lead was reused rather than a new row created. */
  reusedExistingLead: boolean;
  segment: LeadSegment;
  assignedRepId: string | null;
  history: LeadEngagement;
}

/**
 * Phase 4. One way in for every capture source.
 *
 * Before this, `handleFormSubmit` deduped the *contact* and then always created
 * a lead, so the same buyer arriving from four portals became four leads and
 * four salespeople called one person. Phone is the primary key here, and a
 * returning buyer is a signal rather than a new row.
 */
@Injectable()
export class ResolveLeadService {
  private readonly logger = new Logger(ResolveLeadService.name);

  constructor(
    private prisma: PrismaService,
    private contacts: ContactsService,
    private normalization: NormalizationService,
    private orchestrator: LeadOrchestratorService,
  ) {}

  async resolveLead(params: {
    tenantId: string;
    phone?: string;
    name?: string;
    email?: string;
    whatsapp?: string;
    company?: string;
    source: string;
    campaignId?: string;
    message?: string;
    interest?: string;
    budget?: string;
    metadata?: Record<string, unknown>;
    req?: any;
  }): Promise<ResolveLeadResult> {
    const phone = params.phone ? this.normalization.normalizePhone(params.phone) : undefined;
    const whatsapp = params.whatsapp ? this.normalization.normalizePhone(params.whatsapp) : undefined;

    const contact = await this.contacts.findOrCreate(
      { name: params.name, email: params.email, phone, whatsapp, company: params.company },
      params.req,
    );

    const priorLeads = await this.prisma.lead.findMany({
      where: { tenantId: params.tenantId, contactId: contact.id },
      orderBy: { createdAt: 'desc' },
    });

    const history = await this.buildHistory(params.tenantId, contact.id, priorLeads.length);
    const openLead = priorLeads.find(
      (l) => !DEAD_STATUSES.includes(l.status) && !PURCHASED_STATUSES.includes(l.status),
    );

    // Same buyer, still in play: this is a fresh touch on the lead they already
    // have, not a second lead for a second salesperson to chase.
    if (openLead) {
      const updated = await this.prisma.lead.update({
        where: { id: openLead.id },
        data: {
          score: { increment: RETURNING_SCORE_BUMP },
          interest: params.interest ?? openLead.interest,
          budget: params.budget ?? openLead.budget,
          metadata: this.appendTouch(openLead.metadata, params.source, params.campaignId),
        },
      });
      this.logger.log(`Lead ${openLead.id} re-enquired via ${params.source}; kept rep ${openLead.assignedAgentId ?? 'none'}`);
      return {
        leadId: updated.id,
        contactId: contact.id,
        isReturning: true,
        reusedExistingLead: true,
        segment: updated.segment,
        assignedRepId: updated.assignedAgentId,
        history,
      };
    }

    // No open lead, but we know this person. New lead, same rep, and a segment
    // that says which kind of "we know you" this is.
    const hasPurchased = priorLeads.some((l) => PURCHASED_STATUSES.includes(l.status));
    const hasDead = priorLeads.some((l) => DEAD_STATUSES.includes(l.status));
    const segment: LeadSegment = hasPurchased
      ? 'EXISTING_CUSTOMER'
      : hasDead
        ? 'RECONNECT'
        : 'WARM';
    const stickyRepId = priorLeads.find((l) => l.assignedAgentId)?.assignedAgentId ?? null;

    const created = await this.prisma.lead.create({
      data: {
        tenantId: params.tenantId,
        contactId: contact.id,
        source: params.source as any,
        segment,
        assignedAgentId: stickyRepId,
        campaignId: params.campaignId,
        message: params.message,
        interest: params.interest,
        budget: params.budget,
        score: priorLeads.length > 0 ? RETURNING_SCORE_BUMP : 0,
        metadata: this.appendTouch(params.metadata ?? {}, params.source, params.campaignId),
      },
    });

    // New lead: hand it to the lead orchestrator for the source's auto-actions
    // (FORM always calls). Fire-and-forget so a slow call trigger never blocks
    // the submit response. Reused/open leads skip this — they are already in play.
    this.orchestrator.onLeadCreated(created.id).catch((e: any) =>
      this.logger.error(`Auto-action trigger failed for lead ${created.id}: ${e?.message}`),
    );

    return {
      leadId: created.id,
      contactId: contact.id,
      isReturning: priorLeads.length > 0,
      reusedExistingLead: false,
      segment,
      assignedRepId: stickyRepId,
      history,
    };
  }
  /**
   * What Mikey knows about this person before it opens its mouth. Feeds the
   * "welcome back, last week you looked at a 2BHK" greeting.
   */
  private async buildHistory(tenantId: string, contactId: string, previousLeads: number): Promise<LeadEngagement> {
    const leadIds = (
      await this.prisma.lead.findMany({
        where: { tenantId, contactId },
        select: { id: true, interest: true, campaignId: true },
        orderBy: { createdAt: 'desc' },
      })
    );
    const ids = leadIds.map((l) => l.id);
    if (ids.length === 0) {
      return { previousLeads: 0, conversations: 0, callsAnswered: 0, callsMissed: 0, campaigns: [] };
    }

    const [conversations, callsAnswered, callsMissed] = await Promise.all([
      this.prisma.conversationMessage.count({ where: { leadId: { in: ids } } }),
      this.prisma.callLog.count({ where: { leadId: { in: ids }, status: 'COMPLETED' } }),
      this.prisma.callLog.count({ where: { leadId: { in: ids }, status: { in: ['MISSED', 'NO_ANSWER', 'BUSY'] } } }),
    ]);

    return {
      previousLeads,
      conversations,
      callsAnswered,
      callsMissed,
      campaigns: [...new Set(leadIds.map((l) => l.campaignId).filter((c): c is string => !!c))],
      lastInterest: leadIds.find((l) => l.interest)?.interest ?? null,
    };
  }

  /** Keeps every source that brought this person in, so attribution survives a merge. */
  private appendTouch(
    metadata: unknown,
    source: string,
    campaignId?: string,
  ): Prisma.InputJsonObject {
    const base = (metadata && typeof metadata === 'object' && !Array.isArray(metadata))
      ? { ...(metadata as Record<string, unknown>) }
      : {};
    const touches = Array.isArray(base.touches) ? base.touches : [];
    return {
      ...base,
      touches: [...touches, { source, campaignId: campaignId ?? null, at: new Date().toISOString() }],
    } as Prisma.InputJsonObject;
  }
}
