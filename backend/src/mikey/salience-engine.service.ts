import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { EventsService } from '../events/events.service';
import { AutonomyGuardrailsService } from './autonomy-guardrails.service';
import { AutonomousActionService } from './autonomous-action.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { MemoryService } from './memory.service';
import type { SchedulerFinding } from './mikey-scheduler.types';

const DEFAULT_TENANT_ID = 'default-tenant';

/**
 * The triage core: turns a detected finding into a decision — act silently,
 * act and tell the owner, or leave it for the 8am digest — then executes
 * deterministically (no LLM call) so autonomous writes stay reliable and
 * cheap. Judgment calls that need real reasoning stay with the LLM/copilot
 * path; this layer only handles the two finding types with an unambiguous,
 * safe, reversible-or-low-risk remedy.
 */
@Injectable()
export class SalienceEngineService {
  private readonly logger = new Logger(SalienceEngineService.name);

  constructor(
    private prisma: PrismaService,
    private conversations: ConversationsService,
    private events: EventsService,
    private guardrails: AutonomyGuardrailsService,
    private actions: AutonomousActionService,
    private approvals: ApprovalsService,
    private memory: MemoryService,
  ) {}

  /** After a successful action, find relevant procedural rules and record a positive impact so the auto-retire loop has live data. */
  private async recordRuleImpactForAction(finding: SchedulerFinding, success: boolean) {
    try {
      const relevant = await this.memory.getRelevantRules(DEFAULT_TENANT_ID, finding.description || finding.title, undefined, 3);
      for (const r of relevant) {
        await this.memory.recordRuleImpact(r.id, success ? 0.05 : -0.05, finding.type);
      }
    } catch (err: any) {
      this.logger.debug(`recordRuleImpact skipped: ${err.message}`);
    }
  }

  /** Feeds ReflexionService's trajectory builder (which reads mikey.* SystemEvents by leadId) so a later win/loss reflection knows Mikey acted here on its own. */
  private async emitAutonomousActionEvent(leadId: string, tool: string, payload: Record<string, unknown>) {
    await this.events.emit({
      type: 'mikey.autonomous_action',
      source: 'salience-engine',
      leadId,
      payload: { tool, ...payload },
    });
  }

  /** Shadow mode: logs the action Mikey would have taken (same decision, same args) without writing anything or queuing an approval, so an owner can watch a category's real-world decisions before trusting it enough to flip it to autonomous. */
  private async logShadowAction(finding: SchedulerFinding, tool: string, args: Record<string, unknown>, leadId?: string): Promise<{ acted: boolean; summary: string }> {
    await this.events.emit({
      type: 'mikey.shadow_action',
      source: 'salience-engine',
      leadId,
      payload: { tool, ...args, findingType: finding.type },
    });
    return { acted: false, summary: `[SHADOW] Would have run ${tool} for ${finding.type} — logged only, not executed.` };
  }

  /** When in observe mode, create an ApprovalRequest instead of executing the real action — surfaces in the approval UI for one-tap approve/reject. */
  private async draftToApprovalQueue(finding: SchedulerFinding, tool: string, args: Record<string, unknown>, leadId?: string): Promise<{ acted: boolean; summary: string }> {
    await this.approvals.request(DEFAULT_TENANT_ID, {
      type: `mikey_${finding.type}`,
      entityType: leadId ? 'lead' : 'finding',
      entityId: leadId || finding.type,
      reason: `[DRAFT] ${finding.title}: ${finding.description} — tool: ${tool}`,
      requestedById: undefined,
    });
    await this.emitAutonomousActionEvent(leadId || '', tool, { ...args, findingType: finding.type, draft: true });
    return { acted: true, summary: `Drafted ${tool} for ${finding.type} to approval queue — owner must approve before it executes.` };
  }

  async route(finding: SchedulerFinding): Promise<{ acted: boolean; summary?: string }> {
    switch (finding.type) {
      case 'unassigned_hot_leads':
        return this.handleUnassignedHotLeads(finding);
      case 'stale_hot_leads':
        return this.handleStaleHotLeads(finding);
      case 'stale_new_leads':
        return this.handleStaleNewLeads(finding);
      case 'overdue_tasks':
        return this.handleOverdueTasks(finding);
      default:
        return { acted: false };
    }
  }

  /** Assign each unassigned hot lead to the least-loaded active sales agent. Fully reversible. */
  private async handleUnassignedHotLeads(finding: SchedulerFinding): Promise<{ acted: boolean; summary?: string }> {
    const gate = await this.guardrails.canActInternally(DEFAULT_TENANT_ID, 'lead_assignment');
    if (!gate.allowed && gate.mode !== 'observe') {
      this.logger.log(`Skipping auto-assign: ${gate.reason}`);
      return { acted: false };
    }

    const leadIds: string[] = finding.metadata?.leadIds || [];
    if (leadIds.length === 0) return { acted: false };

    if (gate.mode === 'observe') {
      return this.draftToApprovalQueue(finding, 'assign_lead_to_agent', { leadIds }, leadIds[0]);
    }
    if (gate.mode === 'shadow') {
      return this.logShadowAction(finding, 'assign_lead_to_agent', { leadIds }, leadIds[0]);
    }

    const agents = await this.prisma.user.findMany({
      where: { role: 'SALES_AGENT', active: true },
      include: { assignedLeads: { where: { status: { notIn: ['CONVERTED', 'LOST', 'SPAM'] } } } },
    });
    if (agents.length === 0) return { acted: false }; // nobody to assign to — surfaces via the finding itself, not silently dropped

    let assigned = 0;
    for (const leadId of leadIds) {
      // Re-sort each time so consecutive assignments in this batch spread out
      // instead of all landing on whoever was least-loaded at the start.
      const leastLoaded = [...agents].sort((a, b) => a.assignedLeads.length - b.assignedLeads.length)[0];
      await this.prisma.lead.update({ where: { id: leadId }, data: { assignedAgentId: leastLoaded.id } });
      leastLoaded.assignedLeads.push({} as any); // reflect the new load locally for the next iteration's sort
      await this.actions.record({
        tenantId: DEFAULT_TENANT_ID,
        findingType: finding.type,
        tool: 'assign_lead_to_agent',
        leadId,
        args: { agentId: leastLoaded.id },
        result: `Assigned to ${leastLoaded.name}`,
        undoable: true,
        undoData: { previousAgentId: null },
      });
      await this.emitAutonomousActionEvent(leadId, 'assign_lead_to_agent', { agentId: leastLoaded.id, findingType: finding.type });
      assigned++;
    }

    if (assigned > 0) await this.recordRuleImpactForAction(finding, true);
    return { acted: assigned > 0, summary: `Auto-assigned ${assigned} unassigned hot lead(s) to the least-loaded agent(s).` };
  }

  /** Send a light re-engagement nudge to hot leads that have gone quiet, respecting quiet hours/cooldown/cap. Not reversible (a sent message can't be unsent), so logged but never marked undoable. */
  private async handleStaleHotLeads(finding: SchedulerFinding): Promise<{ acted: boolean; summary?: string }> {
    const leadIds: string[] = finding.metadata?.leadIds || [];
    if (leadIds.length === 0) return { acted: false };

    const firstGate = leadIds.length > 0 ? await this.guardrails.canMessageLeadAutonomously(DEFAULT_TENANT_ID, 'lead_messaging', leadIds[0]) : { allowed: false, mode: undefined };
    if (firstGate.mode === 'observe') {
      return this.draftToApprovalQueue(finding, 'send_message', { leadIds, channel: 'WHATSAPP' }, leadIds[0]);
    }
    if (firstGate.mode === 'shadow') {
      return this.logShadowAction(finding, 'send_message', { leadIds, channel: 'WHATSAPP' }, leadIds[0]);
    }

    let sent = 0;
    for (const leadId of leadIds) {
      const gate = await this.guardrails.canMessageLeadAutonomously(DEFAULT_TENANT_ID, 'lead_messaging', leadId);
      if (!gate.allowed) {
        this.logger.log(`Skipping auto-nudge for lead ${leadId}: ${gate.reason}`);
        continue;
      }

      const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, include: { contact: true } });
      if (!lead) continue;

      const name = lead.contact?.name || 'there';
      const interestLine = lead.interest ? ` about ${lead.interest}` : '';
      const text = `Hi ${name}, just checking in${interestLine} — still interested? Happy to answer any questions or set up a time to talk.`;

      try {
        await this.conversations.create({ leadId, channel: 'WHATSAPP', direction: 'OUTBOUND', text });
      } catch (err: any) {
        this.logger.warn(`Auto-nudge blocked for lead ${leadId}: ${err.message}`);
        continue;
      }

      await this.actions.record({
        tenantId: DEFAULT_TENANT_ID,
        findingType: finding.type,
        tool: 'send_message',
        leadId,
        args: { channel: 'WHATSAPP', text },
        result: 'Follow-up sent',
        undoable: false,
      });
      await this.emitAutonomousActionEvent(leadId, 'send_message', { channel: 'WHATSAPP', findingType: finding.type });
      sent++;
    }

    if (sent > 0) await this.recordRuleImpactForAction(finding, true);
    return { acted: sent > 0, summary: `Sent a re-engagement follow-up to ${sent} stale hot lead(s).` };
  }

  /** New leads sitting in NEW status for 24h+ get the same least-loaded-agent assignment as unassigned hot leads. Fully reversible. */
  private async handleStaleNewLeads(finding: SchedulerFinding): Promise<{ acted: boolean; summary?: string }> {
    const gate = await this.guardrails.canActInternally(DEFAULT_TENANT_ID, 'lead_assignment');
    if (!gate.allowed && gate.mode !== 'observe') {
      this.logger.log(`Skipping stale-new-lead auto-assign: ${gate.reason}`);
      return { acted: false };
    }

    const leadIds: string[] = finding.metadata?.leadIds || [];
    if (leadIds.length === 0) return { acted: false };

    if (gate.mode === 'observe') {
      return this.draftToApprovalQueue(finding, 'assign_lead_to_agent', { leadIds, reason: 'stale_new_lead' }, leadIds[0]);
    }
    if (gate.mode === 'shadow') {
      return this.logShadowAction(finding, 'assign_lead_to_agent', { leadIds, reason: 'stale_new_lead' }, leadIds[0]);
    }

    const leads = await this.prisma.lead.findMany({ where: { id: { in: leadIds } } });
    const alreadyAssigned = leads.filter((l) => l.assignedAgentId).map((l) => l.id);
    const needsAssignment = leadIds.filter((id) => !alreadyAssigned.includes(id));
    if (needsAssignment.length === 0) return { acted: false };

    const agents = await this.prisma.user.findMany({
      where: { role: 'SALES_AGENT', active: true },
      include: { assignedLeads: { where: { status: { notIn: ['CONVERTED', 'LOST', 'SPAM'] } } } },
    });
    if (agents.length === 0) return { acted: false };

    let assigned = 0;
    for (const leadId of needsAssignment) {
      const leastLoaded = [...agents].sort((a, b) => a.assignedLeads.length - b.assignedLeads.length)[0];
      await this.prisma.lead.update({ where: { id: leadId }, data: { assignedAgentId: leastLoaded.id } });
      leastLoaded.assignedLeads.push({} as any);
      await this.actions.record({
        tenantId: DEFAULT_TENANT_ID,
        findingType: finding.type,
        tool: 'assign_lead_to_agent',
        leadId,
        args: { agentId: leastLoaded.id, reason: 'stale_new_lead' },
        result: `Assigned to ${leastLoaded.name}`,
        undoable: true,
        undoData: { previousAgentId: null },
      });
      await this.emitAutonomousActionEvent(leadId, 'assign_lead_to_agent', { agentId: leastLoaded.id, findingType: finding.type });
      assigned++;
    }

    if (assigned > 0) await this.recordRuleImpactForAction(finding, true);
    return { acted: assigned > 0, summary: `Auto-assigned ${assigned} stale new lead(s) that had never been picked up.` };
  }

  /**
   * Overdue tasks get bumped to high priority so they surface at the top of
   * whoever owns them — never reassigned or completed automatically, since
   * only the owning human knows if the task is still relevant. Reversible:
   * undo restores the original priority.
   */
  private async handleOverdueTasks(finding: SchedulerFinding): Promise<{ acted: boolean; summary?: string }> {
    const gate = await this.guardrails.canActInternally(DEFAULT_TENANT_ID, 'task_escalation');
    if (!gate.allowed && gate.mode !== 'observe') {
      this.logger.log(`Skipping overdue-task escalation: ${gate.reason}`);
      return { acted: false };
    }

    const taskIds: string[] = finding.metadata?.taskIds || [];
    if (taskIds.length === 0) return { acted: false };

    if (gate.mode === 'observe') {
      return this.draftToApprovalQueue(finding, 'escalate_task_priority', { taskIds, priority: 'high' });
    }
    if (gate.mode === 'shadow') {
      return this.logShadowAction(finding, 'escalate_task_priority', { taskIds, priority: 'high' });
    }

    const tasks = await this.prisma.task.findMany({ where: { id: { in: taskIds }, priority: { not: 'high' } } });
    if (tasks.length === 0) return { acted: false };

    let escalated = 0;
    for (const task of tasks) {
      const previousPriority = task.priority;
      await this.prisma.task.update({ where: { id: task.id }, data: { priority: 'high' } });
      await this.actions.record({
        tenantId: DEFAULT_TENANT_ID,
        findingType: finding.type,
        tool: 'escalate_task_priority',
        leadId: task.leadId ?? undefined,
        args: { taskId: task.id, priority: 'high' },
        result: `Escalated to high priority (was ${previousPriority})`,
        undoable: true,
        undoData: { taskId: task.id, previousPriority },
      });
      escalated++;
    }

    if (escalated > 0) await this.recordRuleImpactForAction(finding, true);
    return { acted: escalated > 0, summary: `Escalated ${escalated} overdue task(s) to high priority.` };
  }
}
