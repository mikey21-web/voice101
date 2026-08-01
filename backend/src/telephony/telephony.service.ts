import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TwilioVoiceAdapter } from '../shared/adapters/voice.adapter';

@Injectable()
export class TelephonyService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private voiceAdapter: TwilioVoiceAdapter,
  ) {}

  async initiateCall(leadId: string, agentId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { contact: true, tenant: true },
    });
    if (!lead) return { success: false, error: 'Lead not found' };
    if (!lead.contact?.phone) return { success: false, error: 'Contact has no phone number' };

    const agentNumber = this.config.get<string>('TWILIO_PHONE_NUMBER', '');
    const statusCallback = `${this.config.get<string>('PUBLIC_URL', '')}/webhooks/twilio/voice/status`;

    const result = await this.voiceAdapter.makeCall(lead.contact.phone, {
      agentPhoneNumber: agentNumber,
      leadName: lead.contact.name || undefined,
      businessName: lead.tenant?.name || undefined,
      statusCallback,
      callerId: agentNumber,
      record: true,
    });

    if (result.success) {
      await this.prisma.callLog.create({
        data: {
          tenantId: lead.tenantId,
          leadId: lead.id,
          contactId: lead.contactId,
          agentId,
          direction: 'OUTBOUND',
          status: 'INITIATED',
          fromNumber: agentNumber,
          toNumber: lead.contact.phone,
          providerSid: result.callSid || undefined,
        },
      });

      // First outbound contact clock (form-submit -> call-placed). Set once, so a
      // follow-up call doesn't overwrite the original capture-to-call measurement.
      if (!lead.firstContactAttemptedAt) {
        await this.prisma.lead.update({
          where: { id: lead.id },
          data: { firstContactAttemptedAt: new Date() },
        });
      }

      await this.prisma.conversationMessage.create({
        data: {
          text: `Outbound call to ${lead.contact.phone} (SID: ${result.callSid})`,
          channel: 'PHONE_CALL',
          direction: 'OUTBOUND',
          providerMessageId: result.callSid,
          leadId: lead.id,
          contactId: lead.contactId,
          deliveryStatus: 'pending',
          metadata: { callSid: result.callSid },
        },
      });
    }

    return result;
  }
}
