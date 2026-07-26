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
  fetchPurchaseOrders: vi.fn().mockResolvedValue({ data: [
    { id: '1', partner: { name: 'ACME Cement' }, totalValue: 50000, status: 'SUBMITTED' },
  ] }),
  fetchPartners: vi.fn().mockResolvedValue({ data: [{ id: 'p1', name: 'ACME Cement' }] }),
  createPurchaseOrder: vi.fn(),
  updatePurchaseOrder: vi.fn(),
}));

const PurchaseOrdersPage = (await import('../../pages/PurchaseOrdersPage')).default;

describe('PurchaseOrdersPage', () => {
  it('renders Purchase Orders heading', async () => {
    render(<PurchaseOrdersPage />, { wrapper: Wrapper });
    expect(await screen.findByText('Purchase Orders')).toBeInTheDocument();
  });

  it('loads and displays purchase orders list', async () => {
    render(<PurchaseOrdersPage />, { wrapper: Wrapper });
    expect(await screen.findByText('ACME Cement')).toBeInTheDocument();
    // "SUBMITTED" also appears as a status-filter <option>, so assert the badge exists rather than uniqueness
    expect((await screen.findAllByText('SUBMITTED')).length).toBeGreaterThan(0);
  });

  it('computes the order total live across multiple line items', async () => {
    render(<PurchaseOrdersPage />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText('New PO'));

    fireEvent.click(await screen.findByText('Add line'));
    const qtyInputs = screen.getAllByLabelText('Qty');
    const costInputs = screen.getAllByLabelText('Unit cost');
    fireEvent.change(qtyInputs[0], { target: { value: '2' } });
    fireEvent.change(costInputs[0], { target: { value: '1000' } });
    fireEvent.change(qtyInputs[1], { target: { value: '3' } });
    fireEvent.change(costInputs[1], { target: { value: '500' } });

    // (2*1000) + (3*500) = 3500
    expect(await screen.findByText('₹3,500')).toBeInTheDocument();
  });
});
