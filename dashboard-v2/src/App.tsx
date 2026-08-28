import { useState, useEffect, lazy, Suspense } from "react";
import { Toaster } from "react-hot-toast";
import { HashRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "./lib/useAuth";
import { getToken } from "./lib/api";
import { capture, identify } from "./lib/posthog";
import { fetchVoiceCallsLive } from "./lib/data";
import { AppProvider } from "./context/AppContext";
import { BrandingProvider } from "./lib/useBranding";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { applyNicheTheme } from "./lib/niche-config";
import { Sidebar } from "./components/layout/sidebar";
import { Topbar } from "./components/layout/topbar";
import { SocketProvider } from "./hooks";
import { FeatureGuard } from "./components/FeatureGuard";
import { initNicheConfig } from "./lib/niche-config";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { Skeleton } from "./components/ui/skeleton";

const PageComponents: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  VoiceAgent: lazy(() => import("./pages/VoiceAgentPage")),
  VoiceEmployees: lazy(() => import("./pages/VoiceEmployeesPage")),
  TalkToBuild: lazy(() => import("./pages/TalkToBuildPage")),
  TalkToEmployee: lazy(() => import("./pages/TalkToEmployeePage")),
  VoiceEmployeeDetail: lazy(() => import("./pages/VoiceEmployeeDetailPage")),
  VoiceAgentSettings: lazy(() => import("./pages/VoiceAgentSettingsPage")),
  VoiceCampaigns: lazy(() => import("./pages/VoiceCampaignsPage")),
  VoiceCampaignDetail: lazy(() => import("./pages/VoiceCampaignDetailPage")),
  VoiceCallLogs: lazy(() => import("./pages/VoiceCallLogsPage")),
  VoiceKnowledgeBase: lazy(() => import("./pages/VoiceKnowledgeBasePage")),
  VoicePostCallWorkflows: lazy(() => import("./pages/VoicePostCallWorkflowsPage")),
  VoiceDashboard: lazy(() => import("./pages/VoiceDashboardPage")),
  VoiceInstantLeads: lazy(() => import("./pages/VoiceInstantLeadsPage")),
  VoiceInboundCalls: lazy(() => import("./pages/VoiceInboundCallsPage")),
  VoiceAllConversations: lazy(() => import("./pages/VoiceAllConversationsPage")),
  VoiceLeadsResults: lazy(() => import("./pages/VoiceLeadsResultsPage")),
  VoicePhoneNumbers: lazy(() => import("./pages/VoicePhoneNumbersPage")),
  VoicePerformance: lazy(() => import("./pages/VoicePerformancePage")),
  VoiceBilling: lazy(() => import("./pages/VoiceBillingPage")),
  VoiceStore: lazy(() => import("./pages/VoiceStorePage")),
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
  if (/^\/voice-campaigns\/[^/]+$/.test(path)) return "VoiceCampaignDetail";
  if (/^\/voice-employees\/[^/]+$/.test(path)) return "VoiceEmployeeDetail";
  if (path.startsWith("/voice-agent-settings")) return "VoiceAgentSettings";
  if (path.startsWith("/voice-campaigns")) return "VoiceCampaigns";
  if (path.startsWith("/voice-call-logs")) return "VoiceCallLogs";
  if (path.startsWith("/voice-knowledge-base")) return "VoiceKnowledgeBase";
  if (path.startsWith("/voice-post-call-workflows")) return "VoicePostCallWorkflows";
  if (path.startsWith("/voice-dashboard")) return "VoiceDashboard";
  if (path.startsWith("/voice-instant-leads")) return "VoiceInstantLeads";
  if (path.startsWith("/voice-inbound-calls")) return "VoiceInboundCalls";
  if (path.startsWith("/voice-all-conversations")) return "VoiceAllConversations";
  if (path.startsWith("/voice-leads-results")) return "VoiceLeadsResults";
  if (path.startsWith("/voice-phone-numbers")) return "VoicePhoneNumbers";
  if (path.startsWith("/voice-performance")) return "VoicePerformance";
  if (path.startsWith("/voice-billing")) return "VoiceBilling";
  if (path.startsWith("/voice-employees")) return "VoiceEmployees";
  if (path.startsWith("/talk-to-build")) return "TalkToBuild";
  if (path.startsWith("/talk-to-employee")) return "TalkToEmployee";
  if (path.startsWith("/voice-agent")) return "VoiceAgent";
  if (path.startsWith("/store")) return "VoiceStore";
  if (path === "/") return "VoiceDashboard";
  return "VoiceDashboard";
}

export default function App() {
  const { user, fetchProfile, isLoggedIn } = useAuth();
  const [page, setPage] = useState("VoiceDashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [publicRoute, setPublicRoute] = useState(() => window.location.hash.replace("#", "") || "/");

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

  useEffect(() => {
    if (!isLoggedIn) return;
    const update = () => fetchVoiceCallsLive().then(calls => {
      document.title = calls.length > 0 ? `(${calls.length} live) Vezraa` : 'Vezraa';
    }).catch(() => {});
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, [isLoggedIn]);

  const navigate = (path: string) => {
    window.location.hash = path;
    setPage(getPageKey(path));
  };

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
    if (getToken()) return null;
    window.location.href = '/login.html';
    return null;
  }

  const PageComponent = PageComponents[page];

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
