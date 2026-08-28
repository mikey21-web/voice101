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
  "/voice-agent": "voiceAgent", "/voice-employees": "voiceAgent", "/voice-agent-settings": "voiceAgent", "/voice-campaigns": "voiceAgent", "/voice-call-logs": "voiceAgent", "/voice-knowledge-base": "voiceAgent", "/voice-post-call-workflows": "voiceAgent", "/talk-to-build": "voiceAgent",
  "/voice-dashboard": "voiceAgent", "/voice-instant-leads": "voiceAgent", "/voice-inbound-calls": "voiceAgent", "/voice-all-conversations": "voiceAgent", "/voice-leads-results": "voiceAgent", "/voice-phone-numbers": "voiceAgent", "/voice-performance": "voiceAgent", "/caller-memory": "voiceAgent",
  "/conversations": "messages", "/templates": "templates", "/media": "media",
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
  "/website-crawler": "websiteCrawler", "/public-profile": "publicProfile",
};

const labelMap: Record<string, "contact" | "conversion"> = {
  "/contacts": "contact",
  "/conversions": "conversion",
};

const rawNavGroups = [
  {
    label: "OVERVIEW",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/voice-dashboard" },
      { label: "My Employees", icon: Users, path: "/voice-employees" },
      { label: "New employee", icon: Sparkles, path: "/talk-to-build" },
      { label: "Talk to an employee", icon: Headset, path: "/talk-to-employee" },
    ],
  },
  {
    label: "CALLING",
    items: [
      { label: "Instant Leads", icon: Phone, path: "/voice-instant-leads" },
      { label: "Bulk Campaigns", icon: Megaphone, path: "/voice-campaigns" },
      { label: "Inbound Calls", icon: PhoneCall, path: "/voice-inbound-calls" },
    ],
  },
  {
    label: "RESULTS & SETUP",
    items: [
      { label: "Leads & Results", icon: BarChart3, path: "/voice-leads-results" },
      { label: "All Conversations", icon: MessageSquare, path: "/voice-all-conversations" },
      { label: "Train Employees", icon: BookOpen, path: "/voice-knowledge-base" },
      { label: "Caller Memory", icon: Brain, path: "/caller-memory" },
      { label: "Phone Numbers", icon: Settings, path: "/voice-phone-numbers" },
      { label: "Performance", icon: BarChart3, path: "/voice-performance" },
      { label: "Store / Hire", icon: Sparkles, path: "/store" },
      { label: "Billing", icon: FileText, path: "/voice-billing" },
      { label: "Settings", icon: Settings, path: "/voice-agent-settings" },
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
        if (!feature) return true;
        if (item.path.startsWith("/voice-") || item.path.startsWith("/talk-to-")) return true;
        return isFeatureEnabled(feature as any);
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
    return new Set(["OVERVIEW", "CALLING", "RESULTS & SETUP"]);
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
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-bold tracking-tight text-[var(--sidebar-fg)]">OUTPERO</span>
              <span className="text-[10px] font-semibold tracking-widest text-[var(--sidebar-muted)]">AI PHONE CALLING</span>
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
