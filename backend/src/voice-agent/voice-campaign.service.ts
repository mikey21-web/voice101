import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DograhService } from '../shared/dograh.service';

export interface CampaignContact { phone: string; name?: string; [key: string]: any }

/** Bulk-calling campaigns, one employee per campaign — the "Bulk Caller" mode from Outpero's
 * captured data model. Each campaign compiles a CSV and hands it to Dograh's own campaign
 * engine (retry/schedule/concurrency all live there already); this service is the thin
 * multi-employee-aware layer + our own progress/run bookkeeping on top. */
@Injectable()
export class VoiceCampaignService {
  constructor(private prisma: PrismaService, private dograh: DograhService) {}

  async list(tenantId: string, employeeId?: string) {
    return this.prisma.voiceCampaign.findMany({
      where: { tenantId, employeeId },
      orderBy: { createdAt: 'desc' },
      include: { employee: { select: { name: true } } },
    });
  }

  async get(tenantId: string, id: string) {
    const campaign = await this.prisma.voiceCampaign.findFirst({ where: { id, tenantId }, include: { employee: true } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async create(
    tenantId: string,
    employeeId: string,
    name: string,
    contacts: CampaignContact[],
    options?: {
      maxConcurrency?: number;
      retryConfig?: { enabled: boolean; maxRetries: number; retryDelaySeconds: number; retryOnBusy: boolean; retryOnNoAnswer: boolean; retryOnVoicemail: boolean };
      scheduleConfig?: { enabled: boolean; timezone: string; slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }> };
    },
  ) {
    const employee = await this.prisma.voiceEmployee.findFirst({ where: { id: employeeId, tenantId } });
    if (!employee) throw new NotFoundException('Employee not found');
    if (!employee.dograhWorkflowId) throw new BadRequestException('Publish the employee before creating a bulk campaign for it');
    const valid = contacts.filter((c) => c.phone?.trim());
    if (!valid.length) throw new BadRequestException('No contacts with a phone number found');

    const rows = [['phone_number', 'first_name'], ...valid.map((c) => [c.phone, (c.name || 'there').replace(/,/g, ' ')])];
    const csv = rows.map((r) => r.join(',')).join('\n');

    const { campaignId: dograhCampaignId } = await this.dograh.createCampaignFromCsv(name, employee.language, csv, {
      ...options,
      workflowIdOverride: employee.dograhWorkflowId,
    });
    await this.dograh.startCampaign(dograhCampaignId);

    return this.prisma.voiceCampaign.create({
      data: {
        tenantId, employeeId, name, status: 'running',
        totalContacts: valid.length,
        maxConcurrency: options?.maxConcurrency,
        retryConfig: options?.retryConfig as any,
        scheduleConfig: options?.scheduleConfig as any,
        dograhCampaignId,
      },
    });
  }

  async pause(tenantId: string, id: string) {
    const campaign = await this.get(tenantId, id);
    if (campaign.dograhCampaignId) await this.dograh.pauseCampaign(campaign.dograhCampaignId);
    return this.prisma.voiceCampaign.update({ where: { id }, data: { status: 'paused' } });
  }

  async resume(tenantId: string, id: string) {
    const campaign = await this.get(tenantId, id);
    if (campaign.dograhCampaignId) await this.dograh.resumeCampaign(campaign.dograhCampaignId);
    return this.prisma.voiceCampaign.update({ where: { id }, data: { status: 'running' } });
  }

  /** Live progress + local counters synced from Dograh's own campaign progress. */
  async progress(tenantId: string, id: string) {
    const campaign = await this.get(tenantId, id);
    if (!campaign.dograhCampaignId) return { dialed: campaign.dialed, reached: campaign.reached, totalContacts: campaign.totalContacts, status: campaign.status };
    const live = await this.dograh.getCampaignProgress(campaign.dograhCampaignId);
    await this.prisma.voiceCampaign.update({
      where: { id },
      data: { dialed: live.dialed ?? campaign.dialed, reached: live.reached ?? campaign.reached },
    }).catch(() => {});
    return live;
  }

  async runs(tenantId: string, id: string, page = 1, limit = 50) {
    const campaign = await this.get(tenantId, id);
    if (!campaign.dograhCampaignId) return { runs: [], totalCount: 0 };
    return this.dograh.getCampaignRuns(campaign.dograhCampaignId, page, limit);
  }
}
