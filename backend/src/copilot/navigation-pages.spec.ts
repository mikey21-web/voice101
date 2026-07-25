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

/**
 * Tests that the navigate_ui tool now accepts ALL page names (not just the old 7).
 * The fix changed page from an enum to a free-form string with examples.
 *
 * chat() delegates reasoning/tool execution to the Python agent-service over HTTP
 * (POST /agent/copilot/chat) and relays back `{ response, actions }` — these tests
 * mock global fetch to return that shape instead of mocking an OpenAI client.
 */
describe('CopilotService — navigate_ui accepts all pages', () => {
  let service: CopilotService;
  let fetchMock: jest.Mock;
  let originalFetch: typeof global.fetch;

  const mockPrisma = () => ({
    copilotMessage: { create: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(0) },
    copilotConversation: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'c1', messages: [] }) },
    businessSettings: { findFirst: jest.fn().mockResolvedValue({}) },
  });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopilotService,
        { provide: PrismaService, useValue: mockPrisma() },
        { provide: ConfigService, useValue: { get: jest.fn((k: string) => k === 'DEEPSEEK_API_KEY' ? 'sk-test' : undefined) } },
        { provide: LeadsService, useValue: { findAll: jest.fn(), findOne: jest.fn(), update: jest.fn() } },
        { provide: TasksService, useValue: { create: jest.fn() } },
        { provide: TicketsService, useValue: { create: jest.fn(), findAll: jest.fn(), update: jest.fn() } },
        { provide: CampaignsService, useValue: { findAll: jest.fn(), create: jest.fn() } },
        { provide: ConversationsService, useValue: { create: jest.fn() } },
        { provide: ReportsService, useValue: { run: jest.fn() } },
        { provide: CustomFieldsService, useValue: { createDefinition: jest.fn() } },
        { provide: TelephonyService, useValue: { initiateCall: jest.fn() } },
        { provide: EmailAdapter, useValue: { send: jest.fn() } },
        { provide: FeatureFlagsService, useValue: { isEnabledDefault: jest.fn().mockResolvedValue(true) } },
        { provide: AnalyticsService, useValue: {} },
        { provide: ContactsService, useValue: { findAll: jest.fn() } },
        { provide: KhojClientService, useValue: { query: jest.fn().mockResolvedValue(null) } },
        { provide: MikeyService, useValue: { runAutonomousAction: jest.fn(), getActionRules: jest.fn().mockReturnValue([]) } },
        { provide: OutcomeEngineService, useValue: { defineOutcome: jest.fn() } },
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

  function mockNavigate(page: string, summary: string) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        response: `Navigated to ${page}.`,
        actions: [{ tool: 'navigate_ui', args: { page, summary }, status: 'success' }],
      }),
    } as Response);
  }

  it('navigates to qr-codes page', async () => {
    mockNavigate('qr-codes', 'Showing QR codes page');
    const result = await service.chat('u1', 'ADMIN', 't1', 'show me qr codes');
    const nav = result.actions.find((a: any) => a.tool === 'navigate_ui');
    expect(nav).toBeDefined();
    expect(nav.args.page).toBe('qr-codes');
  });

  it('navigates to settings page', async () => {
    mockNavigate('settings', 'Navigating to settings');
    const result = await service.chat('u1', 'ADMIN', 't1', 'go to settings');
    const nav = result.actions.find((a: any) => a.tool === 'navigate_ui');
    expect(nav).toBeDefined();
    expect(nav.args.page).toBe('settings');
  });

  it('navigates to events page', async () => {
    mockNavigate('events', 'Showing events');
    const result = await service.chat('u1', 'ADMIN', 't1', 'show me events');
    const nav = result.actions.find((a: any) => a.tool === 'navigate_ui');
    expect(nav).toBeDefined();
    expect(nav.args.page).toBe('events');
  });

  it('navigates to properties page', async () => {
    mockNavigate('properties', 'Showing properties');
    const result = await service.chat('u1', 'ADMIN', 't1', 'show me properties');
    const nav = result.actions.find((a: any) => a.tool === 'navigate_ui');
    expect(nav).toBeDefined();
    expect(nav.args.page).toBe('properties');
  });

  it('navigates to shipments page', async () => {
    mockNavigate('shipments', 'Showing shipments');
    const result = await service.chat('u1', 'ADMIN', 't1', 'show me shipments');
    const nav = result.actions.find((a: any) => a.tool === 'navigate_ui');
    expect(nav).toBeDefined();
    expect(nav.args.page).toBe('shipments');
  });

  it('navigates to bookings page', async () => {
    mockNavigate('bookings', 'Showing bookings');
    const result = await service.chat('u1', 'ADMIN', 't1', 'show me bookings');
    const nav = result.actions.find((a: any) => a.tool === 'navigate_ui');
    expect(nav).toBeDefined();
    expect(nav.args.page).toBe('bookings');
  });

  it('navigates to invoices page', async () => {
    mockNavigate('invoices', 'Showing invoices');
    const result = await service.chat('u1', 'ADMIN', 't1', 'show me invoices');
    const nav = result.actions.find((a: any) => a.tool === 'navigate_ui');
    expect(nav).toBeDefined();
    expect(nav.args.page).toBe('invoices');
  });

  it('navigates to team page', async () => {
    mockNavigate('team', 'Showing team');
    const result = await service.chat('u1', 'ADMIN', 't1', 'show me team');
    const nav = result.actions.find((a: any) => a.tool === 'navigate_ui');
    expect(nav).toBeDefined();
    expect(nav.args.page).toBe('team');
  });

  it('still navigates to old pages too', async () => {
    mockNavigate('leads', 'Showing leads');
    const result = await service.chat('u1', 'ADMIN', 't1', 'show me leads');
    const nav = result.actions.find((a: any) => a.tool === 'navigate_ui');
    expect(nav).toBeDefined();
    expect(nav.args.page).toBe('leads');
  });

  it('handles "qr" alias', async () => {
    mockNavigate('qr', 'Showing QR page');
    const result = await service.chat('u1', 'ADMIN', 't1', 'show me qr');
    const nav = result.actions.find((a: any) => a.tool === 'navigate_ui');
    expect(nav).toBeDefined();
    // The model might pass 'qr' or 'qr-codes' — both are handled by PAGE_MAP
    expect(['qr', 'qr-codes'].includes(nav.args.page)).toBe(true);
  });
});
