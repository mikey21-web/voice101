import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ContactsService } from '../contacts/contacts.service';
import { LeadsService } from '../leads/leads.service';
import { CreatePipelineStageDto, UpdatePipelineStageDto, UpdateNotificationPrefsDto } from './dto/advanced-features.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AdvancedFeaturesService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
    @Inject(forwardRef(() => ContactsService)) private contacts: ContactsService,
    @Inject(forwardRef(() => LeadsService)) private leadsService: LeadsService,
  ) {}

  // === PIPELINE STAGES ===
  async getStages() {
    const stages = await this.prisma.pipelineStage.findMany({ where: { active: true }, orderBy: { order: 'asc' } });
    const counts = await this.prisma.lead.groupBy({ by: ['status'], _count: true, where: { deletedAt: null } });
    const countMap = new Map(counts.map(c => [c.status, c._count]));
    return stages.map(s => ({ ...s, count: countMap.get(s.status) || 0 }));
  }
  createStage(data: CreatePipelineStageDto) { return this.prisma.pipelineStage.create({ data: data as any }); }
  async updateStage(id: string, data: UpdatePipelineStageDto) {
    const s = await this.prisma.pipelineStage.findUnique({ where: { id } }); if (!s) throw new NotFoundException(); return this.prisma.pipelineStage.update({ where: { id }, data });
  }
  async deleteStage(id: string) { await this.prisma.pipelineStage.delete({ where: { id } }); return { deleted: true }; }

  // Pipeline drag/drop reorder
  async reorderStages(stageIds: string[]) {
    const updates = stageIds.map((id, index) =>
      this.prisma.pipelineStage.update({ where: { id }, data: { order: index } })
    );
    await this.prisma.$transaction(updates);
    await this.auditLogs.log('pipeline_reordered', 'PipelineStage', undefined, undefined, { stageCount: stageIds.length });
    return this.getStages();
  }

  // === SAVED FILTERS ===
  getFilters(userId: string) { return this.prisma.savedFilter.findMany({ where: { OR: [{ userId }, { isShared: true }] } }); }
  createFilter(data: Record<string, unknown>) { return this.prisma.savedFilter.create({ data: data as any }); }
  async deleteFilter(id: string) { await this.prisma.savedFilter.delete({ where: { id } }); return { deleted: true }; }

  // === LEAD OWNERSHIP HISTORY ===
  async getOwnershipHistory(leadId: string) { return this.prisma.leadOwnershipHistory.findMany({ where: { leadId }, orderBy: { createdAt: 'desc' } }); }
  async recordOwnershipChange(leadId: string, fromUserId?: string, toUserId?: string, changedBy?: string, reason?: string) {
    return this.prisma.leadOwnershipHistory.create({ data: { leadId, fromUserId, toUserId, changedBy, reason } });
  }

  // === DUPLICATE DETECTION & MERGE ===
  async detectDuplicates(entity: 'contact', fields: { email?: string; phone?: string; name?: string }) {
    const matches: any[] = [];
    if (fields.email) {
      const byEmail = await this.prisma.contact.findMany({ where: { email: fields.email }, take: 5 });
      matches.push(...byEmail);
    }
    if (fields.phone) {
      const byPhone = await this.prisma.contact.findMany({ where: { phone: fields.phone }, take: 5 });
      for (const m of byPhone) {
        if (!matches.find(x => x.id === m.id)) matches.push(m);
      }
    }
    if (fields.name && matches.length === 0) {
      const byName = await this.prisma.contact.findMany({
        where: { name: { contains: fields.name, mode: 'insensitive' } },
        take: 10,
      });
      matches.push(...byName);
    }
    return { matches, count: matches.length };
  }

  async mergeContacts(primaryId: string, secondaryId: string, userId?: string) {
    const primary = await this.prisma.contact.findUnique({ where: { id: primaryId } });
    const secondary = await this.prisma.contact.findUnique({ where: { id: secondaryId } });
    if (!primary || !secondary) throw new NotFoundException('One or both contacts not found');

    const diff: Record<string, { from: unknown; to: unknown }> = {};
    const fields = ['name', 'email', 'phone', 'whatsapp', 'company', 'location'] as const;
    for (const f of fields) {
      if (secondary[f] && secondary[f] !== primary[f]) {
        diff[f] = { from: secondary[f], to: primary[f] };
      }
    }

    await this.prisma.lead.updateMany({ where: { contactId: secondaryId }, data: { contactId: primaryId } });
    await this.prisma.conversationMessage.updateMany({ where: { contactId: secondaryId }, data: { contactId: primaryId } });
    await this.prisma.mediaFile.updateMany({ where: { contactId: secondaryId }, data: { contactId: primaryId } });
    await this.prisma.customFieldValue.updateMany({ where: { contactId: secondaryId }, data: { contactId: primaryId } });
    await this.prisma.contact.delete({ where: { id: secondaryId } });

    await this.auditLogs.log('contacts_merged', 'Contact', primaryId, userId, {
      mergedId: secondaryId,
      fieldsChanged: diff,
      timestamp: new Date().toISOString(),
    });
    return { primary: await this.prisma.contact.findUnique({ where: { id: primaryId } }), merged: secondaryId, diff };
  }

  // === INTERNAL NOTES ===
  async getNotes(leadId: string) { return this.prisma.internalNote.findMany({ where: { leadId }, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true, email: true } } } }); }
  async createNote(leadId: string, userId: string, content: string) {
    const note = await this.prisma.internalNote.create({ data: { leadId, userId, content } });
    await this.auditLogs.log('note_created', 'InternalNote', note.id, userId, { leadId });
    return note;
  }

  // Shared phone normalization — single source of truth
  private normalizePhone(phone: string): string {
    return phone.replace(/[\s\-\(\)\+]/g, '');
  }

  // === BLOCKLIST ===
  async checkBlocklist(email?: string, phone?: string): Promise<boolean> {
    if (email) {
      const blocked = await this.prisma.blocklistEntry.findFirst({ where: { type: 'email', value: email.toLowerCase().trim() } });
      if (blocked) return true;
    }
    if (phone) {
      const clean = this.normalizePhone(phone);
      const blocked = await this.prisma.blocklistEntry.findFirst({ where: { type: 'phone', value: clean } });
      if (blocked) return true;
    }
    return false;
  }
  getBlocklist() { return this.prisma.blocklistEntry.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }); }
  async addToBlocklist(type: string, value: string, reason?: string) {
    const normalized = type === 'phone' ? this.normalizePhone(value) : value.toLowerCase().trim();
    const entry = await this.prisma.blocklistEntry.create({ data: { type, value: normalized, reason } });
    await this.auditLogs.log('blocklist_added', 'BlocklistEntry', entry.id, undefined, { type, value: normalized, reason });
    return entry;
  }
  async removeFromBlocklist(id: string) { await this.prisma.blocklistEntry.delete({ where: { id } }); return { deleted: true }; }

  // === NOTIFICATION PREFERENCES ===
  async getNotificationPrefs(userId: string) {
    let prefs = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    if (!prefs) prefs = await this.prisma.notificationPreference.create({ data: { userId } });
    return prefs;
  }
  async updateNotificationPrefs(userId: string, data: UpdateNotificationPrefsDto) {
    await this.prisma.notificationPreference.upsert({ where: { userId }, create: { ...data, userId }, update: data });
    return this.getNotificationPrefs(userId);
  }

  // === SLA RULES ===
  getSlaRules() { return this.prisma.slaRule.findMany(); }
  createSlaRule(data: any) { return this.prisma.slaRule.create({ data }); }
  async updateSlaRule(id: string, data: any) {
    const r = await this.prisma.slaRule.findUnique({ where: { id } }); if (!r) throw new NotFoundException(); return this.prisma.slaRule.update({ where: { id }, data });
  }
  async deleteSlaRule(id: string) { await this.prisma.slaRule.delete({ where: { id } }); return { deleted: true }; }

  // Evaluate SLA rules for all active leads
  async evaluateSlaRules() {
    const rules = await this.prisma.slaRule.findMany({ where: { active: true } });
    const results: any[] = [];

    for (const rule of rules) {
      let condition: Record<string, unknown> = {};
      try { condition = typeof rule.condition === 'string' ? JSON.parse(rule.condition) : (rule.condition as Record<string, unknown>); } catch {}

      const responseCutoff = new Date(Date.now() - rule.responseTimeMinutes * 60000);
      const where: any = {
        status: { notIn: ['CONVERTED', 'LOST', 'SPAM'] },
      };

      if (condition.status) where.status = condition.status;
      if (condition.segment) where.segment = condition.segment;
      if (condition.source) where.source = condition.source;

      const leads = await this.prisma.lead.findMany({
        where,
        take: 100,
        select: {
          id: true,
          createdAt: true,
          contact: { select: { name: true, email: true } },
          conversations: { orderBy: { createdAt: 'desc' }, take: 1, where: { direction: 'OUTBOUND' }, select: { createdAt: true } },
        },
      });

      for (const lead of leads) {
        const lastOutbound = lead.conversations[0]?.createdAt;
        if (lastOutbound && new Date(lastOutbound) > responseCutoff) continue;

        const referenceTime = lastOutbound || lead.createdAt || new Date();
        const hoursResponse = Math.round((Date.now() - new Date(referenceTime).getTime()) / 3600000);
        results.push({
          slaRuleId: rule.id,
          slaRuleName: rule.name,
          leadId: lead.id,
          leadName: lead.contact?.name,
          hoursWithoutResponse: hoursResponse,
          breached: true,
          escalationNeeded: rule.escalationAfterMinutes ? hoursResponse * 60 >= rule.escalationAfterMinutes : false,
          escalationUserId: rule.escalationUserId,
        });
      }
    }

    if (results.length > 0) {
      await this.auditLogs.log('sla_evaluated', 'SlaRule', undefined, undefined, { breachedCount: results.length, rulesChecked: rules.length });
    }

    return { evaluatedAt: new Date().toISOString(), breaches: results };
  }

  // === REVENUE TRACKING ===
  getRevenue(query: Record<string, string> = {}) {
    const { leadId, startDate, endDate, page = '1', limit = '20' } = query;
    const where: any = {};
    if (leadId) where.leadId = leadId;
    if (startDate) where.createdAt = { ...(where.createdAt || {}), gte: new Date(startDate) };
    if (endDate) where.createdAt = { ...(where.createdAt || {}), lte: new Date(endDate) };

    return Promise.all([
      this.prisma.revenueRecord.findMany({ where, skip: (+page - 1) * +limit, take: +limit, orderBy: { createdAt: 'desc' }, include: { lead: { select: { contact: { select: { name: true } } } } } }),
      this.prisma.revenueRecord.count({ where }),
      this.prisma.revenueRecord.aggregate({ where, _sum: { amount: true } }),
    ]).then(([data, total, agg]) => ({ data, meta: { total, totalRevenue: agg._sum.amount || 0 } }));
  }
  createRevenue(data: Record<string, unknown>) { return this.prisma.revenueRecord.create({ data: data as any }); }

  // === IMPORT/EXPORT ===
  async startImport(userId: string, totalRows: number) {
    return this.prisma.importExportLog.create({ data: { type: 'import', userId, totalRows, status: 'processing' } });
  }

  async processImport(logId: string, rows: Record<string, string>[], entity: 'contact' | 'lead' | 'property' | 'project' | 'channelPartner') {
    const log = await this.prisma.importExportLog.findUnique({ where: { id: logId } });
    if (!log) throw new NotFoundException('Import log not found');

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        if (entity === 'contact') {
          const existing = await this.prisma.contact.findFirst({ where: { email: row.email } });
          if (existing) {
            await this.prisma.contact.update({
              where: { id: existing.id },
              data: {
                name: row.name || existing.name,
                phone: row.phone || existing.phone,
                whatsapp: row.whatsapp || existing.whatsapp,
                company: row.company || existing.company,
              },
            });
          } else {
            await this.prisma.contact.create({
              data: {
                name: row.name || '',
                email: row.email,
                phone: row.phone || null,
                whatsapp: row.whatsapp || null,
                company: row.company || null,
                tenantId: 'default-tenant',
              },
            });
          }
        } else if (entity === 'lead') {
          // A row from an external CRM export (Zoho, Salesforce, ...) has the
          // buyer's name/email/phone on it, not our internal contactId — so
          // find-or-create the contact first (same helper manual lead entry
          // uses) instead of demanding an ID the client could never supply.
          let contactId = row.contactId;
          if (!contactId) {
            const name = row.contactName || row.name;
            const email = row.contactEmail || row.email;
            const phone = row.contactPhone || row.phone;
            if (!name && !email && !phone) {
              throw new Error('Row has no contactId and no contact name/email/phone to match or create a contact');
            }
            const contact = await this.contacts.findOrCreate({ name, email, phone });
            contactId = contact.id;
          }

          await this.leadsService.create({
            source: (row.source as any) || 'MANUAL',
            message: row.message || undefined,
            interest: row.interest || undefined,
            budget: row.budget || undefined,
            urgency: row.urgency || undefined,
            contactId,
            metadata: { _bulkImport: true },
          });
        } else if (entity === 'property') {
          if (!row.title) throw new Error('Row has no title');
          const propertyTypes = ['APARTMENT', 'VILLA', 'PLOT', 'COMMERCIAL', 'PENTHOUSE', 'DUPLEX', 'STUDIO'];
          const propertyStatuses = ['AVAILABLE', 'SOLD', 'UNDER_OFFER', 'ON_HOLD', 'RENTED', 'DRAFT'];
          const propertyType = propertyTypes.includes((row.propertyType || '').toUpperCase()) ? row.propertyType.toUpperCase() : 'APARTMENT';
          const status = propertyStatuses.includes((row.status || '').toUpperCase()) ? row.status.toUpperCase() : 'AVAILABLE';
          await this.prisma.property.create({
            data: {
              title: row.title,
              description: row.description || null,
              propertyType: propertyType as any,
              status: status as any,
              price: row.price ? Number(row.price) : null,
              bedrooms: row.bedrooms ? parseInt(row.bedrooms, 10) : null,
              bathrooms: row.bathrooms ? parseInt(row.bathrooms, 10) : null,
              areaSqft: row.areaSqft ? Number(row.areaSqft) : null,
              location: row.location || null,
              address: row.address || null,
              tenantId: 'default-tenant',
            },
          });
        } else if (entity === 'project') {
          if (!row.name) throw new Error('Row has no name');
          const projectStatuses = ['PLANNING', 'UNDER_CONSTRUCTION', 'READY_TO_MOVE', 'COMPLETED'];
          const status = projectStatuses.includes((row.status || '').toUpperCase()) ? row.status.toUpperCase() : 'UNDER_CONSTRUCTION';
          await this.prisma.project.create({
            data: {
              name: row.name,
              description: row.description || null,
              location: row.location || null,
              address: row.address || null,
              reraId: row.reraId || null,
              status: status as any,
              possessionDate: row.possessionDate ? new Date(row.possessionDate) : null,
              tenantId: 'default-tenant',
            },
          });
        } else if (entity === 'channelPartner') {
          if (!row.name) throw new Error('Row has no name');
          const existing = row.email ? await this.prisma.channelPartner.findFirst({ where: { email: row.email } }) : null;
          if (existing) {
            await this.prisma.channelPartner.update({
              where: { id: existing.id },
              data: {
                name: row.name || existing.name,
                phone: row.phone || existing.phone,
                company: row.company || existing.company,
              },
            });
          } else {
            await this.prisma.channelPartner.create({
              data: {
                name: row.name,
                email: row.email || null,
                phone: row.phone || null,
                company: row.company || null,
                commissionRate: row.commissionRate ? Number(row.commissionRate) : null,
                tenantId: 'default-tenant',
              },
            });
          }
        }
        processed++;
      } catch (e: any) {
        failed++;
        errors.push(`Row ${processed + failed}: ${e.message}`);
      }
    }

    await this.prisma.importExportLog.update({
      where: { id: logId },
      data: {
        processedRows: processed,
        failedRows: failed,
        errors: errors.length > 0 ? errors.slice(0, 100).map(e => ({ message: e })) : undefined,
        status: failed > 0 ? 'completed_with_errors' : 'completed',
        completedAt: new Date(),
      },
    });

    await this.auditLogs.log('import_completed', 'ImportExportLog', logId, log.userId, { processed, failed, entity });
    return { processed, failed, errors: errors.slice(0, 10) };
  }

  async startExport(userId: string) {
    return this.prisma.importExportLog.create({ data: { type: 'export', userId, status: 'processing' } });
  }

  async completeExport(logId: string, entity: 'contact' | 'lead', filters: Record<string, string> = {}) {
    const log = await this.prisma.importExportLog.findUnique({ where: { id: logId } });
    if (!log) throw new NotFoundException('Export log not found');

    let data: any[] = [];
    if (entity === 'contact') {
      data = await this.prisma.contact.findMany({ take: 10000, orderBy: { createdAt: 'desc' } });
    } else {
      data = await this.prisma.lead.findMany({ take: 10000, orderBy: { createdAt: 'desc' }, include: { contact: { select: { name: true, email: true, phone: true } } } });
    }

    const headers = entity === 'contact'
      ? ['name', 'email', 'phone', 'whatsapp', 'company', 'createdAt']
      : ['source', 'status', 'segment', 'score', 'message', 'contactName', 'contactEmail', 'contactPhone', 'createdAt'];

    const csvRows = [headers.join(',')];
    for (const row of data) {
      const values = entity === 'contact'
        ? [row.name, row.email, row.phone, row.whatsapp, row.company, row.createdAt]
        : [row.source, row.status, row.segment, row.score, row.message, row.contact?.name, row.contact?.email, row.contact?.phone, row.createdAt];
      csvRows.push(values.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
    }

    const csvContent = csvRows.join('\n');
    const storagePath = process.env.STORAGE_PATH || './uploads';
    if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });
    const fileName = `${entity}_export_${Date.now()}.csv`;
    const filePath = path.join(storagePath, fileName);
    fs.writeFileSync(filePath, csvContent, 'utf8');

    const fileUrl = `/exports/${fileName}`;
    await this.prisma.importExportLog.update({
      where: { id: logId },
      data: {
        totalRows: data.length,
        processedRows: data.length,
        fileUrl,
        status: 'completed',
        completedAt: new Date(),
      },
    });

    await this.auditLogs.log('export_completed', 'ImportExportLog', logId, log.userId, { entity, rowsExported: data.length });
    return { fileUrl, rowsExported: data.length };
  }

  async getImportLogs(userId: string) { return this.prisma.importExportLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }); }

  // === DATA RETENTION ===
  async purgeSpamAndCold(retentionDays: number = 365) {
    if (retentionDays < 30) throw new BadRequestException('Minimum retention is 30 days');
    const cutoff = new Date(Date.now() - retentionDays * 24 * 3600 * 1000);
    const deleted = await this.prisma.lead.deleteMany({
      where: { OR: [{ status: 'SPAM' }, { segment: 'COLD', updatedAt: { lt: cutoff } }] },
    });
    await this.auditLogs.log('data_purged', 'Lead', undefined, undefined, { deletedCount: deleted.count, retentionDays });
    return { deletedCount: deleted.count, retentionDays };
  }

  // === FAILURE INBOX ===
  async getFailureInbox() {
    return this.prisma.automationEvent.findMany({ where: { status: { in: ['failed', 'retrying'] } }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async recordFailure(data: { eventType: string; error: string; payload?: Record<string, unknown>; workflow?: string }) {
    return this.prisma.automationEvent.create({
      data: {
        type: data.eventType as any,
        payload: data.payload ? JSON.parse(JSON.stringify(data.payload)) : {},
        status: 'failed',
        attempts: 0,
        maxAttempts: 5,
        lastError: data.error,
      },
    });
  }

  async retryFailedEvent(eventId: string) {
    const event = await this.prisma.automationEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Failed event not found');
    if (event.status === 'completed') throw new BadRequestException('Event already completed');

    await this.prisma.automationEvent.update({
      where: { id: eventId },
      data: { status: 'retrying', attempts: event.attempts + 1, lastError: null },
    });

    await this.auditLogs.log('failure_retry_manual', 'AutomationEvent', eventId, undefined, { originalType: event.type });
    return { eventId, status: 'retrying', attempt: event.attempts + 1 };
  }

  // === SMART LISTS ===
  async getSmartLists(tenantId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const count1 = await this.prisma.lead.count({ where: { tenantId, status: 'NEW', deletedAt: null, conversations: { none: { direction: 'OUTBOUND' } } } });

    const twoHoursAgo = new Date(now.getTime() - 2 * 3600000);
    const count2 = await this.prisma.lead.count({ where: { tenantId, segment: 'HOT', deletedAt: null, updatedAt: { lt: twoHoursAgo } } });

    const portalSources: any[] = ['MAGICBRICKS', 'HOUSING_COM', 'NINETY_NINE_ACRES'];
    const count3 = await this.prisma.lead.count({ where: { tenantId, status: 'NEW', source: { in: portalSources }, deletedAt: null, conversations: { none: { direction: 'OUTBOUND' } } } });

    const count4 = await this.prisma.siteVisit.count({ where: { tenantId, startAt: { gte: todayStart, lt: todayEnd }, status: { in: ['SCHEDULED', 'CONFIRMED'] } } });

    const count5 = await this.prisma.siteVisit.count({ where: { tenantId, status: 'NO_SHOW', startAt: { lt: todayEnd } } });

    const count6 = await this.prisma.lead.count({
      where: {
        tenantId, deletedAt: null,
        costSheets: { some: { status: 'SENT' } },
        conversations: { none: { direction: 'OUTBOUND', createdAt: { gte: new Date(now.getTime() - 86400000 * 3) } } },
      },
    });

    const next24h = new Date(now.getTime() + 86400000);
    const count7 = await this.prisma.unitHold.count({ where: { tenantId, status: 'ACTIVE', expiresAt: { lt: next24h, gt: now } } });

    const count9 = await this.prisma.paymentSchedule.count({ where: { tenantId, status: 'OVERDUE' } });

    const brokerDuplicateLeads = await this.prisma.lead.findMany({
      where: { tenantId, deletedAt: null, channelPartnerId: { not: null } },
      select: { contactId: true, id: true },
    });
    const contactLeadCounts = new Map<string, number>();
    for (const l of brokerDuplicateLeads) {
      contactLeadCounts.set(l.contactId, (contactLeadCounts.get(l.contactId) || 0) + 1);
    }
    const duplicateContactIds = new Set(
      [...contactLeadCounts.entries()].filter(([_, c]) => c > 1).map(([id]) => id)
    );
    const count10Actual = await this.prisma.lead.count({
      where: { tenantId, deletedAt: null, channelPartnerId: { not: null }, contactId: { in: [...duplicateContactIds] } },
    });

    return [
      { id: 1, name: 'New Leads Not Contacted', description: 'Leads in NEW status with no outbound messages sent', icon: 'UserPlus', count: count1, filters: { status: 'NEW', hasNoOutbound: 'true' } },
      { id: 2, name: 'Hot Leads Untouched', description: 'Hot segment leads untouched for over 2 hours', icon: 'Flame', count: count2, filters: { segment: 'HOT', untouched: '2h' } },
      { id: 3, name: 'Portal Leads Leaking', description: 'Portal leads (MagicBricks, Housing, 99Acres) in NEW status, not contacted', icon: 'Globe', count: count3, filters: { source: 'MAGICBRICKS,HOUSING_COM,NINETY_NINE_ACRES', status: 'NEW', hasNoOutbound: 'true' } },
      { id: 4, name: 'Site Visit Today', description: 'Leads with scheduled site visits today', icon: 'CalendarClock', count: count4, filters: { smartList: 'site-visit-today' } },
      { id: 5, name: 'Site Visit No-Show', description: 'Leads who did not show up for site visits', icon: 'XCircle', count: count5, filters: { smartList: 'site-visit-noshow' } },
      { id: 6, name: 'Cost Sheet Sent, No Reply', description: 'Leads who received a cost sheet but no reply in 3 days', icon: 'FileText', count: count6, filters: { smartList: 'cost-sheet-no-reply' } },
      { id: 7, name: 'Unit Hold Expiring', description: 'Active unit holds expiring within the next 24 hours', icon: 'Timer', count: count7, filters: { smartList: 'hold-expiring' } },
      { id: 8, name: 'Token Promised Not Paid', description: 'Token amount promised but payment not received', icon: 'DollarSign', count: 0, filters: { smartList: 'token-promised' } },
      { id: 9, name: 'Payment Overdue', description: 'Leads with overdue payment schedules', icon: 'AlertTriangle', count: count9, filters: { smartList: 'payment-overdue' } },
      { id: 10, name: 'Broker Duplicate Risk', description: 'Channel partner leads where contact has multiple leads', icon: 'Copy', count: count10Actual, filters: { smartList: 'broker-duplicate' } },
    ];
  }

  // === SANDBOX TEST ===
  async sandboxTest() {
    const checks: any = {};
    try { checks.database = (await this.prisma.$queryRaw`SELECT 1`) ? 'ok' : 'fail'; } catch { checks.database = 'fail'; }
    checks.timestamp = new Date().toISOString();
    return { mode: 'sandbox', checks };
  }
}
