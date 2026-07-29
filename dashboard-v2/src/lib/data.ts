import { api, apiUpload } from './api';
import type { Lead, Contact, Campaign, Task, Message, Template, Integration, BookingSetting, CrmMapping, ScoringRule, RoutingRule, AutomationRule, PipelineStage, FailureRecord, User, HealthReport, AnalyticsOverview } from './types';

export async function fetchAnalytics() { return api('/analytics/overview') as Promise<AnalyticsOverview>; }
export async function fetchBuilderCommand() { return api('/analytics/builder-command') as Promise<any>; }
export async function fetchSources() { return api('/analytics/sources') as Promise<{ source: string; count: number }[]>; }
export async function fetchAgents() { return api('/analytics/agents') as Promise<{ id: string; name: string; role: string; assignedLeads: number; converted: number }[]>; }
// /health/ready is public and returns { status, checks: { database, uptime, memory } };
// plain /health is the lightweight liveness probe with no `checks` (Overview needs checks.database).
export async function fetchHealth() { return api('/health/ready') as Promise<any>; }
export async function fetchDeepHealth() { return api('/health/deep') as Promise<HealthReport>; }

export async function fetchLeads(page = 1, filters: Record<string, string> = {}) {
  const q = new URLSearchParams({ page: String(page), limit: '20', ...filters });
  return api(`/leads?${q}`) as Promise<{ data: Lead[]; meta: { total: number; page: number; limit: number; totalPages?: number } }>;
}
export async function fetchLead(id: string) { return api(`/leads/${id}`) as Promise<Lead>; }
export async function createLead(data: any) { return api('/leads', { method: 'POST', body: JSON.stringify(data) }) as Promise<Lead>; }
export async function updateLead(id: string, data: any) { return api(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }) as Promise<Lead>; }
export async function scoreLead(id: string) { return api(`/leads/${id}/score`, { method: 'POST' }); }
export async function assignLead(id: string, agentId: string) { return api(`/leads/${id}/assign`, { method: 'POST', body: JSON.stringify({ agentId }) }); }
export async function markSpam(id: string) { return api(`/leads/${id}/mark-spam`, { method: 'POST' }); }
export async function getLeadTimeline(id: string) { return api(`/leads/${id}/timeline`) as Promise<any[]>; }

export async function fetchContacts(page = 1, search = '') { return api(`/contacts?page=${page}&limit=20&search=${search}`) as Promise<{ data: Contact[]; meta: any }>; }
export async function fetchCampaigns() { return api('/campaigns') as Promise<{ data: Campaign[]; meta: any }>; }
export async function createCampaign(data: any) { return api('/campaigns', { method: 'POST', body: JSON.stringify(data) }); }
export async function toggleCampaign(id: string, active: boolean) { return api(`/campaigns/${id}/${active ? 'pause' : 'activate'}`, { method: 'POST' }); }
export async function duplicateCampaign(id: string) { return api(`/campaigns/${id}/duplicate`, { method: 'POST' }); }
export async function fetchCampaign(id: string) { return api(`/campaigns/${id}`) as Promise<any>; }
export async function updateCampaign(id: string, data: any) { return api(`/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function startCampaign(id: string) { return api(`/campaigns/${id}/start`, { method: 'POST' }); }
export async function pauseCampaign(id: string) { return api(`/campaigns/${id}/pause`, { method: 'POST' }); }
export async function completeCampaign(id: string) { return api(`/campaigns/${id}/complete`, { method: 'POST' }); }
export async function archiveCampaign(id: string) { return api(`/campaigns/${id}/archive`, { method: 'POST' }); }
export async function deleteCampaign(id: string) { return api(`/campaigns/${id}`, { method: 'DELETE' }); }
export async function fetchCampaignPerformance(id: string) { return api(`/campaigns/${id}/performance`) as Promise<any>; }
export async function fetchCampaignTimeline(id: string) { return api(`/campaigns/${id}/timeline`) as Promise<any[]>; }

export async function fetchTasks() { return api('/tasks') as Promise<any>; }
export async function createTask(data: any) { return api('/tasks', { method: 'POST', body: JSON.stringify(data) }) as Promise<Task>; }
export async function updateTask(id: string, data: any) { return api(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function deleteTask(id: string) { return api(`/tasks/${id}`, { method: 'DELETE' }); }

export async function fetchEvents(page = 1, filters: Record<string, string> = {}) {
  const q = new URLSearchParams({ page: String(page), limit: '20', ...filters });
  return api(`/events-ops?${q}`) as Promise<{ data: any[]; meta: { total: number; page: number; limit: number } }>;
}
export async function fetchEvent(id: string) { return api(`/events-ops/${id}`); }
export async function createEvent(data: any) { return api('/events-ops', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateEvent(id: string, data: any) { return api(`/events-ops/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function fetchEventCalendar(from: string, to: string) { return api(`/events-ops/calendar?from=${from}&to=${to}`); }
export async function fetchEventFinancials(id: string) { return api(`/events-ops/${id}/financials`); }
export async function fetchEventFunctions(id: string) { return api(`/events-ops/${id}/functions`) as Promise<any[]>; }
export async function createEventFunction(id: string, data: any) { return api(`/events-ops/${id}/functions`, { method: 'POST', body: JSON.stringify(data) }); }
export async function fetchEventMoodboard(id: string) { return api(`/events-ops/${id}/moodboard`) as Promise<any[]>; }
export async function createEventMoodboardIdea(id: string, data: any) { return api(`/events-ops/${id}/moodboard`, { method: 'POST', body: JSON.stringify(data) }); }
export async function fetchEventTeam(id: string) { return api(`/events-ops/${id}/team`) as Promise<any[]>; }
export async function assignEventTeamMember(id: string, data: any) { return api(`/events-ops/${id}/team`, { method: 'POST', body: JSON.stringify(data) }); }
export async function fetchEventVendors(id: string) { return api(`/events-ops/${id}/vendors`) as Promise<any[]>; }
export async function assignEventVendor(id: string, data: any) { return api(`/events-ops/${id}/vendors`, { method: 'POST', body: JSON.stringify(data) }); }
export async function fetchEventFiles(id: string, visibility?: string) { return api(`/events-ops/${id}/files${visibility ? `?visibility=${visibility}` : ''}`) as Promise<any[]>; }
export async function createEventFile(id: string, data: any) { return api(`/events-ops/${id}/files`, { method: 'POST', body: JSON.stringify(data) }); }
export async function fetchEventExpenses(id: string) { return api(`/events-ops/${id}/expenses`) as Promise<any[]>; }
export async function createEventExpense(id: string, data: any) { return api(`/events-ops/${id}/expenses`, { method: 'POST', body: JSON.stringify(data) }); }
export async function fetchEventMilestones(id: string) { return api(`/events-ops/${id}/milestones`) as Promise<any[]>; }
export async function createEventMilestone(id: string, data: any) { return api(`/events-ops/${id}/milestones`, { method: 'POST', body: JSON.stringify(data) }); }
export async function fetchEventRunSheet(id: string) { return api(`/events-ops/${id}/runsheet`) as Promise<any[]>; }
export async function createEventRunSheetItem(id: string, data: any) { return api(`/events-ops/${id}/runsheet`, { method: 'POST', body: JSON.stringify(data) }); }

export async function fetchInvoices(filters: Record<string, string> = {}) { const q = new URLSearchParams(filters); return api(`/client-finance/invoices?${q}`) as Promise<{ data: any[]; meta: any }>; }
export async function createInvoice(data: any) { return api('/client-finance/invoices', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateInvoice(id: string, data: any) { return api(`/client-finance/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function getInvoicePdf(id: string) { return api(`/client-finance/invoices/${id}/pdf`) as Promise<{ publicUrl: string; fileName: string }>; }
export async function sendInvoice(id: string, data: { channels?: string[]; message?: string } = {}) { return api(`/client-finance/invoices/${id}/send`, { method: 'POST', body: JSON.stringify(data) }) as Promise<{ delivered: boolean; publicUrl: string; results: Record<string, { success: boolean; error?: string }> }>; }

export async function fetchQuotations(filters: Record<string, string> = {}) { const q = new URLSearchParams(filters); return api(`/client-finance/quotations?${q}`) as Promise<{ data: any[]; meta: any }>; }
export async function createQuotation(data: any) { return api('/client-finance/quotations', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateQuotation(id: string, data: any) { return api(`/client-finance/quotations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }

export async function fetchContracts(filters: Record<string, string> = {}) { const q = new URLSearchParams(filters); return api(`/client-finance/contracts?${q}`) as Promise<{ data: any[]; meta: any }>; }
export async function createContract(data: any) { return api('/client-finance/contracts', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateContract(id: string, data: any) { return api(`/client-finance/contracts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }

export async function fetchTransactions(filters: Record<string, string> = {}) { const q = new URLSearchParams(filters); return api(`/client-finance/transactions?${q}`) as Promise<{ data: any[]; meta: any }>; }
export async function createTransaction(data: any) { return api('/client-finance/transactions', { method: 'POST', body: JSON.stringify(data) }); }

export async function fetchTaxReport() { return api('/client-finance/reports/tax'); }
export async function fetchProfitAndLoss() { return api('/client-finance/reports/profit-and-loss'); }
export async function fetchCashFlow() { return api('/client-finance/reports/cash-flow'); }
export async function fetchBalanceSheet() { return api('/client-finance/reports/balance-sheet'); }
export async function fetchVendorPaymentsReport() { return api('/client-finance/reports/vendor-payments'); }
export async function fetchEventProfitability() { return api('/client-finance/reports/event-profitability') as Promise<any[]>; }

export async function fetchMessages() { return api('/conversations?limit=50') as Promise<{ data: Message[]; meta: any }>; }
export async function sendMessage(data: any) { return api('/conversations/messages', { method: 'POST', body: JSON.stringify(data) }); }

export async function fetchTemplates() { return api('/message-templates') as Promise<Template[]>; }
export async function createTemplate(data: any) { return api('/message-templates', { method: 'POST', body: JSON.stringify(data) }); }
export async function previewTemplate(id: string, vars: Record<string, string>) { return api(`/message-templates/${id}/preview`, { method: 'POST', body: JSON.stringify(vars) }); }

export async function fetchForms() { return api('/forms') as Promise<any[]>; }
export async function fetchForm(id: string) { return api(`/forms/${id}`) as Promise<any>; }
export async function fetchFormPublic(id: string) { return api(`/forms/${id}/public`) as Promise<any>; }
export async function createForm(data: any) { return api('/forms', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateForm(id: string, data: any) { return api(`/forms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function deleteForm(id: string) { return api(`/forms/${id}`, { method: 'DELETE' }); }
export async function addFormField(formId: string, data: any) { return api(`/forms/${formId}/fields`, { method: 'POST', body: JSON.stringify(data) }); }
export async function addFormFields(formId: string, fields: any[], steps?: any[]) { return api(`/forms/${formId}/fields/bulk`, { method: 'POST', body: JSON.stringify({ fields, steps }) }); }
export async function updateFormField(formId: string, fieldId: string, data: any) { return api(`/forms/${formId}/fields/${fieldId}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function deleteFormField(formId: string, fieldId: string) { return api(`/forms/${formId}/fields/${fieldId}`, { method: 'DELETE' }); }
export async function submitForm(formId: string, data: any) { return api(`/forms/${formId}/submit`, { method: 'POST', body: JSON.stringify(data) }); }
export async function fetchSubmissions(formId: string, params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params).toString() : '';
  return api(`/forms/${formId}/submissions${q}`) as Promise<{ data: any[]; meta: any }>;
}
export async function fetchFormAnalytics(formId: string) { return api(`/forms/${formId}/analytics`) as Promise<any>; }

export async function fetchQRCodes() { return api('/qr-codes') as Promise<any[]>; }
export async function createQRCode(data: any) { return api('/qr-codes', { method: 'POST', body: JSON.stringify(data) }); }

export async function fetchMedia(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params).toString() : '';
  return api(`/media${q}`) as Promise<{ data: any[]; meta: any }>;
}
export async function deleteMedia(id: string) { return api(`/media/${id}`, { method: 'DELETE' }); }
export async function updateMedia(id: string, data: any) { return api(`/media/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function getMediaDownloadUrl(id: string) { return api(`/media/${id}/download-url`) as Promise<any>; }

export async function fetchMediaCollections() { return api('/media/collections') as Promise<any[]>; }
export async function createMediaCollection(data: any) { return api('/media/collections', { method: 'POST', body: JSON.stringify(data) }); }
export async function getMediaCollection(id: string) { return api(`/media/collections/${id}`) as Promise<any>; }
export async function updateMediaCollection(id: string, data: any) { return api(`/media/collections/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function deleteMediaCollection(id: string) { return api(`/media/collections/${id}`, { method: 'DELETE' }); }
export async function addMediaToCollection(collectionId: string, mediaId: string) { return api(`/media/collections/${collectionId}/media/${mediaId}`, { method: 'POST' }); }
export async function removeMediaFromCollection(collectionId: string, mediaId: string) { return api(`/media/collections/${collectionId}/media/${mediaId}`, { method: 'DELETE' }); }

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}
export async function fetchNotifications(unreadOnly = false) { return api(`/notifications?unreadOnly=${unreadOnly}`) as Promise<AppNotification[]>; }
export async function fetchUnreadNotificationCount() { return api('/notifications/unread-count') as Promise<number>; }
export async function markNotificationRead(id: string) { return api(`/notifications/${id}/read`, { method: 'PATCH' }); }
export async function markAllNotificationsRead() { return api('/notifications/read-all', { method: 'PATCH' }); }

export async function fetchScoringRules() { return api('/scoring-rules') as Promise<any>; }
export async function createScoringRule(data: any) { return api('/scoring-rules', { method: 'POST', body: JSON.stringify(data) }); }
export async function deleteScoringRule(id: string) { return api(`/scoring-rules/${id}`, { method: 'DELETE' }); }

export async function fetchRoutingRules() { return api('/routing-rules') as Promise<any>; }
export async function createRoutingRule(data: any) { return api('/routing-rules', { method: 'POST', body: JSON.stringify(data) }); }
export async function deleteRoutingRule(id: string) { return api(`/routing-rules/${id}`, { method: 'DELETE' }); }

export async function fetchIntegrations() { return api('/integrations') as Promise<any>; }
export async function createIntegration(data: any) { return api('/integrations', { method: 'POST', body: JSON.stringify(data) }); }
export async function deleteIntegration(id: string) { return api(`/integrations/${id}`, { method: 'DELETE' }); }
export async function updateIntegration(id: string, data: any) { return api(`/integrations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function testIntegration(id: string) { return api(`/integrations/${id}/test`, { method: 'POST' }); }

export async function fetchCRMMappings() { return api('/crm-mappings') as Promise<any>; }
export async function createCRMMapping(data: any) { return api('/crm-mappings', { method: 'POST', body: JSON.stringify(data) }); }
export async function testCRMMapping(id: string) { return api(`/crm-mappings/${id}/test`, { method: 'POST' }); }

export async function fetchBookingSettings() { return api('/booking-settings') as Promise<any>; }
export async function createBookingSetting(data: any) { return api('/booking-settings', { method: 'POST', body: JSON.stringify(data) }); }

export async function fetchPipelineStages() { return api('/pipeline-stages') as Promise<PipelineStage[]>; }
export async function fetchPipelineDeals() { return api('/tasks/pipeline-deals') as Promise<{ stages: any[]; deals: Record<string, any[]> }>; }
export async function fetchLeadTasks(leadId: string) { return api(`/tasks/lead/${leadId}`) as Promise<Task[]>; }
export async function fetchBlocklist() { return api('/blocklist') as Promise<any[]>; }
export async function fetchSLARules() { return api('/sla-rules') as Promise<any[]>; }
export async function fetchRevenue() { return api('/revenue') as Promise<any>; }

export async function fetchProjects(params: Record<string, string> = {}) {
  const q = new URLSearchParams(params); return api(`/projects?${q}`) as Promise<{ data: any[]; meta: any }>;
}
export async function fetchProperties(params: Record<string, string> = {}) {
  const q = new URLSearchParams(params); return api(`/properties?${q}`) as Promise<{ data: any[]; meta: any }>;
}
export async function fetchUnits(params: Record<string, string> = {}) {
  const q = new URLSearchParams(params); return api(`/projects/units?${q}`) as Promise<{ data: any[]; meta: any }>;
}
export async function holdUnit(data: { unitId: string; leadId: string; holdHours?: number }) {
  return api('/unit-holds', { method: 'POST', body: JSON.stringify(data) });
}
export async function createBooking(leadId: string, data: any) {
  return api(`/leads/${leadId}/bookings`, { method: 'POST', body: JSON.stringify(data) });
}
export async function fetchLeadBookings(leadId: string) {
  return api(`/bookings?leadId=${leadId}`);
}
export async function fetchLeadCostSheets(leadId: string) {
  return api(`/cost-sheets?leadId=${leadId}`) as Promise<{ data: any[]; meta: any }>;
}
export async function draftAIReply(leadId: string, context?: string) {
  return api('/agent/draft-reply', { method: 'POST', body: JSON.stringify({ leadId, context }) }) as Promise<{ draft: string; source: string }>;
}

export async function fetchUsers() { return api('/users') as Promise<User[]>; }
export async function fetchAuditLogs() { return api('/audit-logs') as Promise<any>; }

export async function fetchProfile() { return api('/auth/me') as Promise<any>; }
export async function fetchBusinessSettings() { return api('/business-settings') as Promise<any>; }
export async function updateBusinessSettings(data: any) { return api('/business-settings', { method: 'PATCH', body: JSON.stringify(data) }); }

export interface VoiceAgentSettings { greeting: string; persona: string; voicemailDetectionEnabled: boolean; antiEarlyHangupEnabled: boolean; checklistCopy: string; }
export async function fetchVoiceAgentSettings(lang = 'en') { return api(`/voice-agent/settings?lang=${lang}`) as Promise<VoiceAgentSettings>; }
export async function updateVoiceAgentSettings(data: { greeting?: string; persona?: string; antiEarlyHangupEnabled?: boolean; checklistCopy?: string }, lang = 'en') { return api(`/voice-agent/settings?lang=${lang}`, { method: 'PATCH', body: JSON.stringify(data) }) as Promise<VoiceAgentSettings>; }
export async function toggleVoiceAgentAmd(enabled: boolean) { return api('/voice-agent/settings/amd', { method: 'PATCH', body: JSON.stringify({ enabled }) }) as Promise<{ voicemailDetectionEnabled: boolean }>; }

export interface VoiceCampaign { id: number; name: string; state: string; total_rows: number; processed_rows: number; failed_rows: number; created_at: string; }
export interface VoiceRetryConfig { enabled: boolean; maxRetries: number; retryDelaySeconds: number; retryOnBusy: boolean; retryOnNoAnswer: boolean; retryOnVoicemail: boolean; }
export interface VoiceScheduleConfig { enabled: boolean; timezone: string; slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }>; }
export async function fetchVoiceCampaigns() { return api('/voice-agent/campaigns') as Promise<{ campaigns: VoiceCampaign[] }>; }
export async function createVoiceCampaign(name: string, leadIds: string[], lang = 'en', extra?: { maxConcurrency?: number; retryConfig?: VoiceRetryConfig; scheduleConfig?: VoiceScheduleConfig; contacts?: Array<{ phone: string; name?: string }> }) {
  return api('/voice-agent/campaigns', { method: 'POST', body: JSON.stringify({ name, leadIds, lang, ...extra }) }) as Promise<{ campaignId: number; leadCount: number }>;
}
export async function getVoiceCampaignProgress(id: number) { return api(`/voice-agent/campaigns/${id}/progress`) as Promise<any>; }
export async function pauseVoiceCampaign(id: number) { return api(`/voice-agent/campaigns/${id}/pause`, { method: 'POST' }); }
export async function resumeVoiceCampaign(id: number) { return api(`/voice-agent/campaigns/${id}/resume`, { method: 'POST' }); }

export interface VoiceCallRun {
  id: number; workflowId: number; workflowName: string; createdAt: string;
  durationSeconds: number; calledNumber: string | null; callerNumber: string | null;
  disposition: string; answered: boolean; leadName: string | null; leadId: string | null;
  recordingUrl: string | null; transcriptUrl: string | null;
  summary: string | null; transcript: string | null;
  gatheredContext: Record<string, any>;
}
export async function fetchVoiceCampaignRuns(id: number, page = 1, limit = 50) {
  return api(`/voice-agent/campaigns/${id}/runs?page=${page}&limit=${limit}`) as Promise<{ runs: VoiceCallRun[]; totalCount: number; page: number; limit: number; totalPages: number }>;
}
export function downloadVoiceCampaignReport(id: number) {
  const t = localStorage.getItem('token');
  const base = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
  fetch(`${base}/voice-agent/campaigns/${id}/report`, { headers: t ? { Authorization: `Bearer ${t}` } : {} })
    .then((res) => res.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `campaign-${id}-report.csv`; a.click();
      URL.revokeObjectURL(url);
    });
}
export async function fetchVoiceCallLogs(page = 1, limit = 50) {
  return api(`/voice-agent/call-logs?page=${page}&limit=${limit}`) as Promise<{ runs: VoiceCallRun[]; totalCount: number; page: number; limit: number; totalPages: number; totalDurationSeconds: number }>;
}
export interface VoiceDashboardStats { totalCalls: number; answerRate: number; avgDurationSeconds: number; totalMinutesUsed: number; dispositionCounts: Record<string, number>; }
export async function fetchVoiceDashboardStats() { return api('/voice-agent/dashboard-stats') as Promise<VoiceDashboardStats>; }

export interface VoiceKbDocument { id: number; document_uuid: string; filename: string; processing_status: string; total_chunks: number; created_at: string; }
export async function fetchVoiceKbDocuments() { return api('/voice-agent/knowledge-base/documents') as Promise<{ documents: VoiceKbDocument[] }>; }
export async function uploadVoiceKbDocument(file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiUpload('/voice-agent/knowledge-base/documents', form) as Promise<VoiceKbDocument>;
}
export async function deleteVoiceKbDocument(uuid: string) { return api(`/voice-agent/knowledge-base/documents/${uuid}`, { method: 'DELETE' }); }

export interface OutboundWebhook { id: string; name: string; url: string; events: string[]; active: boolean; createdAt: string; }
export async function fetchOutboundWebhooks() { return api('/webhooks/outbound') as Promise<OutboundWebhook[]>; }
export async function createOutboundWebhookSub(data: { name: string; url: string; events: string[]; secret?: string }) { return api('/webhooks/outbound', { method: 'POST', body: JSON.stringify(data) }) as Promise<OutboundWebhook>; }
export async function updateOutboundWebhookSub(id: string, data: { active?: boolean }) { return api(`/webhooks/outbound/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function deleteOutboundWebhookSub(id: string) { return api(`/webhooks/outbound/${id}`, { method: 'DELETE' }); }
export async function testOutboundWebhookSub(id: string) { return api(`/webhooks/outbound/${id}/test`, { method: 'POST' }); }

export interface VoiceCustomField { name: string; type: 'string' | 'number' | 'boolean'; prompt: string; }
export async function fetchVoiceCustomFields(lang = 'en') { return api(`/voice-agent/custom-fields?lang=${lang}`) as Promise<VoiceCustomField[]>; }
export async function addVoiceCustomField(field: VoiceCustomField, lang = 'en') { return api(`/voice-agent/custom-fields?lang=${lang}`, { method: 'POST', body: JSON.stringify(field) }) as Promise<VoiceCustomField[]>; }
export async function deleteVoiceCustomField(name: string, lang = 'en') { return api(`/voice-agent/custom-fields/${encodeURIComponent(name)}?lang=${lang}`, { method: 'DELETE' }) as Promise<VoiceCustomField[]>; }

export async function fetchFailures(filter = 'all') { return api(filter === 'open' ? '/failures/open' : '/failures') as Promise<FailureRecord[]>; }
export async function retryFailure(id: string) { return api(`/failures/${id}/retry`, { method: 'POST' }); }
export async function resolveFailure(id: string) { return api(`/failures/${id}/resolve`, { method: 'POST' }); }

export async function fetchAutomationRules() { return api('/rules') as Promise<AutomationRule[]>; }
export async function createAutomationRule(data: any) { return api('/rules', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateAutomationRule(id: string, data: any) { return api(`/rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function deleteAutomationRule(id: string) { return api(`/rules/${id}`, { method: 'DELETE' }); }
export async function testRuleConditions(conditions: any[], testLead: any) { return api('/rules/test', { method: 'POST', body: JSON.stringify({ conditions, testLead }) }); }

export async function fetchConversions() { return api('/conversions') as Promise<any>; }


export async function triggerAgent(leadId: string) { return api('/agent/run-summary', { method: 'POST', body: JSON.stringify({ leadId, action: 'manual_trigger' }) }); }

export async function fetchAgentStatus() { return api('/agent/status') as Promise<any>; }
export async function fetchAgentStats() { return api('/agent/stats') as Promise<any>; }
export async function testAgent(message: string) { return api('/agent/test', { method: 'POST', body: JSON.stringify({ message }) }); }
export async function updateAgentConfig(config: any) { return api('/agent/config', { method: 'PATCH', body: JSON.stringify(config) }); }

export async function fetchWebhooks() { return api('/webhooks') as Promise<any>; }
export async function testWebhook(type: string) { return api(`/webhooks/${type}/test`, { method: 'POST' }); }

export async function sendTestSMS(to: string, message: string) { return api('/sms/test', { method: 'POST', body: JSON.stringify({ to, message }) }); }

// --- Procurement ---
export async function fetchPartners(filters: Record<string, string> = {}) { const q = new URLSearchParams(filters); return api(`/procurement/partners?${q}`) as Promise<{ data: any[]; meta: any }>; }
export async function createPartner(data: any) { return api('/procurement/partners', { method: 'POST', body: JSON.stringify(data) }); }
export async function fetchVendorBookings(filters: Record<string, string> = {}) { const q = new URLSearchParams(filters); return api(`/procurement/vendor-bookings?${q}`) as Promise<{ data: any[]; meta: any }>; }
export async function createVendorBooking(data: any) { return api('/procurement/vendor-bookings', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateVendorBooking(id: string, data: any) { return api(`/procurement/vendor-bookings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function fetchPurchaseOrders(filters: Record<string, string> = {}) { const q = new URLSearchParams(filters); return api(`/procurement/purchase-orders?${q}`) as Promise<{ data: any[]; meta: any }>; }
export async function createPurchaseOrder(data: any) { return api('/procurement/purchase-orders', { method: 'POST', body: JSON.stringify(data) }); }
export async function updatePurchaseOrder(id: string, data: any) { return api(`/procurement/purchase-orders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }

// --- Inventory ---
export async function fetchInventoryItems(filters: Record<string, string> = {}) { const q = new URLSearchParams(filters); return api(`/inventory/items?${q}`) as Promise<{ data: any[]; meta: any }>; }
export async function fetchInventoryStats() { return api('/inventory/items/stats'); }
export async function createInventoryItem(data: any) { return api('/inventory/items', { method: 'POST', body: JSON.stringify(data) }); }
export async function fetchStockMovements(filters: Record<string, string> = {}) { const q = new URLSearchParams(filters); return api(`/inventory/movements?${q}`) as Promise<{ data: any[]; meta: any }>; }
export async function createStockMovement(data: any) { return api('/inventory/movements', { method: 'POST', body: JSON.stringify(data) }); }
export async function fetchInventoryLocations(active?: string) { return api(`/inventory/locations${active ? `?active=${active}` : ''}`) as Promise<any[]>; }
export async function createInventoryLocation(data: any) { return api('/inventory/locations', { method: 'POST', body: JSON.stringify(data) }); }
export async function fetchEventInventoryAllocations(eventId: string) { return api(`/inventory/events/${eventId}/allocations`) as Promise<any[]>; }
export async function allocateEventInventory(eventId: string, data: any) { return api(`/inventory/events/${eventId}/allocations`, { method: 'POST', body: JSON.stringify(data) }); }

// --- Team / HR ---
export async function fetchLeaveRequests() { return api('/team-ops/leave-requests') as Promise<any[]>; }
export async function fetchLeaveStats() { return api('/team-ops/leave-requests/stats'); }
export async function createLeaveRequest(data: any) { return api('/team-ops/leave-requests', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateLeaveRequest(id: string, data: any) { return api(`/team-ops/leave-requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function fetchPayroll() { return api('/team-ops/payroll'); }
export async function createSalaryRecord(data: any) { return api('/team-ops/payroll', { method: 'POST', body: JSON.stringify(data) }); }
export async function fetchTimesheetEntries(filters: Record<string, string> = {}) { const q = new URLSearchParams(filters); return api(`/team-ops/timesheet?${q}`) as Promise<any[]>; }
export async function createTimesheetEntry(data: any) { return api('/team-ops/timesheet', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateTeamMemberHr(id: string, data: any) { return api(`/team-ops/members/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }

// --- Module Permissions ---
export async function fetchPermissionPresets() { return api('/module-permissions/presets') as Promise<any[]>; }
export async function fetchUserPermissions(userId: string) { return api(`/module-permissions/users/${userId}`) as Promise<any[]>; }
export async function setUserPermission(userId: string, module: string, level: string) { return api(`/module-permissions/users/${userId}`, { method: 'POST', body: JSON.stringify({ module, level }) }); }
export async function applyPermissionPreset(userId: string, preset: string) { return api(`/module-permissions/users/${userId}/apply-preset`, { method: 'POST', body: JSON.stringify({ preset }) }); }

export async function fetchTeamInvites() { return api('/team/invites') as Promise<any[]>; }
export async function createTeamInvite(data: { name: string; email: string; role?: string; department?: string; moduleGrants?: Record<string, string> }) {
  return api('/team/invites', { method: 'POST', body: JSON.stringify(data) });
}
export async function revokeTeamInvite(id: string) { return api(`/team/invites/${id}`, { method: 'DELETE' }); }
export async function resendTeamInvite(id: string) { return api(`/team/invites/${id}/resend`, { method: 'POST' }); }
export async function lookupTeamInvite(token: string) { return api(`/team/invites/${token}/lookup`); }
export async function acceptTeamInvite(token: string, password: string) {
  return api('/team/invites/accept', { method: 'POST', body: JSON.stringify({ token, password }) });
}

// --- Public Profile ---
export async function fetchMyPublicProfile() { return api('/public-profile/mine'); }
export async function updateMyPublicProfile(data: any) { return api('/public-profile/mine', { method: 'PATCH', body: JSON.stringify(data) }); }
export async function fetchPublicProfileBySlug(slug: string) { return api(`/public-profile/org/${slug}`); }
export async function fetchPublicListingBySlug(slug: string) { return api(`/properties/public/${slug}`); }

export async function fetchWorkflows() { return api('/workflows'); }
export async function fetchWorkflowById(id: string) { return api(`/workflows/${id}`); }
export async function createWorkflow(data: { name: string; description?: string }) { return api('/workflows', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateWorkflow(id: string, data: any) { return api(`/workflows/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function deleteWorkflow(id: string) { return api(`/workflows/${id}`, { method: 'DELETE' }); }

export async function fetchFlows() { return api('/flows'); }
export async function fetchFlow(id: string) { return api(`/flows/${id}`); }
export async function createFlow(data: any) { return api('/flows', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateFlow(id: string, data: any) { return api(`/flows/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function deleteFlow(id: string) { return api(`/flows/${id}`, { method: 'DELETE' }); }
export async function fetchPublicCollection(slugs: string[]) { return api(`/properties/public/collection?slugs=${slugs.join(',')}`); }
