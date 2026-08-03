import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TimelineService } from '../timeline/timeline.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UnitHoldStatus, UnitStatus } from '@prisma/client';
import { FollowUpSchedulerService } from '../automation/follow-up-scheduler.service';

@Injectable()
export class UnitHoldsService {
  private readonly logger = new Logger(UnitHoldsService.name);
  private readonly holdHours: number;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private timeline: TimelineService,
    private auditLogs: AuditLogsService,
    private followUps: FollowUpSchedulerService,
  ) {
    this.holdHours = Number(this.config.get('HOLD_DURATION_HOURS', '48'));
  }

  /**
   * Atomic hold algorithm (spec 48.7): read unit, reject if not AVAILABLE or
   * an active hold already exists, then transition the unit only where its
   * `version` still matches what we read — so two salespeople racing to hold
   * the same unit can't both succeed. The loser gets UNIT_NOT_AVAILABLE.
   */
  async requestHold(data: {
    tenantId: string;
    unitId: string;
    leadId: string;
    requestedById?: string;
    holdHours?: number;
  }) {
    const unit = await this.prisma.unit.findFirst({ where: { id: data.unitId, tenantId: data.tenantId } });
    if (!unit) throw new NotFoundException('Unit not found');
    if (unit.status !== UnitStatus.AVAILABLE) {
      throw new ConflictException({ code: 'UNIT_NOT_AVAILABLE', message: `Unit is ${unit.status}` });
    }

    const activeHold = await this.prisma.unitHold.findFirst({
      where: { unitId: data.unitId, status: UnitHoldStatus.ACTIVE },
    });
    if (activeHold) throw new ConflictException({ code: 'UNIT_NOT_AVAILABLE', message: 'Unit already has an active hold' });

    const lead = await this.prisma.lead.findFirst({ where: { id: data.leadId, tenantId: data.tenantId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const expiresAt = new Date(Date.now() + (data.holdHours || this.holdHours) * 60 * 60 * 1000);

    const hold = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.unit.updateMany({
        where: { id: unit.id, version: unit.version, status: UnitStatus.AVAILABLE },
        data: { status: UnitStatus.ON_HOLD, version: { increment: 1 }, leadId: data.leadId },
      });
      if (claim.count === 0) {
        throw new ConflictException({ code: 'UNIT_NOT_AVAILABLE', message: 'Unit was claimed by someone else' });
      }

      const h = await tx.unitHold.create({
        data: {
          tenantId: data.tenantId,
          unitId: data.unitId,
          leadId: data.leadId,
          requestedById: data.requestedById,
          expiresAt,
        },
      });

      await tx.unitStatusHistory.create({
        data: {
          unitId: unit.id,
          fromStatus: unit.status,
          toStatus: UnitStatus.ON_HOLD,
          reason: 'hold_created',
          changedById: data.requestedById,
        },
      });

      return h;
    });

    await this.timeline.add({
      type: 'unit_hold_created',
      title: `Unit ${unit.unitNumber} held until ${expiresAt.toLocaleString('en-IN')}`,
      leadId: data.leadId,
      metadata: { unitHoldId: hold.id, unitId: unit.id },
      createdById: data.requestedById,
    });
    await this.auditLogs.log('CREATE', 'UnitHold', hold.id, data.requestedById, { unitId: unit.id, expiresAt });

    return hold;
  }

  async findAll(tenantId: string, query: { status?: string; unitId?: string; leadId?: string; page?: number; limit?: number }) {
    const { status, unitId, leadId, page = 1, limit = 20 } = query;
    const where: any = { tenantId };
    if (status) where.status = status;
    if (unitId) where.unitId = unitId;
    if (leadId) where.leadId = leadId;

    const [data, total] = await Promise.all([
      this.prisma.unitHold.findMany({
        where,
        skip: (+page - 1) * +limit,
        take: +limit,
        orderBy: { createdAt: 'desc' },
        include: { unit: { select: { id: true, unitNumber: true } }, lead: { select: { id: true, contact: { select: { name: true } } } } },
      }),
      this.prisma.unitHold.count({ where }),
    ]);
    return { data, meta: { total, page: +page, limit: +limit } };
  }

  async findOne(tenantId: string, id: string) {
    const hold = await this.prisma.unitHold.findFirst({ where: { id, tenantId } });
    if (!hold) throw new NotFoundException('Unit hold not found');
    return hold;
  }

  /** Only a manager/owner may extend — enforced by @Roles at the controller. */
  async extend(tenantId: string, id: string, newExpiresAt: Date, actorId?: string) {
    const hold = await this.findOne(tenantId, id);
    if (hold.status !== UnitHoldStatus.ACTIVE) throw new ForbiddenException('Only an active hold can be extended');

    const updated = await this.prisma.unitHold.update({
      where: { id: hold.id },
      data: { expiresAt: newExpiresAt, approvedById: actorId },
    });
    await this.auditLogs.log('EXTEND', 'UnitHold', id, actorId, { before: hold.expiresAt, after: newExpiresAt });
    return updated;
  }

  async release(tenantId: string, id: string, reason: string | undefined, actorId?: string) {
    const hold = await this.findOne(tenantId, id);
    if (hold.status !== UnitHoldStatus.ACTIVE) throw new ForbiddenException('Only an active hold can be released');

    const released = await this.releaseAtomically(hold, UnitHoldStatus.RELEASED, reason, actorId);
    await this.timeline.add({
      type: 'unit_hold_released',
      title: 'Unit hold released',
      leadId: hold.leadId,
      metadata: { unitHoldId: id, reason },
      createdById: actorId,
    });
    await this.auditLogs.log('RELEASE', 'UnitHold', id, actorId, { reason });
    return released;
  }

  /**
   * Heartbeat scan (mirrors SiteVisitsService.scanNoShows): release any ACTIVE
   * hold whose expiry has passed. Verifies current unit status before
   * touching it — never auto-releases a unit that has since been booked.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async autoReleaseBatches(): Promise<number> {
    const now = new Date();
    const batches = await this.prisma.inventoryReleaseBatch.findMany({
      where: { status: 'PLANNED', releaseAt: { lte: now } },
    });
    let released = 0;
    for (const batch of batches) {
      await this.prisma.$transaction(async (tx) => {
        await tx.inventoryReleaseBatch.update({ where: { id: batch.id }, data: { status: 'RELEASED' } });
        if (batch.unitIds?.length) {
          await tx.unit.updateMany({ where: { id: { in: batch.unitIds as string[] }, status: UnitStatus.BLOCKED }, data: { status: UnitStatus.AVAILABLE } });
        }
      });
      released++;
    }
    if (released > 0) this.logger.log(`Auto-released ${released} inventory batch(es)`);
    return released;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scanExpiredHolds(): Promise<number> {
    const now = new Date();
    const expired = await this.prisma.unitHold.findMany({
      where: { status: UnitHoldStatus.ACTIVE, expiresAt: { lt: now } },
      take: 50,
      include: { lead: { select: { assignedAgentId: true, contact: { select: { name: true } } } }, unit: { select: { unitNumber: true } } },
    });

    let released = 0;
    for (const hold of expired) {
      try {
        await this.releaseAtomically(hold, UnitHoldStatus.EXPIRED, 'Hold expired', undefined);
        await this.timeline.add({
          type: 'unit_hold_expired',
          title: 'Unit hold expired and was released automatically',
          leadId: hold.leadId,
          metadata: { unitHoldId: hold.id },
        });

        const buyerName = (hold as any).lead?.contact?.name?.split(/\s+/)[0] || 'Buyer';
        const unitNum = (hold as any).unit?.unitNumber || '';
        const text = `Hi, the hold on unit ${unitNum} for ${buyerName} has expired and been released automatically. Please follow up if the buyer is still interested.`;

        await this.followUps.schedule({
          leadId: hold.leadId,
          kind: 'notification',
          runAt: new Date(Date.now() + 1000),
          dedupeKey: `hold_expired_notif:${hold.id}`,
          payload: { channel: 'WHATSAPP', text, unitHoldId: hold.id, unitId: hold.unitId },
          revive: true,
        });

        released++;
      } catch (e: any) {
        this.logger.warn(`Failed to auto-release hold ${hold.id}: ${e.message}`);
      }
    }
    if (released > 0) this.logger.log(`Unit-hold expiry scan: released ${released} hold(s)`);
    return released;
  }

  private async releaseAtomically(
    hold: { id: string; unitId: string },
    toStatus: typeof UnitHoldStatus.RELEASED | typeof UnitHoldStatus.EXPIRED,
    reason: string | undefined,
    actorId: string | undefined,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.unitHold.updateMany({
        where: { id: hold.id, status: UnitHoldStatus.ACTIVE },
        data: { status: toStatus, releasedAt: new Date(), releaseReason: reason },
      });
      if (claim.count === 0) throw new ConflictException('Hold was already resolved');

      // Only put the unit back to AVAILABLE if it's still ON_HOLD — a hold
      // that was already consumed by a booking must not be reopened here.
      const unit = await tx.unit.findUnique({ where: { id: hold.unitId } });
      if (unit && unit.status === UnitStatus.ON_HOLD) {
        await tx.unit.update({
          where: { id: unit.id },
          data: { status: UnitStatus.AVAILABLE, leadId: null, version: { increment: 1 } },
        });
        await tx.unitStatusHistory.create({
          data: {
            unitId: unit.id,
            fromStatus: UnitStatus.ON_HOLD,
            toStatus: UnitStatus.AVAILABLE,
            reason: reason || 'hold_released',
            changedById: actorId,
          },
        });
      }

      return tx.unitHold.findUniqueOrThrow({ where: { id: hold.id } });
    });
  }
}

