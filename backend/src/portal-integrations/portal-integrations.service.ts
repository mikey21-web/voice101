import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import { LeadsService } from '../leads/leads.service';
import { ConversationsService } from '../conversations/conversations.service';
import * as crypto from 'crypto';

export interface PortalLeadPayload {
  name?: string;
  phone?: string;
  email?: string;
  message?: string;
  city?: string;
  budget?: string;
  requirement?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class PortalIntegrationsService {
  private readonly logger = new Logger(PortalIntegrationsService.name);

  constructor(
    private prisma: PrismaService,
    private contactsService: ContactsService,
    private leadsService: LeadsService,
    private conversationsService: ConversationsService,
  ) {}

  private idempotencyKey(parts: string[]): string {
    return parts.join(':').slice(0, 255);
  }

  private payloadHash(payload: any): string {
    return crypto.createHash('md5').update(JSON.stringify(payload, Object.keys(payload).sort())).digest('hex');
  }

  private async dedupAndCreate(payload: PortalLeadPayload, source: string, req?: any) {
    const contact = await this.contactsService.findOrCreate({
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
    }, req);

    const existingLead = await this.prisma.lead.findFirst({
      where: {
        contactId: contact.id,
        status: { notIn: ['LOST', 'CONVERTED', 'SPAM'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    const isNewLead = !existingLead;
    const lead = existingLead || await this.leadsService.create({
      contactId: contact.id,
      source: source as any,
      message: payload.message || payload.requirement || '',
      metadata: {
        portalSource: source,
        city: payload.city,
        budget: payload.budget,
        requirement: payload.requirement,
        ...(payload.metadata || {}),
      },
    });

    if (isNewLead) {
      this.sendFirstResponseAck(lead.id, contact).catch(err =>
        this.logger.warn(`First-response WhatsApp ack failed for lead ${lead.id}: ${err.message}`),
      );
    }

    return { contact, lead };
  }

  /**
   * Instant acknowledgement on a brand-new portal lead (spec 3/47). Only
   * sends if the tenant has configured an active WELCOME WhatsApp template —
   * there is no built-in default wording, and ConversationsService.create
   * still runs the full consent/quiet-hours/rate-limit policy gate before
   * anything actually goes out.
   */
  private async recordPortalEvent(provider: string, key: string, rawPayload: any, result: any, status: string = 'processed') {
    await this.prisma.webhookEvent.create({ data: { provider, eventType: 'portal_lead', idempotencyKey: key, rawPayload, processedResult: result, status } }).catch(e =>
      this.logger.error(`Failed to record webhook event: ${e.message}`),
    );
  }

  private async sendFirstResponseAck(leadId: string, contact: { id: string; name?: string | null }): Promise<void> {
    const template = await this.prisma.messageTemplate.findFirst({
      where: { type: 'WELCOME', channel: 'WHATSAPP', active: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!template) return;

    const firstName = (contact.name || '').trim().split(/\s+/)[0] || 'there';
    const text = template.body.replace(/\{\{\s*name\s*\}\}/gi, firstName);

    await this.conversationsService.create({
      leadId,
      channel: 'WHATSAPP',
      direction: 'OUTBOUND',
      text,
      messageTemplateId: template.id,
    });
  }

  async handleIndiaMART(raw: any) {
    const key = this.idempotencyKey(['indiamart', raw.lead_id || raw.enquiry_id || this.payloadHash(raw)]);
    const existing = await this.prisma.webhookEvent.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { status: 'duplicate', leadId: (existing.processedResult as any)?.lead?.id };
    try {
      const payload: PortalLeadPayload = {
        name: raw.buyer_name || raw.name || raw.contact_person || raw.BUYER_NAME,
        phone: raw.buyer_mobile || raw.mobile || raw.phone || raw.BUYER_MOBILE,
        email: raw.buyer_email || raw.email || raw.BUYER_EMAIL,
        message: raw.enquiry_description || raw.message || raw.requirement || raw.ENQUIRY_DESC,
        city: raw.buyer_city || raw.city || raw.CITY,
        budget: raw.budget_band || raw.budget || raw.BUDGET,
        requirement: raw.enquiry_for || raw.category || raw.ENQUIRY_FOR,
        metadata: {
          portal: 'IndiaMART', rawProduct: raw.product_name || raw.product || raw.PRODUCT_NAME,
          rawCategory: raw.category || raw.CATEGORY, rawCompanyName: raw.buyer_company || raw.company || raw.COMPANY_NAME,
          rawLeadId: raw.lead_id || raw.enquiry_id || raw.LEAD_ID, rawSource: raw.source || raw.lead_source, rawPayload: raw,
        },
      };
      const { contact, lead } = await this.dedupAndCreate(payload, 'INDIAMART');
      const result = { contact, lead };
      await this.recordPortalEvent('indiamart', key, raw, result, 'processed');
      this.logger.log(`IndiaMART lead ${lead.id} from ${payload.name} (${payload.phone})`);
      return { status: 'created', leadId: lead.id, contactId: contact.id };
    } catch (e: any) {
      this.logger.error(`IndiaMART handler error: ${e.message}`, e.stack);
      await this.recordPortalEvent('indiamart', key, raw, { error: e.message }, 'failed');
      throw e;
    }
  }

  async handle99Acres(raw: any) {
    const key = this.idempotencyKey(['99acres', raw.id || raw.query_id || raw.enquiry_id || this.payloadHash(raw)]);
    const existing = await this.prisma.webhookEvent.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { status: 'duplicate', leadId: (existing.processedResult as any)?.lead?.id };
    try {
      const payload: PortalLeadPayload = {
        name: raw.user_name || raw.name || raw.USER_NAME,
        phone: raw.user_mobile || raw.mobile || raw.phone || raw.USER_MOBILE,
        email: raw.user_email || raw.email || raw.USER_EMAIL,
        message: raw.description || raw.message || raw.requirement || raw.DESCRIPTION,
        city: raw.city || raw.CITY, budget: raw.budget || raw.BUDGET,
        requirement: raw.property_type || raw.property_for || raw.listing_type,
        metadata: {
          portal: '99acres', rawPropertyType: raw.property_type || raw.PROPERTY_TYPE,
          rawPropertyFor: raw.property_for || raw.PROPERTY_FOR, rawLocation: raw.location || raw.LOCATION,
          rawListingId: raw.listing_id || raw.property_id || raw.LISTING_ID,
          rawBedrooms: raw.bedrooms || raw.BEDROOMS, rawPostedBy: raw.posted_by || raw.POSTED_BY, rawPayload: raw,
        },
      };
      const { contact, lead } = await this.dedupAndCreate(payload, 'NINETY_NINE_ACRES');
      const result = { contact, lead };
      await this.recordPortalEvent('99acres', key, raw, result, 'processed');
      this.logger.log(`99acres lead ${lead.id} from ${payload.name} (${payload.phone})`);
      return { status: 'created', leadId: lead.id, contactId: contact.id };
    } catch (e: any) {
      this.logger.error(`99acres handler error: ${e.message}`, e.stack);
      await this.recordPortalEvent('99acres', key, raw, { error: e.message }, 'failed');
      throw e;
    }
  }

  async handleJustDial(raw: any) {
    const key = this.idempotencyKey(['justdial', raw.enquiry_id || raw.id || this.payloadHash(raw)]);
    const existing = await this.prisma.webhookEvent.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { status: 'duplicate', leadId: (existing.processedResult as any)?.lead?.id };
    try {
      const payload: PortalLeadPayload = {
        name: raw.customer_name || raw.name || raw.CUSTOMER_NAME,
        phone: raw.customer_mobile || raw.mobile || raw.phone || raw.CUSTOMER_MOBILE,
        email: raw.customer_email || raw.email || raw.CUSTOMER_EMAIL,
        message: raw.requirement || raw.message || raw.description || raw.REQUIREMENT,
        city: raw.city || raw.CITY,
        requirement: raw.service_category || raw.category || raw.SERVICE_CATEGORY,
        metadata: {
          portal: 'JustDial', rawServiceCategory: raw.service_category || raw.SERVICE_CATEGORY,
          rawBusinessName: raw.business_name || raw.BUSINESS_NAME, rawLocation: raw.location || raw.LOCATION,
          rawEnquiryId: raw.enquiry_id || raw.ENQUIRY_ID, rawPayload: raw,
        },
      };
      const { contact, lead } = await this.dedupAndCreate(payload, 'JUSTDIAL');
      const result = { contact, lead };
      await this.recordPortalEvent('justdial', key, raw, result, 'processed');
      this.logger.log(`JustDial lead ${lead.id} from ${payload.name} (${payload.phone})`);
      return { status: 'created', leadId: lead.id, contactId: contact.id };
    } catch (e: any) {
      this.logger.error(`JustDial handler error: ${e.message}`, e.stack);
      await this.recordPortalEvent('justdial', key, raw, { error: e.message }, 'failed');
      throw e;
    }
  }

  async handleMagicBricks(raw: any) {
    const key = this.idempotencyKey(['magicbricks', raw.lead_id || raw.id || this.payloadHash(raw)]);
    const existing = await this.prisma.webhookEvent.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { status: 'duplicate', leadId: (existing.processedResult as any)?.lead?.id };
    try {
      const payload: PortalLeadPayload = {
        name: raw.name || raw.user_name || raw.NAME,
        phone: raw.mobile || raw.phone || raw.user_mobile || raw.MOBILE,
        email: raw.email || raw.user_email || raw.EMAIL,
        message: raw.requirement || raw.message || raw.requirement_text || raw.REQUIREMENT,
        city: raw.city || raw.CITY, budget: raw.budget || raw.min_budget || raw.max_budget || raw.BUDGET,
        requirement: raw.property_type || raw.listing_type || raw.PROPERTY_TYPE,
        metadata: {
          portal: 'MagicBricks', rawPropertyType: raw.property_type || raw.PROPERTY_TYPE,
          rawListingId: raw.listing_id || raw.property_id || raw.LISTING_ID,
          rawLocation: raw.location || raw.locality || raw.LOCATION, rawPostedBy: raw.posted_by || raw.POSTED_BY,
          rawBedrooms: raw.bedrooms || raw.BEDROOMS, rawPayload: raw,
        },
      };
      const { contact, lead } = await this.dedupAndCreate(payload, 'MAGICBRICKS');
      const result = { contact, lead };
      await this.recordPortalEvent('magicbricks', key, raw, result, 'processed');
      this.logger.log(`MagicBricks lead ${lead.id} from ${payload.name} (${payload.phone})`);
      return { status: 'created', leadId: lead.id, contactId: contact.id };
    } catch (e: any) {
      this.logger.error(`MagicBricks handler error: ${e.message}`, e.stack);
      await this.recordPortalEvent('magicbricks', key, raw, { error: e.message }, 'failed');
      throw e;
    }
  }

  async handleHousing(raw: any) {
    const key = this.idempotencyKey(['housing', raw.enquiry_id || raw.id || raw.lead_id || this.payloadHash(raw)]);
    const existing = await this.prisma.webhookEvent.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { status: 'duplicate', leadId: (existing.processedResult as any)?.lead?.id };
    try {
      const payload: PortalLeadPayload = {
        name: raw.name || raw.user_name || raw.NAME,
        phone: raw.mobile || raw.phone || raw.user_mobile || raw.MOBILE,
        email: raw.email || raw.user_email || raw.EMAIL,
        message: raw.requirement || raw.message || raw.description || raw.REQUIREMENT,
        city: raw.city || raw.CITY, budget: raw.budget || raw.min_budget || raw.max_budget || raw.BUDGET,
        requirement: raw.property_type || raw.listing_type || raw.PROPERTY_TYPE,
        metadata: {
          portal: 'Housing.com', rawPropertyType: raw.property_type || raw.PROPERTY_TYPE,
          rawListingId: raw.listing_id || raw.property_id || raw.LISTING_ID,
          rawLocation: raw.location || raw.locality || raw.LOCATION, rawPostedBy: raw.posted_by || raw.POSTED_BY, rawPayload: raw,
        },
      };
      const { contact, lead } = await this.dedupAndCreate(payload, 'HOUSING_COM');
      const result = { contact, lead };
      await this.recordPortalEvent('housing', key, raw, result, 'processed');
      this.logger.log(`Housing.com lead ${lead.id} from ${payload.name} (${payload.phone})`);
      return { status: 'created', leadId: lead.id, contactId: contact.id };
    } catch (e: any) {
      this.logger.error(`Housing handler error: ${e.message}`, e.stack);
      await this.recordPortalEvent('housing', key, raw, { error: e.message }, 'failed');
      throw e;
    }
  }

  async handleTradeIndia(raw: any) {
    const key = this.idempotencyKey(['tradeindia', raw.enquiry_id || raw.id || this.payloadHash(raw)]);
    const existing = await this.prisma.webhookEvent.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { status: 'duplicate', leadId: (existing.processedResult as any)?.lead?.id };
    try {
      const payload: PortalLeadPayload = {
        name: raw.buyer_name || raw.name || raw.contact_person || raw.BUYER_NAME,
        phone: raw.mobile || raw.phone || raw.buyer_mobile || raw.MOBILE || raw.BUYER_MOBILE,
        email: raw.email || raw.buyer_email || raw.EMAIL || raw.BUYER_EMAIL,
        message: raw.requirement || raw.message || raw.enquiry_description || raw.REQUIREMENT,
        city: raw.city || raw.buyer_city || raw.CITY, budget: raw.budget || raw.BUDGET,
        requirement: raw.product_name || raw.category || raw.product || raw.PRODUCT_NAME,
        metadata: {
          portal: 'TradeIndia', rawProduct: raw.product_name || raw.product || raw.PRODUCT_NAME,
          rawCategory: raw.category || raw.CATEGORY, rawCompanyName: raw.buyer_company || raw.company || raw.COMPANY_NAME, rawPayload: raw,
        },
      };
      const { contact, lead } = await this.dedupAndCreate(payload, 'TRADEINDIA');
      const result = { contact, lead };
      await this.recordPortalEvent('tradeindia', key, raw, result, 'processed');
      this.logger.log(`TradeIndia lead ${lead.id} from ${payload.name} (${payload.phone})`);
      return { status: 'created', leadId: lead.id, contactId: contact.id };
    } catch (e: any) {
      this.logger.error(`TradeIndia handler error: ${e.message}`, e.stack);
      await this.recordPortalEvent('tradeindia', key, raw, { error: e.message }, 'failed');
      throw e;
    }
  }
}
