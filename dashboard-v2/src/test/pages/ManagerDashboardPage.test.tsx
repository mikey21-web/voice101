import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from '../../lib/useAuth';
import { api } from '../../lib/api';

vi.mock('../../lib/useAuth', () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: 'u1', role: 'MANAGER', name: 'Manager', email: 'm@t.com', tenantId: 't1' },
    login: vi.fn(), logout: vi.fn(), fetchProfile: vi.fn(), loading: false, isLoggedIn: true,
  }),
}));

vi.mock('../../lib/api', () => ({
  api: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

const mockData = {
  agentResponse: [
    {
      agentId: 'a1', name: 'Alice Smith',
      avgFirstResponseMinutes: 12, medianFirstResponseMinutes: 8,
      leadsAssigned: 50, leadsResponded: 45,
      responseRate: 90, untouchedLeadCount: 0,
    },
    {
      agentId: 'a2', name: 'Bob Jones',
      avgFirstResponseMinutes: 45, medianFirstResponseMinutes: 30,
      leadsAssigned: 40, leadsResponded: 20,
      responseRate: 50, untouchedLeadCount: 3,
    },
  ],
  overdue: [
    {
      agentId: 'a1', name: 'Alice Smith',
      overdueTaskCount: 2, leadsStaleCount: 0,
      overdueSiteVisits: 1, totalOverdue: 3,
    },
  ],
  visitConv: [
    {
      agentId: 'a1', name: 'Alice Smith',
      siteVisitsScheduled: 20, siteVisitsCompleted: 18,
      noShowCount: 2, bookingsAfterVisit: 12,
      visitToBookRate: 67, showRate: 90,
    },
  ],
  sourceRoi: [
    {
      source: 'Google Ads', totalLeads: 200, convertedLeads: 40,
      conversionRate: 20, totalSpend: 5000,
      costPerLead: 25, revenue: 150000, roi: 2900,
    },
  ],
  brokerRanks: [
    {
      brokerId: 'b1', brokerName: 'Acme Realty',
      totalLeads: 30, convertedLeads: 10,
      conversionRate: 33, totalDealValue: 500000,
      commissionRate: 3, commissionOwed: 15000,
    },
  ],
};

const ManagerDashboardPage = (await import('../../pages/ManagerDashboardPage')).default;

describe('ManagerDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    vi.mocked(api).mockImplementation((path: string) => {
      const map: Record<string, unknown> = {
        '/analytics/agent-response-times': mockData.agentResponse,
        '/analytics/agent-overdue-followups': mockData.overdue,
        '/analytics/agent-visit-conversion': mockData.visitConv,
        '/analytics/source-roi': mockData.sourceRoi,
        '/analytics/broker-rankings': mockData.brokerRanks,
      };
      return Promise.resolve(map[path] ?? []);
    });
    vi.mocked(useAuth).mockReset();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', role: 'MANAGER', name: 'Manager', email: 'm@t.com', tenantId: 't1' },
      login: vi.fn(), logout: vi.fn(), fetchProfile: vi.fn(), loading: false, isLoggedIn: true,
    });
  });

  it('renders "Manager Dashboard" heading', async () => {
    render(<ManagerDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Manager Dashboard')).toBeInTheDocument();
    });
  });

  it('renders all 5 tab buttons', () => {
    render(<ManagerDashboardPage />);
    expect(screen.getByText('Agent Response')).toBeInTheDocument();
    expect(screen.getByText('Overdue Follow-ups')).toBeInTheDocument();
    expect(screen.getByText('Visit Conversion')).toBeInTheDocument();
    expect(screen.getByText('Source ROI')).toBeInTheDocument();
    expect(screen.getByText('Broker Rankings')).toBeInTheDocument();
  });

  it('shows permission error for non-OWNER/ADMIN/MANAGER roles', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u2', role: 'SALES_AGENT', name: 'Agent', email: 'a@t.com', tenantId: 't1' },
      login: vi.fn(), logout: vi.fn(), fetchProfile: vi.fn(), loading: false, isLoggedIn: true,
    });
    render(<ManagerDashboardPage />);
    expect(screen.getByText('You do not have permission to view this page.')).toBeInTheDocument();
  });

  it('shows content for MANAGER role', async () => {
    render(<ManagerDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Manager Dashboard')).toBeInTheDocument();
    });
  });

  it('loads and displays Agent Response table', async () => {
    render(<ManagerDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/Agent Response Times/)).toBeInTheDocument();
    });
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('Avg Resp (min)')).toBeInTheDocument();
    expect(screen.getByText('Median (min)')).toBeInTheDocument();
    expect(screen.getByText('Untouched')).toBeInTheDocument();
  });

  it('loads and displays Overdue Follow-ups table', async () => {
    render(<ManagerDashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /Overdue Follow-ups/ }));
    await waitFor(() => {
      expect(screen.getByText(/Overdue Follow-ups \(sorted by total descending\)/)).toBeInTheDocument();
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });
    expect(screen.getByText('Overdue Tasks')).toBeInTheDocument();
    expect(screen.getByText('Stale Hot Leads')).toBeInTheDocument();
  });

  it('loads and displays Visit Conversion table', async () => {
    render(<ManagerDashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /Visit Conversion/ }));
    await waitFor(() => {
      expect(screen.getByText(/Visit-to-Booking Conversion/)).toBeInTheDocument();
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });
    expect(screen.getByText('Show Rate')).toBeInTheDocument();
    expect(screen.getByText('Visit→Book')).toBeInTheDocument();
  });

  it('loads and displays Source ROI table', async () => {
    render(<ManagerDashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /Source ROI/ }));
    await waitFor(() => {
      expect(screen.getByText(/Source ROI Breakdown/)).toBeInTheDocument();
      expect(screen.getByText('Google Ads')).toBeInTheDocument();
    });
    expect(screen.getByText('CPL')).toBeInTheDocument();
    expect(screen.getByText('ROI')).toBeInTheDocument();
  });

  it('loads and displays Broker Rankings table', async () => {
    render(<ManagerDashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /Broker Rankings/ }));
    await waitFor(() => {
      expect(screen.getByText(/Broker Rankings \(sorted by conversion rate descending\)/)).toBeInTheDocument();
      expect(screen.getByText('Acme Realty')).toBeInTheDocument();
    });
    expect(screen.getByText('Comm Rate')).toBeInTheDocument();
    expect(screen.getByText('Commission Owed')).toBeInTheDocument();
  });

  it('shows loading skeleton while data loads', () => {
    const { container } = render(<ManagerDashboardPage />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('tab switching: click "Source ROI" tab, verify it renders Source ROI content', async () => {
    render(<ManagerDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/Agent Response Times/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Source ROI/ }));
    await waitFor(() => {
      expect(screen.getByText(/Source ROI Breakdown/)).toBeInTheDocument();
    });
  });
});
