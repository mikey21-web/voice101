import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TwilioSmsAdapter } from '../shared/adapters/sms.adapter';
import { WhatsAppCloudAdapter } from '../shared/adapters/messaging.adapter';
import { NormalizationService } from '../shared/normalization.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;
  let smsAdapter: any;

  beforeEach(async () => {
    prisma = {
      notification: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'notif-1', read: false, createdAt: new Date(), ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      businessSettings: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    smsAdapter = { send: jest.fn().mockResolvedValue({ success: true }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TwilioSmsAdapter, useValue: smsAdapter },
        { provide: WhatsAppCloudAdapter, useValue: { sendMessage: jest.fn().mockResolvedValue({ success: true }) } },
        { provide: NormalizationService, useValue: { normalizePhone: (p: string) => p } },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('creates a notification when no preference row exists (default allow)', async () => {
    const result = await service.create({ tenantId: 't1', userId: 'u1', type: 'lead_assigned', title: 'New lead' });
    expect(result).not.toBeNull();
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { tenantId: 't1', userId: 'u1', type: 'lead_assigned', title: 'New lead', body: undefined, link: undefined },
    });
  });

  it('skips creating a notification when the user has explicitly disabled that type', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue({ leadAssigned: false });
    const result = await service.create({ tenantId: 't1', userId: 'u1', type: 'lead_assigned', title: 'New lead' });
    expect(result).toBeNull();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('creates broadcast notifications (no userId) without checking preferences', async () => {
    const result = await service.create({ tenantId: 't1', type: 'generic', title: 'System update' });
    expect(result).not.toBeNull();
    expect(prisma.notificationPreference.findUnique).not.toHaveBeenCalled();
  });

  it('marks a single notification read scoped to the owning user', async () => {
    await service.markRead('notif-1', 'u1');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where: { id: 'notif-1', userId: 'u1' }, data: { read: true } });
  });

  it('marks all unread notifications read for a user', async () => {
    await service.markAllRead('u1');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1', read: false }, data: { read: true } });
  });
});
