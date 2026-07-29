import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsOpsService {
  constructor(private prisma: PrismaService) {}

  findAll(query: any = {}) {
    const { status, type, contactId, page = 1, limit = 20 } = query;
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (contactId) where.contactId = contactId;
    return Promise.all([
      this.prisma.event.findMany({
        where,
        skip: (+page - 1) * +limit,
        take: +limit,
        orderBy: { eventDate: 'desc' },
        include: { contact: { select: { id: true, name: true } } },
      }),
      this.prisma.event.count({ where }),
    ]).then(([data, total]) => ({ data, meta: { total, page: +page, limit: +limit } }));
  }

  async findOne(id: string) {
    const e = await this.prisma.event.findUnique({
      where: { id },
      include: { contact: true, lead: true },
    });
    if (!e) throw new NotFoundException('Event not found');
    return e;
  }

  create(data: any) { return this.prisma.event.create({ data }); }

  async update(id: string, data: any) { await this.findOne(id); return this.prisma.event.update({ where: { id }, data }); }

  // --- sub-resources ---

  async listFunctions(eventId: string) { await this.findOne(eventId); return this.prisma.eventFunction.findMany({ where: { eventId }, orderBy: { startAt: 'asc' } }); }
  createFunction(eventId: string, data: any) { return this.prisma.eventFunction.create({ data: { ...data, eventId } }); }

  async listMoodboard(eventId: string) { await this.findOne(eventId); return this.prisma.eventMoodboardIdea.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }); }
  createMoodboardIdea(eventId: string, data: any) { return this.prisma.eventMoodboardIdea.create({ data: { ...data, eventId } }); }

  async listTeam(eventId: string) { await this.findOne(eventId); return this.prisma.eventTeamAssignment.findMany({ where: { eventId }, include: { user: { select: { id: true, name: true } } } }); }
  assignTeamMember(eventId: string, data: any) { return this.prisma.eventTeamAssignment.create({ data: { ...data, eventId } }); }

  async listVendors(eventId: string) { await this.findOne(eventId); return this.prisma.eventVendorAssignment.findMany({ where: { eventId }, include: { partner: true } }); }
  assignVendor(eventId: string, data: any) { return this.prisma.eventVendorAssignment.create({ data: { ...data, eventId } }); }

  async listFiles(eventId: string, visibility?: string) {
    await this.findOne(eventId);
    const where: any = { eventId };
    if (visibility) where.visibility = visibility;
    return this.prisma.eventFile.findMany({ where, orderBy: { createdAt: 'desc' } });
  }
  createFile(eventId: string, data: any) { return this.prisma.eventFile.create({ data: { ...data, eventId } }); }

  async listExpenses(eventId: string) { await this.findOne(eventId); return this.prisma.eventExpense.findMany({ where: { eventId }, orderBy: { expenseDate: 'desc' } }); }
  createExpense(eventId: string, data: any) { return this.prisma.eventExpense.create({ data: { ...data, eventId } }); }

  async listMilestones(eventId: string) { await this.findOne(eventId); return this.prisma.paymentMilestone.findMany({ where: { eventId }, orderBy: { dueDate: 'asc' } }); }
  createMilestone(eventId: string, data: any) { return this.prisma.paymentMilestone.create({ data: { ...data, eventId } }); }

  async listRunSheet(eventId: string) { await this.findOne(eventId); return this.prisma.runSheetItem.findMany({ where: { eventId }, orderBy: { time: 'asc' } }); }
  createRunSheetItem(eventId: string, data: any) { return this.prisma.runSheetItem.create({ data: { ...data, eventId } }); }

  // --- financials: computed funnel, no new storage ---
  async getFinancials(eventId: string) {
    const event = await this.findOne(eventId);
    const [milestones, expenses] = await Promise.all([
      this.prisma.paymentMilestone.findMany({ where: { eventId } }),
      this.prisma.eventExpense.findMany({ where: { eventId } }),
    ]);

    const budget = event.budget ?? 0;
    // Quoted/Contracted/Invoiced/Collected are sourced from Phase 2's Invoice/Quotation models once built;
    // until then, milestones stand in for the collection schedule.
    const quoted = 0;
    const contracted = 0;
    const invoiced = milestones.reduce((s, m) => s + m.amount, 0);
    const collected = 0; // becomes real once Invoice.status === 'PAID' tracking exists (Phase 2)
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const pendingReceivables = invoiced - collected;
    const projectedProfit = budget - totalExpenses;
    const actualProfit = collected - totalExpenses;
    const collectionRate = invoiced > 0 ? (collected / invoiced) * 100 : 0;
    const margin = budget > 0 ? (projectedProfit / budget) * 100 : 0;
    const risk = margin < 10 || (invoiced > 0 && collectionRate < 20);

    return {
      budget, quoted, contracted, invoiced, collected,
      pendingReceivables, expenses: totalExpenses,
      projectedProfit, actualProfit, collectionRate, margin, risk,
    };
  }

  // --- calendar aggregation ---
  async getCalendar(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const [events, tasks, siteVisits] = await Promise.all([
      this.prisma.event.findMany({ where: { eventDate: { gte: fromDate, lte: toDate } }, select: { id: true, title: true, eventDate: true, status: true } }),
      this.prisma.task.findMany({ where: { dueAt: { gte: fromDate, lte: toDate } }, select: { id: true, title: true, dueAt: true, status: true, priority: true } }),
      this.prisma.siteVisit.findMany({
        where: { startAt: { gte: fromDate, lte: toDate } },
        select: { id: true, startAt: true, status: true, lead: { select: { contact: { select: { name: true } } } }, project: { select: { name: true } } },
      }),
    ]);
    return {
      events: events.map((e) => ({ id: e.id, title: e.title, date: e.eventDate, kind: 'event', status: e.status })),
      tasks: tasks.map((t) => ({ id: t.id, title: t.title, date: t.dueAt, kind: 'task', status: t.status })),
      siteVisits: siteVisits.map((v) => ({
        id: v.id,
        title: `Site visit: ${v.lead?.contact?.name || 'Lead'} @ ${v.project?.name || 'project'}`,
        date: v.startAt,
        kind: 'site_visit',
        status: v.status,
      })),
    };
  }
}
