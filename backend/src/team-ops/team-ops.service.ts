import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeamOpsService {
  constructor(private prisma: PrismaService) {}

  // --- Leave ---
  findLeaveRequests() { return this.prisma.leaveRequest.findMany({ orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true } } } }); }

  async createLeaveRequest(data: any) {
    const teamCount = await this.prisma.user.count();
    if (teamCount === 0) throw new BadRequestException('Add a team member before requesting leave.');
    return this.prisma.leaveRequest.create({ data });
  }

  updateLeaveRequest(id: string, data: any) { return this.prisma.leaveRequest.update({ where: { id }, data }); }

  async leaveStats() {
    const [onLeaveToday, pending, approvedThisMonth, totalTeam] = await Promise.all([
      this.prisma.leaveRequest.count({ where: { status: 'APPROVED', startDate: { lte: new Date() }, endDate: { gte: new Date() } } }),
      this.prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.leaveRequest.count({ where: { status: 'APPROVED', createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
      this.prisma.user.count(),
    ]);
    return { onLeaveToday, pending, approvedThisMonth, totalTeam };
  }

  // --- Salaries (auto-derived from Team Members list; no separate "add employee" flow) ---
  async listPayroll() {
    const [users, records] = await Promise.all([
      this.prisma.user.findMany({ where: { monthlySalary: { not: null } }, select: { id: true, name: true, monthlySalary: true, salaryType: true } }),
      this.prisma.salaryRecord.findMany({ orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true } } } }),
    ]);
    const totalMonthlyPayroll = users.reduce((s, u) => s + (u.monthlySalary || 0), 0);
    return { employees: users, records, totalMonthlyPayroll, onPayroll: users.length };
  }

  createSalaryRecord(data: any) { return this.prisma.salaryRecord.create({ data }); }

  // --- Timesheet ---
  findTimesheetEntries(query: any = {}) {
    const where: any = {};
    if (query.eventId) where.eventId = query.eventId;
    if (query.userId) where.userId = query.userId;
    return this.prisma.timesheetEntry.findMany({ where, orderBy: { date: 'desc' }, include: { user: { select: { id: true, name: true } }, event: { select: { id: true, title: true } } } });
  }
  createTimesheetEntry(data: any) { return this.prisma.timesheetEntry.create({ data }); }

  // --- Team member HR fields (extends existing User) ---
  updateTeamMember(id: string, data: any) { return this.prisma.user.update({ where: { id }, data }); }
}
