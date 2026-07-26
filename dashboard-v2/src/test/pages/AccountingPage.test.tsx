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
  fetchTransactions: vi.fn().mockResolvedValue({ data: [{ id: '1', description: 'Sale', type: 'INCOME', amount: 50000 }] }),
  fetchInvoices: vi.fn().mockResolvedValue({ data: [{ id: '1', invoiceNumber: 'INV-001', contact: { name: 'Client A' }, grandTotal: 59000, status: 'SENT' }] }),
  fetchTaxReport: vi.fn().mockResolvedValue({ taxCollected: 10000, taxPaid: 5000, netPayable: 5000 }),
  fetchEventProfitability: vi.fn().mockResolvedValue([{ eventId: 'EVT-1', income: 100000, expenses: 40000, profit: 60000 }]),
  createTransaction: vi.fn(),
}));

const AccountingPage = (await import('../../pages/AccountingPage')).default;

describe('AccountingPage', () => {
  it('renders Accounting & Finance heading', async () => {
    render(<AccountingPage />, { wrapper: Wrapper });
    expect(await screen.findByText('Accounting & Finance')).toBeInTheDocument();
  });

  it('renders all 6 sub-tab buttons', async () => {
    render(<AccountingPage />, { wrapper: Wrapper });
    for (const tab of ['Transactions', 'Invoices', 'Receivables', 'Event Analytics', 'Tax', 'Reports']) {
      expect(await screen.findByText(tab)).toBeInTheDocument();
    }
  });

  it('renders Transactions tab data after load', async () => {
    render(<AccountingPage />, { wrapper: Wrapper });
    expect(await screen.findByText('Sale')).toBeInTheDocument();
    expect(await screen.findByText('+₹50,000')).toBeInTheDocument();
  });

  it('switches to Tax tab and shows tax report data', async () => {
    render(<AccountingPage />, { wrapper: Wrapper });
    fireEvent.click(await screen.findByText('Tax'));
    expect(await screen.findByText('Tax collected')).toBeInTheDocument();
    expect(await screen.findByText('₹10,000')).toBeInTheDocument();
    expect(await screen.findByText('Net payable')).toBeInTheDocument();
  });

  it('shows Add transaction button', async () => {
    render(<AccountingPage />, { wrapper: Wrapper });
    expect(await screen.findByText('Add transaction')).toBeInTheDocument();
  });

  it('shows an overview KPI strip with outstanding receivables from SENT invoices', async () => {
    render(<AccountingPage />, { wrapper: Wrapper });
    expect(await screen.findByText('Outstanding receivables')).toBeInTheDocument();
    // the single mocked SENT invoice has grandTotal 59000
    expect(await screen.findByText('₹59,000')).toBeInTheDocument();
  });
});
