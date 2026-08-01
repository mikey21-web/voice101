import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async overview() {
    const [total, hot, warm, cold, converted, lost, contacted] = await Promise.all([
      this.prisma.lead.count(),
      this.prisma.lead.count({ where: { segment: 'HOT' } }),
      this.prisma.lead.count({ where: { segment: 'WARM' } }),
      this.prisma.lead.count({ where: { segment: 'COLD' } }),
      this.prisma.lead.count({ where: { status: 'CONVERTED' } }),
      this.prisma.lead.count({ where: { status: 'LOST' } }),
      this.prisma.lead.findMany({ where: { firstContactAttemptedAt: { not: null } }, select: { createdAt: true, firstContactAttemptedAt: true } }),
    ]);
    const captureToCallSeconds = contacted.length > 0
      ? +(contacted.reduce((sum, l) => sum + Math.max(0, (l.firstContactAttemptedAt!.getTime() - l.createdAt.getTime()) / 1000), 0) / contacted.length).toFixed(1)
      : 0;
    return { total, hot, warm, cold, converted, lost, conversionRate: total ? ((converted / total) * 100).toFixed(1) : 0, captureToCallSeconds };
  }

  async forecast() {
    const [stages, leadsByStatus] = await Promise.all([
      this.prisma.pipelineStage.findMany({ select: { status: true, probability: true } }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where: { status: { notIn: ['CONVERTED', 'LOST', 'SPAM'] }, dealValue: { not: null } },
        _sum: { dealValue: true },
        _count: true,
      }),
    ]);
    const probabilityByStatus = new Map(stages.map(s => [s.status, s.probability]));
    const byStage = leadsByStatus.map(l => {
      const probability = probabilityByStatus.get(l.status) ?? 0;
      const totalValue = l._sum.dealValue ?? 0;
      return {
        status: l.status,
        count: l._count,
        totalValue,
        probability,
        weightedValue: +(totalValue * (probability / 100)).toFixed(2),
      };
    });
    const totalWeightedForecast = +byStage.reduce((sum, s) => sum + s.weightedValue, 0).toFixed(2);
    return { totalWeightedForecast, byStage };
  }

  async sources() {
    const leads = await this.prisma.lead.groupBy({ by: ['source'], _count: true });
    return leads.map(l => ({ source: l.source, count: l._count }));
  }

  async sourceInsight(source: string) {
    const [total, converted, statusGroups, ticketCount, urgentOpenTicketCount, overview, sampleLeads] = await Promise.all([
      this.prisma.lead.count({ where: { source: source as any } }),
      this.prisma.lead.count({ where: { source: source as any, status: 'CONVERTED' } }),
      this.prisma.lead.groupBy({ by: ['status'], where: { source: source as any }, _count: true }),
      this.prisma.ticket.count({ where: { lead: { source: source as any } } }),
      this.prisma.ticket.count({ where: { lead: { source: source as any }, priority: 'URGENT', status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
      this.overview(),
      this.prisma.lead.findMany({ where: { source: source as any }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, status: true, contact: { select: { name: true } } } }),
    ]);
    return {
      source, total, converted,
      conversionRate: total ? +((converted / total) * 100).toFixed(1) : 0,
      overallConversionRate: +overview.conversionRate,
      statusBreakdown: statusGroups.map(g => ({ status: g.status, count: g._count })),
      ticketCount, urgentOpenTicketCount,
      sampleLeads: sampleLeads.map(l => ({ id: l.id, status: l.status, name: l.contact?.name })),
    };
  }

  async campaigns() {
    const campaigns = await this.prisma.campaign.findMany({ include: { _count: { select: { leads: true } } } });
    return campaigns.map(c => ({ id: c.id, name: c.name, active: c.active, leadCount: c._count.leads }));
  }

  async conversions() {
    return this.prisma.conversion.groupBy({ by: ['destination', 'status'], _count: true });
  }

  async agents() {
    const agents = await this.prisma.user.findMany({ where: { role: { in: ['SALES_AGENT', 'MANAGER', 'OWNER'] } }, include: { assignedLeads: true } });
    return agents.map(a => ({
      id: a.id, name: a.name, role: a.role,
      assignedLeads: a.assignedLeads.length,
      converted: a.assignedLeads.filter(l => l.status === 'CONVERTED').length,
    }));
  }

  /**
   * The owner's "run the team" home screen: per-agent performance, leads at
   * risk of going cold, and today's site-visit volume — the "am I in control"
   * moment, in one call instead of the owner having to piece it together.
   */
  async teamCommand() {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const [agents, staleHotLeads, unassignedHotLeads, overdueTasksCount, todayVisitsCount] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: 'SALES_AGENT', active: true },
        include: { assignedLeads: { where: { status: { notIn: ['CONVERTED', 'LOST', 'SPAM'] } } } },
      }),
      this.prisma.lead.findMany({
        where: { segment: 'HOT', status: { notIn: ['CONVERTED', 'LOST', 'SPAM'] }, updatedAt: { lt: twoHoursAgo }, assignedAgentId: { not: null } },
        include: { contact: { select: { name: true } }, assignedAgent: { select: { name: true } } },
        take: 10,
      }),
      this.prisma.lead.findMany({
        where: { segment: 'HOT', assignedAgentId: null, status: { notIn: ['CONVERTED', 'LOST', 'SPAM'] } },
        include: { contact: { select: { name: true } } },
        take: 10,
      }),
      this.prisma.task.count({ where: { dueAt: { lt: now }, status: { not: 'completed' } } }),
      this.prisma.booking.count({ where: { startTime: { gte: todayStart, lt: todayEnd }, status: { in: ['PENDING', 'CONFIRMED'] } } }),
    ]);

    const totalLeadsAllTime = await this.prisma.lead.count();
    const convertedAllTime = await this.prisma.lead.count({ where: { status: 'CONVERTED' } });

    const agentPerformance = await Promise.all(agents.map(async (a) => {
      const total = a.assignedLeads.length;
      const [convertedCount, hotCount] = await Promise.all([
        this.prisma.lead.count({ where: { assignedAgentId: a.id, status: 'CONVERTED' } }),
        this.prisma.lead.count({ where: { assignedAgentId: a.id, segment: 'HOT', status: { notIn: ['CONVERTED', 'LOST', 'SPAM'] } } }),
      ]);
      return {
        id: a.id, name: a.name, activeLeads: total, hotLeads: hotCount,
        converted: convertedCount,
        conversionRate: total > 0 ? Math.round((convertedCount / total) * 100) : 0,
      };
    }));

    return {
      agentPerformance: agentPerformance.sort((a, b) => b.conversionRate - a.conversionRate),
      staleHotLeads: staleHotLeads.map(l => ({ id: l.id, name: l.contact?.name || 'Unknown', agent: l.assignedAgent?.name || 'Unassigned', hoursSinceUpdate: Math.round((now.getTime() - l.updatedAt.getTime()) / (1000 * 60 * 60)) })),
      unassignedHotLeads: unassignedHotLeads.map(l => ({ id: l.id, name: l.contact?.name || 'Unknown' })),
      overdueTasksCount,
      todayVisitsCount,
      overallConversionRate: totalLeadsAllTime > 0 ? Math.round((convertedAllTime / totalLeadsAllTime) * 100) : 0,
    };
  }

  /**
   * Real-estate owner console: the one screen a small builder checks to see
   * whether paid leads are being worked, visits are happening, inventory is
   * moving, collections are at risk, and partners are producing.
   */
  async builderCommand() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const activeLeadWhere = { status: { notIn: ['CONVERTED', 'LOST', 'SPAM'] as any[] } };
    const visitWhere = { startTime: { gte: todayStart, lt: todayEnd }, status: { in: ['PENDING', 'CONFIRMED'] as any[] } };
    const overduePaymentWhere = {
      OR: [
        { status: 'OVERDUE' as any },
        { status: 'PENDING' as any, dueDate: { lt: now } },
      ],
    };

    const missedCallStatuses = ['NO_ANSWER', 'BUSY', 'FAILED', 'MISSED'] as any[];

    const [
      activeLeads,
      hotLeads,
      unassignedLeads,
      newLeadsToday,
      todayVisits,
      overduePayments,
      activeProjects,
      activePartners,
      sourceGroups,
      unitGroups,
      recentLeads,
      upcomingVisits,
      collectionQueue,
      topPartners,
      missedCallsToday,
      noShowsThisMonth,
      bookingsThisMonth,
      activeHolds,
      tomorrowVisits,
    ] = await Promise.all([
      this.prisma.lead.count({ where: activeLeadWhere }),
      this.prisma.lead.count({ where: { ...activeLeadWhere, segment: 'HOT' } }),
      this.prisma.lead.count({ where: { ...activeLeadWhere, assignedAgentId: null } }),
      this.prisma.lead.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.booking.count({ where: visitWhere }),
      this.prisma.paymentSchedule.count({ where: overduePaymentWhere }),
      this.prisma.project.count({ where: { deletedAt: null } }),
      this.prisma.channelPartner.count({ where: { status: 'ACTIVE' } }),
      this.prisma.lead.groupBy({
        by: ['source'],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _count: true,
        orderBy: { _count: { source: 'desc' } },
      }),
      this.prisma.unit.groupBy({ by: ['status'], _count: true, _sum: { price: true } }),
      this.prisma.lead.findMany({
        where: activeLeadWhere,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 8,
        include: {
          contact: { select: { name: true, phone: true, whatsapp: true, location: true } },
          assignedAgent: { select: { name: true } },
          channelPartner: { select: { name: true, company: true } },
        },
      }),
      this.prisma.booking.findMany({
        where: { startTime: { gte: now }, status: { in: ['PENDING', 'CONFIRMED'] } },
        orderBy: { startTime: 'asc' },
        take: 6,
        include: {
          lead: { include: { contact: { select: { name: true, phone: true } }, assignedAgent: { select: { name: true } } } },
          unit: { include: { project: { select: { name: true, location: true } }, tower: { select: { name: true } } } },
        },
      }),
      this.prisma.paymentSchedule.findMany({
        where: overduePaymentWhere,
        orderBy: { dueDate: 'asc' },
        take: 6,
        include: {
          lead: { include: { contact: { select: { name: true, phone: true } } } },
          booking: { include: { unit: { include: { project: { select: { name: true } } } } } },
        },
      }),
      this.prisma.channelPartner.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { leads: { _count: 'desc' } },
        take: 5,
        include: { _count: { select: { leads: true } } },
      }),
      this.prisma.callLog.count({ where: { createdAt: { gte: todayStart }, status: { in: missedCallStatuses } } }),
      this.prisma.siteVisit.count({ where: { status: 'NO_SHOW' as any, startAt: { gte: monthStart } } }),
      this.prisma.booking.count({ where: { status: 'CONFIRMED' as any, createdAt: { gte: monthStart } } }),
      this.prisma.unitHold.findMany({ where: { status: 'ACTIVE' as any, expiresAt: { gte: now } }, orderBy: { expiresAt: 'asc' }, take: 10, include: { unit: { select: { unitNumber: true } }, lead: { include: { contact: { select: { name: true } } } } } }),
      this.prisma.booking.count({ where: { startTime: { gte: tomorrowStart, lt: tomorrowEnd }, status: { in: ['PENDING', 'CONFIRMED'] as any[] } } }),
    ]);

    const inventory = unitGroups.reduce((acc, row) => {
      acc[row.status] = {
        count: row._count,
        value: row._sum.price || 0,
      };
      return acc;
    }, {} as Record<string, { count: number; value: number }>);

    const sourceBreakdown = sourceGroups.map(row => ({
      source: row.source,
      leads: row._count,
    }));

    const weakAgents = await this.prisma.user.findMany({ where: { active: true, role: 'SALES_AGENT' }, select: { id: true, name: true } });
    const weakSalespeople: Array<{ id: string; name: string; totalLeads: number; converted: number; rate: number }> = [];
    if (weakAgents.length > 0) {
      const agentIds = weakAgents.map(a => a.id);
      const [totalMap, convertedMap] = await Promise.all([
        this.prisma.lead.groupBy({ by: ['assignedAgentId'], where: { assignedAgentId: { in: agentIds } }, _count: { id: true } }),
        this.prisma.lead.groupBy({ by: ['assignedAgentId'], where: { assignedAgentId: { in: agentIds }, status: 'CONVERTED' as any }, _count: { id: true } }),
      ]);
      const totalByAgent = new Map(totalMap.map(s => [s.assignedAgentId, s._count.id]));
      const convertedByAgent = new Map(convertedMap.map(s => [s.assignedAgentId, s._count.id]));
      for (const a of weakAgents) {
        const total = totalByAgent.get(a.id) || 0;
        const converted = convertedByAgent.get(a.id) || 0;
        const rate = total > 0 ? converted / total : 0;
        if (total > 10 && rate < 0.1) weakSalespeople.push({ id: a.id, name: a.name, totalLeads: total, converted, rate });
      }
    }

    return {
      kpis: {
        activeLeads,
        hotLeads,
        unassignedLeads,
        newLeadsToday,
        todayVisits,
        tomorrowVisits,
        missedCallsToday,
        noShowsThisMonth,
        bookingsThisMonth,
        overduePayments,
        activeProjects,
        activePartners,
      },
      sourceBreakdown,
      inventory,
      activeHolds: activeHolds.map(h => ({
        id: h.id,
        unitNumber: h.unit?.unitNumber || 'Unknown',
        buyer: h.lead?.contact?.name || 'Unknown buyer',
        expiresAt: h.expiresAt,
        status: h.status,
      })),
      weakSalespeople,
      recentLeads: recentLeads.map(l => ({
        id: l.id,
        buyer: l.contact?.name || 'Unknown buyer',
        phone: l.contact?.whatsapp || l.contact?.phone || null,
        location: l.contact?.location || null,
        source: l.source,
        status: l.status,
        segment: l.segment,
        score: l.score,
        budget: l.budget,
        interest: l.interest,
        assignedAgent: l.assignedAgent?.name || 'Unassigned',
        channelPartner: l.channelPartner?.company || l.channelPartner?.name || null,
        createdAt: l.createdAt,
      })),
      upcomingVisits: upcomingVisits.map(v => ({
        id: v.id,
        title: v.title,
        startTime: v.startTime,
        status: v.status,
        buyer: v.lead?.contact?.name || 'Unknown buyer',
        phone: v.lead?.contact?.phone || null,
        agent: v.lead?.assignedAgent?.name || 'Unassigned',
        project: v.unit?.project?.name || null,
        location: v.unit?.project?.location || null,
        unit: v.unit ? `${v.unit.tower?.name ? `${v.unit.tower.name}-` : ''}${v.unit.unitNumber}` : null,
      })),
      collectionQueue: collectionQueue.map(p => ({
        id: p.id,
        buyer: p.lead?.contact?.name || 'Unknown buyer',
        phone: p.lead?.contact?.phone || null,
        label: p.label,
        amount: p.amount,
        currency: p.currency,
        dueDate: p.dueDate,
        status: p.status,
        project: p.booking?.unit?.project?.name || null,
      })),
      topPartners: topPartners.map(p => ({
        id: p.id,
        name: p.company || p.name,
        phone: p.phone,
        reraId: p.reraId,
        commissionRate: p.commissionRate,
        leadCount: p._count.leads,
      })),
      nextActions: [
        unassignedLeads > 0 ? { severity: 'critical', label: `${unassignedLeads} active leads need an owner`, href: '#/leads' } : null,
        overduePayments > 0 ? { severity: 'warning', label: `${overduePayments} collection milestones are overdue`, href: '#/payment-schedules' } : null,
        missedCallsToday > 0 ? { severity: 'warning', label: `${missedCallsToday} missed calls today — review and call back`, href: '#/calls' } : null,
        weakSalespeople.length > 0 ? { severity: 'warning', label: `${weakSalespeople.length} agent(s) with weak conversion — review performance`, href: '#/team' } : null,
        activeHolds.length > 0 ? { severity: 'info', label: `${activeHolds.length} unit(s) on hold — ${activeHolds.filter(h => new Date(h.expiresAt).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000).length} expiring within 3 days`, href: '#/booking' } : null,
        hotLeads > 0 ? { severity: 'info', label: `${hotLeads} hot leads should get WhatsApp/call follow-up today`, href: '#/leads' } : null,
        todayVisits > 0 ? { severity: 'info', label: `${todayVisits} site visits need pre-visit briefs`, href: '#/booking' } : null,
      ].filter(Boolean),
    };
  }

  async getAgentResponseTimes(tenantId: string) {
    const agents = await this.prisma.user.findMany({ where: { tenantId, role: 'SALES_AGENT', active: true } });
    const results = await Promise.all(agents.map(async (agent) => {
      const assignedLeads = await this.prisma.lead.findMany({
        where: { assignedAgentId: agent.id, tenantId },
        select: { id: true, createdAt: true },
      });
      if (assignedLeads.length === 0) {
        return { agentId: agent.id, name: agent.name, avgFirstResponseMinutes: 0, medianFirstResponseMinutes: 0, leadsAssigned: 0, leadsResponded: 0, responseRate: 0, untouchedLeadCount: 0 };
      }
      const leadIds = assignedLeads.map(l => l.id);
      const responseTimes: number[] = [];
      let respondedCount = 0;
      const leadCreatedMap = new Map(assignedLeads.map(l => [l.id, l.createdAt]));
      for (const leadId of leadIds) {
        const firstOutbound = await this.prisma.conversationMessage.findFirst({
          where: { leadId, direction: 'OUTBOUND' },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        });
        if (firstOutbound) {
          const created = leadCreatedMap.get(leadId)!;
          const diffMs = firstOutbound.createdAt.getTime() - created.getTime();
          responseTimes.push(Math.max(0, diffMs / 60000));
          respondedCount++;
        }
      }
      const sorted = [...responseTimes].sort((a, b) => a - b);
      const avg = responseTimes.length > 0 ? +(responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length).toFixed(1) : 0;
      const median = sorted.length > 0 ? (sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)]) : 0;
      return {
        agentId: agent.id, name: agent.name,
        avgFirstResponseMinutes: avg,
        medianFirstResponseMinutes: +median.toFixed(1),
        leadsAssigned: assignedLeads.length,
        leadsResponded: respondedCount,
        responseRate: assignedLeads.length > 0 ? +((respondedCount / assignedLeads.length) * 100).toFixed(1) : 0,
        untouchedLeadCount: assignedLeads.length - respondedCount,
      };
    }));
    return results.sort((a, b) => a.responseRate - b.responseRate);
  }

  async getAgentOverdueFollowups(tenantId: string) {
    const agents = await this.prisma.user.findMany({ where: { tenantId, role: 'SALES_AGENT', active: true } });
    const now = new Date();
    const results = await Promise.all(agents.map(async (agent) => {
      const overdueTaskCount = await this.prisma.task.count({
        where: { assigneeId: agent.id, dueAt: { lt: now }, status: { not: 'completed' } },
      });
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const hotLeads = await this.prisma.lead.findMany({
        where: { assignedAgentId: agent.id, tenantId, segment: 'HOT', status: { notIn: ['CONVERTED', 'LOST', 'SPAM'] } },
        select: { id: true },
      });
      let leadsStaleCount = 0;
      for (const l of hotLeads) {
        const lastMsg = await this.prisma.conversationMessage.findFirst({
          where: { leadId: l.id, direction: 'OUTBOUND' },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });
        if (!lastMsg || lastMsg.createdAt < twoHoursAgo) leadsStaleCount++;
      }
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const agentVisits = await this.prisma.siteVisit.findMany({
        where: { lead: { assignedAgentId: agent.id }, startAt: { lt: threeDaysAgo }, status: { in: ['COMPLETED', 'NO_SHOW'] } },
        select: { id: true, startAt: true },
      });
      let overdueSiteVisits = 0;
      for (const v of agentVisits) {
        const followUp = await this.prisma.task.findFirst({
          where: { lead: { siteVisits: { some: { id: v.id } } }, createdAt: { gt: v.startAt } },
        });
        if (!followUp) overdueSiteVisits++;
      }
      const totalOverdue = overdueTaskCount + leadsStaleCount + overdueSiteVisits;
      return { agentId: agent.id, name: agent.name, overdueTaskCount, leadsStaleCount, overdueSiteVisits, totalOverdue };
    }));
    return results.sort((a, b) => b.totalOverdue - a.totalOverdue);
  }

  async getAgentVisitConversion(tenantId: string) {
    const agents = await this.prisma.user.findMany({ where: { tenantId, role: 'SALES_AGENT', active: true } });
    const results = await Promise.all(agents.map(async (agent) => {
      const siteVisits = await this.prisma.siteVisit.findMany({
        where: { lead: { assignedAgentId: agent.id } },
        select: { id: true, status: true, startAt: true, leadId: true },
      });
      const total = siteVisits.length;
      const completed = siteVisits.filter(v => v.status === 'COMPLETED').length;
      const noShow = siteVisits.filter(v => v.status === 'NO_SHOW').length;
      let bookingsAfterVisit = 0;
      for (const v of siteVisits) {
        if (v.status === 'NO_SHOW') continue;
        const thirtyDaysLater = new Date(v.startAt.getTime() + 30 * 24 * 60 * 60 * 1000);
        const booking = await this.prisma.booking.findFirst({
          where: { leadId: v.leadId, createdAt: { gte: v.startAt, lte: thirtyDaysLater } },
        });
        if (booking) bookingsAfterVisit++;
      }
      return {
        agentId: agent.id, name: agent.name,
        siteVisitsScheduled: total,
        siteVisitsCompleted: completed,
        noShowCount: noShow,
        bookingsAfterVisit,
        visitToBookRate: completed > 0 ? +((bookingsAfterVisit / completed) * 100).toFixed(1) : 0,
        showRate: total > 0 ? +((completed / total) * 100).toFixed(1) : 0,
      };
    }));
    return results.sort((a, b) => b.visitToBookRate - a.visitToBookRate);
  }

  async getSourceAnalytics(tenantId: string) {
    const sourceGroups = await this.prisma.lead.groupBy({
      by: ['source'],
      where: { tenantId },
      _count: { id: true },
      _sum: { dealValue: true },
    });
    const all = await this.prisma.lead.groupBy({
      by: ['source', 'status'],
      where: { tenantId, status: 'CONVERTED' },
      _count: { id: true },
      _sum: { dealValue: true },
    });
    const convertedBySource = new Map<string, { count: number; revenue: number }>();
    for (const row of all) {
      const prev = convertedBySource.get(row.source) || { count: 0, revenue: 0 };
      convertedBySource.set(row.source, { count: prev.count + row._count.id, revenue: prev.revenue + (row._sum.dealValue || 0) });
    }
    const campaigns = await this.prisma.campaign.findMany({
      where: { tenantId },
      select: { sourceType: true, totalSpend: true, totalLeads: true },
    });
    const spendBySource = new Map<string, number>();
    for (const c of campaigns) {
      if (c.sourceType && c.totalSpend) {
        spendBySource.set(c.sourceType, (spendBySource.get(c.sourceType) || 0) + c.totalSpend);
      }
    }
    return sourceGroups.map(g => {
      const total = g._count.id;
      const converted = convertedBySource.get(g.source) || { count: 0, revenue: 0 };
      const spend = spendBySource.get(g.source) || 0;
      const cpl = spend > 0 && total > 0 ? +(spend / total).toFixed(2) : 0;
      const roi = spend > 0 ? +(((converted.revenue - spend) / spend) * 100).toFixed(1) : 0;
      return {
        source: g.source,
        totalLeads: total,
        convertedLeads: converted.count,
        conversionRate: total > 0 ? +((converted.count / total) * 100).toFixed(1) : 0,
        totalSpend: spend,
        costPerLead: cpl,
        revenue: converted.revenue,
        roi,
      };
    }).sort((a, b) => b.conversionRate - a.conversionRate);
  }

  async getBrokerRankings(tenantId: string) {
    const brokers = await this.prisma.channelPartner.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: { _count: { select: { leads: true } } },
    });
    const results = await Promise.all(brokers.map(async (b) => {
      const totalLeads = b._count.leads;
      const convertedLeads = await this.prisma.lead.count({
        where: { channelPartnerId: b.id, status: 'CONVERTED' },
      });
      const dealAgg = await this.prisma.lead.aggregate({
        where: { channelPartnerId: b.id, status: 'CONVERTED' },
        _sum: { dealValue: true },
      });
      const totalDealValue = dealAgg._sum.dealValue || 0;
      const commissionOwed = b.commissionRate ? +((totalDealValue * b.commissionRate) / 100).toFixed(2) : 0;
      return {
        brokerId: b.id,
        brokerName: b.company || b.name,
        totalLeads,
        convertedLeads,
        conversionRate: totalLeads > 0 ? +((convertedLeads / totalLeads) * 100).toFixed(1) : 0,
        totalDealValue,
        commissionRate: b.commissionRate || 0,
        commissionOwed,
      };
    }));
    return results.sort((a, b) => b.conversionRate - a.conversionRate);
  }

  async dataHealth() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000);

    const [missingEmail, missingPhone, duplicateEmails, duplicatePhones, stuckLeads, unassignedLeads, staleHot, totalContacts, totalLeads, urgentOpenTickets, slaBreachedTickets] = await Promise.all([
      this.prisma.contact.count({ where: { OR: [{ email: null }, { email: '' }] } }),
      this.prisma.contact.count({ where: { OR: [{ phone: null }, { phone: '' }] } }),
      this.prisma.contact.groupBy({ by: ['email'], _count: true, having: { email: { _count: { gt: 1 } } } }),
      this.prisma.contact.groupBy({ by: ['phone'], _count: true, having: { phone: { _count: { gt: 1 } } } }),
      this.prisma.lead.count({ where: { status: 'NEW', createdAt: { lt: sevenDaysAgo } } }),
      this.prisma.lead.count({ where: { assignedAgentId: null, status: { notIn: ['CONVERTED', 'LOST'] } } }),
      this.prisma.lead.count({ where: { segment: 'HOT', updatedAt: { lt: threeDaysAgo } } }),
      this.prisma.contact.count(),
      this.prisma.lead.count({ where: { status: { notIn: ['CONVERTED', 'LOST'] } } }),
      this.prisma.ticket.count({ where: { priority: 'URGENT', status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
      this.prisma.ticket.count({ where: { dueAt: { lt: new Date() }, status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
    ]);

    const insights: { type: 'warning' | 'error' | 'info'; message: string; count: number; action: string; page: 'leads' | 'contacts' | 'tickets'; filters?: Record<string, string> }[] = [];

    if (missingEmail > 0) insights.push({ type: 'warning', message: `${missingEmail} contacts have no email address`, count: missingEmail, action: 'Add emails', page: 'contacts' });
    if (missingPhone > 0) insights.push({ type: 'warning', message: `${missingPhone} contacts have no phone number`, count: missingPhone, action: 'Add phones', page: 'contacts' });
    if (duplicateEmails.length > 0) insights.push({ type: 'error', message: `${duplicateEmails.length} duplicate emails found`, count: duplicateEmails.length, action: 'Merge duplicates', page: 'contacts' });
    if (duplicatePhones.length > 0) insights.push({ type: 'error', message: `${duplicatePhones.length} duplicate phone numbers found`, count: duplicatePhones.length, action: 'Merge duplicates', page: 'contacts' });
    if (stuckLeads > 0) insights.push({ type: 'error', message: `${stuckLeads} leads stuck in New for 7+ days`, count: stuckLeads, action: 'Follow up', page: 'leads', filters: { status: 'NEW' } });
    if (unassignedLeads > 0) insights.push({ type: 'warning', message: `${unassignedLeads} active leads have no owner`, count: unassignedLeads, action: 'Assign owners', page: 'leads' });
    if (staleHot > 0) insights.push({ type: 'error', message: `${staleHot} hot leads not contacted in 3+ days`, count: staleHot, action: 'Reach out now', page: 'leads', filters: { segment: 'HOT' } });
    if (urgentOpenTickets > 0) insights.push({ type: 'error', message: `${urgentOpenTickets} urgent tickets still need attention`, count: urgentOpenTickets, action: 'Review tickets', page: 'tickets' });
    if (slaBreachedTickets > 0) insights.push({ type: 'error', message: `${slaBreachedTickets} tickets have breached SLA`, count: slaBreachedTickets, action: 'Review tickets', page: 'tickets' });

    return {
      totalContacts,
      totalLeads,
      dataQuality: {
        complete: totalContacts > 0 ? Math.round(((totalContacts - missingEmail - missingPhone) / totalContacts) * 100) : 100,
        duplicates: duplicateEmails.length + duplicatePhones.length,
      },
      insights,
    };
  }
}
