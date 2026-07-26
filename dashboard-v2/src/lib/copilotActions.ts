import { setPendingFilter } from './pendingSearch';
import { api } from './api';
import { startExplainFlow } from './explainMode';
import { PAGE_MAP, resolvePage } from './pageMap';

export interface CopilotAction {
  tool: string;
  args: any;
  status: 'success' | 'error' | 'pending';
  result?: string;
  requiresConfirmation?: boolean;
  pendingActionId?: string;
}

export function runUIAction(action: CopilotAction) {
  if (action.status !== 'success') return;
  if (action.tool === 'explain_flow') {
    startExplainFlow(action.args?.steps || []);
    return;
  }
  if (action.tool !== 'navigate_ui') return;
  const { page: rawPage, filters, highlightId } = action.args || {};
  if (!rawPage) return;
  // Raw model output ("qr_codes", "qr codes") rarely matches a PAGE_MAP key
  // exactly. Using it as the hash unresolved silently left the page exactly
  // where it was while Mikey still reported success.
  const page = resolvePage(rawPage);
  setPendingFilter(page, { filters, highlightId });
  window.location.hash = PAGE_MAP[page] || '/' + page;
}

const NAV_PHRASES = [
  /(?:navigat(?:ed|ing)|tak(?:ing|e)|show(?:ing|s?)|open(?:ed|ing)?|go(?:ing)?)\s+(?:you\s+)?(?:to\s+)?(?:the\s+)?(?:leads?|contacts?|tickets?|campaigns?|reports?|tasks?|analytics|pipeline|inbox|messages?|settings|properties|projects?)/i,
  /(?:here(?:'s| is)|(?:here are|showing))\s+(?:your\s+)?(?:hot|warm|cold|new|open|qualified|converted|lost|all|active|recent)?\s*(?:leads?|contacts?|tickets?|campaigns?)/i,
];

function tryNavigateFromText(text: string): boolean {
  const known: Record<string, string> = {
    leads: '/leads', contacts: '/contacts', tickets: '/tickets',
    campaigns: '/campaigns', reports: '/reports', tasks: '/tasks',
    analytics: '/analytics', pipeline: '/pipeline', inbox: '/messages',
    messages: '/messages', settings: '/settings', properties: '/properties',
    projects: '/projects',
  };
  const lower = text.toLowerCase();
  for (const [name, path] of Object.entries(known)) {
    if (lower.includes(name) && NAV_PHRASES.some(p => p.test(lower))) {
      setPendingFilter(name, {});
      window.location.hash = path;
      return true;
    }
  }
  return false;
}

export function runUIActions(actions: CopilotAction[] | undefined, responseText?: string) {
  (actions || []).forEach(runUIAction);
  const hasNavAction = (actions || []).some(a => a.tool === 'navigate_ui' && a.status === 'success');
  if (!hasNavAction && responseText) {
    tryNavigateFromText(responseText);
  }
}

function highlightTargetForConfirmedAction(tool: string, args: any): { page: string; highlightId: string } | null {
  if (['update_lead_status', 'send_message', 'initiate_call', 'send_email'].includes(tool) && args?.leadId) {
    return { page: 'leads', highlightId: args.leadId };
  }
  if (tool === 'update_ticket' && args?.ticketId) {
    return { page: 'tickets', highlightId: args.ticketId };
  }
  return null;
}

export async function confirmPendingAction(pendingActionId: string): Promise<{ status: string; result: any; tool: string; args: any }> {
  const res = await api('/copilot/confirm-action', {
    method: 'POST',
    body: JSON.stringify({ pendingActionId }),
  });
  const target = highlightTargetForConfirmedAction(res.tool, res.args);
  if (target) {
    runUIAction({ tool: 'navigate_ui', args: target, status: 'success' });
  }
  return res;
}
