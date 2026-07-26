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

vi.mock('../../lib/api', () => ({
  api: vi.fn().mockResolvedValue({
    data: [
      { id: '1', description: 'Facebook ads', amount: 5000, category: 'Marketing & Ads', date: '2026-07-01', receiptMedia: { id: 'm1', publicUrl: '/uploads/receipt.pdf' } },
      { id: '2', description: 'Cab fare', amount: 800, category: 'Travel & Transport', date: '2026-07-02', receiptMedia: null },
    ],
  }),
  apiUpload: vi.fn(),
  resolveMediaUrl: (u: string) => `http://localhost${u}`,
}));

const MyExpensesPage = (await import('../../pages/MyExpensesPage')).default;

describe('MyExpensesPage', () => {
  it('renders heading and expense list', async () => {
    render(<MyExpensesPage />, { wrapper: Wrapper });
    expect(await screen.findByText('My Expenses')).toBeInTheDocument();
    expect(await screen.findByText('Facebook ads')).toBeInTheDocument();
    expect(await screen.findByText('Cab fare')).toBeInTheDocument();
  });

  it('shows a Receipt link only for expenses with an attached receipt', async () => {
    render(<MyExpensesPage />, { wrapper: Wrapper });
    const receiptLinks = await screen.findAllByText('Receipt');
    expect(receiptLinks).toHaveLength(1);
    expect(receiptLinks[0].closest('a')).toHaveAttribute('href', 'http://localhost/uploads/receipt.pdf');
  });

  it('computes total expenses across all entries', async () => {
    render(<MyExpensesPage />, { wrapper: Wrapper });
    // both dates fall in the current month, so this also equals "This Month" — assert at least one match
    expect((await screen.findAllByText('₹5,800')).length).toBeGreaterThan(0);
  });
});
