import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SpineDriverService } from '../leads/spine-driver.service';

export interface TimelineEntry {
  type: string;
  title: string;
  description?: string;
  leadId?: string;
  contactId?: string;
  metadata?: Record<string, unknown>;
  createdById?: string;
}

@Injectable()
export class TimelineService {
  private readonly logger = new Logger(TimelineService.name);

  constructor(
    private prisma: PrismaService,
    // forwardRef: LeadsModule imports TimelineModule for its own writes, and
    // the driver lives in LeadsModule, so the two modules reference each other.
    @Inject(forwardRef(() => SpineDriverService))
    private spineDriver: SpineDriverService,
  ) {}

  async add(entry: TimelineEntry) {
    const item = await this.prisma.timelineItem.create({ data: entry as any });

    // Section 2: Mikey operates the spine. Every lifecycle service already
    // records its business facts here, so this is the one place that can turn
    // "a cost sheet went out" into "the lead is at PROPOSAL_SENT" without six
    // services each remembering to write a status.
    //
    // Fire and forget: a stage that cannot advance must never fail the booking
    // or site visit that produced this entry.
    this.spineDriver
      .onLifecycleEvent(entry)
      .catch((err) => this.logger.warn(`Spine driver failed on ${entry.type}: ${err.message}`));

    return item;
  }

  async getByLead(leadId: string) {
    return this.prisma.timelineItem.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getByContact(contactId: string) {
    return this.prisma.timelineItem.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async recordLeadCreated(leadId: string, details?: Record<string, unknown>) {
    return this.add({ type: 'lead_created', title: 'Lead created', leadId, metadata: details });
  }

  async recordMessageReceived(leadId: string, channel: string) {
    return this.add({ type: 'message_received', title: `Message received via ${channel}`, leadId });
  }

  async recordMessageSent(leadId: string, channel: string) {
    return this.add({ type: 'message_sent', title: `Message sent via ${channel}`, leadId });
  }

  async recordScoreChanged(leadId: string, oldScore: number, newScore: number) {
    return this.add({ type: 'score_changed', title: `Score: ${oldScore} → ${newScore}`, leadId, metadata: { oldScore, newScore } });
  }

  async recordSegmentChanged(leadId: string, segment: string) {
    return this.add({ type: 'segment_changed', title: `Segment: ${segment}`, leadId });
  }

  async recordAssigned(leadId: string, agentName?: string) {
    return this.add({ type: 'assigned', title: agentName ? `Assigned to ${agentName}` : 'Lead assigned', leadId });
  }

  async recordCRMPush(leadId: string, crm: string, success: boolean) {
    return this.add({ type: success ? 'crm_push_succeeded' : 'crm_push_failed', title: `CRM push to ${crm}: ${success ? 'succeeded' : 'failed'}`, leadId });
  }

  async recordConversion(leadId: string, destination: string) {
    return this.add({ type: 'conversion', title: `Converted: ${destination}`, leadId });
  }

  async recordAutomationFailed(leadId: string, reason: string) {
    return this.add({ type: 'automation_failed', title: `Automation failed: ${reason}`, leadId });
  }

  async recordDeliveryUpdated(leadId: string, channel: string, status: string) {
    const icons: Record<string, string> = { delivered: '\u2713', read: '\u2713\u2713', sent: '\u2197', failed: '\u2717', pending: '\u25CB' };
    return this.add({ type: 'delivery_updated', title: `${channel}: ${icons[status] || status}`, description: status, leadId });
  }

  async recordCall(leadId: string, status: string, recordingUrl?: string | null, disposition?: string | null) {
    const title = disposition ? `Call: ${disposition.replace(/_/g, ' ')}` : `Call status: ${status}`;
    return this.add({ type: 'call', title, description: status, leadId, metadata: { recordingUrl, disposition } as any });
  }

  async recordDiscountApproved(leadId: string, discountAmount: string, approvedBy?: string) {
    return this.add({ type: 'discount_approved', title: 'Discount Approved', description: `Discount amount: ${discountAmount}`, leadId, createdById: approvedBy });
  }
}
