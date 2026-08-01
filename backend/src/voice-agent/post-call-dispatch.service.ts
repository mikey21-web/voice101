import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagePolicyService } from '../conversations/message-policy.service';
import { NotificationsService } from '../notifications/notifications.service';

/** The one template allowed for post-call details. Must exist and be active
 * for out-of-window sends to work at all. See section 5.4 of the build plan. */
export const POST_CALL_TEMPLATE_NAME = 'post_call_details';

/**
 * Section 5 — the "under a minute" flow's post-call half.
 * On call end: assemble what was actually discussed into a WhatsApp message,
 * deliver to contact.whatsapp || contact.phone within 60s, and notify the
 * assigned rep with the summary + recording.
 */
@Injectable()
export class PostCallDispatchService {
  private readonly logger = new Logger(PostCallDispatchService.name);

  constructor(
    private prisma: PrismaService,
    private conversations: ConversationsService,
    private policy: MessagePolicyService,
    private notifications: NotificationsService,
    private config: ConfigService,
  ) {}

  async dispatchAfterCall(params: {
    tenantId: string;
    leadId: string;
    callLogId: string;
  }): Promise<void> {
    const { tenantId, leadId, callLogId } = params;
    const callLog = await this.prisma.callLog.findUnique({ where: { id: callLogId } });
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { contact: true, assignedAgent: true, campaign: true },
    });
    if (!lead?.contact) {
      this.logger.warn(`post-call dispatch: lead ${leadId} has no contact`);
      return;
    }

    const destination = lead.contact.whatsapp || lead.contact.phone;
    if (!destination) {
      this.logger.warn(`post-call dispatch: lead ${leadId} has no phone/whatsapp`);
      return;
    }

    // Content matches the conversation: the unit type + project he asked about.
    const metadata = (lead.metadata || {}) as any;
    const interest = lead.interest || metadata.interest || metadata.property_type || metadata.unitType;
    const budget = lead.budget || metadata.budget;
    const project = metadata.project || metadata.projectName;
    const parts: string[] = [];
    if (interest) parts.push(interest);
    if (project) parts.push(project);
    if (budget) parts.push(`budget around ${budget}`);
    const topic = parts.length ? parts.join(', ') : 'what we discussed';

    const summary = callLog?.summary || lead.message || '';
    const body = summary ? `${summary.trim()}\n\n` : '';
    const text = `Thanks for the call! ${body}Here are the details on ${topic}. ` +
      `Reply here anytime or call us for more.`;

    // Use the policy gate: an approved template is required for a WhatsApp
    // number we have never messaged within the 24h window.
    const policyResult = await this.policy.evaluate(leadId, 'WHATSAPP', text, { isProactive: true });
    let templateId: string | undefined;
    if (policyResult.requiresTemplate) {
      templateId = await this.pickApprovedTemplate();
    }

    let deliveryError: string | undefined;
    if (policyResult.requiresTemplate && !templateId) {
      // conversations.create would block this anyway (fail closed). Say so
      // plainly rather than logging a "fallback" that does not exist.
      deliveryError = `no approved WhatsApp template named "${POST_CALL_TEMPLATE_NAME}", and the 24h session window is closed`;
      this.logger.error(`post-call dispatch to lead ${leadId} blocked: ${deliveryError}`);
    } else {
      try {
        await this.conversations.create({
          leadId,
          tenantId,
          contactId: lead.contactId,
          channel: 'WHATSAPP',
          direction: 'OUTBOUND',
          text,
          messageTemplateId: templateId,
          deliveryStatus: 'pending',
          metadata: { postCallDispatch: true, callLogId },
        });
      } catch (e: any) {
        deliveryError = e.message;
        this.logger.error(`post-call WhatsApp to ${leadId} failed: ${e.message}`);
      }
    }

    // Assigned rep gets the summary + recording link. If the buyer never got
    // their details, the rep is told loudly — a silent failure here means
    // nobody follows up and the lead just goes cold.
    if (lead.assignedAgentId) {
      const link = callLog?.recordingUrl || undefined;
      const who = lead.contact.name || 'lead';
      this.notifications.create({
        tenantId,
        userId: lead.assignedAgentId,
        // sla_breach is in SMS_NOTIFICATION_TYPES, so a failed delivery reaches
        // the rep as a real text, not just an in-app row they may never open.
        type: deliveryError ? 'sla_breach' : 'lead_hot',
        title: deliveryError
          ? `WhatsApp NOT delivered to ${who} — send it manually`
          : `Call complete: ${who}`,
        body: deliveryError
          ? `${who} was told details are coming on WhatsApp but the send failed: ${deliveryError}`
          : summary || 'Call completed',
        link,
        whatsappTo: lead.assignedAgent?.phone || undefined,
      }).catch((e) => this.logger.error(`Rep notify failed for ${leadId}: ${e.message}`));
    }
  }

  /**
   * MessageTemplate has no tenantId, so "any active WhatsApp template" would
   * happily send another tenant's payment-overdue copy to a brand new buyer.
   * Match one specific name instead, and send nothing if it is missing.
   */
  private async pickApprovedTemplate(): Promise<string | undefined> {
    const t = await this.prisma.messageTemplate.findFirst({
      where: { channel: 'WHATSAPP', active: true, name: POST_CALL_TEMPLATE_NAME },
      orderBy: { updatedAt: 'desc' },
    });
    return t?.id;
  }
}
