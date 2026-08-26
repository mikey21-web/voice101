import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { TimelineService } from '../timeline/timeline.service';
import { AgentClientService } from './agent-client.service';
import { KhojClientService } from '../khoj-client/khoj-client.service';

export interface AgentConfig {
  toneStyle: string;
  businessName: string;
  industry: string;
  customPrompt: string;
  qualificationQuestions: string[];
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private prisma: PrismaService,
    private events: EventsService,
    private timeline: TimelineService,
    private agentClient: AgentClientService,
    private khoj: KhojClientService,
  ) {}

  async recordRunSummary(dto: { runId: string; leadId: string; actions: any[]; model: string; startedAt: string; finishedAt: string }) {
    const actionSummary = (dto.actions || []).map((a: any) =>
      `${a.tool}: ${a.status}`
    ).join(', ') || 'no actions';

    await this.timeline.add({
      type: 'agent_run_completed',
      title: `Agent run completed`,
      description: `Model: ${dto.model}. Actions: ${actionSummary}`,
      leadId: dto.leadId,
      metadata: dto as any,
    });

    await this.events.emit({
      type: 'agent.run_completed',
      leadId: dto.leadId,
      entityType: 'agent',
      entityId: dto.runId,
      payload: dto,
    });

    await this.persistToKhojMemory(dto);

    this.logger.log(`Run ${dto.runId} recorded for lead ${dto.leadId}: ${actionSummary}`);
    return { recorded: true, runId: dto.runId };
  }

  private async persistToKhojMemory(dto: { runId: string; leadId: string; actions: any[]; model: string; startedAt: string; finishedAt: string }) {
    try {
      const actions = dto.actions || [];
      const sentMessages = actions.filter((a: any) => a.tool === 'send_message' && a.status === 'success');
      const escalated = actions.find((a: any) => a.tool === 'escalate_to_human');
      const statusChanges = actions.filter((a: any) => a.tool === 'update_status');

      const parts: string[] = [`Lead ${dto.leadId} — Agent conversation completed`];
      if (sentMessages.length > 0) parts.push(`Sent ${sentMessages.length} message(s)`);
      if (statusChanges.length > 0) {
        for (const sc of statusChanges) {
          if (sc.args?.status) parts.push(`Status changed to ${sc.args.status}`);
        }
      }
      if (escalated) parts.push('Escalated to human');
      if (actions.length === 0) parts.push('No actions taken');

      const memory = parts.join('. ') + '.';
      await this.khoj.saveMemory(memory);
      this.logger.debug(`Persisted run ${dto.runId} to Khoj memory`);
    } catch (err: any) {
      this.logger.warn(`Failed to persist to Khoj memory: ${err.message}`);
    }
  }

  async getAgentConfig(): Promise<AgentConfig> {
    const tenant = await this.prisma.tenant.findFirst({ where: { slug: 'default' } });
    const settings = (tenant?.settings as any) || {};
    const agent = settings.agentConfig || {};

    return {
      toneStyle: agent.toneStyle || 'professional',
      businessName: agent.businessName || 'My Business',
      industry: agent.industry || 'generic',
      customPrompt: agent.customPrompt || '',
      qualificationQuestions: agent.qualificationQuestions || [],
    };
  }

  async setAgentConfig(config: Partial<AgentConfig>): Promise<AgentConfig> {
    const tenant = await this.prisma.tenant.findFirst({ where: { slug: 'default' } });
    if (!tenant) throw new Error('No default tenant found');

    const current = (tenant.settings as any) || {};
    const existing = current.agentConfig || {};
    const merged = { ...existing, ...config };

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { settings: { ...current, agentConfig: merged } },
    });

    this.logger.log('Agent config persisted to tenant settings');

    // Push to agent-service if available
    await this.pushConfigToAgentService(merged);

    return merged;
  }

  async getStatus() {
    const model = process.env.AGENT_MODEL || 'gemini-2.5-flash';
    const apiKeyConfigured = !!(process.env.GOOGLE_API_KEY || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY);
    const agentUrl = process.env.AGENT_SERVICE_URL;

    const config = await this.getAgentConfig();

    return {
      online: !!agentUrl,
      model,
      apiKeyConfigured,
      tone: {
        style: config.toneStyle,
        businessName: config.businessName,
        industry: config.industry,
        customPrompt: config.customPrompt,
      },
      qualificationQuestions: config.qualificationQuestions,
      stats: await this.getStats(),
    };
  }

  async getStats() {
    const [totalMessages, qualifiedLeads, bookedAppointments] = await Promise.all([
      this.prisma.conversationMessage.count({
        where: { channel: { in: ['CHATBOT', 'WHATSAPP'] } },
      }),
      this.prisma.lead.count({
        where: { status: 'QUALIFIED' },
      }),
      this.prisma.lead.count({
        where: { status: 'APPOINTMENT_BOOKED' },
      }),
    ]);

    return {
      conversationsHandled: totalMessages,
      leadsQualified: qualifiedLeads,
      appointmentsBooked: bookedAppointments,
    };
  }

  async testAgent(message: string, channel: string) {
    const agentUrl = process.env.AGENT_SERVICE_URL;
    const key = process.env.AGENT_INBOUND_KEY;

    if (agentUrl) {
      try {
        const response = await fetch(`${agentUrl}/agent/test`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-agent-key': key || '',
          },
          body: JSON.stringify({ message, channel }),
        });
        if (response.ok) {
          const data = await response.json();
          return { response: data.response || data.message || 'No response', source: 'agent-service' };
        }
      } catch (err: any) {
        this.logger.warn(`Agent test via service failed: ${err.message}`);
      }
    }

    const fallbackResponses = [
      'Thanks for your message! I\'d be happy to help. Could you share a bit more about your needs — specifically your budget range and timeline?',
      'Great question! I can assist with that. We offer several solutions tailored to your industry. Would you like me to connect you with a specialist?',
      'I understand you\'re interested in our services. Let me ask a few quick questions to make sure I can help: What\'s the size of your team and when are you looking to start?',
      'Thanks for reaching out. I\'d recommend scheduling a quick consultation where we can go over your requirements in detail. What day works best for you?',
    ];
    const idx = Math.floor(Math.random() * fallbackResponses.length);

    return { response: fallbackResponses[idx], source: 'fallback' };
  }

  async draftReply(leadId: string, context?: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { contact: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const name = lead.contact?.name || 'there';
    const interest = lead.interest || 'our projects';
    const prompt = `Draft a WhatsApp reply for a lead. Name: ${name}. Interest: ${interest}.${context ? ` Context: ${context}` : ''} Keep it under 160 characters, friendly and professional, end with a question.`;

    const agentUrl = process.env.AGENT_SERVICE_URL;
    const key = process.env.AGENT_INBOUND_KEY;
    if (agentUrl) {
      try {
        const response = await fetch(`${agentUrl}/agent/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-agent-key': key || '' },
          body: JSON.stringify({ message: prompt, channel: 'WHATSAPP' }),
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const data = await response.json();
          return { draft: data.response || data.message || '...', source: 'agent-service' };
        }
      } catch {}
    }

    const drafts = [
      `Hi ${name}, thanks for your interest in ${interest}! Would you like to schedule a site visit to see the property? Let me know a convenient time.`,
      `Hello ${name}! We have great options matching your interest in ${interest}. Would you like me to share the latest cost sheet?`,
      `Hi! Following up on your inquiry about ${interest}. We've just released new units that might be perfect. Care to take a look?`,
    ];
    return { draft: drafts[Math.floor(Math.random() * drafts.length)], source: 'fallback' };
  }

  async updateConfig(dto: { businessName?: string; industry?: string; toneStyle?: string; qualificationQuestions?: string[]; customPrompt?: string }) {
    const config = await this.setAgentConfig({
      ...(dto.businessName !== undefined && { businessName: dto.businessName }),
      ...(dto.industry !== undefined && { industry: dto.industry }),
      ...(dto.toneStyle !== undefined && { toneStyle: dto.toneStyle }),
      ...(dto.qualificationQuestions !== undefined && { qualificationQuestions: dto.qualificationQuestions.filter(q => q.trim()) }),
      ...(dto.customPrompt !== undefined && { customPrompt: dto.customPrompt }),
    });

    this.logger.log('Agent config updated');
    return { success: true, message: 'Configuration saved', config };
  }

  private async pushConfigToAgentService(config: AgentConfig) {
    const agentUrl = process.env.AGENT_SERVICE_URL;
    const key = process.env.AGENT_INBOUND_KEY;
    if (!agentUrl) return;

    try {
      const response = await fetch(`${agentUrl}/agent/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agent-key': key || '',
        },
        body: JSON.stringify({
          toneStyle: config.toneStyle,
          businessName: config.businessName,
          industry: config.industry,
          customPrompt: config.customPrompt,
          qualificationQuestions: config.qualificationQuestions,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        this.logger.warn(`Failed to push config to agent-service: ${response.status}`);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to push config to agent-service: ${err.message}`);
    }
  }
}
