import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { EmailAdapter } from '../shared/adapters/email.adapter';
import { WhatsAppCloudAdapter } from '../shared/adapters/messaging.adapter';

function genNumber(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

@Injectable()
export class ClientFinanceService {
  private readonly logger = new Logger(ClientFinanceService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private invoicePdf: InvoicePdfService,
    private email: EmailAdapter,
    private whatsApp: WhatsAppCloudAdapter,
  ) {}

  // --- Invoices ---
  findInvoices(tenantId: string, query: any = {}) {
    const { status, contactId, eventId, propertyId, projectId, page = 1, limit = 20 } = query;
    const where: any = { tenantId };
    if (status) where.status = status;
    if (contactId) where.contactId = contactId;
    if (eventId) where.eventId = eventId;
    if (propertyId) where.propertyId = propertyId;
    if (projectId) where.projectId = projectId;
    return Promise.all([
      this.prisma.invoice.findMany({
        where, skip: (+page - 1) * +limit, take: +limit, orderBy: { createdAt: 'desc' },
        include: {
          lineItems: true,
          contact: { select: { id: true, name: true } },
          property: { select: { id: true, title: true, address: true } },
          project: { select: { id: true, name: true, location: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]).then(([data, total]) => ({ data, meta: { total, page: +page, limit: +limit } }));
  }

  async findInvoice(tenantId: string, id: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: { lineItems: true, contact: true, property: true, project: true },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  // Per-line gstPercent (if given) drives that line's tax; the invoice-level
  // gstPercent is only a fallback for lines that don't specify their own.
  createInvoice(tenantId: string, data: any) {
    const { lineItems = [], invoiceNumber, ...rest } = data;
    const lines = lineItems.map((li: any) => {
      const total = li.total ?? li.qty * li.unitPrice;
      const gstPercent = li.gstPercent ?? rest.gstPercent;
      const gst = gstPercent ? total * (gstPercent / 100) : 0;
      return { ...li, total, gst };
    });
    const subtotal = lines.reduce((s: number, li: any) => s + li.total, 0);
    const gstTotal = lines.reduce((s: number, li: any) => s + li.gst, 0);
    return this.prisma.invoice.create({
      data: {
        ...rest,
        tenantId,
        invoiceNumber: invoiceNumber || genNumber('INV'),
        subtotal,
        gstTotal,
        grandTotal: subtotal + gstTotal,
        lineItems: {
          create: lines.map((li: any) => ({
            description: li.description, unit: li.unit, qty: li.qty ?? 1, unitPrice: li.unitPrice,
            gstPercent: li.gstPercent, notes: li.notes, total: li.total,
          })),
        },
      },
      include: { lineItems: true },
    });
  }

  // Accrual discipline: an invoice only becomes income when explicitly marked PAID here —
  // never inferred just from the invoice existing (matches Vyuha's own stated accounting rule).
  async updateInvoice(tenantId: string, id: string, data: any) {
    await this.findInvoice(tenantId, id);
    const patch: any = { ...data };
    if (data.status === 'PAID' && !data.paidAt) patch.paidAt = new Date();
    return this.prisma.invoice.update({ where: { id }, data: patch });
  }

  // Generate (or regenerate) the invoice PDF and return its public URL.
  async getInvoicePdf(tenantId: string, id: string) {
    await this.findInvoice(tenantId, id);
    return this.invoicePdf.generateInvoicePdf(tenantId, id);
  }

  // Generate the PDF, deliver it to the client over the requested channels
  // (email and/or WhatsApp), and mark the invoice SENT. Delivery is best-effort
  // per channel: one channel failing does not block the other, and the per-channel
  // outcome is returned so the UI can show exactly what went through.
  async sendInvoice(
    tenantId: string,
    id: string,
    opts: { channels?: string[]; message?: string } = {},
  ) {
    const invoice = await this.findInvoice(tenantId, id);
    const channels = opts.channels?.length ? opts.channels : ['email', 'whatsapp'];
    const { publicUrl, fileName, filePath } = await this.invoicePdf.generateInvoicePdf(tenantId, id);

    const settings = await this.prisma.businessSettings.findFirst();
    const bizName = settings?.businessName || 'our team';
    const results: Record<string, { success: boolean; error?: string }> = {};

    if (channels.includes('email')) {
      const to = invoice.contact?.email;
      if (!to) {
        results.email = { success: false, error: 'Client has no email address' };
      } else {
        const subject = `Invoice ${invoice.invoiceNumber} from ${bizName}`;
        const body = opts.message
          || `<p>Hi ${invoice.contact?.name || 'there'},</p><p>Please find your invoice <b>${invoice.invoiceNumber}</b> attached. You can also view it here: <a href="${publicUrl}">${publicUrl}</a></p><p>Thank you,<br/>${bizName}</p>`;
        results.email = await this.email.send(to, subject, body, undefined, [{ filename: fileName, path: filePath }]);
      }
    }

    if (channels.includes('whatsapp')) {
      const to = invoice.contact?.whatsapp || invoice.contact?.phone;
      if (!to) {
        results.whatsapp = { success: false, error: 'Client has no WhatsApp/phone number' };
      } else {
        const caption = opts.message || `Invoice ${invoice.invoiceNumber} from ${bizName}`;
        results.whatsapp = await this.whatsApp.sendMessage(to, caption, {
          phoneNumberId: this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '',
          accessToken: this.config.get<string>('WHATSAPP_ACCESS_TOKEN') || '',
          within24h: true,
          mediaUrl: publicUrl,
          mediaType: 'document',
          fileName,
          caption,
        });
      }
    }

    const anyDelivered = Object.values(results).some(r => r.success);
    if (anyDelivered && invoice.status === 'DRAFT') {
      await this.prisma.invoice.update({ where: { id }, data: { status: 'SENT' } });
    }

    return { invoiceNumber: invoice.invoiceNumber, publicUrl, delivered: anyDelivered, results };
  }

  // --- Quotations ---
  findQuotations(tenantId: string, query: any = {}) {
    const { status, contactId, eventId, propertyId, projectId, page = 1, limit = 20 } = query;
    const where: any = { tenantId };
    if (status) where.status = status;
    if (contactId) where.contactId = contactId;
    if (eventId) where.eventId = eventId;
    if (propertyId) where.propertyId = propertyId;
    if (projectId) where.projectId = projectId;
    return Promise.all([
      this.prisma.quotation.findMany({
        where, skip: (+page - 1) * +limit, take: +limit, orderBy: { createdAt: 'desc' },
        include: {
          sections: { include: { lineItems: true } },
          contact: { select: { id: true, name: true } },
          property: { select: { id: true, title: true, address: true } },
          project: { select: { id: true, name: true, location: true } },
        },
      }),
      this.prisma.quotation.count({ where }),
    ]).then(([data, total]) => ({ data, meta: { total, page: +page, limit: +limit } }));
  }

  async findQuotation(tenantId: string, id: string) {
    const q = await this.prisma.quotation.findFirst({
      where: { id, tenantId },
      include: { sections: { include: { lineItems: true } }, contact: true, property: true, project: true },
    });
    if (!q) throw new NotFoundException('Quotation not found');
    return q;
  }

  createQuotation(tenantId: string, data: any) {
    const { sections = [], ...rest } = data;
    return this.prisma.quotation.create({
      data: {
        ...rest,
        tenantId,
        quoteNumber: genNumber('Q'),
        sections: {
          create: sections.map((s: any, i: number) => ({
            title: s.title,
            order: s.order ?? i,
            lineItems: { create: (s.lineItems || []).map((li: any) => ({ description: li.description, qty: li.qty ?? 1, unitPrice: li.unitPrice, total: li.total ?? li.qty * li.unitPrice })) },
          })),
        },
      },
      include: { sections: { include: { lineItems: true } } },
    });
  }

  async updateQuotation(tenantId: string, id: string, data: any) { await this.findQuotation(tenantId, id); return this.prisma.quotation.update({ where: { id }, data }); }

  // --- Contracts (own "New contract" flow, or convert an accepted quotation) ---
  private contractInclude() {
    return {
      contact: { select: { id: true, name: true } },
      quotation: { select: { id: true, quoteNumber: true, property: { select: { title: true } }, project: { select: { name: true } } } },
    } as const;
  }

  findContracts(tenantId: string, query: any = {}) {
    const { status, page = 1, limit = 20 } = query;
    const where: any = { tenantId };
    if (status) where.status = status;
    return Promise.all([
      this.prisma.contract.findMany({ where, skip: (+page - 1) * +limit, take: +limit, orderBy: { createdAt: 'desc' }, include: this.contractInclude() }),
      this.prisma.contract.count({ where }),
    ]).then(([data, total]) => ({ data, meta: { total, page: +page, limit: +limit } }));
  }

  async findContract(tenantId: string, id: string) {
    const c = await this.prisma.contract.findFirst({ where: { id, tenantId }, include: this.contractInclude() });
    if (!c) throw new NotFoundException('Contract not found');
    return c;
  }

  async createContract(tenantId: string, data: any) {
    let amount = data.amount ?? 0;
    let contactId = data.contactId;
    if (data.quotationId) {
      const q = await this.prisma.quotation.findFirst({ where: { id: data.quotationId, tenantId }, include: { sections: { include: { lineItems: true } } } });
      if (!data.amount) amount = q?.sections.reduce((s, sec) => s + sec.lineItems.reduce((ss, li) => ss + li.total, 0), 0) ?? 0;
      if (!contactId) contactId = q?.contactId ?? undefined;
    }
    return this.prisma.contract.create({ data: { ...data, contactId, tenantId, amount, contractNumber: genNumber('C') }, include: this.contractInclude() });
  }

  // Client acceptance and internal signing are tracked as two distinct
  // timestamps because a contract can be accepted by the client before
  // the business countersigns it — collapsing them would lose that gap.
  async updateContract(tenantId: string, id: string, data: any) {
    await this.findContract(tenantId, id);
    const patch: any = { ...data };
    if (data.status === 'SIGNED' && !data.signedAt) patch.signedAt = new Date();
    return this.prisma.contract.update({ where: { id }, data: patch, include: this.contractInclude() });
  }

  // --- Transactions ---
  findTransactions(tenantId: string, query: any = {}) {
    const { type, status, eventId, page = 1, limit = 20 } = query;
    const where: any = { tenantId };
    if (type) where.type = type;
    if (status) where.status = status;
    if (eventId) where.eventId = eventId;
    return Promise.all([
      this.prisma.transaction.findMany({
        where, skip: (+page - 1) * +limit, take: +limit, orderBy: { date: 'desc' },
        include: { receiptMedia: { select: { id: true, publicUrl: true, fileName: true } } },
      }),
      this.prisma.transaction.count({ where }),
    ]).then(([data, total]) => ({ data, meta: { total, page: +page, limit: +limit } }));
  }
  createTransaction(tenantId: string, data: any) { return this.prisma.transaction.create({ data: { ...data, tenantId } }); }


  // --- Reports ---
  async getTaxReport(tenantId: string) {
    const [paidInvoices, paidExpenseTxns] = await Promise.all([
      this.prisma.invoice.findMany({ where: { tenantId, status: 'PAID' } }),
      this.prisma.transaction.findMany({ where: { tenantId, type: 'EXPENSE', status: 'PAID' } }),
    ]);
    const taxCollected = paidInvoices.reduce((s, i) => s + i.gstTotal, 0);
    const taxPaid = paidExpenseTxns.reduce((s, t) => s + (t.gstPercent ? t.amount * (t.gstPercent / 100) : 0), 0);
    return { taxCollected, taxPaid, netPayable: taxCollected - taxPaid };
  }

  async getProfitAndLoss(tenantId: string) {
    const [incomeTxns, expenseTxns] = await Promise.all([
      this.prisma.transaction.findMany({ where: { tenantId, type: 'INCOME', status: 'RECEIVED' } }),
      this.prisma.transaction.findMany({ where: { tenantId, type: 'EXPENSE', status: 'PAID' } }),
    ]);
    const income = incomeTxns.reduce((s, t) => s + t.amount, 0);
    const expenses = expenseTxns.reduce((s, t) => s + t.amount, 0);
    return { income, expenses, netProfit: income - expenses };
  }

  async getCashFlow(tenantId: string) {
    const [cashIn, cashOut] = await Promise.all([
      this.prisma.transaction.aggregate({ where: { tenantId, type: 'INCOME', status: 'RECEIVED' }, _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: { tenantId, type: 'EXPENSE', status: 'PAID' }, _sum: { amount: true } }),
    ]);
    const inflow = cashIn._sum.amount || 0;
    const outflow = cashOut._sum.amount || 0;
    return { inflow, outflow, netCashFlow: inflow - outflow };
  }

  async getBalanceSheet(tenantId: string) {
    const [receivablesInvoices, payablesTxns] = await Promise.all([
      this.prisma.invoice.findMany({ where: { tenantId, status: { in: ['SENT', 'OVERDUE', 'PENDING'] } } }),
      this.prisma.transaction.findMany({ where: { tenantId, type: 'EXPENSE', status: { in: ['PENDING', 'OVERDUE'] } } }),
    ]);
    const receivables = receivablesInvoices.reduce((s, i) => s + i.grandTotal, 0);
    const payables = payablesTxns.reduce((s, t) => s + t.amount, 0);
    return { receivables, payables, netPosition: receivables - payables };
  }

  async getVendorPayments(tenantId: string) {
    const vendorTxns = await this.prisma.transaction.findMany({ where: { tenantId, partyType: 'VENDOR' } });
    const paid = vendorTxns.filter(t => t.status === 'PAID').reduce((s, t) => s + t.amount, 0);
    const pending = vendorTxns.filter(t => t.status !== 'PAID').reduce((s, t) => s + t.amount, 0);
    return { paid, pending, total: paid + pending };
  }

  async getEventProfitability(tenantId: string) {
    const txns = await this.prisma.transaction.findMany({ where: { tenantId, eventId: { not: null } } });
    const byEvent = new Map<string, { income: number; expenses: number }>();
    for (const t of txns) {
      const key = t.eventId as string;
      const row = byEvent.get(key) || { income: 0, expenses: 0 };
      if (t.type === 'INCOME') row.income += t.amount; else row.expenses += t.amount;
      byEvent.set(key, row);
    }
    return Array.from(byEvent.entries()).map(([eventId, v]) => ({ eventId, ...v, profit: v.income - v.expenses }));
  }
}
