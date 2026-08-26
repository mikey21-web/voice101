import { Test, TestingModule } from '@nestjs/testing';
import { ResolveLeadService } from './resolve-lead.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import { NormalizationService } from '../shared/normalization.service';
import { LeadOrchestratorService } from '../voice-agent/lead-orchestrator.service';

describe('ResolveLeadService (Phase 4)', () => {
  let service: ResolveLeadService;
  let prisma: any;
  let contacts: any;

  const contact = { id: 'c1', name: 'Ravi', phone: '+919000000000' };

  // NormalizationService reads DEFAULT_COUNTRY_CODE once, in its constructor,
  // and falls back to 'US'. For an India-only product that silently turns every
  // 10-digit number into +1..., so it is pinned here rather than inherited.
  const realCountryCode = process.env.DEFAULT_COUNTRY_CODE;
  beforeAll(() => { process.env.DEFAULT_COUNTRY_CODE = 'IN'; });
  afterAll(() => { process.env.DEFAULT_COUNTRY_CODE = realCountryCode; });

  beforeEach(async () => {
    prisma = {
      lead: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'new-lead' })),
        update: jest.fn().mockImplementation(({ where, data }: any) =>
          Promise.resolve({ id: where.id, segment: 'WARM', assignedAgentId: 'agent-1', ...data })),
      },
      conversationMessage: { count: jest.fn().mockResolvedValue(0) },
      callLog: { count: jest.fn().mockResolvedValue(0) },
    };
    contacts = { findOrCreate: jest.fn().mockResolvedValue(contact) };
    const orchestrator = { onLeadCreated: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResolveLeadService,
        { provide: PrismaService, useValue: prisma },
        { provide: ContactsService, useValue: contacts },
        { provide: LeadOrchestratorService, useValue: orchestrator },
        NormalizationService,
      ],
    }).compile();

    service = module.get(ResolveLeadService);
  });

  const base = { tenantId: 't1', phone: '9000000000', name: 'Ravi', source: 'FORM' };

  it('normalises the phone to E.164 before matching', async () => {
    await service.resolveLead({ ...base, phone: '90000 00000' });
    expect(contacts.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+919000000000' }),
      undefined,
    );
  });

  it('creates one lead for a brand new buyer', async () => {
    const res = await service.resolveLead(base);

    expect(res.reusedExistingLead).toBe(false);
    expect(res.isReturning).toBe(false);
    expect(prisma.lead.create).toHaveBeenCalled();
  });

  it('fires the auto-action trigger only for a newly created lead', async () => {
    const orchestrator = { onLeadCreated: jest.fn().mockResolvedValue(undefined) };
    (service as any).orchestrator = orchestrator;

    await service.resolveLead(base);
    expect(orchestrator.onLeadCreated).toHaveBeenCalledWith('new-lead');

    // Returning buyer on an open lead: no new lead, no trigger (already in play).
    prisma.lead.findMany.mockResolvedValue([
      { id: 'lead-1', status: 'QUALIFYING', assignedAgentId: 'agent-1', metadata: {} },
    ]);
    orchestrator.onLeadCreated.mockClear();
    await service.resolveLead(base);
    expect(orchestrator.onLeadCreated).not.toHaveBeenCalled();
  });

  it('reuses the open lead instead of creating a second one', async () => {
    // The bug this phase exists to kill: same buyer, four portals, four leads.
    prisma.lead.findMany.mockResolvedValue([
      { id: 'lead-1', status: 'QUALIFYING', assignedAgentId: 'agent-1', interest: '2BHK', metadata: {} },
    ]);

    const res = await service.resolveLead({ ...base, source: 'META_ADS' });

    expect(prisma.lead.create).not.toHaveBeenCalled();
    expect(res.reusedExistingLead).toBe(true);
    expect(res.leadId).toBe('lead-1');
    expect(res.assignedRepId).toBe('agent-1'); // same rep, not a new one
  });

  it('raises the score on a repeat enquiry', async () => {
    prisma.lead.findMany.mockResolvedValue([
      { id: 'lead-1', status: 'QUALIFYING', assignedAgentId: 'agent-1', metadata: {} },
    ]);

    await service.resolveLead(base);

    const update = prisma.lead.update.mock.calls[0][0];
    expect(update.data.score).toEqual({ increment: 15 });
  });

  it('keeps every source that brought the buyer in', async () => {
    prisma.lead.findMany.mockResolvedValue([
      { id: 'lead-1', status: 'QUALIFYING', assignedAgentId: 'agent-1', metadata: { touches: [{ source: 'FORM' }] } },
    ]);

    await service.resolveLead({ ...base, source: '99ACRES' });

    const update = prisma.lead.update.mock.calls[0][0];
    expect(update.data.metadata.touches).toHaveLength(2);
    expect(update.data.metadata.touches[1].source).toBe('99ACRES');
  });

  it('treats a re-enquiry after a lost lead as RECONNECT, on the same rep', async () => {
    prisma.lead.findMany.mockResolvedValue([
      { id: 'old', status: 'LOST', assignedAgentId: 'agent-7', metadata: {} },
    ]);

    const res = await service.resolveLead(base);

    expect(res.reusedExistingLead).toBe(false); // a dead lead is not reopened
    expect(res.segment).toBe('RECONNECT');
    expect(res.assignedRepId).toBe('agent-7');
    expect(res.isReturning).toBe(true);
  });

  it('treats a buyer who already purchased as EXISTING_CUSTOMER', async () => {
    prisma.lead.findMany.mockResolvedValue([
      { id: 'old', status: 'POSSESSION', assignedAgentId: 'agent-3', metadata: {} },
    ]);

    const res = await service.resolveLead(base);

    expect(res.segment).toBe('EXISTING_CUSTOMER');
    expect(res.assignedRepId).toBe('agent-3');
  });

  it('gathers the history Mikey greets them with', async () => {
    prisma.lead.findMany.mockResolvedValue([
      { id: 'lead-1', status: 'QUALIFYING', assignedAgentId: 'agent-1', interest: '2BHK Kompally', campaignId: 'camp-1', metadata: {} },
    ]);
    prisma.conversationMessage.count.mockResolvedValue(9);
    prisma.callLog.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

    const res = await service.resolveLead(base);

    expect(res.history.conversations).toBe(9);
    expect(res.history.callsAnswered).toBe(2);
    expect(res.history.callsMissed).toBe(1);
    expect(res.history.lastInterest).toBe('2BHK Kompally');
    expect(res.history.campaigns).toEqual(['camp-1']);
  });

  it('the same buyer on four portals produces one lead with four touches', async () => {
    const stored: any = { id: 'lead-1', status: 'NEW', assignedAgentId: 'agent-1', metadata: {} };
    prisma.lead.findMany.mockImplementation(() => Promise.resolve([stored]));
    prisma.lead.update.mockImplementation(({ data }: any) => {
      stored.metadata = data.metadata;
      return Promise.resolve({ ...stored, segment: 'WARM' });
    });

    for (const source of ['FORM', 'META_ADS', 'GOOGLE_ADS', 'REFERRAL']) {
      await service.resolveLead({ ...base, source });
    }

    expect(prisma.lead.create).not.toHaveBeenCalled();
    expect(stored.metadata.touches).toHaveLength(4);
  });
});
