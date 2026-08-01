import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { LeadStatus } from '@prisma/client';
import { isLegalTransition, stageOf, SpineStage } from './spine-stage';

@Injectable()
export class AdvanceStageService {
  constructor(
    private prisma: PrismaService,
    private events: EventsService,
  ) {}

  /**
   * The only way a lead's status moves. Validates the transition, records it as
   * a Mikey autonomous action (audit + undo), and emits lead.stage_advanced.
   */
  async advanceStage(params: {
    tenantId: string;
    leadId: string;
    to: LeadStatus;
    actor: 'mikey' | 'human' | 'system';
    reason: string;
    actorUserId?: string;
  }): Promise<{ from: LeadStatus; to: LeadStatus; stage: SpineStage }> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: params.leadId, tenantId: params.tenantId },
      select: { id: true, status: true, tenantId: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    if (!isLegalTransition(lead.status, params.to)) {
      throw new BadRequestException(
        `Illegal lead transition ${lead.status} -> ${params.to}`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.lead.update({
        where: { id: lead.id },
        data: { status: params.to },
      }),
      this.prisma.mikeyAutonomousAction.create({
        data: {
          tenantId: lead.tenantId,
          findingType: 'lead.stage_advanced',
          tool: 'advance_stage',
          leadId: lead.id,
          args: {
            from: lead.status,
            to: params.to,
            actor: params.actor,
            reason: params.reason,
          },
          result: `${lead.status} -> ${params.to}`,
          undoable: true,
          undoData: { previousStatus: lead.status },
        },
      }),
    ]);

    await this.events.emit({
      type: 'lead.stage_advanced',
      source: params.actor,
      entityType: 'lead',
      entityId: lead.id,
      leadId: lead.id,
      payload: { from: lead.status, to: params.to, reason: params.reason },
      metadata: { tenantId: lead.tenantId },
      createdById: params.actorUserId,
    });

    return { from: lead.status, to: updated.status, stage: stageOf(updated.status) };
  }
}
