import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KhojClientService } from '../khoj-client/khoj-client.service';
import { OutcomeEngineService } from './outcome-engine.service';
import { EventsService } from '../events/events.service';
import { AdvanceStageService } from '../leads/advance-stage.service';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface ActionRule {
  tool: string;
  risk: RiskLevel;
  autoExecute: boolean;
  description: string;
}

const ACTION_RULES: ActionRule[] = [
  { tool: 'search_leads', risk: 'low', autoExecute: true, description: 'Search leads' },
  { tool: 'search_contacts', risk: 'low', autoExecute: true, description: 'Search contacts' },
  { tool: 'get_lead_detail', risk: 'low', autoExecute: true, description: 'Get lead details' },
  { tool: 'list_tickets', risk: 'low', autoExecute: true, description: 'List tickets' },
  { tool: 'list_campaigns', risk: 'low', autoExecute: true, description: 'List campaigns' },
  { tool: 'get_analytics_overview', risk: 'low', autoExecute: true, description: 'Get analytics' },
  { tool: 'run_report', risk: 'low', autoExecute: true, description: 'Run report' },
  { tool: 'navigate_ui', risk: 'low', autoExecute: true, description: 'Navigate UI' },
  { tool: 'explain_flow', risk: 'low', autoExecute: true, description: 'Explain flow' },
  { tool: 'analyze_lead_source', risk: 'low', autoExecute: true, description: 'Analyze lead source' },
  { tool: 'draft_message', risk: 'low', autoExecute: true, description: 'Draft message' },
  { tool: 'create_custom_field', risk: 'low', autoExecute: true, description: 'Create custom field' },
  { tool: 'create_task', risk: 'medium', autoExecute: true, description: 'Create task (auto-executable)' },
  { tool: 'create_ticket', risk: 'medium', autoExecute: true, description: 'Create ticket (auto-executable)' },
  { tool: 'update_lead_status', risk: 'medium', autoExecute: true, description: 'Update lead status (auto-executable)' },
  { tool: 'set_segment', risk: 'medium', autoExecute: true, description: 'Set lead segment (auto-executable)' },
  { tool: 'update_score', risk: 'medium', autoExecute: true, description: 'Update lead score (auto-executable)' },
  { tool: 'send_message', risk: 'high', autoExecute: false, description: 'Send message' },
  { tool: 'create_campaign', risk: 'high', autoExecute: false, description: 'Create campaign' },
  { tool: 'update_ticket', risk: 'high', autoExecute: false, description: 'Update ticket' },
  { tool: 'initiate_call', risk: 'high', autoExecute: false, description: 'Initiate call' },
  { tool: 'send_email', risk: 'high', autoExecute: false, description: 'Send email' },
  { tool: 'bulk_send_message', risk: 'high', autoExecute: false, description: 'Bulk send message' },
  { tool: 'search_media', risk: 'low', autoExecute: true, description: 'Search media files' },
  { tool: 'send_media', risk: 'high', autoExecute: false, description: 'Send media file to lead' },
];

@Injectable()
export class MikeyService {
  private readonly logger = new Logger(MikeyService.name);

  constructor(
    private prisma: PrismaService,
    private khoj: KhojClientService,
    private outcomeEngine: OutcomeEngineService,
    private events: EventsService,
    private advanceStage: AdvanceStageService,
  ) {}

  getActionRisk(tool: string): { rule: ActionRule; risk: RiskLevel } {
    const rule = ACTION_RULES.find(r => r.tool === tool);
    return {
      rule: rule || { tool, risk: 'high', autoExecute: false, description: tool },
      risk: rule?.risk || 'high',
    };
  }

  canAutoExecute(tool: string): boolean {
    return ACTION_RULES.find(r => r.tool === tool)?.autoExecute ?? false;
  }

  getActionRules(): ActionRule[] {
    return ACTION_RULES;
  }

  async processProactiveSuggestion(finding: {
    type: string;
    title: string;
    description: string;
    severity: string;
    metadata: any;
  }): Promise<{ action: string; reason: string } | null> {
    if (finding.severity !== 'critical') return null;

    if (finding.type === 'unassigned_hot_leads' && finding.metadata?.leadIds?.length > 0) {
      const agents = await this.prisma.user.findMany({
        where: { role: 'SALES_AGENT', active: true },
        include: { assignedLeads: { where: { status: { notIn: ['CONVERTED', 'LOST', 'SPAM'] } } } },
      });

      if (agents.length === 0) return null;
      const leastLoaded = agents.sort((a, b) => a.assignedLeads.length - b.assignedLeads.length)[0];

      const leadId = finding.metadata.leadIds[0];
      await this.prisma.lead.update({
        where: { id: leadId },
        data: { assignedAgentId: leastLoaded.id },
      });

      const reason = `Auto-assigned lead ${leadId} to ${leastLoaded.name || leastLoaded.email} (lowest current load: ${leastLoaded.assignedLeads.length} active leads)`;
      this.logger.log(reason);
      return { action: `assigned_lead:${leadId}`, reason };
    }

    if (finding.type === 'stale_hot_leads' && finding.metadata?.leadIds?.length > 0) {
      const leadIds = finding.metadata.leadIds.slice(0, 5);
      for (const leadId of leadIds) {
        await this.khoj.saveMemory(`Lead ${leadId} flagged as stale hot lead — follow-up recommended. ${finding.description}`);
      }
      return { action: `flagged_${leadIds.length}_stale_hot_leads`, reason: `Created Khoj memory entries for ${leadIds.length} stale hot leads. Staff will be notified via dashboard.` };
    }

    return null;
  }

  async runAutonomousAction(params: { leadId?: string; action: string; args: any }): Promise<{ success: boolean; result: string }> {
    const risk = this.getActionRisk(params.action);

    if (risk.risk === 'high') {
      return { success: false, result: `Action "${params.action}" requires human confirmation (high risk)` };
    }

    const logTask = true;
    let actionDescription = '';

    try {
      let result: any;
      switch (params.action) {
        case 'create_task':
          result = await this.prisma.task.create({
            data: {
              title: params.args.title || 'Untitled task',
              description: params.args.description,
              priority: params.args.priority || 'medium',
              dueAt: params.args.dueAt ? new Date(params.args.dueAt) : undefined,
              leadId: params.leadId,
              assigneeId: params.args.assigneeId,
              createdBy: 'mikey',
              source: 'mikey_proactive',
              status: 'pending',
            },
          });
          actionDescription = `Created task: ${params.args.title}`;
          break;
        case 'create_ticket':
          result = await this.prisma.ticket.create({ data: { ...params.args, leadId: params.leadId } });
          actionDescription = `Created ticket: ${params.args.title || ''}`;
          break;
        case 'update_lead_status': {
          const lead = await this.prisma.lead.findUnique({ where: { id: params.leadId }, select: { tenantId: true } });
          if (!lead) throw new Error('Lead not found');
          result = await this.advanceStage.advanceStage({
            tenantId: lead.tenantId,
            leadId: params.leadId!,
            to: params.args.status,
            actor: 'mikey',
            reason: 'autonomous update_lead_status',
          });
          actionDescription = `Updated lead ${params.leadId} status to ${params.args.status}`;
          break;
        }
        case 'set_segment':
          result = await this.prisma.lead.update({
            where: { id: params.leadId },
            data: { segment: params.args.segment },
          });
          actionDescription = `Set lead segment to ${params.args.segment}`;
          break;
        case 'update_score':
          result = await this.prisma.lead.update({
            where: { id: params.leadId },
            data: { score: params.args.score },
          });
          actionDescription = `Updated lead score to ${params.args.score}`;
          break;
        case 'draft_message':
          result = { draft: true, instructions: params.args.instructions || '' };
          actionDescription = `Drafted message for lead ${params.leadId}`;
          break;
        default:
          return { success: false, result: `Unknown autonomous action: ${params.action}` };
      }

      await this.events.emit({
        type: 'mikey.autonomous_action',
        source: 'mikey',
        entityType: 'lead',
        entityId: params.leadId,
        payload: { action: params.action, args: params.args, result },
      });

      if (logTask && actionDescription && params.leadId) {
        await this.prisma.task.create({
          data: {
            title: actionDescription,
            description: `Mikey auto-action: ${params.action} on lead ${params.leadId}. Args: ${JSON.stringify(params.args).slice(0, 200)}`,
            status: 'done',
            priority: 'low',
            leadId: params.leadId,
            createdBy: 'mikey',
            source: 'mikey_self_doc',
          },
        }).catch(err => this.logger.warn(`Failed to log self-documenting task: ${err.message}`));
      }

      return { success: true, result: `${params.action} completed: ${JSON.stringify(result).slice(0, 200)}` };
    } catch (err: any) {
      return { success: false, result: `${params.action} failed: ${err.message}` };
    }
  }

  async generateStageTasks(leadId: string, status: string, tenantId: string): Promise<number> {
    const stageTaskMap: Record<string, Array<{ title: string; description: string; priority: string }>> = {
      NEW: [
        { title: 'Contact lead within 4 hours', description: 'Initial outreach to qualify interest and set expectations', priority: 'urgent' },
        { title: 'Send brochure / property details', description: 'Share relevant project info based on lead interest', priority: 'high' },
      ],
      CONTACTED: [
        { title: 'Qualify budget and timeline', description: 'Confirm budget range, timeline, and preferred locations', priority: 'high' },
        { title: 'Schedule discovery call', description: 'Book a 15-min call to understand requirements', priority: 'medium' },
      ],
      ENGAGED: [
        { title: 'Send property recommendations', description: 'Share 2-3 matching properties based on requirements', priority: 'high' },
        { title: 'Schedule site visit', description: 'Book a visit to the most relevant project', priority: 'high' },
      ],
      QUALIFYING: [
        { title: 'Verify budget and pre-approval', description: 'Confirm financing readiness and budget confirmation', priority: 'high' },
        { title: 'Share payment plan options', description: 'Send available payment plans and EMI options', priority: 'medium' },
      ],
      QUALIFIED: [
        { title: 'Schedule site visit', description: 'Book a physical site visit for the shortlisted property', priority: 'urgent' },
        { title: 'Prepare comparison sheet', description: 'Create a comparison of shortlisted properties', priority: 'medium' },
      ],
      PROPOSAL_SENT: [
        { title: 'Follow up on proposal within 24 hours', description: 'Check if lead has reviewed the proposal and address questions', priority: 'urgent' },
        { title: 'Prepare for negotiation', description: 'Discuss pricing, discounts, and add-ons', priority: 'high' },
      ],
      APPOINTMENT_BOOKED: [
        { title: 'Confirm appointment 24 hours before', description: 'Send reminder and confirm site visit timing', priority: 'high' },
        { title: 'Prepare site visit kit', description: 'Brochures, floor plans, price list for the visit', priority: 'medium' },
      ],
    };

    const tasks = stageTaskMap[status] || [];
    if (tasks.length === 0) return 0;

    const existingTasks = await this.prisma.task.findMany({
      where: { leadId, title: { in: tasks.map(t => t.title) } },
      select: { title: true },
    });
    const existingTitles = new Set(existingTasks.map(t => t.title));

    let created = 0;
    for (const task of tasks) {
      if (existingTitles.has(task.title)) continue;
      await this.prisma.task.create({
        data: {
          title: task.title,
          description: task.description,
          priority: task.priority,
          leadId,
          createdBy: 'mikey',
          source: 'mikey_proactive',
          status: 'pending',
        },
      });
      created++;
    }
    return created;
  }

  async generateProactiveTasksForAllLeads(tenantId: string): Promise<number> {
    const activeStatuses: any[] = ['NEW', 'CONTACTED', 'ENGAGED', 'QUALIFYING', 'QUALIFIED', 'PROPOSAL_SENT', 'APPOINTMENT_BOOKED'];
    const leads = await this.prisma.lead.findMany({
      where: { tenantId, status: { in: activeStatuses } },
      select: { id: true, status: true },
    });

    let total = 0;
    for (const lead of leads) {
      const count = await this.generateStageTasks(lead.id, lead.status, tenantId);
      total += count;
    }
    return total;
  }
}

