import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
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


// chat() delegates all reasoning/tool execution to the Python agent-service over HTTP
// (POST /agent/copilot/chat) and just relays back `{ response, actions }`. Voice/nav
// commands like "show me leads" resolve to a `navigate_ui` action there — these tests
// mock global fetch to return that shape instead of mocking an OpenAI client directly.
function pythonResponse(response: string, actions: any[] = []) {
  return { ok: true, json: async () => ({ response, actions }) } as Response;
}

describe('CopilotService — voice command navigation', () => {
  let service: CopilotService;
  let fetchMock: jest.Mock;
  let originalFetch: typeof global.fetch;

  const mockPrisma = () => ({
    copilotMessage: {
      create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      count: jest.fn().mockResolvedValue(0),
    },
    copilotConversation: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'conv-1', messages: [] }),
    },
    businessSettings: {
      findFirst: jest.fn().mockResolvedValue({ businessName: 'TestBiz', industry: 'events' }),
    },
  });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopilotService,
        { provide: PrismaService, useValue: mockPrisma() },
        { provide: ConfigService, useValue: { get: jest.fn((k: string) => k === 'DEEPSEEK_API_KEY' ? 'sk-test' : undefined) } },
        { provide: LeadsService, useValue: { findAll: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue({ id: 'l1', contact: { name: 'Test' } }), update: jest.fn() } },
        { provide: TasksService, useValue: { create: jest.fn() } },
        { provide: TicketsService, useValue: { create: jest.fn(), findAll: jest.fn().mockResolvedValue([]), update: jest.fn() } },
        { provide: CampaignsService, useValue: { findAll: jest.fn().mockResolvedValue([]), create: jest.fn() } },
        { provide: ConversationsService, useValue: { create: jest.fn() } },
        { provide: ReportsService, useValue: { run: jest.fn() } },
        { provide: CustomFieldsService, useValue: { createDefinition: jest.fn() } },
        { provide: TelephonyService, useValue: { initiateCall: jest.fn() } },
        { provide: EmailAdapter, useValue: { send: jest.fn() } },
        { provide: FeatureFlagsService, useValue: { isEnabledDefault: jest.fn().mockResolvedValue(true) } },
        { provide: AnalyticsService, useValue: {} },
        { provide: ContactsService, useValue: { findAll: jest.fn().mockResolvedValue([]) } },
        { provide: KhojClientService, useValue: { query: jest.fn().mockResolvedValue(null) } },
        { provide: MikeyService, useValue: { runAutonomousAction: jest.fn(), getActionRules: jest.fn().mockReturnValue([]) } },
        { provide: OutcomeEngineService, useValue: { defineOutcome: jest.fn().mockResolvedValue({ id: 'o1', goal: 'test', steps: [] }) } },
        { provide: MemoryService, useValue: { recallRecent: jest.fn().mockResolvedValue([]) } },
        { provide: ApprovalsService, useValue: { request: jest.fn(), decide: jest.fn() } },
      ],
    }).compile();
    service = module.get<CopilotService>(CopilotService);
  });

  beforeEach(() => {
    originalFetch = global.fetch;
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('handles "show me leads" by calling navigate_ui', async () => {
    fetchMock.mockResolvedValueOnce(pythonResponse('Here are your leads', [
      { tool: 'navigate_ui', args: { page: 'leads', filters: { status: 'HOT' }, summary: 'Here are your leads' }, status: 'success' },
    ]));

    const result = await service.chat('user-1', 'ADMIN', 'tenant-1', 'show me leads');
    expect(result.actions).toBeDefined();
    expect(result.actions!.length).toBeGreaterThanOrEqual(1);
    const navAction = result.actions!.find((a: any) => a.tool === 'navigate_ui');
    expect(navAction).toBeDefined();
    expect(navAction.args.page).toBe('leads');
    expect(navAction.args.filters.status).toBe('HOT');
  });

  it('handles "show me hot leads" with status filter', async () => {
    fetchMock.mockResolvedValueOnce(pythonResponse('Showing hot leads.', [
      { tool: 'navigate_ui', args: { page: 'leads', filters: { status: 'HOT' }, summary: 'Displaying hot leads' }, status: 'success' },
    ]));

    const result = await service.chat('user-1', 'ADMIN', 'tenant-1', 'show me hot leads');
    expect(result.actions).toBeDefined();
    const navAction = result.actions!.find((a: any) => a.tool === 'navigate_ui');
    expect(navAction).toBeDefined();
    expect(navAction.args.page).toBe('leads');
  });

  it('handles "navigate to tickets" command', async () => {
    fetchMock.mockResolvedValueOnce(pythonResponse('Navigated to tickets.', [
      { tool: 'navigate_ui', args: { page: 'tickets', filters: { status: 'OPEN' }, summary: 'Showing open tickets' }, status: 'success' },
    ]));

    const result = await service.chat('user-1', 'ADMIN', 'tenant-1', 'navigate to tickets');
    const navAction = result.actions!.find((a: any) => a.tool === 'navigate_ui');
    expect(navAction).toBeDefined();
    expect(navAction.args.page).toBe('tickets');
  });

  it('returns text reply for non-navigation queries', async () => {
    fetchMock.mockResolvedValueOnce(pythonResponse('Your business has 12 hot leads and 3 open tickets.'));

    const result = await service.chat('user-1', 'ADMIN', 'tenant-1', 'what is my conversion rate');
    expect(result.reply).toBeDefined();
    expect(result.reply.length).toBeGreaterThan(0);
    // No navigation actions for non-nav queries
    const navAction = result.actions!.find((a: any) => a.tool === 'navigate_ui');
    expect(navAction).toBeUndefined();
  });
});
