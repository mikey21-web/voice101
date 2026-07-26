import { render, screen, waitFor } from '@testing-library/react';
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

vi.mock('../../lib/api', () => ({ api: vi.fn() }));

import { api } from '../../lib/api';

const CollectionsPage = (await import('../../pages/CollectionsPage')).default;

const mockReceipts = [
  { id: '1', receivedAt: '2024-01-15T10:00:00Z', leadId: 'L001', lead: { contact: { name: 'Ravi Kumar' } }, amountPaise: 5000000, mode: 'UPI', status: 'CONFIRMED' },
  { id: '2', receivedAt: '2024-01-20T14:30:00Z', leadId: 'L002', lead: null, amountPaise: 2500000, mode: 'NEFT', status: 'PENDING_RECONCILIATION' },
];

describe('CollectionsPage', () => {
  beforeEach(() => {
    vi.mocked(api).mockImplementation((path: string) => {
      if (path.includes('/collections/receipts')) return Promise.resolve({ data: mockReceipts });
      if (path.includes('/interest-policies')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
  });

  it('shows loading text initially', () => {
    render(<CollectionsPage />, { wrapper: Wrapper });
    expect(screen.getByText('Loading receipts...')).toBeInTheDocument();
  });

  it('renders Collections heading after data loads', async () => {
    render(<CollectionsPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Collections')).toBeInTheDocument();
    });
  });

  it('loads and displays receipts in the table', async () => {
    render(<CollectionsPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getAllByText('₹50,000').length).toBeGreaterThan(0); // row amount + confirmed KPI card
      expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
      expect(screen.getByText('PENDING RECONCILIATION')).toBeInTheDocument();
    });
  });

  it('shows Buy ledger lookup section with input and button', async () => {
    render(<CollectionsPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Buyer ledger lookup')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Lead ID')).toBeInTheDocument();
      expect(screen.getByText('Look up')).toBeInTheDocument();
    });
  });

  it('shows Record payment button', async () => {
    render(<CollectionsPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Record payment')).toBeInTheDocument();
    });
  });

  it('shows buyer name instead of raw lead id when available, falling back otherwise', async () => {
    render(<CollectionsPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
      expect(screen.getByText('L002')).toBeInTheDocument();
    });
  });

  it('shows KPI summary cards computed from receipt statuses', async () => {
    render(<CollectionsPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Confirmed collections')).toBeInTheDocument();
      expect(screen.getByText('Pending reconciliation')).toBeInTheDocument();
      expect(screen.getAllByText('₹25,000').length).toBeGreaterThan(0); // pending KPI + row amount
    });
  });
});
