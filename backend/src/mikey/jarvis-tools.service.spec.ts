import { Test, TestingModule } from '@nestjs/testing';
import { JarvisToolsService } from './jarvis-tools.service';
import { PrismaService } from '../prisma/prisma.service';
import { SiteVisitsService } from '../site-visits/site-visits.service';
import { UnitHoldsService } from '../unit-holds/unit-holds.service';
import { CostSheetsService } from '../cost-sheets/cost-sheets.service';
import { OffersService } from '../offers/offers.service';
import { DocumentsService } from '../documents/documents.service';
import { ChannelPartnerClaimsService } from '../channel-partner-claims/channel-partner-claims.service';
import { TicketsService } from '../tickets/tickets.service';
import { AutonomousActionService } from './autonomous-action.service';
import { AutonomyGuardrailsService } from './autonomy-guardrails.service';
import { ApprovalsService } from '../approvals/approvals.service';

describe('JarvisToolsService', () => {
  let service: JarvisToolsService;
  let guardrails: any;
  let autonomousActions: any;
  let unitHolds: any;

  beforeEach(async () => {
    guardrails = { canActInternally: jest.fn().mockResolvedValue({ allowed: true }) };
    autonomousActions = { record: jest.fn().mockResolvedValue({}) };
    unitHolds = { requestHold: jest.fn().mockResolvedValue({ id: 'hold-1', expiresAt: new Date() }), release: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JarvisToolsService,
        { provide: PrismaService, useValue: { task: { create: jest.fn().mockResolvedValue({ id: 'task-1' }) } } },
        { provide: SiteVisitsService, useValue: { create: jest.fn(), confirm: jest.fn() } },
        { provide: UnitHoldsService, useValue: unitHolds },
        { provide: CostSheetsService, useValue: { create: jest.fn() } },
        { provide: OffersService, useValue: { request: jest.fn() } },
        { provide: DocumentsService, useValue: { generateDemandLetter: jest.fn() } },
        { provide: ChannelPartnerClaimsService, useValue: { registerClaim: jest.fn() } },
        { provide: TicketsService, useValue: { create: jest.fn() } },
        { provide: ApprovalsService, useValue: { request: jest.fn(), decide: jest.fn() } },
        { provide: AutonomousActionService, useValue: autonomousActions },
        { provide: AutonomyGuardrailsService, useValue: guardrails },
      ],
    }).compile();

    service = module.get(JarvisToolsService);
  });

  it('blocks the tool call and records it when the daily autonomy cap is reached', async () => {
    guardrails.canActInternally.mockResolvedValue({ allowed: false, reason: 'daily autonomous action cap reached' });
    const result = await service.holdUnit('t1', { unitId: 'unit-1', leadId: 'lead-1' });
    expect(result).toEqual({ status: 'BLOCKED_BY_POLICY', reason: 'daily autonomous action cap reached' });
    expect(unitHolds.requestHold).not.toHaveBeenCalled();
    expect(autonomousActions.record).toHaveBeenCalledWith(expect.objectContaining({ result: expect.stringContaining('BLOCKED_BY_POLICY') }));
  });

  it('executes and records COMPLETED when the gate passes', async () => {
    const result = await service.holdUnit('t1', { unitId: 'unit-1', leadId: 'lead-1' });
    expect(result.status).toBe('COMPLETED');
    expect(unitHolds.requestHold).toHaveBeenCalledWith({ tenantId: 't1', unitId: 'unit-1', leadId: 'lead-1', holdHours: undefined });
    expect(autonomousActions.record).toHaveBeenCalledWith(expect.objectContaining({ result: 'COMPLETED' }));
  });

  it('records FAILED_FINAL when the underlying service throws, and never lets the error escape uncaught', async () => {
    unitHolds.requestHold.mockRejectedValue(new Error('Unit was claimed by someone else'));
    const result = await service.holdUnit('t1', { unitId: 'unit-1', leadId: 'lead-1' });
    expect(result).toEqual({ status: 'FAILED_FINAL', error: 'Unit was claimed by someone else' });
  });

  it('the payment reminder tool only creates a task — it never sends a message itself', async () => {
    const result = await service.sendPaymentReminder('t1', { leadId: 'lead-1', paymentScheduleId: 'ps-1' });
    expect(result.status).toBe('COMPLETED');
    expect((result as any).data.taskId).toBe('task-1');
  });
});
