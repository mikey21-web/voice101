import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TimelineService } from '../timeline/timeline.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PostSalesStage, BuyerDocumentStatus, PaymentScheduleStatus, BookingStatus } from '@prisma/client';

/** Ordered lifecycle (spec 67.1) — each transition only ever moves exactly one step forward. */
const STAGE_ORDER: PostSalesStage[] = [
  PostSalesStage.BOOKING_CONFIRMED,
  PostSalesStage.KYC_IN_PROGRESS,
  PostSalesStage.ALLOTMENT_ISSUED,
  PostSalesStage.AGREEMENT_IN_PROGRESS,
  PostSalesStage.AGREEMENT_REGISTERED,
  PostSalesStage.PAYMENT_ACTIVE,
  PostSalesStage.PRE_POSSESSION,
  PostSalesStage.POSSESSION_OFFERED,
  PostSalesStage.HANDED_OVER,
  PostSalesStage.POST_POSSESSION_SUPPORT,
];

const REQUIRED_KYC_TYPES = ['PAN', 'ADDRESS_PROOF'] as const;

@Injectable()
export class PostSalesService {
  constructor(
    private prisma: PrismaService,
    private timeline: TimelineService,
    private auditLogs: AuditLogsService,
  ) {}

  async getCurrentStage(tenantId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, tenantId } });
    if (!booking) throw new NotFoundException('Booking not found');
    return { stage: booking.postSalesStage || PostSalesStage.BOOKING_CONFIRMED, changedAt: booking.postSalesStageChangedAt };
  }

  async getHistory(tenantId: string, bookingId: string) {
    return this.prisma.postSalesTransition.findMany({ where: { tenantId, bookingId }, orderBy: { changedAt: 'asc' } });
  }

  /**
   * Advances exactly one stage forward, running the precondition check for
   * the target stage first (spec 67.1: "each transition has document/
   * payment/checklist/approval preconditions"). A failed precondition
   * returns a clear reason rather than silently allowing the jump — this is
   * deliberately not a free-form dropdown.
   */
  async getAccountStatement(tenantId: string, bookingId: string) {
    const booking: any = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
      include: {
        unit: { select: { unitNumber: true, price: true, areaSqft: true, project: { select: { name: true } } } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const schedules = await this.prisma.paymentSchedule.findMany({
      where: { bookingId, tenantId },
      orderBy: { dueDate: 'asc' },
    });
    const receipts = await this.prisma.paymentReceipt.findMany({
      where: { bookingId, tenantId },
      orderBy: { receivedAt: 'asc' },
    });

    const totalPayable = schedules.reduce((s, p) => s + Math.round(Number(p.amount || 0) * 100), 0);
    const totalPaid = receipts.reduce((s, r) => s + Number(r.amountPaise), 0);
    const overdue = schedules
      .filter(s => s.status === 'PENDING' && !!s.dueDate && new Date(s.dueDate) < new Date())
      .reduce((s, p) => s + Math.round(Number(p.amount || 0) * 100), 0);

    return {
      booking: { id: booking.id, unitNumber: booking.unit?.unitNumber, projectName: booking.unit?.project?.name },
      summary: { totalPayable, totalPaid, outstanding: totalPayable - totalPaid, overdue },
      paymentSchedule: schedules,
      receipts,
    };
  }

  async addConstructionUpdate(tenantId: string, bookingId: string, message: string, imageUrl?: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, tenantId } });
    if (!booking) throw new NotFoundException('Booking not found');
    return this.timeline.add({
      type: 'construction_update',
      title: 'Construction Update',
      description: message,
      leadId: booking.leadId,
      metadata: { bookingId, ...(imageUrl ? { imageUrl } : {}) },
    });
  }

  async advance(tenantId: string, bookingId: string, toStage: PostSalesStage, actorId: string | undefined, reason?: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, tenantId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ForbiddenException('Post-sales lifecycle only applies to a CONFIRMED booking');
    }

    const fromStage = booking.postSalesStage || PostSalesStage.BOOKING_CONFIRMED;
    const fromIndex = STAGE_ORDER.indexOf(fromStage);
    const toIndex = STAGE_ORDER.indexOf(toStage);
    if (toIndex !== fromIndex + 1) {
      throw new BadRequestException(`Cannot move from ${fromStage} directly to ${toStage} — stages advance one at a time`);
    }

    const precondition = await this.checkPrecondition(tenantId, booking.id, booking.leadId, toStage);
    if (!precondition.passed) {
      throw new ForbiddenException(`Precondition failed for ${toStage}: ${precondition.reason}`);
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.postSalesTransition.create({
        data: {
          tenantId,
          bookingId,
          fromStage,
          toStage,
          preconditionsSnapshot: precondition as any,
          reason,
          changedById: actorId,
        },
      }),
      this.prisma.booking.update({
        where: { id: bookingId },
        data: { postSalesStage: toStage, postSalesStageChangedAt: new Date() },
      }),
    ]);

    await this.timeline.add({
      type: 'post_sales_stage_changed',
      title: `Post-sales stage: ${fromStage} → ${toStage}`,
      leadId: booking.leadId,
      metadata: { bookingId, fromStage, toStage },
      createdById: actorId,
    });
    await this.auditLogs.log('ADVANCE_STAGE', 'Booking', bookingId, actorId, { fromStage, toStage, reason });

    return { ...updated, bookingAmountPaise: (updated as any).bookingAmountPaise?.toString() };
  }

  private async checkPrecondition(tenantId: string, bookingId: string, leadId: string, toStage: PostSalesStage): Promise<{ passed: boolean; reason?: string; checkedAt: string }> {
    const checkedAt = new Date().toISOString();

    if (toStage === PostSalesStage.ALLOTMENT_ISSUED) {
      const docs = await this.prisma.buyerDocument.findMany({ where: { tenantId, leadId } });
      const ok = new Set(docs.filter(d => d.status === BuyerDocumentStatus.VERIFIED || d.status === BuyerDocumentStatus.WAIVED).map(d => d.type));
      const missing = REQUIRED_KYC_TYPES.filter(t => !ok.has(t as any));
      if (missing.length > 0) return { passed: false, reason: `Missing verified KYC documents: ${missing.join(', ')}`, checkedAt };
    }

    if (toStage === PostSalesStage.AGREEMENT_REGISTERED) {
      const agreementDoc = await this.prisma.generatedDocument.findFirst({
        where: { tenantId, bookingId },
      });
      const hasAgreement = agreementDoc && String((agreementDoc.snapshot as any)?.documentType || '').toUpperCase().includes('AGREEMENT');
      if (!hasAgreement) return { passed: false, reason: 'No generated agreement document found for this booking', checkedAt };
    }

    if (toStage === PostSalesStage.PRE_POSSESSION) {
      const overdue = await this.prisma.paymentSchedule.count({ where: { tenantId, bookingId, status: PaymentScheduleStatus.OVERDUE } });
      if (overdue > 0) return { passed: false, reason: `${overdue} overdue payment milestone(s)`, checkedAt };
    }

    if (toStage === PostSalesStage.POSSESSION_OFFERED) {
      const unpaid = await this.prisma.paymentSchedule.count({
        where: { tenantId, bookingId, status: { notIn: [PaymentScheduleStatus.PAID, PaymentScheduleStatus.WAIVED] } },
      });
      if (unpaid > 0) return { passed: false, reason: `${unpaid} payment milestone(s) not yet paid or waived`, checkedAt };

      const possession = await this.prisma.possessionCase.findUnique({ where: { bookingId } });
      const ready = possession && possession.accountClearanceConfirmed && possession.documentClearanceConfirmed && possession.unitReadinessConfirmed;
      if (!ready) return { passed: false, reason: 'Possession case preconditions (account/document/unit clearance) not all confirmed', checkedAt };
    }

    if (toStage === PostSalesStage.HANDED_OVER) {
      const possession = await this.prisma.possessionCase.findUnique({ where: { bookingId } });
      if (!possession?.possessionAcknowledgedAt) return { passed: false, reason: 'Buyer has not acknowledged possession yet', checkedAt };
    }

    return { passed: true, checkedAt };
  }
}


