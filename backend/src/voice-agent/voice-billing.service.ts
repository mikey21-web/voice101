import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Numbers, wallet and billing — matching Outpero's captured response shapes exactly (see
 * REVERSE-ENGINEERED.md §7). No real payment processor wired in — credits/rates are read-model
 * only for now; the actual charge-per-minute metering that would decrement a real balance is a
 * separate piece (needs a payment provider decision, out of scope for the engine itself). */
@Injectable()
export class VoiceBillingService {
  constructor(private prisma: PrismaService) {}

  async listNumbers(tenantId: string) {
    return this.prisma.voicePhoneNumber.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  async addNumber(tenantId: string, number: string, provider = 'twilio') {
    const existing = await this.prisma.voicePhoneNumber.findUnique({ where: { number } });
    if (existing) throw new ConflictException('Number already registered');
    return this.prisma.voicePhoneNumber.create({ data: { tenantId, number, provider } });
  }

  async setNumberKyc(tenantId: string, id: string, status: 'not_started' | 'pending' | 'verified') {
    const number = await this.prisma.voicePhoneNumber.findFirst({ where: { id, tenantId } });
    if (!number) throw new NotFoundException('Number not found');
    return this.prisma.voicePhoneNumber.update({ where: { id }, data: { kycStatus: status, dltRegistered: status === 'verified' } });
  }

  async assignNumber(tenantId: string, employeeId: string, numberId: string) {
    const [employee, number] = await Promise.all([
      this.prisma.voiceEmployee.findFirst({ where: { id: employeeId, tenantId } }),
      this.prisma.voicePhoneNumber.findFirst({ where: { id: numberId, tenantId } }),
    ]);
    if (!employee) throw new NotFoundException('Employee not found');
    if (!number) throw new NotFoundException('Number not found');
    if (number.kycStatus !== 'verified') throw new BadRequestException('Number must complete KYC before it can be assigned to an employee');
    return this.prisma.voiceEmployee.update({ where: { id: employeeId }, data: { numberId } });
  }

  /** Matches Outpero's /billing shape: credits, per-employee usage, rate card, lifetime
   * totals, runway. Rate card is the one real thing here — it should reflect your actual
   * vendor costs (Sarvam/Cartesia/OpenAI/Gemini) plus margin, not Outpero's own numbers. */
  private readonly RATE_CARD = {
    sarvamPerMin: 0.50,        // ₹30/hour STT
    cartesiaPerMin: 2.50,      // $0.03/min ~₹2.50
    openaiPerMin: 0.15,        // gpt-4o-mini avg ₹0.15/min (input+output tokens)
    groqPerMin: 0,             // free tier
    vobizPerMin: 0.60,         // SIP trunk outbound, ballpark
  };

  async getBilling(tenantId: string) {
    const [employees, calls] = await Promise.all([
      this.prisma.voiceEmployee.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, name: true, role: true, status: true, voiceProvider: true } }),
      this.prisma.voiceCall.findMany({ where: { tenantId }, select: { employeeId: true, durationS: true } }),
    ]);

    const byEmployee = new Map<string, { costInr: number; minutes: number }>();
    for (const c of calls) {
      const minutes = (c.durationS || 0) / 60;
      const costInr = this.computeCallCost(minutes);
      const cur = byEmployee.get(c.employeeId) || { costInr: 0, minutes: 0 };
      cur.costInr += costInr;
      cur.minutes += minutes;
      byEmployee.set(c.employeeId, cur);
    }

    const totalSpent = Array.from(byEmployee.values()).reduce((s, e) => s + e.costInr, 0);
    const totalMinutes = Array.from(byEmployee.values()).reduce((s, e) => s + e.minutes, 0);

    return {
      credits: 0,
      employees: employees.map((e) => ({
        id: e.id, name: e.name, role: e.role, status: e.status,
        voiceProvider: e.voiceProvider,
        minutesUsed: Math.round((byEmployee.get(e.id)?.minutes || 0) * 10) / 10,
        costInr: Math.round((byEmployee.get(e.id)?.costInr || 0) * 100) / 100,
      })),
      rates: this.RATE_CARD,
      lifetime: { spentInr: Math.round(totalSpent * 100) / 100, minutesUsedTotal: Math.round(totalMinutes * 10) / 10 },
      minutesUsedTotal: Math.round(totalMinutes * 10) / 10,
    };
  }

  private computeCallCost(minutes: number): number {
    const stt = minutes * this.RATE_CARD.sarvamPerMin;
    const tts = minutes * this.RATE_CARD.cartesiaPerMin;
    const llm = minutes * this.RATE_CARD.openaiPerMin;
    const telephony = minutes * this.RATE_CARD.vobizPerMin;
    return stt + tts + llm + telephony;
  }

  async getWallet(_tenantId: string) {
    // Placeholder until a payment processor is wired in — real balance, not a guess.
    return { balanceInr: 0 };
  }
}
