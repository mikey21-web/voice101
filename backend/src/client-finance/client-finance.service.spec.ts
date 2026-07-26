import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClientFinanceService } from './client-finance.service';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { EmailAdapter } from '../shared/adapters/email.adapter';
import { WhatsAppCloudAdapter } from '../shared/adapters/messaging.adapter';
import { NotFoundException } from '@nestjs/common';

describe('ClientFinanceService', () => {
  let service: ClientFinanceService;
  let prisma: any;

  const mockInvoice = {
    id: 'inv-1', tenantId: 'default-tenant', invoiceNumber: 'INV-1', subtotal: 1000, gstTotal: 180, grandTotal: 1180,
    status: 'DRAFT', contactId: 'contact-1', lineItems: [{ id: 'li-1', description: 'Item', qty: 1, unitPrice: 1000, total: 1000 }],
  };

  const tenantId = 'default-tenant';

  beforeEach(async () => {
    prisma = {
      invoice: {
        findMany: jest.fn().mockResolvedValue([mockInvoice]),
        findFirst: jest.fn().mockResolvedValue(mockInvoice),
        create: jest.fn().mockResolvedValue(mockInvoice),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...mockInvoice, ...data })),
        count: jest.fn().mockResolvedValue(1),
      },
      quotation: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'q-1', contactId: 'contact-9', sections: [{ lineItems: [{ total: 500 }, { total: 250 }] }] }),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'q-1', ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'q-1', ...data })),
        count: jest.fn().mockResolvedValue(0),
      },
      contract: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'c-1', status: 'DRAFT' }),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'c-1', ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'c-1', ...data })),
        count: jest.fn().mockResolvedValue(0),
      },
      transaction: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'txn-1', ...data })),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientFinanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: InvoicePdfService, useValue: { generate: jest.fn() } },
        { provide: EmailAdapter, useValue: { send: jest.fn() } },
        { provide: WhatsAppCloudAdapter, useValue: { send: jest.fn() } },
      ],
    }).compile();

    service = module.get<ClientFinanceService>(ClientFinanceService);
  });

  describe('createInvoice', () => {
    it('should compute subtotal, gstTotal, and grandTotal from line items', async () => {
      await service.createInvoice(tenantId, { contactId: 'contact-1', gstPercent: 18, lineItems: [{ description: 'Item', qty: 2, unitPrice: 500 }] });
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subtotal: 1000, gstTotal: 180, grandTotal: 1180 }),
        }),
      );
    });

    it('should use each line item\'s own gstPercent over the invoice-level fallback', async () => {
      await service.createInvoice(tenantId, {
        contactId: 'contact-1',
        gstPercent: 18,
        lineItems: [
          { description: 'Booking amount', qty: 1, unitPrice: 100000, gstPercent: 1 },
          { description: 'Club membership', qty: 1, unitPrice: 20000 },
        ],
      });
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subtotal: 120000, gstTotal: 1000 + 3600, grandTotal: 120000 + 1000 + 3600 }),
        }),
      );
    });
  });

  describe('updateInvoice', () => {
    it('should not set paidAt unless status is PAID', async () => {
      await service.updateInvoice(tenantId, 'inv-1', { status: 'SENT' });
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'SENT' } }),
      );
    });

    it('should stamp paidAt when status transitions to PAID', async () => {
      await service.updateInvoice(tenantId, 'inv-1', { status: 'PAID' });
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PAID', paidAt: expect.any(Date) }) }),
      );
    });

    it('should throw NotFoundException for a non-existent invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);
      await expect(service.updateInvoice(tenantId, 'nonexistent', { status: 'PAID' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('createContract', () => {
    it('should use the provided amount when given', async () => {
      const c = await service.createContract(tenantId, { amount: 5000 });
      expect(c.amount).toBe(5000);
      expect(prisma.quotation.findFirst).not.toHaveBeenCalled();
    });

    it('should derive amount from the quotation when not provided', async () => {
      const c = await service.createContract(tenantId, { quotationId: 'q-1' });
      expect(c.amount).toBe(750);
    });

    it('should derive the contact from the quotation when not provided directly', async () => {
      const c = await service.createContract(tenantId, { quotationId: 'q-1' });
      expect(c.contactId).toBe('contact-9');
    });
  });

  describe('updateContract', () => {
    it('should stamp signedAt when status transitions to SIGNED', async () => {
      await service.updateContract(tenantId, 'c-1', { status: 'SIGNED' });
      expect(prisma.contract.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SIGNED', signedAt: expect.any(Date) }) }),
      );
    });
  });

  describe('getTaxReport', () => {
    it('should compute collected, paid, and net payable', async () => {
      prisma.invoice.findMany.mockResolvedValue([{ gstTotal: 180 }, { gstTotal: 90 }]);
      prisma.transaction.findMany.mockResolvedValue([{ amount: 1000, gstPercent: 18 }]);
      const report = await service.getTaxReport(tenantId);
      expect(report.taxCollected).toBe(270);
      expect(report.taxPaid).toBe(180);
      expect(report.netPayable).toBe(90);
    });
  });

  describe('getProfitAndLoss', () => {
    it('should compute income, expenses, and net profit', async () => {
      prisma.transaction.findMany
        .mockResolvedValueOnce([{ amount: 5000 }, { amount: 2000 }])
        .mockResolvedValueOnce([{ amount: 1500 }]);
      const pl = await service.getProfitAndLoss(tenantId);
      expect(pl.income).toBe(7000);
      expect(pl.expenses).toBe(1500);
      expect(pl.netProfit).toBe(5500);
    });
  });

  describe('getEventProfitability', () => {
    it('should group income and expenses per event', async () => {
      prisma.transaction.findMany.mockResolvedValue([
        { eventId: 'event-1', type: 'INCOME', amount: 1000 },
        { eventId: 'event-1', type: 'EXPENSE', amount: 300 },
        { eventId: 'event-2', type: 'INCOME', amount: 500 },
      ]);
      const rows = await service.getEventProfitability(tenantId);
      const e1 = rows.find(r => r.eventId === 'event-1')!;
      expect(e1.income).toBe(1000);
      expect(e1.expenses).toBe(300);
      expect(e1.profit).toBe(700);
    });
  });
});
