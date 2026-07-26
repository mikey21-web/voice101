import { fireEvent, render, screen } from '@testing-library/react';
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
  fetchProfitAndLoss: vi.fn(),
  fetchCashFlow: vi.fn(),
  fetchBalanceSheet: vi.fn(),
  fetchTaxReport: vi.fn(),
  fetchVendorPaymentsReport: vi.fn(),
  fetchEventProfitability: vi.fn(),
}));

const FinanceReportsPage = (await import('../../pages/FinanceReportsPage')).default;

describe('FinanceReportsPage', () => {
  it('renders Financial Reports heading', () => {
    render(<FinanceReportsPage />, { wrapper: Wrapper });
    expect(screen.getByText('Financial Reports')).toBeInTheDocument();
  });

  it('shows click to download subtitle', () => {
    render(<FinanceReportsPage />, { wrapper: Wrapper });
    expect(screen.getByText('Click a report to download it as CSV')).toBeInTheDocument();
  });

  it('renders all 6 report cards', () => {
    render(<FinanceReportsPage />, { wrapper: Wrapper });
    for (const report of ['Profit & Loss', 'Cash Flow', 'Balance Sheet', 'Tax Reports', 'Vendor Payments', 'Event Profitability']) {
      expect(screen.getByText(report)).toBeInTheDocument();
    }
  });

  it('renders all report cards as enabled buttons', () => {
    render(<FinanceReportsPage />, { wrapper: Wrapper });
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(6);
    buttons.forEach(b => expect(b).not.toBeDisabled());
  });

  it('shows a last-downloaded timestamp only after a report has been run', async () => {
    const { fetchProfitAndLoss } = await import('../../lib/data');
    vi.mocked(fetchProfitAndLoss).mockResolvedValue({ income: 1000, expenses: 400, netProfit: 600 });

    render(<FinanceReportsPage />, { wrapper: Wrapper });
    expect(screen.queryByText(/Last downloaded/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Profit & Loss'));
    expect(await screen.findByText(/Last downloaded/)).toBeInTheDocument();
  });
});
