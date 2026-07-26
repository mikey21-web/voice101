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
  fetchContracts: vi.fn().mockResolvedValue({ data: [
    { id: '1', contractNumber: 'CT-001', amount: 5000000, status: 'SIGNED', contact: { name: 'Client A' } },
    { id: '2', contractNumber: 'CT-002', amount: 7500000, status: 'DRAFT', contact: null },
  ] }),
  fetchQuotations: vi.fn().mockResolvedValue({ data: [] }),
  fetchContacts: vi.fn().mockResolvedValue({ data: [] }),
  createContract: vi.fn(),
  updateContract: vi.fn(),
}));

const ContractsPage = (await import('../../pages/ContractsPage')).default;

describe('ContractsPage', () => {
  it('renders Contracts heading', async () => {
    render(<ContractsPage />, { wrapper: Wrapper });
    expect(await screen.findByText('Contracts')).toBeInTheDocument();
  });

  it('shows New contract button', async () => {
    render(<ContractsPage />, { wrapper: Wrapper });
    expect(await screen.findByText('New contract')).toBeInTheDocument();
  });

  it('loads and displays contracts list with numbers and statuses', async () => {
    render(<ContractsPage />, { wrapper: Wrapper });
    expect(await screen.findByText('CT-001 — Client A')).toBeInTheDocument();
    expect(await screen.findByText('CT-002 — No customer linked')).toBeInTheDocument();
    expect(await screen.findByText('SIGNED')).toBeInTheDocument();
    expect(await screen.findByText('DRAFT')).toBeInTheDocument();
  });

  it('shows Mark signed only for contracts not yet signed or cancelled', async () => {
    render(<ContractsPage />, { wrapper: Wrapper });
    const signButtons = await screen.findAllByText('Mark signed');
    expect(signButtons).toHaveLength(1);
  });
});
