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
  fetchInvoices: vi.fn().mockResolvedValue({ data: [
    { id: '1', invoiceNumber: 'INV-001', contact: { name: 'Client A' }, grandTotal: 59000, status: 'SENT' },
    { id: '2', invoiceNumber: 'INV-002', contact: null, grandTotal: 120000, status: 'PAID' },
  ] }),
  fetchContacts: vi.fn().mockResolvedValue({ data: [] }),
  fetchProperties: vi.fn().mockResolvedValue({ data: [] }),
  fetchProjects: vi.fn().mockResolvedValue({ data: [] }),
  createInvoice: vi.fn(),
  updateInvoice: vi.fn(),
  getInvoicePdf: vi.fn(),
  sendInvoice: vi.fn(),
}));

const InvoicesPage = (await import('../../pages/InvoicesPage')).default;

describe('InvoicesPage', () => {
  it('renders Invoices heading', async () => {
    render(<InvoicesPage />, { wrapper: Wrapper });
    expect(await screen.findByText('Invoices')).toBeInTheDocument();
  });

  it('shows Create invoice button', async () => {
    render(<InvoicesPage />, { wrapper: Wrapper });
    expect(await screen.findByText('Create invoice')).toBeInTheDocument();
  });

  it('loads and displays invoices list with numbers, contacts, and statuses', async () => {
    render(<InvoicesPage />, { wrapper: Wrapper });
    expect(await screen.findByText('INV-001 — Client A')).toBeInTheDocument();
    expect(await screen.findByText('INV-002 — No customer linked')).toBeInTheDocument();
    expect(await screen.findByText('SENT')).toBeInTheDocument();
    expect(await screen.findByText('PAID')).toBeInTheDocument();
  });

  it('shows Mark paid button only for unpaid invoices', async () => {
    render(<InvoicesPage />, { wrapper: Wrapper });
    const markPaidButtons = await screen.findAllByText('Mark paid');
    expect(markPaidButtons).toHaveLength(1);
  });

  it('opens the invoice builder and computes the grand total live from line items', async () => {
    render(<InvoicesPage />, { wrapper: Wrapper });
    fireEvent.click(await screen.findByText('Create invoice'));

    fireEvent.change(screen.getByPlaceholderText('Qty'), { target: { value: '2' } });
    fireEvent.change(screen.getByPlaceholderText('Rate'), { target: { value: '500' } });
    fireEvent.change(screen.getByPlaceholderText('GST %'), { target: { value: '18' } });

    expect((await screen.findAllByText('₹1,000')).length).toBeGreaterThan(0); // line amount + subtotal
    expect(await screen.findByText('₹180')).toBeInTheDocument(); // gst total
    expect(await screen.findByText('₹1,180')).toBeInTheDocument(); // grand total
  });
});
