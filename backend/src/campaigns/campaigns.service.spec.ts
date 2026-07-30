import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsService } from './campaigns.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CampaignDispatcherService } from './campaign-dispatcher.service';

describe('CampaignsService', () => {
  let service: CampaignsService;
  let prisma: any;
  const auditLogs = { log: jest.fn().mockResolvedValue({}) };
  const dispatcher = { dispatchCampaign: jest.fn().mockResolvedValue({ sent: 0, skipped: 0, errors: 0 }) };

  const now = new Date('2025-01-01T00:00:00Z');

  const mockCampaign = {
    id: 'campaign-1',
    name: 'Test Campaign',
    sourceType: 'FORM',
    campaignType: 'multi-channel',
    description: null,
    status: 'draft',
    priority: 0,
    budget: {},
    targeting: {},
    channels: [],
    creatives: [],
    tags: [],
    totalBudget: null,
    dailyBudget: null,
    totalSpend: null,
    costPerLead: null,
    roi: null,
    totalLeads: 0,
    totalConversions: 0,
    offer: 'Test Offer',
    landingUrl: 'https://example.com',
    conversionGoal: 'lead',
    crmDestination: null,
    bookingDestination: null,
    startDate: null,
    endDate: null,
    active: true,
    creatorId: 'user-1',
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
    formId: null,
    qrCodeId: null,
    tenantId: 'default-tenant',
    nurtureId: null,
    assignedAgentId: null,
    createdAt: now,
    updatedAt: now,
    form: null,
    qrCode: null,
    nurtureSequence: null,
    _count: { leads: 5 },
  };

  const mockLead = {
    id: 'lead-1',
    campaignId: 'campaign-1',
    status: 'NEW',
    segment: 'COLD',
    source: 'CAMPAIGN',
    score: 0,
    createdAt: now,
  };

  const hotConvertedLead = {
    id: 'lead-2',
    campaignId: 'campaign-1',
    status: 'CONVERTED',
    segment: 'HOT',
    source: 'FACEBOOK',
    score: 10,
    createdAt: new Date('2025-01-02T00:00:00Z'),
  };

  const mockTimelineEntry = {
    id: 'timeline-1',
    campaignId: 'campaign-1',
    event: 'campaign_created',
    detail: 'Campaign created',
    metadata: {},
    userId: 'user-1',
    createdAt: now,
  };

  beforeEach(async () => {
    // findOne() (used by completeCampaign/startCampaign/getTimeline) queries via
    // findFirst, while a couple of call sites query the same row via findUnique —
    // sharing one jest.fn() keeps both in sync with whatever a test sets the
    // campaign's existence to, the same way a real Prisma client would return the
    // same row (or none) from either query shape.
    const findCampaignOne = jest.fn().mockResolvedValue(mockCampaign);
    prisma = {
      campaign: {
        findMany: jest.fn().mockResolvedValue([mockCampaign]),
        findUnique: findCampaignOne,
        findFirst: findCampaignOne,
        create: jest.fn().mockResolvedValue(mockCampaign),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ ...mockCampaign, ...data }),
        ),
        count: jest.fn().mockResolvedValue(1),
      },
      lead: {
        findMany: jest.fn().mockResolvedValue([mockLead, hotConvertedLead]),
      },
      campaignTimelineEntry: {
        create: jest.fn().mockResolvedValue(mockTimelineEntry),
        findMany: jest.fn().mockResolvedValue([mockTimelineEntry]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: auditLogs },
        { provide: CampaignDispatcherService, useValue: dispatcher },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
  });

  // ──────────────────────────────────────────────
  // CREATE
  // ──────────────────────────────────────────────

  it('should create a campaign with default status "draft"', async () => {
    const campaign = await service.create({
      name: 'Test Campaign',
      sourceType: 'FORM',
    }, 'user-1');
    expect(campaign.name).toBe('Test Campaign');
    expect(campaign.sourceType).toBe('FORM');
    expect(campaign.status).toBe('draft');
    expect(auditLogs.log).toHaveBeenCalledWith('campaign_created', 'Campaign', campaign.id, 'user-1');
    expect(prisma.campaignTimelineEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event: 'campaign_created' }),
      }),
    );
  });

  it('should create a campaign with custom status', async () => {
    prisma.campaign.create.mockResolvedValue({ ...mockCampaign, status: 'active' });
    const campaign = await service.create({
      name: 'Active Campaign',
      sourceType: 'FORM',
      status: 'active',
    }, 'user-1');
    expect(campaign.status).toBe('active');
  });

  // ──────────────────────────────────────────────
  // FIND ALL
  // ──────────────────────────────────────────────

  it('should find all campaigns with pagination', async () => {
    const result = await service.findAll({ page: 1, limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(10);
  });

  it('should filter campaigns by active status', async () => {
    await service.findAll({ active: true, page: 1, limit: 20 });
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true }),
      }),
    );
  });

  it('should filter campaigns by status', async () => {
    await service.findAll({ status: 'active', page: 1, limit: 20 });
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'active' }),
      }),
    );
  });

  it('should filter campaigns by campaignType', async () => {
    await service.findAll({ campaignType: 'multi-channel', page: 1, limit: 20 });
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ campaignType: 'multi-channel' }),
      }),
    );
  });

  it('should filter campaigns by sourceType', async () => {
    await service.findAll({ sourceType: 'FORM', page: 1, limit: 20 });
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sourceType: 'FORM' }),
      }),
    );
  });

  it('should search campaigns by name or description', async () => {
    await service.findAll({ search: 'Test', page: 1, limit: 20 });
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ name: expect.objectContaining({ contains: 'Test' }) }),
          ]),
        }),
      }),
    );
  });

  it('should sort campaigns by specified field', async () => {
    await service.findAll({ sortBy: 'totalLeads', sortOrder: 'asc', page: 1, limit: 20 });
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { totalLeads: 'asc' },
      }),
    );
  });

  it('should sort campaigns by name descending', async () => {
    await service.findAll({ sortBy: 'name', sortOrder: 'desc', page: 1, limit: 20 });
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: 'desc' },
      }),
    );
  });

  it('should sort campaigns by priority ascending', async () => {
    await service.findAll({ sortBy: 'priority', sortOrder: 'asc', page: 1, limit: 20 });
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { priority: 'asc' },
      }),
    );
  });

  it('should sort campaigns by roi descending', async () => {
    await service.findAll({ sortBy: 'roi', sortOrder: 'desc', page: 1, limit: 20 });
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { roi: 'desc' },
      }),
    );
  });

  it('should include timeline and _count in findAll', async () => {
    await service.findAll({ page: 1, limit: 20 });
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          _count: expect.objectContaining({ select: { leads: true } }),
          timeline: expect.objectContaining({ take: 3 }),
        }),
      }),
    );
  });

  // ──────────────────────────────────────────────
  // FIND ONE
  // ──────────────────────────────────────────────

  it('should find a campaign by id', async () => {
    const campaign = await service.findOne('campaign-1');
    expect(campaign.name).toBe('Test Campaign');
    expect(campaign._count.leads).toBe(5);
  });

  it('should throw NotFoundException when campaign not found', async () => {
    prisma.campaign.findUnique.mockResolvedValue(null);
    await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
  });

  // ──────────────────────────────────────────────
  // UPDATE
  // ──────────────────────────────────────────────

  it('should update a campaign', async () => {
    prisma.campaign.update.mockResolvedValue({ ...mockCampaign, name: 'Updated Campaign' });
    const campaign = await service.update('campaign-1', { name: 'Updated Campaign' }, 'user-1');
    expect(campaign.name).toBe('Updated Campaign');
    expect(auditLogs.log).toHaveBeenCalledWith('campaign_updated', 'Campaign', 'campaign-1', 'user-1');
  });

  it('should throw NotFoundException when updating non-existent campaign', async () => {
    prisma.campaign.findUnique.mockResolvedValue(null);
    await expect(service.update('nonexistent', { name: 'Nope' })).rejects.toThrow(NotFoundException);
  });

  it('should create timeline entry when status changes on update', async () => {
    prisma.campaign.findUnique.mockResolvedValue({ ...mockCampaign, status: 'draft' });
    await service.update('campaign-1', { status: 'active' }, 'user-1');
    expect(prisma.campaignTimelineEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event: 'status_changed_to_active',
          detail: expect.stringContaining('draft'),
        }),
      }),
    );
  });

  it('should create timeline entry when budget changes on update', async () => {
    prisma.campaign.findUnique.mockResolvedValue({ ...mockCampaign, budget: { total: 1000 } });
    await service.update('campaign-1', { budget: { total: 2000 } }, 'user-1');
    expect(prisma.campaignTimelineEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event: 'budget_changed' }),
      }),
    );
  });

  it('should not create timeline entry when budget is unchanged', async () => {
    prisma.campaign.findUnique.mockResolvedValue({ ...mockCampaign, budget: { total: 1000 } });
    await service.update('campaign-1', { name: 'Renamed' }, 'user-1');
    // Only the audit log should fire, no status or budget timeline entries
    const budgetCalls = prisma.campaignTimelineEntry.create.mock.calls.filter(
      (call: any[]) => call[0]?.data?.event === 'budget_changed',
    );
    expect(budgetCalls).toHaveLength(0);
  });

  // ──────────────────────────────────────────────
  // PAUSE
  // ──────────────────────────────────────────────

  it('should pause a campaign', async () => {
    const campaign = await service.pause('campaign-1', 'user-1');
    expect(campaign.active).toBe(false);
    expect(campaign.status).toBe('paused');
    expect(prisma.campaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: false, status: 'paused' } }),
    );
    expect(prisma.campaignTimelineEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event: 'campaign_paused' }),
      }),
    );
    expect(auditLogs.log).toHaveBeenCalledWith('campaign_paused', 'Campaign', 'campaign-1', 'user-1');
  });

  it('should throw NotFoundException when pausing non-existent campaign', async () => {
    prisma.campaign.findUnique.mockResolvedValue(null);
    await expect(service.pause('nonexistent')).rejects.toThrow(NotFoundException);
  });

  // ──────────────────────────────────────────────
  // ACTIVATE
  // ──────────────────────────────────────────────

  it('should activate a campaign', async () => {
    prisma.campaign.update.mockResolvedValue({ ...mockCampaign, active: true, status: 'active' });
    const campaign = await service.activate('campaign-1', 'user-1');
    expect(campaign.active).toBe(true);
    expect(campaign.status).toBe('active');
    expect(prisma.campaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: true, status: 'active' } }),
    );
    expect(prisma.campaignTimelineEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event: 'campaign_activated' }),
      }),
    );
    expect(auditLogs.log).toHaveBeenCalledWith('campaign_activated', 'Campaign', 'campaign-1', 'user-1');
  });

  it('should throw NotFoundException when activating non-existent campaign', async () => {
    prisma.campaign.findUnique.mockResolvedValue(null);
    await expect(service.activate('nonexistent')).rejects.toThrow(NotFoundException);
  });

  // ──────────────────────────────────────────────
  // START CAMPAIGN
  // ──────────────────────────────────────────────

  it('should start a campaign', async () => {
    prisma.campaign.findUnique.mockResolvedValue({ ...mockCampaign, status: 'draft' });
    prisma.campaign.update.mockResolvedValue({ ...mockCampaign, status: 'active', active: true, startDate: now });

    const result = await service.startCampaign('campaign-1', 'user-1');
    expect(result.status).toBe('active');
    expect(result.active).toBe(true);
    expect(prisma.campaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'active', active: true }),
      }),
    );
    expect(prisma.campaignTimelineEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event: 'campaign_started' }),
      }),
    );
    expect(auditLogs.log).toHaveBeenCalledWith('campaign_started', 'Campaign', 'campaign-1', 'user-1');
  });

  it('should not start an already active campaign', async () => {
    prisma.campaign.findUnique.mockResolvedValue({ ...mockCampaign, status: 'active', active: true });
    const result = await service.startCampaign('campaign-1', 'user-1');
    expect(result.status).toBe('active');
    // No timeline or audit log should be created
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when starting non-existent campaign', async () => {
    prisma.campaign.findUnique.mockResolvedValue(null);
    await expect(service.startCampaign('nonexistent')).rejects.toThrow(NotFoundException);
  });

  // ──────────────────────────────────────────────
  // COMPLETE CAMPAIGN
  // ──────────────────────────────────────────────

  it('should complete a campaign', async () => {
    prisma.campaign.findUnique.mockResolvedValue({ ...mockCampaign, status: 'active' });
    prisma.campaign.update.mockResolvedValue({ ...mockCampaign, status: 'completed', active: false });

    const result = await service.completeCampaign('campaign-1', 'user-1');
    expect(result.status).toBe('completed');
    expect(result.active).toBe(false);
    expect(prisma.campaignTimelineEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event: 'campaign_completed' }),
      }),
    );
    expect(auditLogs.log).toHaveBeenCalledWith('campaign_completed', 'Campaign', 'campaign-1', 'user-1');
  });

  it('should throw NotFoundException when completing non-existent campaign', async () => {
    prisma.campaign.findUnique.mockResolvedValue(null);
    await expect(service.completeCampaign('nonexistent')).rejects.toThrow(NotFoundException);
  });

  // ──────────────────────────────────────────────
  // ARCHIVE CAMPAIGN
  // ──────────────────────────────────────────────

  it('should archive a campaign', async () => {
    prisma.campaign.findUnique.mockResolvedValue({ ...mockCampaign, status: 'completed' });
    prisma.campaign.update.mockResolvedValue({ ...mockCampaign, status: 'archived', active: false });

    const result = await service.archiveCampaign('campaign-1', 'user-1');
    expect(result.status).toBe('archived');
    expect(result.active).toBe(false);
    expect(prisma.campaignTimelineEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event: 'campaign_archived' }),
      }),
    );
    expect(auditLogs.log).toHaveBeenCalledWith('campaign_archived', 'Campaign', 'campaign-1', 'user-1');
  });

  it('should throw NotFoundException when archiving non-existent campaign', async () => {
    prisma.campaign.findUnique.mockResolvedValue(null);
    await expect(service.archiveCampaign('nonexistent')).rejects.toThrow(NotFoundException);
  });

  // ──────────────────────────────────────────────
  // DUPLICATE
  // ──────────────────────────────────────────────

  it('should duplicate a campaign with (copy) suffix and inactive status', async () => {
    const dupCampaign = { ...mockCampaign, id: 'campaign-dup', name: 'Test Campaign (copy)', active: false };
    prisma.campaign.create.mockResolvedValue(dupCampaign);
    const campaign = await service.duplicate('campaign-1', 'user-1');
    expect(campaign.name).toContain('(copy)');
    expect(campaign.active).toBe(false);
    expect(auditLogs.log).toHaveBeenCalledWith('campaign_duplicated', 'Campaign', campaign.id, 'user-1', { originalId: 'campaign-1' });
    expect(prisma.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Test Campaign (copy)',
          active: false,
          tenantId: 'default-tenant',
        }),
      }),
    );
    expect(prisma.campaignTimelineEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event: 'campaign_duplicated' }),
      }),
    );
  });

  it('should throw NotFoundException when duplicating non-existent campaign', async () => {
    prisma.campaign.findUnique.mockResolvedValue(null);
    await expect(service.duplicate('nonexistent')).rejects.toThrow(NotFoundException);
  });

  // ──────────────────────────────────────────────
  // PERFORMANCE
  // ──────────────────────────────────────────────

  it('should return basic performance metrics for a campaign', async () => {
    const result = await service.performance('campaign-1');
    expect(result.data.campaign.name).toBe('Test Campaign');
    expect(result.data.totalLeads).toBe(2);
    expect(result.data.bySegment.hot).toBe(1);
    expect(result.data.bySegment.warm).toBe(0);
    expect(result.data.bySegment.cold).toBe(1);
    expect(result.data.converted).toBe(1);
    expect(result.data.conversionRate).toBe(50.0);
  });

  it('should return 0 conversion rate when there are no leads', async () => {
    prisma.lead.findMany.mockResolvedValue([]);
    const result = await service.performance('campaign-1');
    expect(result.data.totalLeads).toBe(0);
    expect(result.data.conversionRate).toBe(0);
    expect(result.data.budgetStats.costPerLead).toBe(0);
  });

  it('should throw NotFoundException when getting performance for non-existent campaign', async () => {
    prisma.campaign.findUnique.mockResolvedValue(null);
    await expect(service.performance('nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('should return enhanced performance with budget stats', async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      ...mockCampaign,
      totalBudget: 10000,
      totalSpend: 2500,
      channels: [{ type: 'facebook', active: true }, { type: 'google', active: true }],
    });
    prisma.campaignTimelineEntry.findMany.mockResolvedValue([
      { id: 't1', campaignId: 'campaign-1', event: 'campaign_created', detail: 'Created', userId: 'user-1', createdAt: now, metadata: {} },
    ]);

    const result = await service.performance('campaign-1');
    expect(result.data.budgetStats).toBeDefined();
    expect(result.data.budgetStats.total).toBe(10000);
    expect(result.data.budgetStats.spent).toBe(2500);
    expect(result.data.budgetStats.remaining).toBe(7500);
    expect(result.data.budgetStats.costPerLead).toBe(1250);
    // ROI is null when no deal/revenue data is available
    expect(result.data.budgetStats.roi).toBeNull();
  });

  it('should return lead source breakdown in performance', async () => {
    const result = await service.performance('campaign-1');
    expect(result.data.bySource).toBeDefined();
    expect(result.data.bySource.campaign).toBe(1);
    expect(result.data.bySource.facebook).toBe(1);
  });

  it('should return lead status breakdown in performance', async () => {
    const result = await service.performance('campaign-1');
    expect(result.data.byStatus).toBeDefined();
    expect(result.data.byStatus.new).toBe(1);
    expect(result.data.byStatus.converted).toBe(1);
  });

  it('should return segment breakdown in performance', async () => {
    const result = await service.performance('campaign-1');
    expect(result.data.bySegment).toBeDefined();
    expect(result.data.bySegment.hot).toBe(1);
    expect(result.data.bySegment.cold).toBe(1);
  });

  it('should return timeline entries in performance', async () => {
    prisma.campaignTimelineEntry.findMany.mockResolvedValue([
      { id: 't1', campaignId: 'campaign-1', event: 'campaign_created', detail: 'Created', userId: 'user-1', createdAt: now, metadata: {} },
    ]);

    const result = await service.performance('campaign-1');
    expect(result.data.timeline).toBeDefined();
    expect(Array.isArray(result.data.timeline)).toBe(true);
  });

  it('should return daily leads in performance', async () => {
    const result = await service.performance('campaign-1');
    expect(result.data.dailyLeads).toBeDefined();
    expect(Array.isArray(result.data.dailyLeads)).toBe(true);
  });

  it('should return channel performance breakdown', async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      ...mockCampaign,
      channels: [{ type: 'facebook', active: true }, { type: 'google', active: true }],
    });

    const result = await service.performance('campaign-1');
    expect(result.data.channelPerformance).toBeDefined();
    expect(Array.isArray(result.data.channelPerformance)).toBe(true);
    expect(result.data.channelPerformance.length).toBe(2);
    expect(result.data.channelPerformance[0].type).toBe('facebook');
    expect(result.data.channelPerformance[1].type).toBe('google');
  });

  it('should handle empty channels gracefully in performance', async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      ...mockCampaign,
      channels: [],
    });

    const result = await service.performance('campaign-1');
    expect(result.data.channelPerformance).toEqual([]);
  });

  it('should handle null budget gracefully in performance', async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      ...mockCampaign,
      totalBudget: null,
      totalSpend: null,
    });

    const result = await service.performance('campaign-1');
    expect(result.data.budgetStats.total).toBe(0);
    expect(result.data.budgetStats.spent).toBe(0);
    expect(result.data.budgetStats.remaining).toBe(0);
    expect(result.data.budgetStats.costPerLead).toBe(0);
  });

  // ──────────────────────────────────────────────
  // GET TIMELINE
  // ──────────────────────────────────────────────

  it('should get campaign timeline', async () => {
    const timelineEntries = [
      { id: 't1', campaignId: 'campaign-1', event: 'campaign_created', detail: 'Campaign created', userId: 'user-1', createdAt: now, metadata: {} },
      { id: 't2', campaignId: 'campaign-1', event: 'campaign_activated', detail: 'Campaign activated', userId: 'user-1', createdAt: now, metadata: {} },
    ];
    prisma.campaignTimelineEntry.findMany.mockResolvedValue(timelineEntries);

    const result = await service.getTimeline('campaign-1');
    expect(result).toHaveLength(2);
    expect(result[0].event).toBe('campaign_created');
    expect(prisma.campaignTimelineEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campaignId: 'campaign-1' },
      }),
    );
  });

  it('should throw NotFoundException when getting timeline for non-existent campaign', async () => {
    prisma.campaign.findUnique.mockResolvedValue(null);
    await expect(service.getTimeline('nonexistent')).rejects.toThrow(NotFoundException);
  });

  // ──────────────────────────────────────────────
  // STATE TRANSITION EDGE CASES
  // ──────────────────────────────────────────────

  it('should reject operations on non-existent campaigns', async () => {
    prisma.campaign.findUnique.mockResolvedValue(null);
    const operations = [
      service.startCampaign('nonexistent'),
      service.completeCampaign('nonexistent'),
      service.archiveCampaign('nonexistent'),
      service.getTimeline('nonexistent'),
    ];
    for (const op of operations) {
      await expect(op).rejects.toThrow(NotFoundException);
    }
  });

  it('should handle the full lifecycle: draft -> active -> paused -> active -> completed -> archived', async () => {
    // Start in draft
    prisma.campaign.findUnique.mockResolvedValue({ ...mockCampaign, status: 'draft' });
    prisma.campaign.update.mockResolvedValue({ ...mockCampaign, status: 'active', active: true, startDate: now });
    await service.startCampaign('campaign-1', 'user-1');
    // Not toHaveBeenLastCalledWith — starting a campaign also fires a
    // fire-and-forget dispatch whose own timeline entry can land right after.
    expect(prisma.campaignTimelineEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'campaign_started' }) }),
    );

    // Pause
    prisma.campaign.update.mockResolvedValue({ ...mockCampaign, status: 'paused', active: false });
    await service.pause('campaign-1', 'user-1');
    expect(prisma.campaignTimelineEntry.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'campaign_paused' }) }),
    );

    // Activate again
    prisma.campaign.update.mockResolvedValue({ ...mockCampaign, status: 'active', active: true });
    await service.activate('campaign-1', 'user-1');
    // Not toHaveBeenLastCalledWith — activating also fires a fire-and-forget
    // dispatch whose own timeline entry can land right after.
    expect(prisma.campaignTimelineEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'campaign_activated' }) }),
    );

    // Complete
    prisma.campaign.update.mockResolvedValue({ ...mockCampaign, status: 'completed', active: false });
    await service.completeCampaign('campaign-1', 'user-1');
    expect(prisma.campaignTimelineEntry.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'campaign_completed' }) }),
    );

    // Archive
    prisma.campaign.update.mockResolvedValue({ ...mockCampaign, status: 'archived', active: false });
    await service.archiveCampaign('campaign-1', 'user-1');
    expect(prisma.campaignTimelineEntry.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'campaign_archived' }) }),
    );
  });
});
