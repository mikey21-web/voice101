import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TimelineService } from '../timeline/timeline.service';
import OpenAI from 'openai';

@Injectable()
export class LeadContextService {
  private readonly logger = new Logger(LeadContextService.name);
  private client: OpenAI | undefined;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private timeline: TimelineService,
  ) {
    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY');
    const baseURL = this.config.get<string>('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com/v1';
    if (apiKey) {
      this.client = new OpenAI({ apiKey, baseURL, timeout: 15000, maxRetries: 1 });
    }
  }

  async enrich(leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        contact: true,
        campaign: true,
        customFields: { include: { definition: true } },
      },
    });
    if (!lead) return;

    const [consent, agentAvailable, history, aiScore] = await Promise.all([
      this.getConsent(lead.contactId),
      this.checkAgentAvailability(lead),
      this.getHistory(lead.contactId),
      this.scoreMessageAI(lead),
    ]);

    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        urgency: aiScore.urgencyReason || lead.urgency,
        metadata: {
          ...(lead.metadata as any),
          _context: {
            campaign: lead.campaign?.name || null,
            campaignType: lead.campaign?.campaignType || null,
            consent,
            agentAvailable,
            previousContacts: history.count,
            aiIntent: aiScore.intent,
            aiUrgency: aiScore.urgency,
            aiReasoning: (aiScore.reasoning || '').slice(0, 500),
            enrichedAt: new Date().toISOString(),
          },
        },
      },
    });

    await this.timeline.add({
      type: 'ai_reaction',
      title: 'Mikey analyzed this lead',
      description: `Intent: ${aiScore.intent}/100, Urgency: ${aiScore.urgency}/100. ${aiScore.reasoning}`,
      leadId,
      contactId: lead.contactId,
    });
  }

  async scoreIntent(leadId: string): Promise<{ intent: number; urgency: number; reasoning: string }> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { message: true, interest: true, urgency: true, source: true, metadata: true },
    });
    if (!lead) return { intent: 0, urgency: 0, reasoning: '' };
    if (!this.client) return this.defaultScore(lead);

    const text = [lead.message, lead.interest, lead.urgency].filter(Boolean).join('. ');
    if (!text) return this.defaultScore(lead);

    try {
      const completion = await this.client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `You are Mikey, a lead scoring AI. Given a lead's message and source, respond with ONLY JSON:
{
  "intent": 0-100 (buying intent: 0=junk/spam, 100=ready to buy today),
  "urgency": 0-100 (how soon: 0=not urgent/browsing, 100=needs immediate follow-up),
  "reasoning": "one short sentence explaining the scores"
}
Consider: specific requirements, timeline mentions, question quality, source credibility. Return ONLY valid JSON.`,
          },
          {
            role: 'user',
            content: `Source: ${lead.source}. Message: """${text.slice(0, 1000)}"""`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const parsed = JSON.parse(completion.choices[0].message.content || '{}');
      return {
        intent: Math.max(0, Math.min(100, parsed.intent ?? 30)),
        urgency: Math.max(0, Math.min(100, parsed.urgency ?? 30)),
        reasoning: (parsed.reasoning || '').slice(0, 300),
      };
    } catch (e: any) {
      this.logger.warn(`AI scoring failed for lead ${leadId}: ${e.message}`);
      return this.defaultScore(lead);
    }
  }

  private defaultScore(lead: any): { intent: number; urgency: number; reasoning: string } {
    const s = lead.source as string;
    const hotSources = ['WHATSAPP', 'PHONE_CALL', 'FORM'];
    const intent = hotSources.includes(s) ? 60 : 30;
    return { intent, urgency: 40, reasoning: `Source-based default (${s})` };
  }

  private async getConsent(contactId: string): Promise<{ whatsapp: boolean; email: boolean; sms: boolean }> {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      select: { consentStatus: true, optedOutAt: true },
    });
    const ok = contact?.consentStatus !== 'opted_out' && !contact?.optedOutAt;
    return { whatsapp: ok, email: ok, sms: ok };
  }

  private async checkAgentAvailability(lead: any): Promise<boolean> {
    if (lead.assignedAgentId) return true;
    const agent = await this.prisma.user.findFirst({
      where: { tenantId: lead.tenantId, role: 'SALES_AGENT', active: true },
      orderBy: { createdAt: 'asc' },
    });
    return !!agent;
  }

  private async getHistory(contactId: string): Promise<{ count: number; lastStatus: string; lastContact: Date | null }> {
    const leads = await this.prisma.lead.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { status: true, createdAt: true },
    });
    if (leads.length === 0) return { count: 0, lastStatus: 'none', lastContact: null };
    return { count: leads.length, lastStatus: leads[0].status, lastContact: leads[0].createdAt };
  }

  private async scoreMessageAI(lead: any): Promise<{ intent: number; urgency: number; reasoning: string; urgencyReason?: string }> {
    const text = [lead.message, lead.interest, lead.urgency].filter(Boolean).join('. ');
    if (!text || !this.client) return { intent: 30, urgency: 30, reasoning: 'No message or AI unavailable', urgencyReason: '' };

    try {
      const completion = await this.client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `You are Mikey, a lead scoring AI. Respond with ONLY JSON:
{
  "intent": 0-100,
  "urgency": 0-100,
  "reasoning": "short reason",
  "urgencyReason": "timeline hint like 'immediate' or '3 months'"
}`,
          },
          { role: 'user', content: `Source: ${lead.source}. Message: """${text.slice(0, 1000)}"""` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });
      const parsed = JSON.parse(completion.choices[0].message.content || '{}');
      return {
        intent: Math.max(0, Math.min(100, parsed.intent ?? 30)),
        urgency: Math.max(0, Math.min(100, parsed.urgency ?? 30)),
        reasoning: (parsed.reasoning || '').slice(0, 300),
        urgencyReason: parsed.urgencyReason || '',
      };
    } catch (e: any) {
      this.logger.warn(`AI scoring failed: ${e.message}`);
      return { intent: 30, urgency: 30, reasoning: 'AI scoring unavailable', urgencyReason: '' };
    }
  }
}
