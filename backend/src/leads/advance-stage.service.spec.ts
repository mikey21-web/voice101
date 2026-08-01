import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdvanceStageService } from './advance-stage.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

describe('AdvanceStageService', () => {
  let service: AdvanceStageService;
  let prisma: any;
  let events: any;

  beforeEach(async () => {
    prisma = {
      lead: {
        findFirst: jest.fn().mockResolvedValue({ id: 'lead-1', tenantId: 't1', status: 'NEW' }),
        update: jest.fn().mockResolvedValue({ id: 'lead-1', tenantId: 't1', status: 'CONTACTED' }),
      },
      mikeyAutonomousAction: { create: jest.fn().mockResolvedValue({ id: 'action-1' }) },
      $transaction: jest.fn().mockImplementation((items: any[]) => Promise.all(items)),
    };
    events = { emit: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvanceStageService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsService, useValue: events },
      ],
    }).compile();

    service = module.get(AdvanceStageService);
  });

  it('advances a legal transition, writes an action row and emits the event', async () => {
    const result = await service.advanceStage({
      tenantId: 't1', leadId: 'lead-1', to: 'CONTACTED' as any,
      actor: 'system', reason: 'test',
    });
    expect(result).toEqual({ from: 'NEW', to: 'CONTACTED', stage: 'ENGAGE' });
    expect(prisma.lead.update).toHaveBeenCalledWith({ where: { id: 'lead-1' }, data: { status: 'CONTACTED' } });
    expect(prisma.mikeyAutonomousAction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 't1', leadId: 'lead-1', tool: 'advance_stage' }),
    }));
    expect(events.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'lead.stage_advanced' }));
  });

  it('throws on an illegal backward transition', async () => {
    prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1', tenantId: 't1', status: 'POSSESSION' });
    await expect(service.advanceStage({
      tenantId: 't1', leadId: 'lead-1', to: 'QUALIFIED' as any, actor: 'system', reason: 'test',
    })).rejects.toThrow(BadRequestException);
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it('throws NotFound when the lead does not belong to the tenant', async () => {
    prisma.lead.findFirst.mockResolvedValue(null);
    await expect(service.advanceStage({
      tenantId: 'other', leadId: 'lead-1', to: 'CONTACTED' as any, actor: 'system', reason: 'test',
    })).rejects.toThrow(NotFoundException);
  });
});
