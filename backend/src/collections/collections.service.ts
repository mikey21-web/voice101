import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TimelineService } from '../timeline/timeline.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PaymentReceiptStatus, LedgerEntryType } from '@prisma/client';

/**
 * Ledger sign convention used here (spec 48.11): DEBIT increases the amount a
 * buyer owes; PAYMENT/CREDIT/WAIVER/REFUND reduce it; REVERSAL adds a payment
 * back onto the balance. This is a bookkeeping default, not a tax/legal
 * ruling — confirm with the tenant's accountant before relying on it for
 * statements sent to buyers (spec 55.3 never-guess rule on finance policy).
 */
const INCREASES_BALANCE: LedgerEntryType[] = [LedgerEntryType.DEBIT, LedgerEntryType.REVERSAL];

@Injectable()
export class CollectionsService {
  constructor(
    private prisma: PrismaService,
    private timeline: TimelineService,
    private auditLogs: AuditLogsService,
  ) {}

  /**
   * Records a payment as PENDING_RECONCILIATION. This never touches the
   * legacy Float PaymentSchedule.amount — allocations are informational
   * paise records; marking a schedule PAID remains a manual step through the
   * existing payment-schedules module until that model is migrated too.
   */
  async recordReceipt(tenantId: string, data: {
    leadId: string;
    bookingId?: string;
    externalRef?: string;
    amountPaise: number;
    mode: string;
    allocations?: { paymentScheduleId: string; amountPaise: number }[];
    recordedById?: string;
  }) {
    const lead = await this.prisma.lead.findFirst({ where: { id: data.leadId, tenantId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const receipt = await this.prisma.paymentReceipt.create({
      data: {
        tenantId,
        leadId: data.leadId,
        bookingId: data.bookingId,
        externalRef: data.externalRef,
        amountPaise: BigInt(data.amountPaise),
        mode: data.mode,
        allocations: data.allocations
          ? { create: data.allocations.map(a => ({ paymentScheduleId: a.paymentScheduleId, amountPaise: BigInt(a.amountPaise) })) }
          : undefined,
      },
      include: { allocations: true },
    });

    await this.timeline.add({
      type: 'payment_receipt_recorded',
      title: 'Payment received — pending reconciliation',
      leadId: data.leadId,
      metadata: { paymentReceiptId: receipt.id, amountPaise: data.amountPaise },
      createdById: data.recordedById,
    });

    return this.serializable(receipt);
  }

  async findAll(tenantId: string, query: { leadId?: string; bookingId?: string; status?: string; page?: number; limit?: number }) {
    const { leadId, bookingId, status, page = 1, limit = 20 } = query;
    const where: any = { tenantId };
    if (leadId) where.leadId = leadId;
    if (bookingId) where.bookingId = bookingId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.paymentReceipt.findMany({
        where, skip: (+page - 1) * +limit, take: +limit, orderBy: { receivedAt: 'desc' },
        include: { allocations: true, lead: { select: { id: true, contact: { select: { name: true } } } } },
      }),
      this.prisma.paymentReceipt.count({ where }),
    ]);
    return { data: data.map(r => this.serializable(r)), meta: { total, page: +page, limit: +limit } };
  }

  async findOne(tenantId: string, id: string) {
    const receipt = await this.prisma.paymentReceipt.findFirst({ where: { id, tenantId }, include: { allocations: true } });
    if (!receipt) throw new NotFoundException('Payment receipt not found');
    return this.serializable(receipt);
  }

  /** Only collections/admin/manager/owner — enforced by @Roles. Confirming writes an immutable PAYMENT ledger entry. */
  async confirm(tenantId: string, id: string, actorId?: string) {
    const receipt = await this.prisma.paymentReceipt.findFirst({ where: { id, tenantId } });
    if (!receipt) throw new NotFoundException('Payment receipt not found');
    if (receipt.status !== PaymentReceiptStatus.PENDING_RECONCILIATION) {
      throw new ForbiddenException(`Receipt is ${receipt.status} and cannot be confirmed`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.paymentReceipt.update({
        where: { id },
        data: { status: PaymentReceiptStatus.CONFIRMED, confirmedById: actorId, confirmedAt: new Date() },
      }),
      this.prisma.ledgerEntry.create({
        data: {
          tenantId,
          leadId: receipt.leadId,
          bookingId: receipt.bookingId,
          type: LedgerEntryType.PAYMENT,
          amountPaise: receipt.amountPaise,
          relatedReceiptId: id,
          description: `Payment confirmed (${receipt.mode})`,
          createdById: actorId,
        },
      }),
    ]);

    await this.timeline.add({ type: 'payment_confirmed', title: 'Payment confirmed', leadId: receipt.leadId, metadata: { paymentReceiptId: id }, createdById: actorId });
    await this.auditLogs.log('CONFIRM', 'PaymentReceipt', id, actorId, {});

    // Auto-link: find the oldest PENDING/OVERDUE schedule for this lead and mark it PAID
    try {
      const oldestDue = await this.prisma.paymentSchedule.findFirst({
        where: { tenantId, leadId: receipt.leadId, status: { in: ['PENDING', 'OVERDUE'] as any } },
        orderBy: { dueDate: 'asc' },
      });
      if (oldestDue) {
        await this.prisma.paymentSchedule.update({
          where: { id: oldestDue.id },
          data: { status: 'PAID' as any, paidAt: new Date() },
        });
        await this.timeline.add({ type: 'payment_schedule_paid', title: `Milestone "${oldestDue.label}" auto-marked paid`, leadId: receipt.leadId, metadata: { paymentReceiptId: id, paymentScheduleId: oldestDue.id }, createdById: actorId });
      }
    } catch { /* non-critical; don't fail the confirm */ }

    return this.serializable(updated);
  }

  /** A confirmed receipt is never edited or deleted — only reversed, with a new ledger entry recording the reversal. */
  async reverse(tenantId: string, id: string, reason: string, actorId?: string) {
    const receipt = await this.prisma.paymentReceipt.findFirst({ where: { id, tenantId } });
    if (!receipt) throw new NotFoundException('Payment receipt not found');
    if (receipt.status !== PaymentReceiptStatus.CONFIRMED) {
      throw new ForbiddenException(`Only a CONFIRMED receipt can be reversed (current status: ${receipt.status})`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.paymentReceipt.update({
        where: { id },
        data: { status: PaymentReceiptStatus.REVERSED, reversedAt: new Date(), reversalReason: reason },
      }),
      this.prisma.ledgerEntry.create({
        data: {
          tenantId,
          leadId: receipt.leadId,
          bookingId: receipt.bookingId,
          type: LedgerEntryType.REVERSAL,
          amountPaise: receipt.amountPaise,
          relatedReceiptId: id,
          description: reason,
          createdById: actorId,
        },
      }),
    ]);

    await this.timeline.add({ type: 'payment_reversed', title: `Payment reversed: ${reason}`, leadId: receipt.leadId, metadata: { paymentReceiptId: id }, createdById: actorId });
    await this.auditLogs.log('REVERSE', 'PaymentReceipt', id, actorId, { reason });
    return this.serializable(updated);
  }

  /** Current balance is always computed from ledger entries — never hand-typed (spec 48.11). */
  async ledger(tenantId: string, leadId: string) {
    const entries = await this.prisma.ledgerEntry.findMany({ where: { tenantId, leadId }, orderBy: { createdAt: 'asc' } });
    let balancePaise = BigInt(0);
    const withRunningBalance = entries.map(e => {
      balancePaise += INCREASES_BALANCE.includes(e.type) ? e.amountPaise : -e.amountPaise;
      return { ...e, amountPaise: e.amountPaise.toString(), runningBalancePaise: balancePaise.toString() };
    });
    return { entries: withRunningBalance, balancePaise: balancePaise.toString() };
  }

  private serializable(receipt: any) {
    return {
      ...receipt,
      amountPaise: receipt.amountPaise?.toString(),
      allocations: receipt.allocations?.map((a: any) => ({ ...a, amountPaise: a.amountPaise?.toString() })),
    };
  }
}
