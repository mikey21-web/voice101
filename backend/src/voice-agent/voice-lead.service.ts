import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Leads surfaced by the VoiceEmployee engine — populated automatically by
 * VoiceCallService.handleWebhook, never written directly (mirrors Outpero's own model, where
 * a lead row is a byproduct of a call, not a separately-managed object). */
@Injectable()
export class VoiceLeadService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string, filters: { employeeId?: string; outcome?: string; limit?: number } = {}) {
    return this.prisma.voiceLead.findMany({
      where: { tenantId, employeeId: filters.employeeId, outcome: filters.outcome, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
      include: { employee: { select: { name: true } } },
    });
  }

  async get(tenantId: string, id: string) {
    const lead = await this.prisma.voiceLead.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }
}
