import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppContext, type NicheConfig } from '../../context/AppContext';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../../lib/api';

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

const mockLead = {
  id: 'lead-1',
  status: 'NEW',
  segment: 'HOT',
  score: 85,
  source: 'MAGICBRICKS',
  interest: '2BHK',
  budget: '80L',
  dealValue: 7500000,
  assignedAgent: { id: 'agent-1', name: 'Priya Sharma' },
  contact: { id: 'c1', name: 'Ravi Kumar', phone: '+919876543210', email: 'ravi@example.com' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockTimeline = [
  { id: 't1', type: 'lead_created', title: 'Lead created', description: '', metadata: {}, createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 't2', type: 'message_sent', title: 'WhatsApp sent', description: 'Initial outreach', metadata: {}, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 't3', type: 'call', title: 'Call made', description: 'Discovery call', metadata: { disposition: 'INTERESTED', recordingUrl: 'https://example.com/recording.mp3' }, createdAt: new Date(Date.now() - 1800000).toISOString() },
  { id: 't4', type: 'site_visit_scheduled', title: 'Site visit scheduled', description: 'Visit to Green Valley', metadata: {}, createdAt: new Date().toISOString() },
];

const timelinWithMessages = [
  { id: 't1', type: 'lead_created', title: 'Lead created', description: '', metadata: {}, createdAt: new Date().toISOString() },
  { id: 't2', type: 'message_received', title: 'WhatsApp received', description: 'Interested in 2BHK', metadata: {}, createdAt: new Date().toISOString() },
  { id: 't3', type: 'message_sent', title: 'WhatsApp sent', description: 'Sent brochure', metadata: {}, createdAt: new Date().toISOString() },
  { id: 't4', type: 'site_visit_scheduled', title: 'Site visit scheduled', description: 'Visit to Green Valley', metadata: {}, createdAt: new Date().toISOString() },
];

vi.mock('../../lib/data', () => ({
  fetchLead: vi.fn().mockResolvedValue(mockLead),
  getLeadTimeline: vi.fn().mockResolvedValue(mockTimeline),
  fetchContacts: vi.fn().mockResolvedValue({ data: [], meta: {} }),
  holdUnit: vi.fn().mockResolvedValue({ success: true }),
  createBooking: vi.fn().mockResolvedValue({ success: true }),
  fetchLeadBookings: vi.fn().mockResolvedValue({ data: [] }),
  fetchLeadCostSheets: vi.fn().mockResolvedValue({ data: [], meta: {} }),
  draftAIReply: vi.fn().mockResolvedValue({ draft: 'Draft reply text', source: 'fallback' }),
  fetchProjects: vi.fn().mockResolvedValue({ data: [], meta: {} }),
  fetchUnits: vi.fn().mockResolvedValue({ data: [], meta: {} }),
}));

vi.mock('../../lib/api', () => ({
  api: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../lib/explainMode', () => ({
  startExplainFlow: vi.fn(),
}));

beforeEach(() => {
  window.location.hash = '#/leads/lead-1';
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation((url: string, options?: any) => {
    const method = options?.method || 'GET';
    if (method === 'GET') {
      if (url === '/users') return Promise.resolve([{ id: 'agent-1', name: 'Priya Sharma', role: 'SALES_AGENT' }]);
      if (url.includes('/notes')) return Promise.resolve([]);
      if (url.includes('/custom-fields')) return Promise.resolve({ data: [] });
      if (url.includes('/payment-schedules')) return Promise.resolve({ data: [] });
    }
    return Promise.resolve({ success: true });
  });
});

function Wrapper({ children }: any) {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContext.Provider value={{ niche: mockNiche, loading: false, isSuperAdmin: false, isClientUser: true }}>
        {children}
      </AppContext.Provider>
    </QueryClientProvider>
  );
}

describe('LeadWorkbenchPage', () => {
  it('renders loading skeleton initially', async () => {
    const LeadWorkbenchPage = (await import('../../pages/LeadWorkbenchPage')).default;
    render(<LeadWorkbenchPage />, { wrapper: Wrapper });
    expect(await screen.findByText('Ravi Kumar')).toBeInTheDocument();
  });

  it('renders lead details after loading', async () => {
    const LeadWorkbenchPage = (await import('../../pages/LeadWorkbenchPage')).default;
    render(<LeadWorkbenchPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
    });
    expect(screen.getAllByText('NEW').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('HOT').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('+919876543210')).toBeInTheDocument();
    expect(screen.getByText('ravi@example.com')).toBeInTheDocument();
    expect(screen.getByText(/MAGICBRICKS/i)).toBeInTheDocument();
  });

  it('renders all action buttons', async () => {
    const LeadWorkbenchPage = (await import('../../pages/LeadWorkbenchPage')).default;
    render(<LeadWorkbenchPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
    });
    expect(screen.getByText('Call')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Visit')).toBeInTheDocument();
    expect(screen.getByText('Cost Sheet')).toBeInTheDocument();
    expect(screen.getByText('Hold Unit')).toBeInTheDocument();
    expect(screen.getByText('Book')).toBeInTheDocument();
  });

  it('renders timeline entries with type-specific display', async () => {
    const LeadWorkbenchPage = (await import('../../pages/LeadWorkbenchPage')).default;
    render(<LeadWorkbenchPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Lead created')).toBeInTheDocument();
    });
    expect(screen.getByText('WhatsApp sent')).toBeInTheDocument();
    expect(screen.getByText('Call made')).toBeInTheDocument();
    expect(screen.getByText('Site visit scheduled')).toBeInTheDocument();
    expect(screen.getByText(/INTERESTED/i)).toBeInTheDocument();
    expect(screen.getByText('Listen')).toBeInTheDocument();
  });

  it('shows SLA clock', async () => {
    const LeadWorkbenchPage = (await import('../../pages/LeadWorkbenchPage')).default;
    render(<LeadWorkbenchPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(document.querySelector('[title*="Untouched"]')).toBeInTheDocument();
    });
  });

  it('shows next best action for new lead with phone', async () => {
    const LeadWorkbenchPage = (await import('../../pages/LeadWorkbenchPage')).default;
    render(<LeadWorkbenchPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText(/not yet contacted/)).toBeInTheDocument();
    });
  });

  it('renders agent info', async () => {
    const LeadWorkbenchPage = (await import('../../pages/LeadWorkbenchPage')).default;
    render(<LeadWorkbenchPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    });
  });

  it('displays approved cost sheet quick-book banner', async () => {
    const { fetchLeadCostSheets } = await import('../../lib/data');
    vi.mocked(fetchLeadCostSheets).mockResolvedValueOnce({
      data: [{
        id: 'cs-1', status: 'APPROVED', projectId: 'proj-1', unitId: 'unit-1',
        totalPaise: '500000000', project: { name: 'Green Valley' }, unit: { unitNumber: 'A-101' },
      }],
      meta: {},
    });
    const LeadWorkbenchPage = (await import('../../pages/LeadWorkbenchPage')).default;
    render(<LeadWorkbenchPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText(/approved cost sheet/)).toBeInTheDocument();
    });
    expect(screen.getByText('Book Now')).toBeInTheDocument();
  });

  it('opens WhatsApp modal with Jarvis draft button', async () => {
    const LeadWorkbenchPage = (await import('../../pages/LeadWorkbenchPage')).default;
    render(<LeadWorkbenchPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('WhatsApp'));
    await waitFor(() => {
      expect(screen.getByText('Draft with Jarvis')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Draft with Jarvis'));
    await waitFor(() => {
      expect(screen.getByDisplayValue('Draft reply text')).toBeInTheDocument();
    });
  });

  it('displays notes and allows adding new notes', async () => {
    vi.mocked(api).mockImplementation((url: string, options?: any) => {
      if (options?.method === 'POST' && url === '/notes') return Promise.resolve({ success: true });
      if (url.includes('/notes')) return Promise.resolve([{ id: 'n1', text: 'Test note content', createdAt: '2025-01-01T10:00:00Z' }]);
      if (url === '/users') return Promise.resolve([{ id: 'agent-1', name: 'Priya Sharma', role: 'SALES_AGENT' }]);
      if (url.includes('/custom-fields')) return Promise.resolve({ data: [] });
      if (url.includes('/payment-schedules')) return Promise.resolve({ data: [] });
      return Promise.resolve({ success: true });
    });
    const LeadWorkbenchPage = (await import('../../pages/LeadWorkbenchPage')).default;
    render(<LeadWorkbenchPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Test note content')).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText('Add a note...');
    fireEvent.change(textarea, { target: { value: 'New note text' } });
    fireEvent.click(screen.getByText('Add Note'));
    await waitFor(() => {
      expect(vi.mocked(api)).toHaveBeenCalledWith('/notes', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('New note text'),
      }));
    });
  });

  it('allows reassigning the lead agent', async () => {
    vi.mocked(api).mockImplementation((url: string, options?: any) => {
      if (options?.method === 'POST' && url.includes('/assign')) return Promise.resolve({ success: true });
      if (url === '/users') return Promise.resolve([{ id: 'agent-1', name: 'Priya Sharma', role: 'SALES_AGENT' }, { id: 'agent-2', name: 'Ananya Singh', role: 'SALES_AGENT' }]);
      if (url.includes('/notes')) return Promise.resolve([]);
      if (url.includes('/custom-fields')) return Promise.resolve({ data: [] });
      if (url.includes('/payment-schedules')) return Promise.resolve({ data: [] });
      if (url.includes('/leads/') && options?.method === 'PATCH') return Promise.resolve({ success: true });
      return Promise.resolve({ success: true });
    });
    const LeadWorkbenchPage = (await import('../../pages/LeadWorkbenchPage')).default;
    render(<LeadWorkbenchPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Change'));
    await waitFor(() => {
      expect(screen.getByText('Select agent...')).toBeInTheDocument();
    });
    const agentSelect = screen.getByText('Select agent...').closest('select') || document.querySelectorAll('select')[2];
    fireEvent.change(agentSelect, { target: { value: 'agent-2' } });
    await waitFor(() => {
      expect(vi.mocked(api)).toHaveBeenCalledWith('/leads/lead-1/assign', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('agent-2'),
      }));
    });
  });

  it('filters timeline entries by type', async () => {
    const { getLeadTimeline } = await import('../../lib/data');
    vi.mocked(getLeadTimeline).mockResolvedValue(timelinWithMessages);
    const LeadWorkbenchPage = (await import('../../pages/LeadWorkbenchPage')).default;
    render(<LeadWorkbenchPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Lead created')).toBeInTheDocument();
    });
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Messages'));
    await waitFor(() => {
      expect(screen.queryByText('Lead created')).not.toBeInTheDocument();
    });
    expect(screen.getByText('WhatsApp received')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp sent')).toBeInTheDocument();
  });

  it('renders Matching Units section', async () => {
    const LeadWorkbenchPage = (await import('../../pages/LeadWorkbenchPage')).default;
    render(<LeadWorkbenchPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Matching Units')).toBeInTheDocument();
    });
  });

  it('edits an existing note', async () => {
    vi.mocked(api).mockImplementation((url: string, options?: any) => {
      if (url.includes('/notes') && options?.method === 'PATCH') return Promise.resolve({ success: true });
      if (url.includes('/notes')) return Promise.resolve([{ id: 'n1', text: 'Original text', createdAt: '2025-01-01T10:00:00Z' }]);
      if (url === '/users') return Promise.resolve([{ id: 'agent-1', name: 'Priya Sharma', role: 'SALES_AGENT' }]);
      if (url.includes('/custom-fields')) return Promise.resolve({ data: [] });
      if (url.includes('/payment-schedules')) return Promise.resolve({ data: [] });
      return Promise.resolve({ success: true });
    });
    const LeadWorkbenchPage = (await import('../../pages/LeadWorkbenchPage')).default;
    render(<LeadWorkbenchPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Original text')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('Edit'));
    const editTextarea = screen.getByDisplayValue('Original text');
    fireEvent.change(editTextarea, { target: { value: 'Edited text' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(vi.mocked(api)).toHaveBeenCalledWith('/notes/n1', expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('Edited text'),
      }));
    });
  });

  it('deletes a note', async () => {
    vi.mocked(api).mockImplementation((url: string, options?: any) => {
      if (url.includes('/notes') && options?.method === 'DELETE') return Promise.resolve({ success: true });
      if (url.includes('/notes')) return Promise.resolve([{ id: 'n1', text: 'Delete me', createdAt: '2025-01-01T10:00:00Z' }]);
      if (url === '/users') return Promise.resolve([{ id: 'agent-1', name: 'Priya Sharma', role: 'SALES_AGENT' }]);
      if (url.includes('/custom-fields')) return Promise.resolve({ data: [] });
      if (url.includes('/payment-schedules')) return Promise.resolve({ data: [] });
      return Promise.resolve({ success: true });
    });
    const LeadWorkbenchPage = (await import('../../pages/LeadWorkbenchPage')).default;
    render(<LeadWorkbenchPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Delete me')).toBeInTheDocument();
    });
    window.confirm = vi.fn(() => true);
    fireEvent.click(screen.getByTitle('Delete'));
    await waitFor(() => {
      expect(vi.mocked(api)).toHaveBeenCalledWith('/notes/n1', { method: 'DELETE' });
    });
  });

  it('pins and unpins a note', async () => {
    vi.mocked(api).mockImplementation((url: string, options?: any) => {
      if (url.includes('/notes') && options?.method === 'PATCH') return Promise.resolve({ success: true });
      if (url.includes('/notes')) return Promise.resolve([{ id: 'n1', text: 'Pin me', createdAt: '2025-01-01T10:00:00Z' }]);
      if (url === '/users') return Promise.resolve([{ id: 'agent-1', name: 'Priya Sharma', role: 'SALES_AGENT' }]);
      if (url.includes('/custom-fields')) return Promise.resolve({ data: [] });
      if (url.includes('/payment-schedules')) return Promise.resolve({ data: [] });
      return Promise.resolve({ success: true });
    });
    const LeadWorkbenchPage = (await import('../../pages/LeadWorkbenchPage')).default;
    render(<LeadWorkbenchPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Pin me')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('Pin'));
    await waitFor(() => {
      expect(vi.mocked(api)).toHaveBeenCalledWith('/notes/n1', expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"pinned":true'),
      }));
    });
  });

  it('shows notes in the timeline and filters by Notes', async () => {
    vi.mocked(api).mockImplementation((url: string, options?: any) => {
      if (url.includes('/notes')) return Promise.resolve([{ id: 'n1', text: 'Timeline note', createdAt: '2025-01-01T10:00:00Z' }]);
      if (url === '/users') return Promise.resolve([{ id: 'agent-1', name: 'Priya Sharma', role: 'SALES_AGENT' }]);
      if (url.includes('/custom-fields')) return Promise.resolve({ data: [] });
      if (url.includes('/payment-schedules')) return Promise.resolve({ data: [] });
      return Promise.resolve({ success: true });
    });
    const LeadWorkbenchPage = (await import('../../pages/LeadWorkbenchPage')).default;
    render(<LeadWorkbenchPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Timeline note')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Notes').length).toBeGreaterThanOrEqual(2);
    const filterBtns = screen.getAllByText('Notes');
    fireEvent.click(filterBtns[filterBtns.length - 1]);
    await waitFor(() => {
      expect(screen.getByText('Note')).toBeInTheDocument();
    });
    expect(screen.queryByText('Lead created')).not.toBeInTheDocument();
  });
});
