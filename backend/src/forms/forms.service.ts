import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import { LeadsService } from '../leads/leads.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ConversationsService } from '../conversations/conversations.service';
import { AgentClientService } from '../agent/agent-client.service';
import { ResolveLeadService } from '../leads/resolve-lead.service';
import { getTenantId } from '../shared/tenant-helper';

/** Keys that are stripped from the submission payload before storing as form field data. */
const SUBMISSION_META_KEYS = ['_source', '_pageUrl', '_utm', '_startedAt', '_completedAt'];

// Aliases the embed's dynamic fieldKeys are matched against to fill in the
// generic contact/lead fields — form builders don't always name a field
// exactly "name" or "phone".
const NAME_KEYS = ['name', 'full_name', 'fullName', 'your_name'];
const EMAIL_KEYS = ['email', 'email_address'];
const PHONE_KEYS = ['phone', 'phone_number', 'phoneNumber', 'mobile', 'contact_number'];
const WHATSAPP_KEYS = ['whatsapp', 'whatsapp_number'];
const COMPANY_KEYS = ['company', 'company_name', 'organization'];
const MESSAGE_KEYS = ['message', 'additional_message', 'notes', 'comments'];

function firstOf(fields: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = fields[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

@Injectable()
export class FormsService {
  constructor(
    private prisma: PrismaService,
    private contactsService: ContactsService,
    private leadsService: LeadsService,
    private resolveLead: ResolveLeadService,
    private auditLogs: AuditLogsService,
    private conversationsService: ConversationsService,
    private agentClient: AgentClientService,
  ) {}

  findAll() {
    return this.prisma.leadForm.findMany({
      include: { fields: { orderBy: { displayOrder: 'asc' } } },
    });
  }

  async findOne(id: string) {
    const f = await this.prisma.leadForm.findUnique({
      where: { id },
      include: { fields: { orderBy: { displayOrder: 'asc' } } },
    });
    if (!f) throw new NotFoundException('Form not found');
    return f;
  }

  /**
   * Returns a form config suitable for public embed rendering.
   * Same data shape as findOne() but intended for unauthenticated access.
   */
  async findOnePublic(id: string) {
    return this.findOne(id);
  }

  async create(data: any, userId?: string) {
    const f = await this.prisma.leadForm.create({ data });
    await this.auditLogs.log('form_created', 'LeadForm', f.id, userId);
    return f;
  }

  async update(id: string, data: any, userId?: string) {
    await this.findOne(id);
    const f = await this.prisma.leadForm.update({ where: { id }, data });
    await this.auditLogs.log('form_updated', 'LeadForm', id, userId);
    return f;
  }

  async remove(id: string, userId?: string) {
    await this.findOne(id);
    await this.prisma.formSubmission.deleteMany({ where: { formId: id } });
    await this.prisma.leadFormField.deleteMany({ where: { formId: id } });
    await this.prisma.leadForm.delete({ where: { id } });
    await this.auditLogs.log('form_deleted', 'LeadForm', id, userId);
  }

  addField(formId: string, data: any) {
    return this.prisma.leadFormField.create({ data: { ...data, formId } });
  }

  async addFieldsBulk(formId: string, fields: any[], steps?: any[]) {
    await this.findOne(formId);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.leadFormField.deleteMany({ where: { formId } });
      const created: any[] = [];
      for (const f of fields) {
        const field = await tx.leadFormField.create({ data: { ...f, formId } });
        created.push(field);
      }
      if (steps) {
        await tx.leadForm.update({ where: { id: formId }, data: { steps } });
      }
      return created;
    });
    return result;
  }

  async updateField(formId: string, fieldId: string, data: any) {
    return this.prisma.leadFormField.update({ where: { id: fieldId }, data });
  }

  async deleteField(formId: string, fieldId: string) {
    return this.prisma.leadFormField.delete({ where: { id: fieldId } });
  }

  // ── Submission ─────────────────────────────────────────────────────────────

  async submit(formId: string, payload: any, req?: any) {
    const form = await this.findOne(formId);

    // The embed sends dynamic field values nested under `payload.payload`
    // (keyed by each field's fieldKey), not flat on the payload itself.
    // Direct/legacy API callers may still send a flat body, so fall back to
    // the raw payload when there's no nested `payload` object.
    const fieldData: Record<string, unknown> =
      payload.payload && typeof payload.payload === 'object' ? payload.payload : payload;

    const name = firstOf(fieldData, NAME_KEYS) ?? payload.name;
    const email = firstOf(fieldData, EMAIL_KEYS) ?? payload.email;
    const phone = firstOf(fieldData, PHONE_KEYS) ?? payload.phone;
    const whatsapp = firstOf(fieldData, WHATSAPP_KEYS) ?? payload.whatsapp;
    const company = firstOf(fieldData, COMPANY_KEYS) ?? payload.company;


    // Only trust a client-supplied qrCodeId if it's a real QR code, so a made-up id
    // can't misattribute a lead's source.
    const leadSource = payload.qrCodeId
      && (await this.prisma.qrCode.findUnique({ where: { id: payload.qrCodeId } }))
      ? 'QR_CODE' : 'FORM';

    // Summarize the submitted fields into readable text so the AI agent has
    // something to score/extract from — dynamic forms are mostly dropdowns,
    // not free text, so there's rarely a single "message" field to rely on.
    const contactKeys = new Set([...NAME_KEYS, ...EMAIL_KEYS, ...PHONE_KEYS, ...WHATSAPP_KEYS, ...COMPANY_KEYS]);
    const explicitMessage = firstOf(fieldData, MESSAGE_KEYS) ?? payload.message;
    const summary = (form.fields ?? [])
      .filter((f: any) => !contactKeys.has(f.fieldKey) && !MESSAGE_KEYS.includes(f.fieldKey))
      .map((f: any) => {
        const v = fieldData[f.fieldKey];
        return v ? `${f.label}: ${v}` : null;
      })
      .filter(Boolean)
      .join('. ');
    const message = [summary, explicitMessage].filter(Boolean).join('. ') || undefined;

    // Phase 4: one resolve path for every capture source, so the same buyer
    // arriving by form and by portal is one lead and one salesperson.
    const resolved = await this.resolveLead.resolveLead({
      tenantId: getTenantId(req),
      name, email, phone, whatsapp, company,
      source: leadSource,
      message,
      interest: payload.interest,
      metadata: payload,
      req,
    });
    const contact = { id: resolved.contactId };
    const lead = await this.prisma.lead.findUniqueOrThrow({ where: { id: resolved.leadId } });

    // Strip prefixed meta keys — they are submission metadata, not form field values
    const cleanPayload = this.stripMetaKeys(fieldData);

    // Submission tracking metadata
    const completed = Boolean(payload._completedAt);
    const startedAt = payload._startedAt ? new Date(payload._startedAt) : null;
    const completedAt = payload._completedAt ? new Date(payload._completedAt) : null;

    await this.prisma.formSubmission.create({
      data: {
        formId,
        payload: cleanPayload,
        leadId: lead.id,
        source: payload._source || 'direct',
        pageUrl: payload._pageUrl || null,
        utm: payload._utm || {},
        completed,
        startedAt,
        completedAt,
      },
    });

    // Log the submission as an inbound message and hand it to the AI agent for
    // scoring/extraction — otherwise form-sourced leads sit at score 0 forever,
    // unlike chatbot/WhatsApp leads which go through this same pipeline.
    if (message) {
      await this.conversationsService.create({
        text: message,
        channel: 'CHATBOT',
        direction: 'INBOUND',
        leadId: lead.id,
        contactId: contact.id,
        metadata: { formId, source: 'form' },
      });
      this.agentClient.trigger(lead.id, `form:${lead.id}`, 'CHATBOT', message, lead.tenantId);
    }

    await this.auditLogs.log('form_submitted', 'LeadForm', formId);
    return { data: { lead, contact } };
  }

  // ── Submissions listing (authenticated) ─────────────────────────────────────

  async findSubmissions(formId: string, query: {
    page?: number;
    limit?: number;
    source?: string;
    search?: string;
    completed?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}) {
    // Verify form exists
    await this.findOne(formId);

    const { page = 1, limit = 20, source, search, completed, dateFrom, dateTo } = query;

    const where: any = { formId };

    if (source) {
      where.source = source;
    }

    if (completed !== undefined && completed !== '') {
      where.completed = completed === 'true';
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    // If searching, look up by lead contact info (payload is JSON — not easily searchable)
    if (search) {
      where.lead = {
        contact: {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
          ],
        },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.formSubmission.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { lead: { include: { contact: true } } },
      }),
      this.prisma.formSubmission.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  // ── Analytics ───────────────────────────────────────────────────────────────

  async getAnalytics(formId: string) {
    // Verify form exists
    const form = await this.findOne(formId);

    const [totalSubmissions, completedCount, sourceBreakdown] = await Promise.all([
      this.prisma.formSubmission.count({ where: { formId } }),
      this.prisma.formSubmission.count({ where: { formId, completed: true } }),
      this.prisma.formSubmission.groupBy({
        by: ['source'],
        where: { formId },
        _count: { source: true },
      }),
    ]);

    const completionRate = totalSubmissions > 0
      ? Math.round((completedCount / totalSubmissions) * 10000) / 100
      : 0;

    // ── Field drop-off (multi-step awareness) ──
    // Count how many submissions have data for each step's fields, which tells
    // us at which step users tend to abandon the form.
    const fieldDropOff = await this.computeFieldDropOff(formId, form);

    // ── Trends: submissions per day over the last 30 days ──
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSubmissions = await this.prisma.formSubmission.findMany({
      where: { formId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, completed: true },
      orderBy: { createdAt: 'asc' },
    });

    const trendsMap = new Map<string, { count: number; completed: number }>();
    for (const sub of recentSubmissions) {
      const date = sub.createdAt.toISOString().split('T')[0];
      const entry = trendsMap.get(date) || { count: 0, completed: 0 };
      entry.count++;
      if (sub.completed) entry.completed++;
      trendsMap.set(date, entry);
    }

    const trends = Array.from(trendsMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));

    return {
      totalSubmissions,
      completionRate,
      sourceBreakdown: sourceBreakdown.map((s) => ({
        source: s.source,
        count: s._count.source,
      })),
      fieldDropOff,
      trends,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private stripMetaKeys(payload: Record<string, any>): Record<string, any> {
    return Object.fromEntries(
      Object.entries(payload).filter(([key]) => !SUBMISSION_META_KEYS.includes(key)),
    );
  }

  /** Determine how many submissions reached each step (or field, if no steps). */
  private async computeFieldDropOff(
    formId: string,
    form: any,
  ): Promise<Record<string, number>> {
    const dropOff: Record<string, number> = {};

    // Group fields by step
    const fieldsByStep: Record<string, string[]> = {};
    for (const field of form.fields || []) {
      const stepId = field.stepId || '__default__';
      if (!fieldsByStep[stepId]) fieldsByStep[stepId] = [];
      fieldsByStep[stepId].push(field.fieldKey);
    }

    if (Object.keys(fieldsByStep).length === 0) return dropOff;

    // Fetch all payloads for this form
    const submissions = await this.prisma.formSubmission.findMany({
      where: { formId },
      select: { payload: true },
    });

    for (const [stepId, fieldKeys] of Object.entries(fieldsByStep)) {
      let reached = 0;
      for (const sub of submissions) {
        const p = sub.payload as Record<string, any>;
        const hasData = fieldKeys.some(
          (key) => p[key] !== undefined && p[key] !== null && p[key] !== '',
        );
        if (hasData) reached++;
      }
      dropOff[stepId] = reached;
    }

    return dropOff;
  }
}
