import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CopilotService } from './copilot.service';
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

// chat() no longer runs an in-process OpenAI tool-loop — it delegates all reasoning
// and tool execution to the Python agent-service over HTTP (POST /agent/copilot/chat),
// and only relays back whatever `{ response, actions }` that call returns. The one
// thing that still runs in NestJS is confirmAction() — executing a high-impact action
// once a human approves it. These tests mock global fetch instead of an OpenAI client.
function pythonResponse(response: string, actions: any[] = []) {
  return {
    ok: true,
    json: async () => ({ response, actions }),
  } as Response;
}

// chatStream() reads agent-service's reply as SSE frames instead of one JSON blob —
// this fakes the ReadableStream reader with each string already in wire format
// ("data: {...}\n\n"), split however the caller wants to simulate chunking arriving
// mid-frame across multiple reads.
function pythonStreamResponse(frames: string[]) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => {
          if (i < frames.length) return { value: encoder.encode(frames[i++]), done: false };
          return { value: undefined, done: true };
        },
      }),
    },
  } as any as Response;
}

function sseFrame(msg: any): string {
  return `data: ${JSON.stringify(msg)}\n\n`;
}

describe('CopilotService', () => {
  let service: CopilotService;
  let prisma: any;
  let conversationsService: any;
  let featureFlags: any;
  let memoryService: any;
  let fetchMock: jest.Mock;
  let originalFetch: typeof global.fetch;

  const mockConversation = { id: 'conv-1', messages: [] };

  // In-memory approvalRequest store so approvals.request()/prisma.approvalRequest.*
  // compose the same way they do against the real DB (create then read/update by id).
  let approvalStore: Map<string, any>;
  let approvalSeq: number;

  beforeEach(async () => {
    approvalStore = new Map();
    approvalSeq = 0;
    prisma = {
      copilotConversation: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(mockConversation),
      },
      copilotMessage: { create: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(0) },
      businessSettings: { findFirst: jest.fn().mockResolvedValue(null) },
      jarvisOutcome: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findUnique: jest.fn() },
      approvalRequest: {
        findUnique: jest.fn(({ where: { id } }: any) => Promise.resolve(approvalStore.get(id) ?? null)),
        update: jest.fn(({ where: { id }, data }: any) => {
          const updated = { ...approvalStore.get(id), ...data };
          approvalStore.set(id, updated);
          return Promise.resolve(updated);
        }),
      },
    };
    conversationsService = { create: jest.fn().mockResolvedValue({}) };
    featureFlags = { isEnabledDefault: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopilotService,
        { provide: ConfigService, useValue: { get: jest.fn((k: string) => (k === 'DEEPSEEK_API_KEY' ? 'fake-key' : '')) } },
        { provide: PrismaService, useValue: prisma },
        { provide: LeadsService, useValue: { findAll: jest.fn(), update: jest.fn() } },
        { provide: TasksService, useValue: {} },
        { provide: TicketsService, useValue: {} },
        { provide: CampaignsService, useValue: {} },
        { provide: ConversationsService, useValue: conversationsService },
        { provide: ReportsService, useValue: {} },
        { provide: CustomFieldsService, useValue: {} },
        { provide: TelephonyService, useValue: { initiateCall: jest.fn() } },
        { provide: EmailAdapter, useValue: { send: jest.fn() } },
        { provide: FeatureFlagsService, useValue: featureFlags },
        { provide: AnalyticsService, useValue: { sourceInsight: jest.fn() } },
        { provide: ContactsService, useValue: { findAll: jest.fn() } },
        { provide: KhojClientService, useValue: { query: jest.fn().mockResolvedValue(null) } },
        { provide: MikeyService, useValue: { runAutonomousAction: jest.fn() } },
        { provide: OutcomeEngineService, useValue: { defineOutcome: jest.fn() } },
        {
          provide: MemoryService,
          useValue: (memoryService = {
            recallRecent: jest.fn().mockResolvedValue([]),
            getRelevantRules: jest.fn().mockResolvedValue([]),
            applyRule: jest.fn().mockResolvedValue({}),
          }),
        },
        {
          provide: ApprovalsService,
          useValue: {
            request: jest.fn((tenantId: string, data: any) => {
              const id = `pa_${++approvalSeq}`;
              const approval = { id, tenantId, status: 'PENDING', ...data };
              approvalStore.set(id, approval);
              return Promise.resolve(approval);
            }),
            decide: jest.fn((tenantId: string, id: string, decision: string) => {
              const updated = { ...approvalStore.get(id), status: decision === 'APPROVED' ? 'APPROVED' : 'REJECTED' };
              approvalStore.set(id, updated);
              return Promise.resolve(updated);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CopilotService>(CopilotService);

    originalFetch = global.fetch;
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('kill-switch and usage cap guardrails', () => {
    it('refuses to run when the copilot_enabled flag has been explicitly disabled', async () => {
      featureFlags.isEnabledDefault.mockResolvedValue(false);
      await expect(
        service.chat('user-1', 'SALES_AGENT', 'default-tenant', 'show me leads'),
      ).rejects.toThrow('temporarily disabled');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('defaults to enabled when the flag has never been set (fail open, not closed)', async () => {
      fetchMock.mockResolvedValueOnce(pythonResponse('ok'));
      await service.chat('user-1', 'SALES_AGENT', 'default-tenant', 'hello');
      expect(featureFlags.isEnabledDefault).toHaveBeenCalledWith('copilot_enabled', true);
      expect(fetchMock).toHaveBeenCalled();
    });

    it('refuses to run once the tenant has hit its daily message cap', async () => {
      prisma.copilotMessage.count.mockResolvedValue(500);
      await expect(
        service.chat('user-1', 'SALES_AGENT', 'default-tenant', 'show me leads'),
      ).rejects.toThrow('daily usage limit');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('allows the request through when under the daily cap', async () => {
      prisma.copilotMessage.count.mockResolvedValue(499);
      fetchMock.mockResolvedValueOnce(pythonResponse('ok'));
      await service.chat('user-1', 'SALES_AGENT', 'default-tenant', 'hello');
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  describe('learned rules (closing the reflexion loop)', () => {
    it('surfaces active procedural rules to the agent-service as memoryContext and marks them applied', async () => {
      memoryService.getRelevantRules.mockResolvedValueOnce([
        { id: 'rule-1', rule: 'Send pricing within 5 minutes for hot leads', rationale: 'Converts 2x better' },
      ]);
      fetchMock.mockResolvedValueOnce(pythonResponse('ok'));
      await service.chat('user-1', 'SALES_AGENT', 'default-tenant', 'a hot lead just came in');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.memoryContext).toContain('Send pricing within 5 minutes for hot leads');
      expect(memoryService.applyRule).toHaveBeenCalledWith('rule-1');
    });

    it('leaves memoryContext untouched when no rules are relevant', async () => {
      fetchMock.mockResolvedValueOnce(pythonResponse('ok'));
      await service.chat('user-1', 'SALES_AGENT', 'default-tenant', 'hello');
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.memoryContext).toBe('');
      expect(memoryService.applyRule).not.toHaveBeenCalled();
    });
  });

  describe('resumeStuckOutcomes (checkpoint recovery)', () => {
    it('resumes an outcome whose step is stuck in_progress past the stall threshold', async () => {
      prisma.jarvisOutcome.findMany.mockResolvedValue([
        { id: 'outcome-1', tenantId: 'default-tenant', userId: 'user-1', steps: [{ id: 's1', status: 'in_progress' }] },
      ]);
      prisma.user.findUnique.mockResolvedValue({ role: 'SALES_AGENT' });
      const runOutcomeSpy = jest.spyOn(service, 'runOutcome').mockResolvedValue({} as any);

      await service.resumeStuckOutcomes();

      expect(runOutcomeSpy).toHaveBeenCalledWith('outcome-1', 'user-1', 'SALES_AGENT', 'default-tenant');
    });

    it('skips outcomes with no step stuck in_progress (e.g. legitimately still pending)', async () => {
      prisma.jarvisOutcome.findMany.mockResolvedValue([
        { id: 'outcome-2', tenantId: 'default-tenant', userId: 'user-1', steps: [{ id: 's1', status: 'pending' }] },
      ]);
      const runOutcomeSpy = jest.spyOn(service, 'runOutcome').mockResolvedValue({} as any);

      await service.resumeStuckOutcomes();

      expect(runOutcomeSpy).not.toHaveBeenCalled();
    });
  });

  describe('relaying results from the Python agent-service', () => {
    it('falls back to a friendly error when the agent-service call fails', async () => {
      fetchMock.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
      const result = await service.chat('user-1', 'SALES_AGENT', 'default-tenant', 'show me new leads');
      expect(result.reply).toContain('trouble connecting');
      expect(result.actions).toEqual([]);
    });

    it('relays a successful read-only action reported by the agent-service', async () => {
      fetchMock.mockResolvedValueOnce(
        pythonResponse('Found 1 lead.', [{ tool: 'search_leads', args: { status: 'NEW' }, status: 'success', result: '1 lead found' }]),
      );
      const result = await service.chat('user-1', 'SALES_AGENT', 'default-tenant', 'show me new leads');
      expect(result.actions[0].status).toBe('success');
      expect(result.actions[0].tool).toBe('search_leads');
    });

    it('relays an error action reported by the agent-service (e.g. a permission refusal)', async () => {
      fetchMock.mockResolvedValueOnce(
        pythonResponse('You do not have permission for that.', [{ tool: 'search_leads', args: {}, status: 'error', result: 'do not have permission' }]),
      );
      const result = await service.chat('user-1', 'VIEWER_WITHOUT_LEADS', 'default-tenant', 'show me new leads');
      expect(result.actions[0].status).toBe('error');
      expect(result.actions[0].result).toContain('do not have permission');
    });
  });

  describe('high-impact confirmation guardrail', () => {
    it('does not execute a high-impact tool immediately — marks it pending confirmation', async () => {
      fetchMock.mockResolvedValueOnce(
        pythonResponse('I will send this message, pending your confirmation.', [
          { tool: 'send_message', args: { leadId: 'lead-1', channel: 'WHATSAPP', text: 'hi' }, status: 'pending' },
        ]),
      );

      const result = await service.chat('user-1', 'SALES_AGENT', 'default-tenant', 'message lead-1 saying hi');

      expect(result.actions[0].status).toBe('pending');
      expect(result.actions[0].requiresConfirmation).toBe(true);
      expect(result.actions[0].pendingActionId).toMatch(/^pa_/);
    });

    it('only executes the high-impact tool after confirmAction is called', async () => {
      fetchMock.mockResolvedValueOnce(
        pythonResponse('Pending confirmation.', [
          { tool: 'send_message', args: { leadId: 'lead-1', channel: 'WHATSAPP', text: 'hi' }, status: 'pending' },
        ]),
      );

      const chatResult = await service.chat('user-1', 'SALES_AGENT', 'default-tenant', 'message lead-1 saying hi');
      const pendingActionId = chatResult.actions[0].pendingActionId;
      expect(pendingActionId).toBeTruthy();
      expect(conversationsService.create).not.toHaveBeenCalled();

      await service.confirmAction('user-1', 'SALES_AGENT', pendingActionId);
      expect(conversationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ leadId: 'lead-1', channel: 'WHATSAPP', text: 'hi', direction: 'OUTBOUND' }),
        'user-1',
      );
    });
  });

  describe('chatStream (Phase 2: streamed replies)', () => {
    it('relays token frames via onToken and resolves with the same shape chat() returns in one shot', async () => {
      fetchMock.mockResolvedValueOnce(pythonStreamResponse([
        sseFrame({ type: 'token', text: 'Found ' }),
        sseFrame({ type: 'token', text: '3 leads.' }),
        sseFrame({ type: 'done', response: 'Found 3 leads.', actions: [] }),
      ]));

      const tokens: string[] = [];
      const result = await service.chatStream('user-1', 'SALES_AGENT', 'default-tenant', 'how many leads', undefined, (t) => tokens.push(t));

      expect(tokens).toEqual(['Found ', '3 leads.']);
      expect(result.reply).toBe('Found 3 leads.');
      expect(result.actions).toEqual([]);
      expect(result.conversationId).toBe(mockConversation.id);
    });

    it('still opens an approval request for a pending high-impact action from the done frame', async () => {
      fetchMock.mockResolvedValueOnce(pythonStreamResponse([
        sseFrame({ type: 'token', text: 'Sending now.' }),
        sseFrame({
          type: 'done',
          response: 'Sending now.',
          actions: [{ tool: 'send_message', args: { leadId: 'lead-1', channel: 'WHATSAPP', text: 'hi' }, status: 'pending' }],
        }),
      ]));

      const result = await service.chatStream('user-1', 'SALES_AGENT', 'default-tenant', 'message lead-1', undefined, () => {});

      expect(result.actions[0].status).toBe('pending');
      expect(result.actions[0].requiresConfirmation).toBe(true);
      expect(result.actions[0].pendingActionId).toMatch(/^pa_/);
    });

    it('falls back to the friendly error message on a stream error frame', async () => {
      fetchMock.mockResolvedValueOnce(pythonStreamResponse([
        sseFrame({ type: 'error', message: 'DeepSeek timed out' }),
      ]));

      const result = await service.chatStream('user-1', 'SALES_AGENT', 'default-tenant', 'hello', undefined, () => {});
      expect(result.reply).toContain('trouble connecting');
    });

    it('a broken onToken callback does not abort accumulation or persistence', async () => {
      fetchMock.mockResolvedValueOnce(pythonStreamResponse([
        sseFrame({ type: 'token', text: 'Hi' }),
        sseFrame({ type: 'done', response: 'Hi there.', actions: [] }),
      ]));

      const result = await service.chatStream('user-1', 'SALES_AGENT', 'default-tenant', 'hi', undefined, () => { throw new Error('client gone'); });
      expect(result.reply).toBe('Hi there.');
    });

    it('barge-in: persists whatever text had streamed in before the reply was aborted', async () => {
      const abort = new AbortController();
      // First read delivers a token like a real stream would; the second read is
      // where a real aborted fetch's reader would reject — simulated the same way
      // here, with the abort firing right before it, matching what actually
      // happens when the frontend cancels mid-stream.
      let reads = 0;
      fetchMock.mockImplementationOnce(async () => {
        return {
          ok: true,
          body: {
            getReader: () => ({
              read: async () => {
                reads++;
                if (reads === 1) {
                  return { value: new TextEncoder().encode(sseFrame({ type: 'token', text: 'Let me check' })), done: false };
                }
                abort.abort();
                throw new DOMException('aborted', 'AbortError');
              },
            }),
          },
        } as any;
      });

      const result = await service.chatStream('user-1', 'SALES_AGENT', 'default-tenant', 'how many hot leads', undefined, () => {}, abort.signal);
      expect(result.reply).toBe('Let me check');
      expect(result.actions).toEqual([]);
    });

    it('barge-in before any text streamed persists nothing rather than a fake reply', async () => {
      const abort = new AbortController();
      abort.abort();
      fetchMock.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));

      const result = await service.chatStream('user-1', 'SALES_AGENT', 'default-tenant', 'hi', undefined, () => {}, abort.signal);
      expect(result.reply).toBe('');
    });
  });

  describe('confirmAction ownership + lifecycle', () => {
    it('throws NotFoundException for an unknown or expired pending action', async () => {
      await expect(service.confirmAction('user-1', 'SALES_AGENT', 'pa_does_not_exist')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when a different user tries to confirm someone else\'s pending action', async () => {
      fetchMock.mockResolvedValueOnce(
        pythonResponse('Pending confirmation.', [
          { tool: 'send_message', args: { leadId: 'lead-1', channel: 'WHATSAPP', text: 'hi' }, status: 'pending' },
        ]),
      );

      const chatResult = await service.chat('user-1', 'SALES_AGENT', 'default-tenant', 'message lead-1 saying hi');
      const pendingActionId = chatResult.actions[0].pendingActionId;

      await expect(service.confirmAction('someone-else', 'SALES_AGENT', pendingActionId)).rejects.toThrow(ForbiddenException);
    });

    it('removes the pending action after it is confirmed (cannot be double-executed)', async () => {
      fetchMock.mockResolvedValueOnce(
        pythonResponse('Pending confirmation.', [
          { tool: 'send_message', args: { leadId: 'lead-1', channel: 'WHATSAPP', text: 'hi' }, status: 'pending' },
        ]),
      );

      const chatResult = await service.chat('user-1', 'SALES_AGENT', 'default-tenant', 'message lead-1 saying hi');
      const pendingActionId = chatResult.actions[0].pendingActionId;

      await service.confirmAction('user-1', 'SALES_AGENT', pendingActionId);
      await expect(service.confirmAction('user-1', 'SALES_AGENT', pendingActionId)).rejects.toThrow(NotFoundException);
    });
  });
});
