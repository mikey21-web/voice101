import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppContext, type NicheConfig } from '../../context/AppContext';
import { vi } from 'vitest';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});

const mockNiche: NicheConfig = {
  industry: 'healthcare',
  display_name: 'Health Clinic',
  fields_to_collect: [],
  scoring_signals: [],
  conversion_goals: ['Book consultation'],
  pipeline_stages: [],
  booking_types: [],
  tone_examples: [],
  labels: { lead: 'Patient' },
  compliance: [],
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContext.Provider value={{ niche: mockNiche, loading: false, isSuperAdmin: false, isClientUser: false }}>
        {children}
      </AppContext.Provider>
    </QueryClientProvider>
  );
}

vi.mock('../../lib/data', () => ({
  fetchAnalytics: vi.fn().mockResolvedValue({
    total: 100, hot: 20, converted: 10, conversionRate: 10,
  }),
  fetchHealth: vi.fn().mockResolvedValue({
    status: 'ok', checks: { database: 'connected' },
  }),
  fetchFailures: vi.fn().mockResolvedValue([]),
}));

// OverviewPage fetches the Mikey daily brief itself (api('/mikey/daily-brief'))
// and auto-speaks it (api('/copilot/speak')) as soon as it loads — both go
// through the real fetch()-backed api() helper, which has no network to reach
// in a test environment. Mocking the module directly avoids the "fetch
// failed" error state and the auto-speak call sitting unresolved.
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: vi.fn().mockImplementation((path: string) => {
      if (path === '/mikey/daily-brief') {
        return Promise.resolve({
          date: '2026-07-30',
          summary: { newLeadsYesterday: 0, newLeadsToday: 0, hotLeads: 0, totalLeads: 0, slowAgents: [] },
          sources: [],
          revenueAtRisk: { totalPaise: 0, overdueCollectionsPaise: 0, bookingsAtRisk: 0, currency: 'INR' },
          readyForBooking: [],
          channelConflicts: [],
          pendingApprovals: { count: 0, items: [] },
          todayVisits: [],
        });
      }
      return Promise.resolve({});
    }),
  };
});

// Dynamic import after mock
const OverviewPage = (await import('../../pages/OverviewPage')).default;

describe('OverviewPage', () => {
  beforeEach(() => {
    // useAuth() reads the logged-in user synchronously from sessionStorage —
    // no network call needed to seed the greeting's first name.
    sessionStorage.setItem('user', JSON.stringify({ id: 'u1', email: 'priya@test.com', name: 'Priya', role: 'OWNER', tenantId: 't1' }));
  });

  it('renders loading skeleton initially when no data', () => {
    const { container } = render(<OverviewPage />, { wrapper: Wrapper });
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders the personalized greeting once the daily brief loads', async () => {
    render(<OverviewPage />, { wrapper: Wrapper });
    // Scoped to the h1 specifically — "Priya" also appears as a mocked
    // property agent's name elsewhere on the page.
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Priya');
    });
  });
});
