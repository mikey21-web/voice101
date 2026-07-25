import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TwilioSmsAdapter } from '../shared/adapters/sms.adapter';
import { WhatsAppCloudAdapter } from '../shared/adapters/messaging.adapter';
import { NormalizationService } from '../shared/normalization.service';

export type NotificationType =
  | 'lead_assigned'
  | 'lead_hot'
  | 'message_received'
  | 'sla_breach'
  | 'webhook_failure'
  | 'call_wants_human'
  | 'generic';

const PREF_FIELD_BY_TYPE: Partial<Record<NotificationType, string>> = {
  lead_assigned: 'leadAssigned',
  lead_hot: 'leadHot',
  message_received: 'messageReceived',
  sla_breach: 'slaBreach',
  webhook_failure: 'webhookFailure',
};

// These types are urgent enough to also send a real text, not just an in-app row.
const SMS_NOTIFICATION_TYPES: NotificationType[] = ['lead_hot', 'sla_breach', 'call_wants_human'];

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private smsAdapter: TwilioSmsAdapter,
    private whatsAppAdapter: WhatsAppCloudAdapter,
    private normalization: NormalizationService,
  ) {}

  async create(opts: {
    tenantId: string;
    userId?: string;
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
    whatsappTo?: string;
  }) {
    const prefField = PREF_FIELD_BY_TYPE[opts.type];
    if (opts.userId && prefField) {
      const prefs = await this.prisma.notificationPreference.findUnique({ where: { userId: opts.userId } });
      if (prefs && prefs[prefField as keyof typeof prefs] === false) return null;
    }

    const notification = await this.prisma.notification.create({
      data: {
        tenantId: opts.tenantId,
        userId: opts.userId,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        link: opts.link,
      },
    });

    if (SMS_NOTIFICATION_TYPES.includes(opts.type)) {
      this.sendSmsAlert(opts.title).catch(err => this.logger.error(`Failed to send SMS alert: ${err.message}`));
    }

    if (opts.whatsappTo) {
      const text = opts.body ? `${opts.title}\n${opts.body}` : opts.title;
      this.sendWhatsAppAlert(opts.whatsappTo, text).catch(err => this.logger.error(`Failed to send WhatsApp alert: ${err.message}`));
    }

    return notification;
  }

  private async sendSmsAlert(title: string) {
    const settings = await this.prisma.businessSettings.findFirst({});
    if (!settings?.notificationPhone) return;
    const result = await this.smsAdapter.send(settings.notificationPhone, title);
    if (!result.success) this.logger.error(`SMS alert failed: ${result.error}`);
  }

  private async sendWhatsAppAlert(phone: string, text: string) {
    const to = this.normalization.normalizePhone(phone).replace(/^\+/, '');
    const result = await this.whatsAppAdapter.sendMessage(to, text, {});
    if (!result.success) this.logger.error(`WhatsApp alert to ${phone} failed: ${result.error}`);
  }

  async findForUser(userId: string, opts: { unreadOnly?: boolean; limit?: number } = {}) {
    return this.prisma.notification.findMany({
      where: { userId, ...(opts.unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 20,
    });
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  }
}
