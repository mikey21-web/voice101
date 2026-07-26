import { render, screen, fireEvent } from '@testing-library/react';
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
  fetchQuotations: vi.fn(),
  fetchContacts: vi.fn().mockResolvedValue({ data: [] }),
  fetchProperties: vi.fn().mockResolvedValue({ data: [] }),
  fetchProjects: vi.fn().mockResolvedValue({ data: [] }),
  createQuotation: vi.fn(),
}));

import { fetchQuotations } from '../../lib/data';

const QuotationsPage = (await import('../../pages/QuotationsPage')).default;

const mockQuotations = [
  { id: '1', quoteNumber: 'Q-001', contact: { name: 'Client A' }, status: 'SENT', sections: [{ lineItems: [{ total: 50000 }] }] },
  { id: '2', quoteNumber: 'Q-002', contact: null, status: 'DRAFT', sections: [] },
];

describe('QuotationsPage', () => {
  beforeEach(() => {
    vi.mocked(fetchQuotations).mockResolvedValue({ data: mockQuotations });
  });

  it('renders Quotations heading', async () => {
    render(<QuotationsPage />, { wrapper: Wrapper });
    expect(await screen.findByText('Quotations')).toBeInTheDocument();
  });

  it('shows New quotation button', async () => {
    render(<QuotationsPage />, { wrapper: Wrapper });
    expect(await screen.findByText('New quotation')).toBeInTheDocument();
  });

  it('loads and displays quotations list', async () => {
    render(<QuotationsPage />, { wrapper: Wrapper });
    expect(await screen.findByText('Q-001 — Client A')).toBeInTheDocument();
    expect(await screen.findByText('Q-002 — Not selected')).toBeInTheDocument();
    expect(await screen.findByText('SENT')).toBeInTheDocument();
    expect(await screen.findByText('DRAFT')).toBeInTheDocument();
  });

  it('shows empty state when no quotations exist', async () => {
    vi.mocked(fetchQuotations).mockResolvedValue({ data: [] });
    render(<QuotationsPage />, { wrapper: Wrapper });
    expect(await screen.findByText('No quotations yet.')).toBeInTheDocument();
  });

  it('opens the quotation builder and computes the grand total live from section line items', async () => {
    render(<QuotationsPage />, { wrapper: Wrapper });
    fireEvent.click(await screen.findByText('New quotation'));

    fireEvent.change(screen.getByPlaceholderText('Qty'), { target: { value: '3' } });
    fireEvent.change(screen.getByPlaceholderText('Unit price'), { target: { value: '200' } });

    expect((await screen.findAllByText('₹600')).length).toBeGreaterThan(0); // line amount + grand total
  });
});
