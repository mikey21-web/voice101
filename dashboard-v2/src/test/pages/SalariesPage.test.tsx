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
  fetchPayroll: vi.fn().mockResolvedValue({
    employees: [{ id: 'u1', name: 'Priya Sharma', monthlySalary: 45000, salaryType: 'month' }],
    records: [
      { id: 'r1', user: { name: 'Priya Sharma' }, month: '2026-07', amount: 5000, type: 'ADVANCE' },
      { id: 'r2', user: { name: 'Priya Sharma' }, month: '2026-06', amount: 45000, type: 'SALARY' },
    ],
    totalMonthlyPayroll: 45000,
    onPayroll: 1,
  }),
  createSalaryRecord: vi.fn(),
}));

const SalariesPage = (await import('../../pages/SalariesPage')).default;

describe('SalariesPage', () => {
  it('renders heading and employee summary', async () => {
    render(<SalariesPage />, { wrapper: Wrapper });
    expect(await screen.findByText('Salaries')).toBeInTheDocument();
    expect((await screen.findAllByText('Priya Sharma')).length).toBeGreaterThan(0);
  });

  it('lists payroll entries with type badges and amounts', async () => {
    render(<SalariesPage />, { wrapper: Wrapper });
    expect(await screen.findByText('ADVANCE')).toBeInTheDocument();
    expect(await screen.findByText('SALARY')).toBeInTheDocument();
    expect(await screen.findByText('₹5,000')).toBeInTheDocument();
  });
});
