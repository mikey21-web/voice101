import { Test, TestingModule } from '@nestjs/testing';
import { TimelineService } from './timeline.service';
import { PrismaService } from '../prisma/prisma.service';
import { SpineDriverService } from '../leads/spine-driver.service';

describe('TimelineService', () => {
  let service: TimelineService;
  let prisma: any;

  const mockTimelineItem = {
    id: 'item-1',
    type: 'lead_created',
    title: 'Lead created',
    description: null,
    leadId: 'lead-1',
    contactId: null,
    metadata: null,
    createdById: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
  };

  const mockTimelineItems = [
    mockTimelineItem,
    {
      ...mockTimelineItem,
      id: 'item-2',
      type: 'message_received',
      title: 'Message received via SMS',
    },
  ];

  beforeEach(async () => {
    prisma = {
      timelineItem: {
        create: jest.fn().mockResolvedValue(mockTimelineItem),
        findMany: jest.fn().mockResolvedValue(mockTimelineItems),
      },
    };

    const spineDriver = { onLifecycleEvent: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimelineService,
        { provide: PrismaService, useValue: prisma },
        // Every timeline write also offers the fact to the spine driver, which
        // is how Mikey advances stages 5-10 off real events.
        { provide: SpineDriverService, useValue: spineDriver },
      ],
    }).compile();

    service = module.get<TimelineService>(TimelineService);
  });

  describe('add', () => {
    it('should add a timeline entry', async () => {
      const entry = await service.add({
        type: 'note',
        title: 'Test entry',
        leadId: 'lead-1',
      });
      expect(entry.type).toBe('lead_created');
      expect(prisma.timelineItem.create).toHaveBeenCalledWith({
        data: { type: 'note', title: 'Test entry', leadId: 'lead-1' },
      });
    });

    it('should add an entry with all optional fields', async () => {
      await service.add({
        type: 'note',
        title: 'Detailed entry',
        description: 'Something happened',
        leadId: 'lead-1',
        contactId: 'contact-1',
        metadata: { key: 'value' },
        createdById: 'user-1',
      });
      expect(prisma.timelineItem.create).toHaveBeenCalledWith({
        data: {
          type: 'note',
          title: 'Detailed entry',
          description: 'Something happened',
          leadId: 'lead-1',
          contactId: 'contact-1',
          metadata: { key: 'value' },
          createdById: 'user-1',
        },
      });
    });
  });

  describe('getByLead', () => {
    it('should return timeline items for a lead ordered by newest first', async () => {
      const items = await service.getByLead('lead-1');
      expect(items).toHaveLength(2);
      expect(prisma.timelineItem.findMany).toHaveBeenCalledWith({
        where: { leadId: 'lead-1' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    });

    it('should return empty array when lead has no timeline', async () => {
      prisma.timelineItem.findMany.mockResolvedValue([]);
      const items = await service.getByLead('lead-empty');
      expect(items).toEqual([]);
    });
  });

  describe('getByContact', () => {
    it('should return timeline items for a contact ordered by newest first (max 50)', async () => {
      const items = await service.getByContact('contact-1');
      expect(items).toHaveLength(2);
      expect(prisma.timelineItem.findMany).toHaveBeenCalledWith({
        where: { contactId: 'contact-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });

  describe('record events', () => {
    it('recordLeadCreated - should add a lead_created entry', async () => {
      const details = { source: 'FORM' };
      await service.recordLeadCreated('lead-1', details);
      expect(prisma.timelineItem.create).toHaveBeenCalledWith({
        data: {
          type: 'lead_created',
          title: 'Lead created',
          leadId: 'lead-1',
          metadata: details,
        },
      });
    });

    it('recordLeadCreated - should work without details', async () => {
      await service.recordLeadCreated('lead-1');
      expect(prisma.timelineItem.create).toHaveBeenCalledWith({
        data: {
          type: 'lead_created',
          title: 'Lead created',
          leadId: 'lead-1',
          metadata: undefined,
        },
      });
    });

    it('recordMessageReceived - should add a message_received entry with channel', async () => {
      await service.recordMessageReceived('lead-1', 'SMS');
      expect(prisma.timelineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'message_received',
            title: 'Message received via SMS',
            leadId: 'lead-1',
          }),
        }),
      );
    });

    it('recordMessageSent - should add a message_sent entry with channel', async () => {
      await service.recordMessageSent('lead-1', 'EMAIL');
      expect(prisma.timelineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'message_sent',
            title: 'Message sent via EMAIL',
            leadId: 'lead-1',
          }),
        }),
      );
    });

    it('recordScoreChanged - should add a score_changed entry with old and new scores', async () => {
      await service.recordScoreChanged('lead-1', 50, 80);
      expect(prisma.timelineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'score_changed',
            title: 'Score: 50 → 80',
            leadId: 'lead-1',
            metadata: { oldScore: 50, newScore: 80 },
          }),
        }),
      );
    });

    it('recordSegmentChanged - should add a segment_changed entry', async () => {
      await service.recordSegmentChanged('lead-1', 'HOT');
      expect(prisma.timelineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'segment_changed',
            title: 'Segment: HOT',
            leadId: 'lead-1',
          }),
        }),
      );
    });

    it('recordAssigned - should include agent name when provided', async () => {
      await service.recordAssigned('lead-1', 'Alice');
      expect(prisma.timelineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Assigned to Alice',
            leadId: 'lead-1',
          }),
        }),
      );
    });

    it('recordAssigned - should use generic title when agent name is not provided', async () => {
      await service.recordAssigned('lead-1');
      expect(prisma.timelineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Lead assigned',
            leadId: 'lead-1',
          }),
        }),
      );
    });

    it('recordCRMPush - should record success', async () => {
      await service.recordCRMPush('lead-1', 'Salesforce', true);
      expect(prisma.timelineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'crm_push_succeeded',
            title: 'CRM push to Salesforce: succeeded',
            leadId: 'lead-1',
          }),
        }),
      );
    });

    it('recordCRMPush - should record failure', async () => {
      await service.recordCRMPush('lead-1', 'HubSpot', false);
      expect(prisma.timelineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'crm_push_failed',
            title: 'CRM push to HubSpot: failed',
            leadId: 'lead-1',
          }),
        }),
      );
    });

    it('recordConversion - should add a conversion entry', async () => {
      await service.recordConversion('lead-1', 'HubSpot');
      expect(prisma.timelineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'conversion',
            title: 'Converted: HubSpot',
            leadId: 'lead-1',
          }),
        }),
      );
    });

    it('recordAutomationFailed - should add an automation_failed entry', async () => {
      await service.recordAutomationFailed('lead-1', 'Webhook timeout');
      expect(prisma.timelineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'automation_failed',
            title: 'Automation failed: Webhook timeout',
            leadId: 'lead-1',
          }),
        }),
      );
    });
  });
});
