import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppContext, type NicheConfig } from '../../context/AppContext';
import { vi } from 'vitest';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});

const mockNiche: NicheConfig = {
  industry: 'realestate',
  display_name: 'Real Estate',
  fields_to_collect: [],
  scoring_signals: [],
  conversion_goals: ['Book site visit'],
  pipeline_stages: [],
  booking_types: [],
  tone_examples: [],
  labels: { lead: 'Lead' },
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
  fetchProjects: vi.fn().mockResolvedValue({ data: [{ id: 'proj-1', name: 'Skyline Towers' }] }),
}));

vi.mock('../../lib/api', () => ({
  api: vi.fn().mockResolvedValue({
    projectId: 'proj-1',
    totalExpectedInflowsPaise: '10000000',
    totalExpectedOutflowsPaise: '4000000',
    netPositionPaise: '6000000',
    entries: [
      { id: 'e1', entryType: 'EXPECTED_COLLECTION', amountPaise: '10000000', sourceType: 'Booking milestone', expectedDate: '2026-08-01T00:00:00Z' },
    ],
    byMonth: [{ month: '2026-08', inflows: '10000000', outflows: '4000000' }],
  }),
}));

const CashFlowForecastPage = (await import('../../pages/CashFlowForecastPage')).default;

describe('CashFlowForecastPage', () => {
  it('renders heading and project picker', async () => {
    render(<CashFlowForecastPage />, { wrapper: Wrapper });
    expect(await screen.findByText('Cash Flow Forecasting')).toBeInTheDocument();
    expect(await screen.findByText('Skyline Towers')).toBeInTheDocument();
  });

  it('shows the expected inflow, outflow, and net position KPI cards from the summary', async () => {
    render(<CashFlowForecastPage />, { wrapper: Wrapper });
    expect((await screen.findAllByText('₹1,00,000')).length).toBeGreaterThan(0); // inflow KPI + monthly bar
    expect((await screen.findAllByText('₹40,000')).length).toBeGreaterThan(0); // outflow KPI + monthly bar
    expect(await screen.findByText('₹60,000')).toBeInTheDocument(); // net position (unique)
  });

  it('lists forecast entries with their source and amount', async () => {
    render(<CashFlowForecastPage />, { wrapper: Wrapper });
    expect(await screen.findByText(/Booking milestone/)).toBeInTheDocument();
  });
});
