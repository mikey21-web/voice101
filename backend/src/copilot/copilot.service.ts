import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LeadsService } from '../leads/leads.service';
import { TasksService } from '../tasks/tasks.service';
import { TicketsService } from '../tickets/tickets.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { ConversationsService } from '../conversations/conversations.service';
import { ReportsService } from '../reports/reports.service';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { TelephonyService } from '../telephony/telephony.service';
import { EmailAdapter } from '../shared/adapters/email.adapter';
import { FeatureFlagsService } from '../shared/feature-flags.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ContactsService } from '../contacts/contacts.service';
import { KhojClientService } from '../khoj-client/khoj-client.service';
import { MikeyService } from '../mikey/mikey.service';
import { OutcomeEngineService } from '../mikey/outcome-engine.service';
import { MemoryService } from '../mikey/memory.service';
import { ApprovalsService } from '../approvals/approvals.service';

const MAX_COPILOT_MESSAGES_PER_TENANT_PER_DAY = 500;
import { PERMISSION_MATRIX } from '../permissions/permissions.matrix';

const HTTP_TIMEOUT_MS = parseInt(process.env.COPILOT_HTTP_TIMEOUT || '30000', 10);

async function fetchWithTimeout(url: string, init: any = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

const APPROVAL_EXPIRY_MS = 5 * 60 * 1000;

@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private leadsService: LeadsService,
    private tasksService: TasksService,
    private ticketsService: TicketsService,
    private campaignsService: CampaignsService,
    private conversationsService: ConversationsService,
    private reportsService: ReportsService,
    private customFieldsService: CustomFieldsService,
    private telephonyService: TelephonyService,
    private emailAdapter: EmailAdapter,
    private featureFlags: FeatureFlagsService,
    private analyticsService: AnalyticsService,
    private contactsService: ContactsService,
    private khoj: KhojClientService,
    private Mikey: MikeyService,
    private outcomeEngine: OutcomeEngineService,
    private memory: MemoryService,
    private approvals: ApprovalsService,
  ) {}

  private can(role: string, permission: string): boolean {
    const roles = PERMISSION_MATRIX[permission];
    return roles?.includes(role) ?? false;
  }

  // Shared between chat() (initial queue-time check) and confirmAction() (re-checked at
  // confirm time, since a user's role/permissions can change between the two).
  private readonly toolPermMap: Record<string, string> = {
    search_leads: 'leads:read',
    search_contacts: 'contacts:read',
    get_lead_detail: 'leads:read',
    update_lead_status: 'leads:write',
    create_task: 'tasks:write',
    create_ticket: 'tickets:write',
    draft_message: 'conversations:read',
    send_message: 'conversations:write',
    list_tickets: 'tickets:read',
    list_campaigns: 'campaigns:read',
    get_analytics_overview: 'analytics:read',
    create_campaign: 'campaigns:write',
    run_report: 'reports:run',
    update_ticket: 'tickets:write',
    initiate_call: 'telephony:call',
    send_email: 'conversations:write',
    create_custom_field: 'custom_fields:write',
    analyze_lead_source: 'analytics:read',
    bulk_send_message: 'conversations:write',
    search_knowledge: 'knowledge_base:read',
    search_media: 'media:read',
    send_media: 'media:read',
  };

  // Backstop for the "no emojis, no dashes" system prompt rule. Prompt instructions steer
  // the model but are not guaranteed, so this deterministically strips what slips through
  // rather than relying on the model to always comply.
  private sanitizeReply(text: string): string {
    return text
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️]/gu, '')
      // Tight ranges like "9am–5pm" or "$50–$100" (no surrounding spaces) keep their meaning
      // by becoming "to", not a comma, since converting them to a comma would turn a range
      // into what reads like a list. Also catches "--" (ASCII double hyphen), which the model
      // sometimes uses as a dash substitute and which the unicode-only pattern below misses.
      .replace(/(\S)(?:—|–|--)(\S)/g, '$1 to $2')
      // Sentence-level dashes (with a space on at least one side) become a comma.
      .replace(/\s*(?:—|–|--)\s*/g, ', ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/ ,/g, ',')
      .trim();
  }

  async chat(
    userId: string,
    userRole: string,
    tenantId: string,
    message: string,
    conversationId?: string,
    outcomeCtx?: { outcomeId: string; stepId: string },
  ) {
    const agentServiceUrl = this.config.get<string>('AGENT_SERVICE_URL') || 'http://agent-service:8000';
    const agentInboundKey = this.config.get<string>('AGENT_INBOUND_KEY') || '';

    const enabled = await this.featureFlags.isEnabledDefault('copilot_enabled', true);
    if (!enabled) {
      throw new Error('The Copilot has been temporarily disabled by an administrator.');
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const messagesToday = await this.prisma.copilotMessage.count({
      where: { role: 'user', createdAt: { gte: startOfDay }, conversation: { tenantId } },
    });
    if (messagesToday >= MAX_COPILOT_MESSAGES_PER_TENANT_PER_DAY) {
      throw new Error('The Copilot has reached its daily usage limit for this account. Please try again tomorrow.');
    }

    let conversation = conversationId
      ? await this.prisma.copilotConversation.findUnique({ where: { id: conversationId }, include: { messages: { orderBy: { createdAt: 'asc' } } } })
      : null;

    if (!conversation) {
      conversation = await this.prisma.copilotConversation.create({
        data: { tenantId, userId, title: message.slice(0, 80) },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    }

    const businessSettings = await this.prisma.businessSettings.findFirst({}) as any;

    let memoryContext = '';
    try {
      const recentMemory = await this.memory.recallRecent(tenantId, 'EPISODIC' as any, 3);
      if (recentMemory?.length) {
        memoryContext = recentMemory.map((m: any) => `- [${m.type}] ${m.summary || m.value}`).join('\n');
      }
    } catch {}
    let khojContext = '';
    try {
      const khojResult = await this.khoj.query(message);
      if (khojResult?.answer) {
        khojContext = khojResult.answer;
      }
    } catch {}

    await this.prisma.copilotMessage.create({
      data: { conversationId: conversation.id, role: 'user', content: message },
    });

    const conversationHistory = conversation.messages.map(m => ({
      role: m.role,
      content: m.content,
      tool_call_id: m.role === 'tool' ? `tc_${m.id}` : undefined,
    }));

    let pythonResult: any;
    try {
      const res = await fetchWithTimeout(`${agentServiceUrl}/agent/copilot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agent-key': agentInboundKey,
        },
        body: JSON.stringify({
          tenantId,
          message,
          conversationHistory,
          businessSettings: {
            businessName: businessSettings?.businessName || '',
            industry: businessSettings?.industry || '',
            toneExamples: businessSettings?.toneExamples || [],
            goals: businessSettings?.goals || [],
            compliance: businessSettings?.compliance || [],
          },
          khojContext,
          memoryContext,
        }),
      });
      pythonResult = await res.json();
      if (!res.ok) throw new Error(pythonResult?.detail || `HTTP ${res.status}`);
    } catch (err: any) {
      this.logger.error('Python copilot call failed', err.message);
      const fallback = `I'm having trouble connecting to the AI service right now. Please try again in a moment.`;
      await this.prisma.copilotMessage.create({
        data: { conversationId: conversation.id, role: 'assistant', content: fallback },
      });
      return { conversationId: conversation.id, reply: fallback, actions: [] };
    }

    const reply = this.sanitizeReply(pythonResult.response || 'Done.');

    const actions: any[] = [];
    for (const a of (pythonResult.actions || [])) {
      if (a.status === 'pending') {
        const approval = await this.approvals.request(tenantId, {
          type: `copilot_${a.tool}`,
          entityType: 'copilot_action',
          entityId: a.tool,
          reason: a.args?.reason || `Copilot action: ${a.tool}`,
          expiresAt: new Date(Date.now() + APPROVAL_EXPIRY_MS),
          requestedById: userId,
        });
        await this.prisma.approvalRequest.update({
          where: { id: approval.id },
          data: { policySnapshot: { tool: a.tool, args: a.args, userId, ...(outcomeCtx || {}) } },
        });
        actions.push({ ...a, status: 'pending', requiresConfirmation: true, pendingActionId: approval.id });
      } else {
        actions.push(a);
      }
    }

    await this.prisma.copilotMessage.create({
      data: { conversationId: conversation.id, role: 'assistant', content: reply, toolCalls: actions.length > 0 ? actions : undefined },
    });

    return { conversationId: conversation.id, reply, actions };
  }

  /** Cartesia TTS for a Mikey reply, base64-encoded so the frontend can play it
   * without needing a separate authenticated static-audio route. */
  async speak(text: string): Promise<{ audioBase64: string; mimeType: string }> {
    const apiKey = this.config.get<string>('CARTESIA_API_KEY');
    if (!apiKey) throw new BadRequestException('CARTESIA_API_KEY not configured');
    const clean = (text || '').replace(/[#*`]/g, '').slice(0, 1000);
    if (!clean.trim()) return { audioBase64: '', mimeType: 'audio/mpeg' };

    const res = await fetchWithTimeout('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Cartesia-Version': '2026-03-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'sonic-3',
        transcript: clean,
        voice: { mode: 'id', id: this.config.get<string>('COPILOT_VOICE_ID') || 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4' },
        output_format: { container: 'mp3', bit_rate: 128000, sample_rate: 44100 },
      }),
    });
    if (!res.ok) throw new BadRequestException(`Cartesia TTS ${res.status}: ${await res.text()}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return { audioBase64: buf.toString('base64'), mimeType: 'audio/mpeg' };
  }

  async confirmAction(userId: string, userRole: string, pendingActionId: string) {
    const approval = await this.prisma.approvalRequest.findUnique({ where: { id: pendingActionId } });
    if (!approval || approval.status !== 'PENDING') throw new NotFoundException('Pending action not found or expired');
    if (approval.requestedById && approval.requestedById !== userId) throw new ForbiddenException('This action belongs to another user');
    if (approval.expiresAt && approval.expiresAt < new Date()) {
      await this.prisma.approvalRequest.update({ where: { id: pendingActionId }, data: { status: 'EXPIRED' } });
      throw new NotFoundException('Pending action has expired');
    }

    const snapshot = approval.policySnapshot as any;
    const tool: string = snapshot?.tool || approval.entityId || '';
    const args: any = snapshot?.args || {};

    // Re-check permission at confirm time, not just when the action was queued — the
    // user's role/permissions may have changed in between.
    const perm = this.toolPermMap[tool];
    if (perm && !this.can(userRole, perm)) {
      await this.approvals.decide(approval.tenantId, pendingActionId, 'REJECTED', `Permission revoked (requires ${perm})`, userId, userRole);
      throw new ForbiddenException(`You no longer have permission to do this (requires ${perm})`);
    }

    // Mark approved before execution, so concurrent confirm requests can't double-execute.
    await this.approvals.decide(approval.tenantId, pendingActionId, 'APPROVED', undefined, userId, userRole);

    let result: any;
    switch (tool) {
      case 'send_message': {
        result = await this.conversationsService.create({
          leadId: args.leadId,
          channel: args.channel,
          text: args.text,
          direction: 'OUTBOUND',
        }, userId);
        break;
      }
      case 'bulk_send_message': {
        const messages: any[] = args.messages || [];
        const results: { leadId: string; status: 'success' | 'error'; error?: string }[] = [];
        for (const m of messages) {
          try {
            await this.conversationsService.create({
              leadId: m.leadId,
              channel: m.channel,
              text: m.text,
              direction: 'OUTBOUND',
            }, userId);
            results.push({ leadId: m.leadId, status: 'success' });
          } catch (err: any) {
            results.push({ leadId: m.leadId, status: 'error', error: err.message || 'Unknown error' });
          }
        }
        result = { sent: results.filter(r => r.status === 'success').length, failed: results.filter(r => r.status === 'error').length, results };
        break;
      }
      case 'create_campaign':
        result = await this.campaignsService.create(args);
        break;
      case 'initiate_call': {
        result = await this.telephonyService.initiateCall(args.leadId, userId);
        break;
      }
      case 'send_email': {
        result = await this.emailAdapter.send(args.to, args.subject, args.body);
        break;
      }
      case 'search_media': {
        const mediaRes = await this.prisma.mediaFile.findMany({
          where: {
            OR: [
              { originalName: { contains: args.query, mode: 'insensitive' } },
              { tags: { hasSome: [args.query] } },
              { fileName: { contains: args.query, mode: 'insensitive' } },
            ],
          },
          take: 10, orderBy: { createdAt: 'desc' },
          select: { id: true, originalName: true, fileType: true, mimeType: true, tags: true, createdAt: true },
        });
        result = { files: mediaRes, count: mediaRes.length };
        break;
      }
      case 'send_media': {
        const mediaFile = await this.prisma.mediaFile.findUnique({ where: { id: args.mediaId } });
        if (!mediaFile) throw new NotFoundException('Media file not found');
        const url = mediaFile.publicUrl || '';
        result = await this.conversationsService.create({
          leadId: args.leadId,
          channel: args.channel || 'WHATSAPP',
          text: args.caption || mediaFile.originalName,
          direction: 'OUTBOUND',
          metadata: { mediaUrl: url, mediaType: mediaFile.mimeType, caption: args.caption || mediaFile.originalName },
        }, userId);
        break;
      }
      default:
        throw new Error(`Unknown tool: ${tool}`);
    }

    const outcomeId = snapshot?.outcomeId;
    const stepId = snapshot?.stepId;
    if (outcomeId && stepId) {
      await this.outcomeEngine.updateStep(outcomeId, approval.tenantId, stepId, {
        status: 'completed',
        result: typeof result === 'string' ? result : JSON.stringify(result),
      });
      await this.outcomeEngine.setStatus(outcomeId, 'active');
      // Don't block the confirm response on the rest of the chain — it may hit
      // another approval gate further down and could take a while either way.
      this.runOutcome(outcomeId, userId, userRole, approval.tenantId).catch(err =>
        this.logger.error(`Resuming outcome ${outcomeId} after approval failed: ${err.message}`),
      );
    }

    return { status: 'success', result, tool, args };
  }

  /** Runs a Jarvis outcome's steps one at a time through the same chat()
   * tool-call pipeline a typed/spoken message goes through, so payment and
   * proposal actions still stop at the existing approval gate. Stops at the
   * first step that needs confirmation or the first failure; confirmAction()
   * resumes the chain once the gated step is approved. */
  async runOutcome(outcomeId: string, userId: string, userRole: string, tenantId: string) {
    let outcome = await this.outcomeEngine.getOutcome(outcomeId, tenantId);
    if (outcome.status !== 'active') return outcome;

    let conversationId = outcome.conversationId ?? undefined;

    // Hard cap so a bad decomposition (or a tool that keeps "succeeding" without
    // ever satisfying nextPendingStep) can't loop forever inside one request.
    let exhaustedCap = true;
    for (let i = 0; i < 25; i++) {
      const step = this.outcomeEngine.nextPendingStep(outcome);
      if (!step) {
        await this.outcomeEngine.setStatus(outcomeId, 'completed');
        exhaustedCap = false;
        break;
      }

      await this.outcomeEngine.updateStep(outcomeId, tenantId, step.id, { status: 'in_progress' });

      let chatResult: any;
      try {
        chatResult = await this.chat(userId, userRole, tenantId, step.description, conversationId, { outcomeId, stepId: step.id });
      } catch (err: any) {
        await this.outcomeEngine.updateStep(outcomeId, tenantId, step.id, { status: 'failed', result: err.message });
        await this.outcomeEngine.setStatus(outcomeId, 'failed');
        exhaustedCap = false;
        break;
      }

      if (!conversationId && chatResult.conversationId) {
        conversationId = chatResult.conversationId as string;
        await this.outcomeEngine.setConversationId(outcomeId, conversationId);
      }

      const pending = (chatResult.actions || []).some((a: any) => a.requiresConfirmation);
      if (pending) {
        await this.outcomeEngine.updateStep(outcomeId, tenantId, step.id, { result: chatResult.reply });
        await this.outcomeEngine.setStatus(outcomeId, 'awaiting_approval');
        exhaustedCap = false;
        break;
      }

      await this.outcomeEngine.updateStep(outcomeId, tenantId, step.id, { status: 'completed', result: chatResult.reply });
      outcome = await this.outcomeEngine.getOutcome(outcomeId, tenantId);
    }

    // Ran all 25 iterations without completing, failing, or hitting an approval
    // gate — surface it instead of leaving the outcome silently "active" forever.
    if (exhaustedCap) {
      await this.outcomeEngine.setStatus(outcomeId, 'failed');
    }

    return this.outcomeEngine.getOutcome(outcomeId, tenantId);
  }

  /** Defines a new Jarvis outcome and kicks off its steps in the background.
   * Runs can take 60-80s+ chaining several LLM calls — returning immediately
   * instead of awaiting the whole chain avoids client/proxy timeouts killing
   * the connection on a run that's actually still succeeding server-side.
   * The frontend polls getOutcome/listOutcomes to watch progress. */
  async startOutcome(
    userId: string,
    userRole: string,
    tenantId: string,
    params: { goal: string; metric: string; target: number; current: number },
  ) {
    const outcome = await this.outcomeEngine.defineOutcome({ tenantId, userId, ...params });
    this.runOutcome(outcome.id, userId, userRole, tenantId).catch(err =>
      this.logger.error(`Outcome ${outcome.id} run failed: ${err.message}`),
    );
    return outcome;
  }

  async listOutcomes(userId: string, tenantId: string) {
    return this.outcomeEngine.listOutcomes(tenantId, userId);
  }

  async getOutcome(id: string, tenantId: string) {
    return this.outcomeEngine.getOutcome(id, tenantId);
  }

  async cancelOutcome(id: string, userId: string, tenantId: string) {
    await this.outcomeEngine.cancelOutcome(id, tenantId, userId);
    return { status: 'cancelled' };
  }

  async getConversations(userId: string) {
    return this.prisma.copilotConversation.findMany({
      where: { userId }, orderBy: { updatedAt: 'desc' }, select: { id: true, title: true, updatedAt: true, createdAt: true },
    });
  }

  async getConversation(id: string, userId: string) {
    const conv = await this.prisma.copilotConversation.findUnique({
      where: { id }, include: { messages: { orderBy: { createdAt: 'asc' }, select: { id: true, role: true, content: true, toolCalls: true, createdAt: true } } },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.userId !== userId) throw new ForbiddenException();
    return conv;
  }
}

