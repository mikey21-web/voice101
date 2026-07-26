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

const PaymentSchedulesPage = (await import('../../pages/PaymentSchedulesPage')).default;

const mockSchedules = [
  { id: '1', leadId: 'lead-1', lead: { contact: { name: 'John Doe' } }, label: 'Booking Amount', amount: 500000, currency: 'INR', dueDate: '2024-02-15', status: 'PENDING' },
  { id: '2', leadId: 'lead-1', lead: { contact: { name: 'John Doe' } }, label: 'Registration', amount: 250000, currency: 'INR', dueDate: '2024-03-01', status: 'PAID' },
];

describe('PaymentSchedulesPage', () => {
  beforeEach(() => {
    vi.mocked(api).mockImplementation((path: string) => {
      if (path.includes('/payment-schedules')) return Promise.resolve(mockSchedules);
      return Promise.resolve([]);
    });
  });

  it('shows loading text initially', () => {
    render(<PaymentSchedulesPage />, { wrapper: Wrapper });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders Payments & Collections heading after data loads', async () => {
    render(<PaymentSchedulesPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Payments & Collections')).toBeInTheDocument();
    });
  });

  it('renders status filter dropdown with All Status default', async () => {
    render(<PaymentSchedulesPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('All Status')).toBeInTheDocument();
    });
  });

  it('loads and displays schedules in the table', async () => {
    render(<PaymentSchedulesPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Booking Amount')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    expect(await screen.findByText('Registration')).toBeInTheDocument();
    const paidElements = await screen.findAllByText('Paid');
    expect(paidElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows Add Milestone button', async () => {
    render(<PaymentSchedulesPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Add Milestone')).toBeInTheDocument();
    });
  });

  it('groups milestones by buyer and shows a collection progress percentage', async () => {
    render(<PaymentSchedulesPage />, { wrapper: Wrapper });
    // ₹2.5L paid of ₹7.5L total = 33%
    expect(await screen.findByText(/33%/)).toBeInTheDocument();
  });
});
