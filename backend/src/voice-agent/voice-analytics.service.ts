import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VoiceAnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getTenantAnalytics(tenantId: string, dateRangeHours = 24) {
    const since = new Date(Date.now() - dateRangeHours * 60 * 60 * 1000);

    const [calls, employees] = await Promise.all([
      this.prisma.voiceCall.findMany({
        where: { tenantId, createdAt: { gte: since } },
        select: { employeeId: true, durationS: true, disposition: true, createdAt: true },
      }),
      this.prisma.voiceEmployee.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true, status: true },
      }),
    ]);

    const totalCalls = calls.length;
    const totalDuration = calls.reduce((sum, c) => sum + (c.durationS || 0), 0);
    const totalCost = this.computeTotalCost(totalDuration);
    const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;

    const dispositions = this.groupBy(calls, 'disposition');
    const successRate = ((dispositions['completed']?.length || 0) / totalCalls) * 100 || 0;

    const byEmployee = this.groupBy(calls, 'employeeId');
    const perEmployee = employees.map((e) => {
      const emp = byEmployee[e.id] || [];
      const duration = emp.reduce((sum, c) => sum + (c.durationS || 0), 0);
      return {
        id: e.id,
        name: e.name,
        status: e.status,
        calls: emp.length,
        duration: Math.round(duration / 60),
        cost: Math.round(this.computeTotalCost(duration) * 100) / 100,
      };
    });

    const funnel = this.computeFunnel(calls);

    return {
      period: { startAt: since, endAt: new Date(), hoursAgo: dateRangeHours },
      summary: {
        totalCalls,
        totalDuration: Math.round(totalDuration / 60),
        totalCost: Math.round(totalCost * 100) / 100,
        avgDuration: Math.round(avgDuration),
        successRate: Math.round(successRate * 100) / 100,
      },
      dispositions: Object.fromEntries(
        Object.entries(dispositions).map(([k, v]) => [k || 'unknown', v.length]),
      ),
      perEmployee,
      funnel,
    };
  }

  private computeTotalCost(durationSeconds: number): number {
    const mins = durationSeconds / 60;
    return mins * (0.50 + 2.50 + 0.15 + 0.60);
  }

  private groupBy<T>(arr: T[], key: keyof T) {
    return arr.reduce(
      (acc, item) => {
        const k = String(item[key]);
        if (!acc[k]) acc[k] = [];
        acc[k].push(item);
        return acc;
      },
      {} as Record<string, T[]>,
    );
  }

  private computeFunnel(calls: any[]) {
    const all = calls.length;
    const long30 = calls.filter((c) => (c.durationS || 0) >= 30).length;
    const completed = calls.filter((c) => c.disposition === 'completed').length;

    return {
      entered: all,
      engaged: long30,
      completed,
      engagementRate: all > 0 ? ((long30 / all) * 100).toFixed(1) + '%' : '0%',
      completionRate: all > 0 ? ((completed / all) * 100).toFixed(1) + '%' : '0%',
    };
  }
}
