import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Users, MessageSquare, BarChart3, Settings,
   Megaphone, FormInput, QrCode, FileText, Target,
  ShoppingCart, Link, Calendar, Layers, ChevronLeft, ChevronRight, ChevronDown,
  UserCircle, CheckSquare, Sparkles, Phone, PhoneCall,   Bot, MessageCircle, Smartphone, Webhook, Globe, LogOut, Columns3,
  LifeBuoy, BookOpen, Puzzle, Download, Headset, Brain,
  Truck, ClipboardList, Package, Box, MapPin, DollarSign,
  Building2, Activity, CalendarClock, GitBranch, Gift, HardDrive, BookCopy, FileSearch, Shield, ExternalLink,
} from "lucide-react";
import { fetchProfile, fetchBusinessSettings } from "../../lib/data";
import { useAuth } from "../../lib/useAuth";
import { useBranding } from "../../lib/useBranding";
import { isFeatureEnabled, getLabel, getBusinessName, getNicheLogo, onConfigChange } from "../../lib/niche-config";

const featureMap: Record<string, string> = {
  "/": "overview", "/queue": "overview", "/builder-desk": "overview", "/leads": "leads", "/smart-lists": "leads", "/pipeline": "pipeline", "/contacts": "contacts",
  "/campaigns": "campaigns", "/forms": "forms", "/qr-codes": "qrCodes",
  "/voice-agent": "voiceAgent", "/voice-agent-settings": "voiceAgent", "/voice-campaigns": "voiceAgent", "/voice-call-logs": "voiceAgent", "/voice-knowledge-base": "voiceAgent", "/voice-post-call-workflows": "voiceAgent", "/conversations": "messages", "/templates": "templates", "/media": "media",
  "/scoring": "scoring", "/rules": "routing",
  "/ai-campaigns": "aiCampaigns", "/ai-agent": "aiAgent", "/copilot": "copilot",
  "/webhooks": "webhooks", "/sms": "sms", "/widget": "widget", "/calls": "calls", "/sync-logs": "syncLogs",
  "/tasks": "tasks", "/conversions": "conversions",
  "/events": "events", "/calendar": "events", "/create-event": "events",
  "/event-detail": "events",
  "/accounting": "finance", "/invoices": "finance", "/quotations": "finance",
  "/contracts": "finance", "/finance-reports": "finance", "/my-expenses": "finance",
  "/partners": "procurement", "/vendor-bookings": "procurement", "/purchase-orders": "procurement",
  "/inventory": "inventory", "/stock-movements": "inventory", "/locations": "inventory",
  "/team": "teamHr", "/leave-log": "teamHr", "/salaries": "teamHr", "/timesheet": "teamHr",
  "/integrations": "integrations", "/crm": "crm", "/booking": "booking",
  "/tickets": "tickets", "/knowledge-base": "knowledgeBase",
  "/analytics": "analytics", "/reports": "reports", "/studio": "studio",
  "/settings": "settings", "/import": "import", "/ads": "adIntegrations",
  "/website-crawler": "websiteCrawler", "/public-profile": "publicProfile",   "/properties": "properties", "/shipments": "shipments",
  "/channel-partners": "channelPartners", "/payment-schedules": "paymentSchedules",
  "/projects": "projects",
  "/marketing-journeys": "marketingJourneys",
  "/marketing-events": "marketingEvents",
  "/portfolio": "portfolio",
  "/cash-flow-forecast": "cashFlowForecast",
  "/revenue-share": "revenueShare",
  "/resale-listings": "resaleListings",
  "/referrals": "referrals",
  "/nri-profiles": "nriProfiles",
  "/construction-erp": "constructionErp",
  "/document-search": "documentSearch",
  "/physical-documents": "physicalDocuments",
  "/allied-inventory": "alliedInventory",
  "/sales-targets": "salesTargets",
  "/digital-sales-room": "digitalSalesRoom",
  "/advanced-marketing": "advancedMarketing",
  "/onboarding-progress": "onboardingProgress",
  "/launch-control": "launchControl",
};

const labelMap: Record<string, "contact" | "conversion"> = {
  "/contacts": "contact",
  "/conversions": "conversion",
};

const rawNavGroups = [
  {
    label: "Overview",
    items: [
      { label: "Today", icon: LayoutDashboard, path: "/" },
      { label: "My Queue", icon: CheckSquare, path: "/queue" },
      { label: "Builder Desk", icon: Building2, path: "/builder-desk" },
    ],
  },
  {
    label: "Leads",
    items: [
      { label: "Leads", icon: Users, path: "/leads" },
      { label: "Smart Lists", icon: Layers, path: "/smart-lists" },
      { label: "Pipeline", icon: Columns3, path: "/pipeline" },
      { label: "Contacts", icon: UserCircle, path: "/contacts" },
      { label: "Campaigns", icon: Megaphone, path: "/campaigns" },
      { label: "Forms", icon: FormInput, path: "/forms" },
      { label: "QR Codes", icon: QrCode, path: "/qr-codes" },
    ],
  },
  {
    label: "Outreach",
    items: [
      { label: "Voice Agent", icon: Phone, path: "/voice-agent" },
      { label: "Voice Campaigns", icon: Megaphone, path: "/voice-campaigns" },
      { label: "Call Logs", icon: PhoneCall, path: "/voice-call-logs" },
      { label: "Voice Knowledge Base", icon: BookOpen, path: "/voice-knowledge-base" },
      { label: "Post-Call Workflows", icon: GitBranch, path: "/voice-post-call-workflows" },
      { label: "Voice Agent Settings", icon: Settings, path: "/voice-agent-settings" },
      { label: "Message Log", icon: MessageSquare, path: "/conversations" },
      { label: "Templates", icon: FileText, path: "/templates" },
      { label: "Media", icon: Layers, path: "/media" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "Journeys", icon: GitBranch, path: "/marketing-journeys" },
      { label: "Events", icon: Calendar, path: "/marketing-events" },
      { label: "Referrals", icon: Gift, path: "/referrals" },
      { label: "Advanced Marketing", icon: Megaphone, path: "/advanced-marketing" },
      { label: "Digital Sales Room", icon: ShoppingCart, path: "/digital-sales-room" },
    ],
  },
  {
    label: "Automation",
    items: [

      { label: "Scoring", icon: BarChart3, path: "/scoring" },
      { label: "Rules", icon: Target, path: "/rules" },
      { label: "AI Campaigns", icon: Sparkles, path: "/ai-campaigns" },
      { label: "AI Agent", icon: Bot, path: "/ai-agent" },
      { label: "Workflows", icon: GitBranch, path: "/workflows" },
      { label: "Flow Builder", icon: GitBranch, path: "/flows" },
      { label: "Mikey", icon: MessageCircle, path: "/copilot" },
    ],
  },
  {
    label: "Channels",
    items: [
      { label: "Webhooks", icon: Webhook, path: "/webhooks" },
      { label: "SMS", icon: Smartphone, path: "/sms" },
      { label: "Chat Widget", icon: Globe, path: "/widget" },
      { label: "Calls", icon: Phone, path: "/calls" },
      { label: "Sync Logs", icon: Activity, path: "/sync-logs" },
      { label: "Social Media", icon: MessageCircle, path: "/integrations" },
      { label: "Lead Source Health", icon: Activity, path: "/source-health" },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { label: "Conversions", icon: ShoppingCart, path: "/conversions" },
      { label: "Tasks", icon: CheckSquare, path: "/tasks" },
    ],
  },
  {
    label: "Listings",
    items: [
      { label: "Projects", icon: Package, path: "/projects" },
      { label: "Properties", icon: Building2, path: "/properties" },
      { label: "Site Visits", icon: CalendarClock, path: "/site-visits" },
      { label: "Cost Sheets", icon: FileText, path: "/cost-sheets" },
      { label: "Resale/Rental", icon: Building2, path: "/resale-listings" },
      { label: "Allied Inventory", icon: Package, path: "/allied-inventory" },
      { label: "KYC & Documents", icon: FileText, path: "/kyc" },
      { label: "Document Search", icon: FileSearch, path: "/document-search" },
      { label: "Physical Docs", icon: BookCopy, path: "/physical-documents" },
      { label: "Agents", icon: Truck, path: "/channel-partners" },
      { label: "Partner Claims", icon: Truck, path: "/partner-claims" },
      { label: "Approvals", icon: CheckSquare, path: "/approvals" },
      { label: "Payments & Collections", icon: ClipboardList, path: "/payment-schedules" },
      { label: "Collections Ledger", icon: ClipboardList, path: "/collections" },
      { label: "Portfolio", icon: BarChart3, path: "/portfolio" },
      { label: "Launch Control", icon: Activity, path: "/launch-control" },
      { label: "Onboarding", icon: CheckSquare, path: "/onboarding-progress" },
      { label: "NRI Buyers", icon: Globe, path: "/nri-profiles" },
      { label: "Construction ERP", icon: HardDrive, path: "/construction-erp" },
      { label: "Cash Flow Forecast", icon: BarChart3, path: "/cash-flow-forecast" },
      { label: "Revenue Share", icon: DollarSign, path: "/revenue-share" },
      { label: "Sales Targets", icon: Target, path: "/sales-targets" },
      { label: "Vezraa Apartments", icon: ExternalLink, path: "/webverse" },
      { label: "Vezraa Villas", icon: ExternalLink, path: "/villa-webverse" },
    ],
  },
  {
    label: "Shipments",
    items: [
      { label: "Shipments", icon: Truck, path: "/shipments" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Events", icon: Calendar, path: "/events" },
      { label: "Calendar", icon: Calendar, path: "/calendar" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Financial Overview", icon: BarChart3, path: "/accounting" },
      { label: "My Expenses", icon: ClipboardList, path: "/my-expenses" },
      { label: "Quotes & Estimates", icon: FileText, path: "/quotations" },
      { label: "Sale Agreements", icon: FileText, path: "/contracts" },
      { label: "Invoices", icon: FileText, path: "/invoices" },
      { label: "Finance Reports", icon: BarChart3, path: "/finance-reports" },
    ],
  },
  {
    label: "Procurement",
    items: [
      { label: "Partners", icon: Truck, path: "/partners" },
      { label: "Vendor Bookings", icon: ClipboardList, path: "/vendor-bookings" },
      { label: "Purchase Orders", icon: Package, path: "/purchase-orders" },
    ],
  },
  {
    label: "Assets",
    items: [
      { label: "Inventory", icon: Box, path: "/inventory" },
      { label: "Stock Movements", icon: Layers, path: "/stock-movements" },
      { label: "Locations", icon: MapPin, path: "/locations" },
    ],
  },
  {
    label: "Team",
    items: [
      { label: "Team Members", icon: Users, path: "/team" },
      { label: "Leave Log", icon: Calendar, path: "/leave-log" },
      { label: "Salaries", icon: BarChart3, path: "/salaries" },
      { label: "Timesheet", icon: CheckSquare, path: "/timesheet" },
    ],
  },
  {
    label: "Integrations",
    items: [
      { label: "Integrations", icon: Link, path: "/integrations" },
      { label: "CRM", icon: ShoppingCart, path: "/crm" },
      { label: "Booking", icon: Calendar, path: "/booking" },
    ],
  },
  {
    label: "Support",
    items: [
      { label: "Tickets", icon: LifeBuoy, path: "/tickets" },
      { label: "Knowledge Base", icon: BookOpen, path: "/knowledge-base" },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Analytics", icon: BarChart3, path: "/analytics" },
      { label: "Manager Dashboard", icon: Shield, path: "/manager-dashboard" },
      { label: "Reports", icon: BarChart3, path: "/reports" },
      { label: "Studio", icon: Puzzle, path: "/studio" },
      { label: "Settings", icon: Settings, path: "/settings" },
      { label: "Import Data", icon: Download, path: "/import" },
      { label: "Ad Integrations", icon: BarChart3, path: "/ads" },
      { label: "Website Crawler", icon: Globe, path: "/website-crawler" },
      { label: "Public Profile", icon: Building2, path: "/public-profile" },
    ],
  },
];

function getNavGroups() {
  const nicheLabel = getLabel("leads");
  return rawNavGroups
    .map((g) => ({
      ...g,
      label: g.label === "Leads" ? nicheLabel : g.label,
      items: g.items.filter((item) => {
        const feature = featureMap[item.path];
        return !feature || isFeatureEnabled(feature as any);
      }).map((item) => {
        const labelKey = labelMap[item.path];
        if (labelKey) return { ...item, label: getLabel(labelKey) };
        if (item.path === "/leads") return { ...item, label: getLabel("lead") };
        return item;
      }),
    }))
    .filter((g) => g.items.length > 0);
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: { collapsed: boolean; onToggle: () => void; mobileOpen?: boolean; onMobileClose?: () => void }) {
  const { logout } = useAuth();
  const branding = useBranding();
  const [profile, setProfile] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cfgRev, setCfgRev] = useState(0);

  useEffect(() => onConfigChange(() => setCfgRev(v => v + 1)), []);

  const findActiveGroupLabel = () => {
    const hash = (window.location.hash.replace('#', '') || '/').split('?')[0];
    const group = getNavGroups().find(g => g.items.some(item => hash === item.path || (item.path !== '/' && hash.startsWith(item.path))));
    return group?.label;
  };

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const active = findActiveGroupLabel();
    return new Set(active ? [active] : []);
  });
  const [activeHash, setActiveHash] = useState(() => window.location.hash);

  useEffect(() => {
    Promise.all([
      fetchProfile().catch(() => null),
      fetchBusinessSettings().catch(() => null),
    ]).then(([p, s]) => {
      setProfile(p);
      setSettings(s);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const onHash = () => {
      setActiveHash(window.location.hash);
      const active = findActiveGroupLabel();
      if (active) setOpenGroups(prev => (prev.has(active) ? prev : new Set(prev).add(active)));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  const companyName = settings?.businessName || profile?.tenant?.name || getBusinessName() || "LeadFlow";
  const initials = companyName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'BN';
  const userName = profile?.name || "User";
  const userEmail = profile?.email || "user@local";

  useEffect(() => {
    if (!mobileOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileOpen]);

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={onMobileClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(18rem,85vw)] flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] transition-transform duration-200 lg:w-64 lg:transition-[width] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 ${collapsed ? "lg:w-16" : "lg:w-64"}`}
      >
        <div className="flex h-14 items-center justify-between border-b border-[var(--sidebar-border)] px-4">
          {!collapsed && (
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="truncate text-sm font-bold text-[var(--sidebar-fg)]">{companyName}</span>
            </div>
          )}
          <button onClick={onToggle} className="hidden rounded-md p-1.5 text-[var(--sidebar-muted)] transition-all duration-150 hover:bg-[var(--sidebar-hover)] hover:scale-105 lg:block">
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {getNavGroups().map((group) => {
            const collapsible = group.items.length > 1;
            const isOpen = !collapsible || openGroups.has(group.label) || collapsed;
            return (
              <div key={group.label} className="pb-1">
                {!collapsed && (
                  collapsible ? (
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-[10px] font-semibold text-[var(--sidebar-muted)] uppercase tracking-wider hover:text-[var(--sidebar-fg)] transition-colors duration-150 active:scale-[0.98]"
                    >
                      <span>{group.label}</span>
                      <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                  ) : (
                    <p className="px-2.5 text-[10px] font-semibold text-[var(--sidebar-muted)] uppercase tracking-wider mb-1">
                      {group.label}
                    </p>
                  )
                )}
                <div
                  className={`space-y-0.5 overflow-hidden transition-all duration-200 ease-out ${
                    isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  {group.items.map((item) => {
                    const isExternal = item.path === "/webverse" || item.path === "/villa-webverse";
                    const isActive = !isExternal && (activeHash.split('?')[0] === `#${item.path}` || (!activeHash && item.path === "/"));
                    const externalUrl = item.path === "/webverse" ? "../vezraa-apartments/index.html" : "../vezraa-villas/index.html";
                    return (
                      <a
                        key={item.path}
                        href={isExternal ? externalUrl : `#${item.path}`}
                        target={isExternal ? "_blank" : undefined}
                        rel={isExternal ? "noopener noreferrer" : undefined}
                        onClick={onMobileClose}
                        className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium relative transition-all duration-150 ${
                          isActive
                            ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-fg)]"
                            : "text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] hover:translate-x-0.5"
                        }`}
                      >
                        {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-[var(--sidebar-active-fg)]" />}
                        <item.icon size={17} strokeWidth={2} className="shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-[var(--sidebar-border)] p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[var(--sidebar-hover)] transition-all duration-150 cursor-pointer active:scale-[0.99]">
            <div className="h-7 w-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-white shrink-0">
              {profile?.name?.[0] || 'U'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--sidebar-fg)] truncate">{userName}</p>
                <p className="text-xs text-[var(--sidebar-muted)] truncate">{userEmail}</p>
              </div>
            )}
            <button
              onClick={(e) => { e.preventDefault(); logout(); }}
              className="rounded-md p-1.5 hover:bg-red-500/10 text-[var(--sidebar-muted)] hover:text-red-400 transition-all duration-150 active:scale-95"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
