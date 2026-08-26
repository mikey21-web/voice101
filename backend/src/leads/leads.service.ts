import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AdvancedFeaturesService } from '../advanced-features/advanced-features.service';
import { EventsService } from '../events/events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ContactsService } from '../contacts/contacts.service';
import { MetricsService } from '../monitoring/metrics.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { LeadOrchestratorService } from '../voice-agent/lead-orchestrator.service';
import { LeadContextService } from './lead-context.service';
import { AdvanceStageService } from './advance-stage.service';
import { getNested, evaluateCondition } from '../shared/scoring.util';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
    @Inject(forwardRef(() => AdvancedFeaturesService)) private advanced: AdvancedFeaturesService,
    private events: EventsService,
    private notifications: NotificationsService,
    @Inject(forwardRef(() => ContactsService)) private contacts: ContactsService,
    private metrics: MetricsService,
    private realtimeGateway: RealtimeGateway,
    private callOrchestrator: LeadOrchestratorService,
    private leadContext: LeadContextService,
    private advanceStage: AdvanceStageService,
  ) {}

  async findAll(query: any = {}, tenantId?: string) {
    const { page = 1, limit = 20, status, segment, source, campaignId, assignedAgentId, search, sortBy, sortOrder } = query;
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (status) where.status = status;
    if (segment) where.segment = segment;
    if (source) where.source = source;
    if (campaignId) where.campaignId = campaignId;
    if (assignedAgentId) where.assignedAgentId = assignedAgentId;
    if (search) {
      where.OR = [
        { contact: { name: { contains: search, mode: 'insensitive' } } },
        { contact: { email: { contains: search, mode: 'insensitive' } } },
        { contact: { phone: { contains: search } } },
        { message: { contains: search, mode: 'insensitive' } },
      ];
    }
    const allowedSortFields = ['createdAt', 'updatedAt', 'score', 'status', 'segment', 'source', 'priority', 'dealValue'] as const;
    const orderField = (allowedSortFields as readonly string[]).includes(sortBy) ? (sortBy as typeof allowedSortFields[number]) : 'createdAt';
    const orderDir: Prisma.SortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.LeadOrderByWithRelationInput = { [orderField]: orderDir };
    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where, skip: (+page - 1) * +limit, take: +limit, orderBy,
        include: { contact: true, assignedAgent: { select: { id: true, name: true, email: true } }, campaign: { select: { id: true, name: true } } },
      }),
      this.prisma.lead.count({ where }),
    ]);
    return { data, meta: { total, page: +page, limit: +limit } };
  }

  async findOne(id: string, tenantId?: string) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const l = await this.prisma.lead.findFirst({
      where,
      include: { contact: true, assignedAgent: { select: { id: true, name: true, email: true } }, campaign: { select: { id: true, name: true } }, conversations: true, conversions: true, tasks: true },
    });
    if (!l) throw new NotFoundException('Lead not found');
    return l;
  }

  /**
   * Pre-visit brief — everything an agent needs on one screen before walking
   * into a site visit, so they never pitch blind: who the buyer is, what they
   * told us, what they've pushed back on, and what's already been booked.
   */
  async getBrief(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        contact: true,
        assignedAgent: { select: { id: true, name: true, email: true } },
        customFields: { include: { definition: true } },
        internalNotes: { orderBy: { createdAt: 'desc' }, take: 10, include: { user: { select: { name: true } } } },
        conversations: { orderBy: { createdAt: 'desc' }, take: 20 },
        bookings: { orderBy: { startTime: 'asc' } },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const fields: Record<string, string> = {};
    for (const cf of lead.customFields) {
      fields[cf.definition.key] = cf.value ?? '';
    }

    const now = new Date();
    const upcomingBooking = lead.bookings
      .filter(b => b.startTime >= now && ['PENDING', 'CONFIRMED'].includes(b.status))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0] || null;

    const pastBookings = lead.bookings.filter(b => b.startTime < now || !['PENDING', 'CONFIRMED'].includes(b.status));

    // Objections: heuristic scan of inbound messages for common pushback language,
    // so the agent isn't caught off guard by something the buyer already raised.
    const objectionKeywords = ['expensive', 'too high', 'budget', 'think about it', 'not sure', 'compare', 'other option', 'later', 'busy', 'no time'];
    const objections = lead.conversations
      .filter(c => c.direction === 'INBOUND' && c.text)
      .filter(c => objectionKeywords.some(k => c.text!.toLowerCase().includes(k)))
      .slice(0, 5)
      .map(c => ({ text: c.text, at: c.createdAt }));

    const recentMessages = lead.conversations.slice(0, 8).map(c => ({
      direction: c.direction, text: c.text, at: c.createdAt,
    }));

    return {
      lead: {
        id: lead.id, status: lead.status, segment: lead.segment, score: lead.score,
        source: lead.source, interest: lead.interest, budget: lead.budget, dealValue: lead.dealValue,
        createdAt: lead.createdAt,
      },
      buyer: {
        name: lead.contact?.name || 'Unknown',
        phone: lead.contact?.phone || null,
        email: lead.contact?.email || null,
      },
      assignedAgent: lead.assignedAgent,
      preferences: fields,
      upcomingBooking,
      pastBookingsCount: pastBookings.length,
      objections,
      recentMessages,
      notes: lead.internalNotes.map(n => ({ content: n.content, by: n.user?.name || 'Unknown', at: n.createdAt })),
    };
  }

  /**
   * The agent's "my day" home screen: their hot leads and their overdue
   * follow-ups. Scoped to a single agent so nobody has to dig through the
   * whole team's queue.
   */
  async getAgentWorklist(agentId: string) {
    const now = new Date();

    const [hotLeads, overdueTasks] = await Promise.all([
      this.prisma.lead.findMany({
        where: { assignedAgentId: agentId, segment: 'HOT', status: { notIn: ['CONVERTED', 'LOST', 'SPAM'] } },
        include: { contact: { select: { name: true, phone: true } } },
        orderBy: { score: 'desc' },
        take: 10,
      }),
      this.prisma.task.findMany({
        where: { assigneeId: agentId, dueAt: { lt: now }, status: { not: 'completed' } },
        include: { lead: { include: { contact: { select: { name: true } } } } },
        orderBy: { dueAt: 'asc' },
        take: 15,
      }),
    ]);

    return { hotLeads, overdueTasks };
  }

  async create(data: any, userId?: string) {
    if (!data.tenantId && data.contactId) {
      const c = await this.prisma.contact.findUnique({ where: { id: data.contactId }, select: { tenantId: true } });
      if (c) data.tenantId = c.tenantId;
    }
    if (data.assignedAgentId === '') delete data.assignedAgentId;
    const lead = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({ data });
      await this.auditLogs.log('lead_created', 'Lead', created.id, userId);
      return created;
    });
    await this.events.emit({ type: 'lead.created', leadId: lead.id, entityType: 'lead', entityId: lead.id, payload: { source: lead.source, status: lead.status }, createdById: userId });
    this.metrics.incrementCounter('leads_created_total', { source: lead.source });

    if (!lead.assignedAgentId) {
      try {
        const agents = await this.prisma.user.findMany({
          where: { tenantId: lead.tenantId, role: 'SALES_AGENT', active: true },
          include: { _count: { select: { assignedLeads: true } } },
        });
        agents.sort((a, b) => a._count.assignedLeads - b._count.assignedLeads);
        let assignTo: (typeof agents)[number] | null = agents[0] ?? null;
        if (!assignTo) {
          assignTo = await this.prisma.user.findFirst({
            where: { tenantId: lead.tenantId, role: 'MANAGER', active: true },
          }) as any;
        }
        if (assignTo) {
          await this.prisma.lead.update({ where: { id: lead.id }, data: { assignedAgentId: assignTo.id } });
          lead.assignedAgentId = assignTo.id;
          const contactName = (await this.prisma.contact.findUnique({ where: { id: lead.contactId }, select: { name: true } }))?.name || 'A new lead';
          await this.notifications.create({
            tenantId: lead.tenantId, userId: assignTo.id, type: 'lead_assigned',
            title: 'New lead assigned', body: `${contactName} was just assigned to you`, link: '/leads',
            whatsappTo: assignTo.phone || undefined,
          });
          this.realtimeGateway.emitToUser(assignTo.id, 'lead.assigned', { leadId: lead.id, assignedAgentId: assignTo.id });
        }
      } catch {}
    }

    try {
      const welcomeSequence = await this.prisma.nurtureSequence.findFirst({
        where: { name: 'New Lead Welcome', active: true },
        include: { steps: { orderBy: { displayOrder: 'asc' }, take: 1 } },
      });
      if (welcomeSequence && welcomeSequence.steps.length > 0) {
        await this.prisma.nurtureProgress.create({
          data: {
            leadId: lead.id,
            sequenceId: welcomeSequence.id,
            stepId: welcomeSequence.steps[0].id,
            status: 'pending',
            dueAt: new Date(),
          },
        });
        this.logger.log(`Lead ${lead.id} enrolled in welcome sequence ${welcomeSequence.id}`);
      }
    } catch (e: any) {
      this.logger.warn(`Failed to enroll lead in welcome sequence: ${e.message}`);
    }

    this.realtimeGateway.emitToTenant(lead.tenantId, 'lead.created', lead);
    this.realtimeGateway.emitToTenant(lead.tenantId, 'mikey:alert', {
      type: 'new_lead',
      message: `New lead just came in from ${lead.source || 'unknown source'}.`,
    });

    // Phase 1: context enrichment + AI scoring (fire-and-forget, non-blocking)
    this.leadContext.enrich(lead.id).catch((e: any) =>
      this.logger.warn(`Lead context enrichment failed: ${e.message}`)
    );
    this.score(lead.id).catch((e: any) =>
      this.logger.warn(`Lead scoring failed: ${e.message}`)
    );

    this.callOrchestrator.onLeadCreated(lead.id).catch(() => {});
    return lead;
  }

  /**
   * Universal intake — every source calls this so all leads go through the
   * same normalization, enrichment, scoring, and routing pipeline.
   */
  async intake(data: {
    name: string; phone?: string; email?: string; whatsapp?: string;
    source: string; message?: string; interest?: string; budget?: string;
    campaignId?: string; metadata?: Record<string, unknown>;
  }, userId?: string, req?: any) {
    const contact = await this.contacts.findOrCreate({
      name: data.name, phone: data.phone, email: data.email, whatsapp: data.whatsapp,
    }, req);
    return this.create({
      contactId: contact.id,
      tenantId: contact.tenantId,
      source: data.source,
      message: data.message,
      interest: data.interest,
      budget: data.budget,
      campaignId: data.campaignId,
      metadata: { ...(data.metadata || {}), _sourcePayload: data },
    }, userId);
  }

  /**
   * Manual lead entry — for leads that came from outside Mikey's coverage
   * (walk-ins, referrals, an agent's own contact) rather than an inbound
   * channel Mikey already watches. Finds-or-creates the contact so the same
   * person doesn't end up duplicated across channels.
   */
  async createManual(data: {
    name: string; phone?: string; email?: string; source?: string;
    interest?: string; budget?: string; message?: string; assignedAgentId?: string;
  }, userId?: string, req?: any) {
    const contact = await this.contacts.findOrCreate({ name: data.name, phone: data.phone, email: data.email }, req);
    return this.create({
      contactId: contact.id,
      tenantId: contact.tenantId,
      source: data.source || 'MANUAL',
      interest: data.interest,
      budget: data.budget,
      message: data.message,
      assignedAgentId: data.assignedAgentId,
    }, userId);
  }

  async update(id: string, data: any, userId?: string) {
    const existing = await this.findOne(id);
    // Status is the spine. It never moves through a generic update — route it
    // through advanceStage so every transition is validated, audited and emitted.
    const { status, whatsapp, ...rest } = data || {};
    if (status) {
      await this.advanceStage.advanceStage({
        tenantId: existing.tenantId,
        leadId: id,
        to: status,
        actor: userId ? 'human' : 'system',
        reason: 'lead update',
        actorUserId: userId,
      });
    }
    if (whatsapp) {
      // WhatsApp is a Contact column, not a Lead column — route it to the contact.
      try {
        await this.prisma.contact.update({ where: { id: existing.contactId }, data: { whatsapp } });
      } catch { /* ignore contact update errors */ }
    }
    if (Object.keys(rest).length === 0) return existing;
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({
        where: { id, version: existing.version },
        data: { ...rest, version: { increment: 1 } },
      }).catch((err) => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
          throw new ConflictException('Lead was modified by another request. Please refresh and retry.');
        }
        throw err;
      });

      // Propagate extracted fields from metadata to contact
      if (data.metadata && lead.contactId) {
        const contactUpdate: any = {};
        if (data.metadata.email) contactUpdate.email = data.metadata.email;
        if (data.metadata.name) contactUpdate.name = data.metadata.name;
        if (data.metadata.phone) contactUpdate.phone = data.metadata.phone;
        if (Object.keys(contactUpdate).length > 0) {
          try {
            await tx.contact.update({ where: { id: lead.contactId }, data: contactUpdate });
          } catch { /* ignore contact update errors */ }
        }
      }

      await this.auditLogs.log('lead_updated', 'Lead', id, userId, data);
      if (data.segment) await this.events.emit({ type: 'lead.segment_changed', leadId: id, entityType: 'lead', entityId: id, payload: { to: data.segment }, createdById: userId });
      return lead;
    });
  }

  async score(id: string, userId?: string) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const lead = await this.prisma.lead.findUnique({ where: { id }, include: { contact: true } });
      if (!lead) throw new NotFoundException('Lead not found');

      try {
        const oldSegment = lead.segment;
        const result = await this.prisma.$transaction(async (tx) => {
          const rules = await tx.scoringRule.findMany({ where: { active: true } });
          let totalScore = lead.score || 0;
          for (const rule of rules) {
            const fieldValue = getNested(lead, rule.field) ?? getNested(lead.metadata, rule.field);
            if (evaluateCondition(fieldValue, rule.operator, rule.value)) totalScore += rule.points;
          }

          const oldScore = lead.score;
          totalScore = Math.max(-100, Math.min(100, totalScore));
          const segment = this.determineSegment(totalScore);

          if (totalScore !== oldScore) {
            await tx.scoreLog.create({ data: { leadId: id, oldScore, newScore: totalScore, reason: 'Automatic scoring run' } });
            await this.auditLogs.log('score_changed', 'Lead', id, userId, { oldScore, newScore: totalScore });
          }
          await this.events.emit({ type: 'lead.scored', leadId: id, entityType: 'lead', entityId: id, payload: { oldScore, newScore: totalScore, segment }, createdById: userId });
          return tx.lead.update({ where: { id, version: lead.version }, data: { score: totalScore, segment, version: { increment: 1 } } });
        }, { isolationLevel: 'Serializable' });

        // Owners want to know the moment a lead turns HOT, not on a cron sweep that
        // (per audit) never actually fires since leads are auto-assigned before scoring.
        if (result.segment === 'HOT' && oldSegment !== 'HOT') {
          this.notifyOwnersOfHotLead(result).catch((e: any) => this.logger.warn(`Hot-lead notify failed for ${id}: ${e.message}`));
          const name = (result as any).contact?.name || 'A lead';
          this.realtimeGateway.emitToTenant(result.tenantId, 'mikey:alert', {
            type: 'hot_lead',
            message: `${name} just went hot. Score: ${result.score}. They may be ready to talk now.`,
          });
        }
        return result;
      } catch (err) {
        const retryable = err instanceof Prisma.PrismaClientKnownRequestError && (err.code === 'P2034' || err.code === 'P2025');
        if (!retryable || attempt === 3) throw err;
      }
    }
    throw new ConflictException('Lead was modified by another request. Please refresh and retry.');
  }

  async assign(id: string, agentId?: string, userId?: string) {
    const lead = await this.findOne(id);
    if (!agentId) {
      const available = await this.prisma.user.findFirst({
        where: { role: { in: ['SALES_AGENT','MANAGER'] } },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      agentId = available?.id || undefined;
    }
    const updated = await this.prisma.lead.update({ where: { id }, data: { assignedAgentId: agentId } });
    await this.auditLogs.log('lead_assigned', 'Lead', id, userId, { agentId });
    await this.events.emit({ type: 'lead.assigned', leadId: id, entityType: 'lead', entityId: id, payload: { agentId }, createdById: userId });
    if (agentId) {
      const agent = await this.prisma.user.findUnique({ where: { id: agentId }, select: { phone: true } });
      await this.notifications.create({
        tenantId: updated.tenantId,
        userId: agentId,
        type: 'lead_assigned',
        title: 'New lead assigned to you',
        link: '/leads',
        whatsappTo: agent?.phone || undefined,
      });
    }
    return updated;
  }

  async markSpam(id: string, userId?: string) {
    const existing = await this.findOne(id);
    await this.advanceStage.advanceStage({
      tenantId: existing.tenantId,
      leadId: id,
      to: 'SPAM',
      actor: userId ? 'human' : 'system',
      reason: 'marked as spam',
      actorUserId: userId,
    });
    const lead = await this.prisma.lead.update({ where: { id }, data: { segment: 'UNQUALIFIED', score: -100 } });
    await this.auditLogs.log('lead_marked_spam', 'Lead', id, userId);
    return lead;
  }

  private async notifyOwnersOfHotLead(lead: { id: string; tenantId: string; contactId: string }): Promise<void> {
    const [contact, owners] = await Promise.all([
      this.prisma.contact.findUnique({ where: { id: lead.contactId }, select: { name: true, phone: true } }),
      this.prisma.user.findMany({ where: { tenantId: lead.tenantId, role: { in: ['OWNER', 'ADMIN'] }, active: true }, select: { id: true, phone: true } }),
    ]);
    const title = 'Hot lead just came in';
    const body = `${contact?.name || 'A lead'} (${contact?.phone || 'no phone'}) just scored HOT.`;
    for (const owner of owners) {
      await this.notifications.create({
        tenantId: lead.tenantId, userId: owner.id, type: 'lead_hot',
        title, body, link: `/leads/${lead.id}`,
        whatsappTo: owner.phone || undefined,
      });
    }
  }

  private determineSegment(score: number) {
    if (score >= 70) return 'HOT';
    if (score >= 40) return 'WARM';
    if (score >= 1) return 'COLD';
    return 'UNQUALIFIED';
  }
}
