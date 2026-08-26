import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/** Numbers, wallet and billing — matching Outpero's captured response shapes exactly (see
 * REVERSE-ENGINEERED.md §7). The wallet lives in the tenant's settings JSON (key `voiceWallet`)
 * so it works without a schema migration — balance + a transactions ledger. Razorpay top-up is
 * wired as a real order+verify flow when RAZORPAY_KEY_ID/SECRET are present, else falls back to
 * a simulated grant so the UI flows end-to-end in dev. */
@Injectable()
export class VoiceBillingService {
  private readonly DEFAULT_WALLET = { balanceInr: 0, transactions: [] };

  constructor(private prisma: PrismaService, private config: ConfigService) {}

  private async getWalletDoc(tenantId: string): Promise<{ balanceInr: number; transactions: any[] }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const settings = (tenant.settings as any) || {};
    const wallet = settings.voiceWallet || this.DEFAULT_WALLET;
    return { balanceInr: Number(wallet.balanceInr || 0), transactions: wallet.transactions || [] };
  }

  private async saveWalletDoc(tenantId: string, wallet: { balanceInr: number; transactions: any[] }) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const settings = (tenant.settings as any) || {};
    settings.voiceWallet = wallet;
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { settings: settings as any } });
  }

  private publicWallet(wallet: { balanceInr: number; transactions: any[] }) {
    return { balanceInr: wallet.balanceInr, transactions: wallet.transactions };
  }

  private async notifyLowCredit(tenantId: string, balanceInr: number) {
    if (balanceInr > 0 && balanceInr < 20) {
      await this.prisma.notification
        .create({
          data: {
            tenantId,
            type: 'low_credit',
            title: 'Low credit balance',
            body: `You have ₹${balanceInr} left — add credits to keep calls running.`,
            link: '/voice-billing',
            read: false,
          },
        })
        .catch(() => {});
    }
  }

  async listNumbers(tenantId: string) {
    return this.prisma.voicePhoneNumber.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  async addNumber(tenantId: string, number: string, provider = 'twilio') {
    const existing = await this.prisma.voicePhoneNumber.findUnique({ where: { number } });
    if (existing) throw new ConflictException('Number already registered');
    return this.prisma.voicePhoneNumber.create({ data: { tenantId, number, provider } });
  }

  /** Purchase a DID at Outpero's ₹649/month list price (taken from wallet balance, renewing
   * monthly). Returns the number and the updated wallet. */
  async buyNumber(tenantId: string, number: string) {
    const wallet = await this.getWalletDoc(tenantId);
    if (wallet.balanceInr < 649) throw new BadRequestException('Insufficient credits — top up first (₹649/month per number)');
    const numberDoc = await this.addNumber(tenantId, number, 'voicelink');
    wallet.balanceInr = Math.round((wallet.balanceInr - 649) * 100) / 100;
    wallet.transactions.unshift({
      type: 'number_purchase',
      amount: -649,
      detail: `Number ${number} — 1 month`,
      createdAt: new Date().toISOString(),
    });
    await this.saveWalletDoc(tenantId, wallet);
    await this.notifyLowCredit(tenantId, wallet.balanceInr);
    return { number: numberDoc, wallet: this.publicWallet(wallet) };
  }

  /** Release a number back to the pool (no refund) and un-assign it from its employee. */
  async releaseNumber(tenantId: string, id: string) {
    const number = await this.prisma.voicePhoneNumber.findFirst({ where: { id, tenantId } });
    if (!number) throw new NotFoundException('Number not found');
    await this.prisma.voiceEmployee.updateMany({ where: { tenantId, numberId: id }, data: { numberId: null } });
    await this.prisma.voicePhoneNumber.delete({ where: { id } });
    return { released: true };
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
   * totals, runway. Rate card reflects actual vendor costs (Sarvam/Inworld/Gemini) plus margin. */
  private readonly RATE_CARD = {
    sarvamPerMin: 3.5,        // customer-facing value tier
    smallestPerMin: 5.0,      // standard
    cartesiaPerMin: 7.0,      // premium
    inworldPerMin: 8.0,       // premium (Outpero's primary)
    llmPerUse: 0.2,           // Gemini flash per-use
    numberMonthly: 649,       // DID rental
    extraChannelMonthly: 300,
    hireFeeMonthly: 1899,
    gst: 0.18,
  };

  async getBilling(tenantId: string) {
    const [employees, calls] = await Promise.all([
      this.prisma.voiceEmployee.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, name: true, role: true, status: true, voiceProvider: true } }),
      this.prisma.voiceCall.findMany({ where: { tenantId }, select: { employeeId: true, durationS: true, costInr: true } }),
    ]);
    const wallet = await this.getWalletDoc(tenantId);

    const byEmployee = new Map<string, { costInr: number; minutes: number }>();
    for (const c of calls) {
      const minutes = (c.durationS || 0) / 60;
      const costInr = c.costInr || this.computeCallCost(minutes);
      const cur = byEmployee.get(c.employeeId) || { costInr: 0, minutes: 0 };
      cur.costInr += costInr;
      cur.minutes += minutes;
      byEmployee.set(c.employeeId, cur);
    }

    const totalSpent = Array.from(byEmployee.values()).reduce((s, e) => s + e.costInr, 0);
    const totalMinutes = Array.from(byEmployee.values()).reduce((s, e) => s + e.minutes, 0);

    const credits = wallet.balanceInr;
    const runwayDays = credits > 0 && totalSpent > 0 ? Math.max(0, Math.round(credits / (totalSpent / Math.max(30, (calls.length ? 1 : 1))))) : 0;

    return {
      credits,
      talkTimeRemainingMin: credits > 0 ? Math.round((credits / 8) * 10) / 10 : 0,
      runwayDays,
      dailyBurnInr: totalSpent > 0 ? Math.round((totalSpent / 30) * 100) / 100 : 0,
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
    const tts = minutes * this.RATE_CARD.inworldPerMin;
    const llm = minutes * this.RATE_CARD.llmPerUse;
    const telephony = minutes * 1.0;
    return stt + tts + llm + telephony;
  }

  async getWallet(tenantId: string) {
    const wallet = await this.getWalletDoc(tenantId);
    return this.publicWallet(wallet);
  }

  /** Create a Razorpay order for a top-up, or (in dev, no Razorpay keys) return a simulated
   * order id so the frontend can complete the flow. */
  async createTopUp(tenantId: string, amountInr: number) {
    if (!amountInr || amountInr <= 0) throw new BadRequestException('Amount must be positive');
    const razorpayKey = this.config.get<string>('RAZORPAY_KEY_ID');
    const razorpaySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!razorpayKey || !razorpaySecret) {
      const orderId = `sim_${Date.now()}`;
      return { order_id: orderId, amount: Math.round(amountInr * 100), currency: 'INR', simulated: true };
    }
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${razorpayKey}:${razorpaySecret}`).toString('base64')}` },
      body: JSON.stringify({ amount: Math.round(amountInr * 100), currency: 'INR', receipt: `topup_${tenantId}_${Date.now()}` }),
    });
    if (!res.ok) throw new BadRequestException(`Razorpay order failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return { order_id: data.id, amount: data.amount, currency: data.currency, simulated: false };
  }

  /** Verify a Razorpay payment and credit the wallet. In dev (simulated order / no keys),
   * credit immediately. */
  async verifyTopUp(tenantId: string, orderId: string, paymentId?: string) {
    const wallet = await this.getWalletDoc(tenantId);
    let amountInr = 0;
    const razorpayKey = this.config.get<string>('RAZORPAY_KEY_ID');
    const razorpaySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!razorpayKey || !razorpaySecret || orderId.startsWith('sim_')) {
      amountInr = Number(orderId.replace('sim_', '')) / 100;
      if (!amountInr) amountInr = 100;
    } else {
      if (!paymentId) throw new BadRequestException('payment_id required');
      const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${razorpayKey}:${razorpaySecret}`).toString('base64')}` },
      });
      if (!res.ok) throw new BadRequestException('Razorpay verification failed');
      const payment = await res.json();
      if (payment.status !== 'captured') throw new BadRequestException('Payment not captured');
      amountInr = Math.round(payment.amount) / 100;
    }
    wallet.balanceInr = Math.round((wallet.balanceInr + amountInr) * 100) / 100;
    wallet.transactions.unshift({
      type: 'top_up',
      amount: amountInr,
      detail: `Credits added (${orderId})`,
      createdAt: new Date().toISOString(),
    });
    await this.saveWalletDoc(tenantId, wallet);
    await this.notifyLowCredit(tenantId, wallet.balanceInr);
    return { wallet: this.publicWallet(wallet) };
  }
}
