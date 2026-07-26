import { useState, useEffect, lazy, Suspense, useCallback } from "react";
import { Toaster } from "react-hot-toast";
import { HashRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "./lib/useAuth";
import { getToken } from "./lib/api";
import { capture, identify, reset as posthogReset } from "./lib/posthog";
import { AppProvider } from "./context/AppContext";
import { BrandingProvider } from "./lib/useBranding";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { applyNicheTheme } from "./lib/niche-config";
import { Sidebar } from "./components/layout/sidebar";
import { Topbar } from "./components/layout/topbar";
import MikeyWidget from "./components/MikeyWidget";
import ExplainModePlayer from "./components/ExplainModePlayer";
import VoiceCommandUI from "./components/VoiceCommandUI";
import { MikeyBanner, showMikeyToast } from "./components/mikey";
import { SocketProvider, useSocket } from "./hooks";
import { FeatureGuard } from "./components/FeatureGuard";
import { initNicheConfig } from "./lib/niche-config";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { Skeleton } from "./components/ui/skeleton";
import OverviewPage from "./pages/OverviewPage";
import LeadsPage from "./pages/LeadsPage";
import ContactsPage from "./pages/ContactsPage";
import CampaignsPage from "./pages/CampaignsPage";
import FormsPage from "./pages/FormsPage";
import FormSubmissionsPage from "./pages/FormSubmissionsPage";
import QRCodesPage from "./pages/QRCodesPage";
import MessagesPage from "./pages/MessagesPage";
import SyncLogPage from "./pages/SyncLogPage";
import PublicOrgPage from "./pages/PublicOrgPage";

const PageComponents: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  Pipeline: lazy(() => import("./pages/PipelinePage")),
  Templates: lazy(() => import("./pages/TemplatesPage")),
  Media: lazy(() => import("./pages/MediaPage")),

  Scoring: lazy(() => import("./pages/ScoringPage")),
  Routing: lazy(() => import("./pages/RoutingPage")),
  Tasks: lazy(() => import("./pages/TasksPage")),
  Conversions: lazy(() => import("./pages/ConversionsPage")),
  Integrations: lazy(() => import("./pages/IntegrationsPage")),
  CRM: lazy(() => import("./pages/CRMPage")),
  Booking: lazy(() => import("./pages/BookingPage")),
  Analytics: lazy(() => import("./pages/AnalyticsPage")),
  Team: lazy(() => import("./pages/TeamPage")),
  AuditLogs: lazy(() => import("./pages/AuditLogsPage")),
  Advanced: lazy(() => import("./pages/AdvancedPage")),
  Settings: lazy(() => import("./pages/SettingsPage")),
  Workspace: lazy(() => import("./pages/WorkspacePage")),
  AdIntegrations: lazy(() => import("./pages/AdIntegrationsPage")),
  Failures: lazy(() => import("./pages/FailuresPage")),
  Health: lazy(() => import("./pages/HealthPage")),
  WebsiteCrawler: lazy(() => import("./pages/WebsiteCrawlerPage")),
  AICampaigns: lazy(() => import("./pages/AICampaignManager")),
  Rules: lazy(() => import("./pages/RulesPage")),
  Import: lazy(() => import("./pages/ImportPage")),
  AIAgent: lazy(() => import("./pages/AIAgentPage")),
  Webhooks: lazy(() => import("./pages/WebhookPage")),
  SMS: lazy(() => import("./pages/SMSSettingsPage")),
  Widget: lazy(() => import("./pages/WidgetPage")),
  Tickets: lazy(() => import("./pages/TicketsPage")),
  Calls: lazy(() => import("./pages/CallsPage")),
  KnowledgeBase: lazy(() => import("./pages/KnowledgeBasePage")),
  Copilot: lazy(() => import("./pages/CopilotPage")),
  Mikey: lazy(() => import("./pages/MikeyPage")),
  Studio: lazy(() => import("./pages/StudioPage")),
  Reports: lazy(() => import("./pages/ReportsPage")),
  Events: lazy(() => import("./pages/EventsPage")),
  EventDetail: lazy(() => import("./pages/EventDetailPage")),
  EventCalendar: lazy(() => import("./pages/CalendarPage")),
  CreateEvent: lazy(() => import("./pages/CreateEventPage")),
  Accounting: lazy(() => import("./pages/AccountingPage")),
  MyExpenses: lazy(() => import("./pages/MyExpensesPage")),
  Invoices: lazy(() => import("./pages/InvoicesPage")),
  Quotations: lazy(() => import("./pages/QuotationsPage")),
  Contracts: lazy(() => import("./pages/ContractsPage")),
  FinanceReports: lazy(() => import("./pages/FinanceReportsPage")),
  Partners: lazy(() => import("./pages/PartnersPage")),
  VendorBookings: lazy(() => import("./pages/VendorBookingsPage")),
  PurchaseOrders: lazy(() => import("./pages/PurchaseOrdersPage")),
  InventoryItems: lazy(() => import("./pages/InventoryPage")),
  StockMovements: lazy(() => import("./pages/StockMovementsPage")),
  Locations: lazy(() => import("./pages/LocationsPage")),
  LeaveLog: lazy(() => import("./pages/LeaveLogPage")),
  Salaries: lazy(() => import("./pages/SalariesPage")),
  Timesheet: lazy(() => import("./pages/TimesheetPage")),
  PublicProfile: lazy(() => import("./pages/PublicProfilePage")),
  BuilderDesk: lazy(() => import("./pages/BuilderDeskPage")),
  Properties: lazy(() => import("./pages/PropertiesPage")),
  PropertyDetail: lazy(() => import("./pages/PropertyDetailPage")),
  Shipments: lazy(() => import("./pages/ShipmentsPage")),
  ChannelPartners: lazy(() => import("./pages/ChannelPartnersPage")),
  AgentDetail: lazy(() => import("./pages/AgentDetailPage")),
  AgentForm: lazy(() => import("./pages/AgentFormPage")),
  PaymentSchedules: lazy(() => import("./pages/PaymentSchedulesPage")),
  Projects: lazy(() => import("./pages/ProjectsPage")),
  ProjectDetail: lazy(() => import("./pages/ProjectDetailPage")),
   SiteVisits: lazy(() => import("./pages/SiteVisitsPage")),
   LeadWorkbench: lazy(() => import("./pages/LeadWorkbenchPage")),
  CostSheets: lazy(() => import("./pages/CostSheetsPage")),
  Kyc: lazy(() => import("./pages/KycPage")),
  Collections: lazy(() => import("./pages/CollectionsPage")),
  PartnerClaims: lazy(() => import("./pages/PartnerClaimsPage")),
  Approvals: lazy(() => import("./pages/ApprovalsPage")),
  SourceHealth: lazy(() => import("./pages/SourceHealthPage")),
  CampaignDetail: lazy(() => import("./pages/CampaignDetailPage")),
  MarketingJourneys: lazy(() => import("./pages/MarketingJourneysPage")),
  MarketingEvents: lazy(() => import("./pages/MarketingEventsPage")),
  Portfolio: lazy(() => import("./pages/PortfolioPage")),
  CashFlowForecast: lazy(() => import("./pages/CashFlowForecastPage")),
  RevenueShare: lazy(() => import("./pages/RevenueSharePage")),
  ResaleListings: lazy(() => import("./pages/ResaleListingsPage")),
  Referrals: lazy(() => import("./pages/ReferralsPage")),
  NriProfiles: lazy(() => import("./pages/NriProfilesPage")),
  ConstructionErp: lazy(() => import("./pages/ConstructionErpPage")),
  DocumentSearch: lazy(() => import("./pages/DocumentSearchPage")),
  PhysicalDocuments: lazy(() => import("./pages/PhysicalDocumentsPage")),
  VoiceAgent: lazy(() => import("./pages/VoiceAgentPage")),
  VoiceAgentSettings: lazy(() => import("./pages/VoiceAgentSettingsPage")),
  VoiceCampaigns: lazy(() => import("./pages/VoiceCampaignsPage")),
  VoiceCampaignDetail: lazy(() => import("./pages/VoiceCampaignDetailPage")),
  VoiceCallLogs: lazy(() => import("./pages/VoiceCallLogsPage")),
  VoiceKnowledgeBase: lazy(() => import("./pages/VoiceKnowledgeBasePage")),
  VoicePostCallWorkflows: lazy(() => import("./pages/VoicePostCallWorkflowsPage")),
  AlliedInventory: lazy(() => import("./pages/AlliedInventoryPage")),
  SalesTargets: lazy(() => import("./pages/SalesTargetsPage")),
  DigitalSalesRoom: lazy(() => import("./pages/DigitalSalesRoomPage")),
  AdvancedMarketing: lazy(() => import("./pages/AdvancedMarketingPage")),
  OnboardingProgress: lazy(() => import("./pages/OnboardingProgressPage")),
  LaunchControl: lazy(() => import("./pages/LaunchControlPage")),
   AgentQueue: lazy(() => import("./pages/AgentQueuePage")),
   SmartLists: lazy(() => import("./components/SmartLists")),
   ManagerDashboard: lazy(() => import("./pages/ManagerDashboardPage")),
};

function PageFallback() {
  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <Skeleton className="h-4 w-72 rounded-lg" />
      <div className="grid grid-cols-3 gap-4 mt-6">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      <Skeleton className="h-64 rounded-lg mt-4" />
    </div>
  );
}

function getPageKey(raw: string): string {
  const path = raw.split('?')[0];
  if (/^\/events\/[^/]+$/.test(path)) return "EventDetail";
  if (/^\/campaigns\/[^/]+$/.test(path)) return "CampaignDetail";
  if (/^\/properties\/[^/]+$/.test(path)) return "PropertyDetail";
  if (path === "/channel-partners/new") return "AgentForm";
  if (/^\/channel-partners\/[^/]+\/edit$/.test(path)) return "AgentForm";
  if (/^\/channel-partners\/[^/]+$/.test(path)) return "AgentDetail";
  if (/^\/projects\/[^/]+$/.test(path)) return "ProjectDetail";
  if (/^\/leads\/[^/]+$/.test(path)) return "LeadWorkbench";
  if (/^\/forms\/[^/]+\/submissions$/.test(path)) return "FormSubmissions";
  if (path.startsWith("/create-event")) return "CreateEvent";
  if (/^\/voice-campaigns\/[^/]+$/.test(path)) return "VoiceCampaignDetail";
  if (path.startsWith("/voice-agent-settings")) return "VoiceAgentSettings";
  if (path.startsWith("/voice-campaigns")) return "VoiceCampaigns";
  if (path.startsWith("/voice-call-logs")) return "VoiceCallLogs";
  if (path.startsWith("/voice-knowledge-base")) return "VoiceKnowledgeBase";
  if (path.startsWith("/voice-post-call-workflows")) return "VoicePostCallWorkflows";
  if (path.startsWith("/voice-agent")) return "VoiceAgent";
  if (path.startsWith("/smart-lists")) return "SmartLists";
  const map: Record<string, string> = {
    "/": "Overview", "/builder-desk": "BuilderDesk", "/leads": "Leads", "/smart-lists": "SmartLists", "/pipeline": "Pipeline", "/contacts": "Contacts",
    "/campaigns": "Campaigns", "/forms": "Forms", "/qr-codes": "QRCodes",
    "/conversations": "Messages", "/messages": "Messages",
    "/templates": "Templates", "/media": "Media",
    "/scoring": "Scoring", "/rules": "Rules",
    "/tasks": "Tasks", "/conversions": "Conversions",
    "/integrations": "Integrations", "/crm": "CRM", "/booking": "Booking",
    "/analytics": "Analytics", "/team": "Team",
    "/audit-logs": "AuditLogs", "/advanced": "Advanced",
    "/settings": "Settings", "/workspace": "Workspace",     "/import": "Import", "/website-crawler": "WebsiteCrawler",
    "/failures": "Failures", "/health": "Health",
    "/ai-campaigns": "AICampaigns", "/ai-agent": "AIAgent",
    "/webhooks": "Webhooks", "/sms": "SMS", "/widget": "Widget", "/ads": "AdIntegrations",
    "/tickets": "Tickets",     "/calls": "Calls", "/sync-logs": "SyncLogs", "/knowledge-base": "KnowledgeBase",
    "/copilot": "Copilot", "/mikey": "Mikey",    "/studio": "Studio", "/reports": "Reports",
    "/events": "Events", "/calendar": "EventCalendar",
    "/accounting": "Accounting", "/invoices": "Invoices", "/quotations": "Quotations",
    "/contracts": "Contracts", "/finance-reports": "FinanceReports", "/my-expenses": "MyExpenses",
    "/partners": "Partners", "/vendor-bookings": "VendorBookings", "/purchase-orders": "PurchaseOrders",
    "/inventory": "InventoryItems", "/stock-movements": "StockMovements", "/locations": "Locations",
    "/leave-log": "LeaveLog", "/salaries": "Salaries", "/timesheet": "Timesheet",
    "/public-profile": "PublicProfile",
    "/properties": "Properties",
    "/shipments": "Shipments",
    "/channel-partners": "ChannelPartners",
    "/payment-schedules": "PaymentSchedules",
    "/projects": "Projects",
    "/site-visits": "SiteVisits",
    "/cost-sheets": "CostSheets",
    "/kyc": "Kyc",
    "/collections": "Collections",
    "/partner-claims": "PartnerClaims",
    "/approvals": "Approvals",
    "/source-health": "SourceHealth",
    "/marketing-journeys": "MarketingJourneys",
    "/marketing-events": "MarketingEvents",
    "/portfolio": "Portfolio",
    "/cash-flow-forecast": "CashFlowForecast",
    "/revenue-share": "RevenueShare",
    "/resale-listings": "ResaleListings",
    "/referrals": "Referrals",
    "/nri-profiles": "NriProfiles",
    "/construction-erp": "ConstructionErp",
    "/document-search": "DocumentSearch",
    "/physical-documents": "PhysicalDocuments",
    "/allied-inventory": "AlliedInventory",
    "/sales-targets": "SalesTargets",
    "/voice-agent": "VoiceAgent",
    "/voice-agent-settings": "VoiceAgentSettings",
    "/voice-campaigns": "VoiceCampaigns",
    "/voice-call-logs": "VoiceCallLogs",
    "/voice-knowledge-base": "VoiceKnowledgeBase",
    "/voice-post-call-workflows": "VoicePostCallWorkflows",
    "/digital-sales-room": "DigitalSalesRoom",
    "/advanced-marketing": "AdvancedMarketing",
    "/onboarding-progress": "OnboardingProgress",
    "/launch-control": "LaunchControl",
    "/queue": "AgentQueue",
    "/manager-dashboard": "ManagerDashboard",
  };
  return map[path] || "Overview";
}

const pageRoutes: Record<string, React.ComponentType<any>> = {
  Overview: OverviewPage, Leads: LeadsPage, Contacts: ContactsPage,
  Campaigns: CampaignsPage, Forms: FormsPage, FormSubmissions: FormSubmissionsPage,
  QRCodes: QRCodesPage, Messages: MessagesPage,
  SyncLogs: SyncLogPage,
};

// EventsService.emit() broadcasts socket events as `event:${type}`, e.g.
// `event:mikey.stale_hot_leads` — strip that wrapper prefix before matching
// against the semantic "mikey." event namespace.
function stripEventPrefix(type: string): string {
  return type.startsWith('event:') ? type.slice('event:'.length) : type;
}

// Not every Mikey finding carries a `title` (only scheduler findings do —
// temporal/staff/outcome findings don't), so fall back to a readable label
// derived from the event type instead of silently dropping it.
function fallbackTitle(type: string): string {
  const suffix = type.split('.').pop() || type;
  return suffix.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function MikeyConnectedBanner() {
  const { eventBuffer } = useSocket();
  const findings = eventBuffer
    .filter(e => stripEventPrefix(e.type).startsWith('mikey.'))
    .slice(-5)
    .map(e => ({
      id: `${e.type}-${e.timestamp}`,
      severity: ((e.payload as any)?.severity === 'critical' ? 'critical' : (e.payload as any)?.severity === 'warning' ? 'warning' : 'info') as 'info' | 'warning' | 'critical',
      title: (e.payload as any)?.title || fallbackTitle(stripEventPrefix(e.type)),
      description: (e.payload as any)?.description || '',
      timestamp: new Date(e.timestamp),
    }));
  return <MikeyBanner findings={findings} />;
}

function MikeyConnectedToast() {
  const { lastEvent } = useSocket();
  useEffect(() => {
    if (!lastEvent) return;
    const semanticType = stripEventPrefix(lastEvent.type);
    if (!semanticType.startsWith('mikey.')) return;
    const p = lastEvent.payload as any;
    showMikeyToast({
      title: p?.title || fallbackTitle(semanticType),
      description: p?.description || '',
      severity: p?.severity === 'critical' ? 'critical' : p?.severity === 'warning' ? 'warning' : 'info',
    });
  }, [lastEvent]);
  return null;
}

export default function App() {
  const { user, fetchProfile, isLoggedIn } = useAuth();
  const [page, setPage] = useState("Overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [publicRoute, setPublicRoute] = useState(() => window.location.hash.replace("#", "") || "/queue");

  useEffect(() => {
    initNicheConfig();
    fetchProfile();
    const onHash = () => {
      const hash = window.location.hash.replace("#", "") || "/";
      const pageKey = getPageKey(hash);
      setPublicRoute(hash);
      setPage(pageKey);
      capture('$pageview', { $current_url: window.location.href, page: pageKey });
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (user) {
      identify(user.id, {
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      });
    }
  }, [user]);

  useEffect(() => {
    applyNicheTheme();
  }, []);

  const navigate = (path: string) => {
    window.location.hash = path;
    setPage(getPageKey(path));
  };

  // Public microsite route — must be checked before the isLoggedIn gate below,
  // since it's meant to be viewable by anyone, logged in or not.
  if (publicRoute.startsWith('/org/')) {
    const slug = publicRoute.slice('/org/'.length);
    return <PublicOrgPage slug={slug} />;
  }

  // Public listing page — the shareable per-property link Mikey sends to leads.
  if (publicRoute.startsWith('/listing/')) {
    const PublicListingPage = lazy(() => import('./pages/PublicListingPage'));
    const slug = publicRoute.slice('/listing/'.length);
    return (
      <Suspense fallback={<PageFallback />}>
        <PublicListingPage slug={slug} />
      </Suspense>
    );
  }

  // Public form renderer — embeddable multi-step form
  if (publicRoute.startsWith('/form/')) {
    const FormRendererPage = lazy(() => import('./pages/FormRendererPage'));
    return (
      <Suspense fallback={<PageFallback />}>
        <FormRendererPage />
      </Suspense>
    );
  }

  // Public accept-invite page — the invitee has no account yet, so this
  // must render before the isLoggedIn gate below.
  if (publicRoute.startsWith('/accept-invite/')) {
    const AcceptInvitePage = lazy(() => import('./pages/AcceptInvitePage'));
    const token = publicRoute.slice('/accept-invite/'.length);
    return (
      <Suspense fallback={<PageFallback />}>
        <AcceptInvitePage token={token} />
      </Suspense>
    );
  }

  // Public partner portal — a channel partner's own login/session, entirely
  // separate from the internal dashboard's auth (spec 48.12).
  if (publicRoute.startsWith('/partner-portal')) {
    const PartnerPortalPage = lazy(() => import('./pages/public/PartnerPortalPage'));
    return (
      <Suspense fallback={<PageFallback />}>
        <PartnerPortalPage />
      </Suspense>
    );
  }

  // Public buyer portal — magic-link session scoped to exactly one booking (spec 54.1).
  if (publicRoute.startsWith('/buyer-portal')) {
    const BuyerPortalPage = lazy(() => import('./pages/public/BuyerPortalPage'));
    return (
      <Suspense fallback={<PageFallback />}>
        <BuyerPortalPage />
      </Suspense>
    );
  }

  // Landing and login are static pages (index.html / login.html) served
  // directly by Caddy at the domain root, outside this SPA. If someone
  // lands here without a session — e.g. an expired token inside
  // /dashboard/* — send them back to the real static login page rather
  // than rendering a React copy of it.
  if (!isLoggedIn) {
    if (publicRoute === '/forgot-password' || publicRoute === '/reset-password') {
      return (
        <BrandingProvider>
          <HashRouter>
            <Routes>
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Routes>
          </HashRouter>
        </BrandingProvider>
      );
    }
    // A token exists but hasn't been validated yet (e.g. sessionStorage's
    // cached user was cleared by closing the tab, but the localStorage
    // token survived) — the fetchProfile() call kicked off on mount is
    // still in flight. Redirecting here would kick out a valid session
    // before it even had a chance to prove itself; wait instead.
    if (getToken()) return null;
    window.location.href = '/login.html';
    return null;
  }

  const PageComponent = pageRoutes[page] || PageComponents[page];

  return (
    <BrandingProvider>
    <AppProvider>
    <SocketProvider>
      <div className="flex min-h-dvh bg-[var(--background)] text-[var(--foreground)] overflow-hidden">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />
        <div className={`flex min-w-0 flex-1 flex-col transition-all duration-200 ${sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"}`}>
          <Topbar onMenuToggle={() => setMobileNavOpen(!mobileNavOpen)} />
          <main className="relative flex-1 overflow-auto px-3 py-4 sm:px-4 lg:p-6">
            <MikeyConnectedBanner />
            <ErrorBoundary>
              <Suspense fallback={<PageFallback />}>
                {PageComponent ? (
                  <FeatureGuard pageKey={page}>
                    <PageComponent />
                  </FeatureGuard>
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--muted-foreground)]">Page not found</div>
                )}
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <MikeyWidget />
      <ExplainModePlayer />
      <VoiceCommandUI />
      <MikeyConnectedToast />
      <Toaster position="top-right" toastOptions={{
        style: { borderRadius: 'var(--radius)', background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)', fontSize: '14px' },
        success: { iconTheme: { primary: '#0f766e', secondary: '#ffffff' } },
        error: { iconTheme: { primary: '#dc2626', secondary: '#ffffff' } },
      }} />
    </SocketProvider>
    </AppProvider>
    </BrandingProvider>
  );
}
