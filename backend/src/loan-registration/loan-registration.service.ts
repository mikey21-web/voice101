import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Loan + registration coordination workspace (spec 67.2) — tracks staff-confirmed status only; never performs bank underwriting or government registration. */
@Injectable()
export class LoanRegistrationService {
  constructor(private prisma: PrismaService) {}

  async getOrCreate(tenantId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, tenantId } });
    if (!booking) throw new NotFoundException('Booking not found');
    return this.ser(await this.prisma.loanRegistrationCase.upsert({
      where: { bookingId },
      create: { tenantId, bookingId },
      update: {},
    }));
  }

  async update(tenantId: string, bookingId: string, data: Partial<{
    lenderName: string; loanAmountPaise: number; sanctionStatus: string; sanctionDate: string;
    disbursementStatus: string; disbursedAmountPaise: number;
    registrationAppointmentAt: string; registrationChargesPaise: number; registrationReceiptNumber: string; registeredAt: string;
    bankNocStatus: string; notes: string;
  }>) {
    await this.getOrCreate(tenantId, bookingId);
    const { loanAmountPaise, disbursedAmountPaise, registrationChargesPaise, sanctionDate, registrationAppointmentAt, registeredAt, ...rest } = data;
    return this.ser(await this.prisma.loanRegistrationCase.update({
      where: { bookingId },
      data: {
        ...rest,
        loanAmountPaise: loanAmountPaise != null ? BigInt(loanAmountPaise) : undefined,
        disbursedAmountPaise: disbursedAmountPaise != null ? BigInt(disbursedAmountPaise) : undefined,
        registrationChargesPaise: registrationChargesPaise != null ? BigInt(registrationChargesPaise) : undefined,
        sanctionDate: sanctionDate ? new Date(sanctionDate) : undefined,
        registrationAppointmentAt: registrationAppointmentAt ? new Date(registrationAppointmentAt) : undefined,
        registeredAt: registeredAt ? new Date(registeredAt) : undefined,
      } as any,
    }));
  }

  /** Prisma returns paise columns as BigInt, which breaks JSON.stringify. Serialize to string everywhere. */
  private ser(c: any) {
    if (!c) return c;
    return { ...c, loanAmountPaise: c.loanAmountPaise?.toString(), disbursedAmountPaise: c.disbursedAmountPaise?.toString(), registrationChargesPaise: c.registrationChargesPaise?.toString() };
  }

  /** One combined read: loan/registration status + KYC checklist + generated documents + e-sign state, so staff don't tab-hop across four screens for one buyer. */
  async getWorkspace(tenantId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, tenantId } });
    if (!booking) throw new NotFoundException('Booking not found');

    const [loanCase, kycDocs, generatedDocs] = await Promise.all([
      this.getOrCreate(tenantId, bookingId),
      this.prisma.buyerDocument.findMany({ where: { tenantId, leadId: booking.leadId } }),
      this.prisma.generatedDocument.findMany({ where: { tenantId, bookingId }, include: { esignRequests: true } }),
    ]);

    return {
      loanRegistration: loanCase,
      kycChecklist: kycDocs.map(d => ({ id: d.id, type: d.type, status: d.status })),
      documents: generatedDocs.map(d => ({ id: d.id, documentType: (d.snapshot as any)?.documentType, esignStatus: d.esignRequests[0]?.status || null })),
      missingBeforeRegistration: kycDocs.filter(d => !['VERIFIED', 'WAIVED'].includes(d.status)).map(d => d.type),
    };
  }
}
