import { getToken } from "./api";

export type NicheConfig = {
  businessName: string;
  primaryColor: string;
  sidebarBg: string;
  sidebarActiveBg: string;
  sidebarAccent: string;
  logo: string;
  labels: {
    lead: string;
    leads: string;
    contact: string;
    conversion: string;
  };
  team: {
    pageSubtitle: string;
    rolePlaceholder: string;
    deptPlaceholder: string;
    skillsPlaceholder: string;
    permissionModuleLabels: Record<string, string>;
  };
  features: {
    nurture: boolean;
    scoring: boolean;
    routing: boolean;
    crm: boolean;
    booking: boolean;
    tickets: boolean;
    knowledgeBase: boolean;
    media: boolean;
    qrCodes: boolean;
    reports: boolean;
    campaigns: boolean;
    forms: boolean;
    messages: boolean;
    templates: boolean;
    aiCampaigns: boolean;
    aiAgent: boolean;
    copilot: boolean;
    webhooks: boolean;
    sms: boolean;
    widget: boolean;
    tasks: boolean;
    integrations: boolean;
    analytics: boolean;
    studio: boolean;
    events: boolean;
    finance: boolean;
    procurement: boolean;
    inventory: boolean;
    teamHr: boolean;
    publicProfile: boolean;
    overview: boolean;
    leads: boolean;
    pipeline: boolean;
    contacts: boolean;
    calls: boolean;
    syncLogs: boolean;
    conversions: boolean;
    settings: boolean;
    import: boolean;
    adIntegrations: boolean;
    websiteCrawler: boolean;
    properties: boolean;
    shipments: boolean;
    channelPartners: boolean;
    paymentSchedules: boolean;
    projects: boolean;
    voiceAgent: boolean;
    portfolio: boolean;
    resaleListings: boolean;
    nriProfiles: boolean;
    constructionErp: boolean;
    documentSearch: boolean;
    physicalDocuments: boolean;
    alliedInventory: boolean;
    salesTargets: boolean;
    cashFlowForecast: boolean;
    revenueShare: boolean;
    launchControl: boolean;
    onboardingProgress: boolean;
  };
};

const realestate: NicheConfig = {
  businessName: "Acme Realty", primaryColor: "#0B5B7A",
  sidebarBg: "#f8f8f8", sidebarActiveBg: "#0B5B7A12", sidebarAccent: "#0B5B7A",
  logo: "",
  labels: { lead: "Buyer", leads: "Buyers", contact: "Contact", conversion: "Deal" },
  team: {
    pageSubtitle: "Manage your sales team.",
    rolePlaceholder: "Sales Agent",
    deptPlaceholder: "Pre-Sales",
    skillsPlaceholder: "Site Visits, Buyer Follow-up, Negotiation",
    permissionModuleLabels: { DASHBOARD: "Dashboard", EVENTS: "Properties", CRM: "Buyers", VENDORS: "Channel Partners", TEAM: "Team", TIMESHEET: "Site Visits", ACCOUNTING: "Payments & Collections", INVENTORY: "Unit Inventory", PROCUREMENT: "Procurement" },
  },
  features: { overview: true, leads: true, pipeline: true, contacts: true, calls: true, syncLogs: false, conversions: true, settings: true, import: true, adIntegrations: false, websiteCrawler: false, nurture: false, scoring: true, routing: true, crm: true, booking: true, tickets: false, knowledgeBase: false, media: true, qrCodes: true, reports: true, campaigns: true, forms: true, messages: true, templates: true, aiCampaigns: true, aiAgent: true, copilot: true, webhooks: true, sms: true, widget: true, tasks: true, integrations: false, analytics: true, studio: true, events: false, finance: true, procurement: false, inventory: false, teamHr: true, publicProfile: true, properties: true, shipments: false, channelPartners: true, paymentSchedules: true, projects: true, voiceAgent: true, portfolio: true, resaleListings: true, nriProfiles: true, constructionErp: true, documentSearch: true, physicalDocuments: true, alliedInventory: true, salesTargets: true, cashFlowForecast: true, revenueShare: true, launchControl: true, onboardingProgress: true },
};

const hospitality: NicheConfig = {
  businessName: "StayWell Hotels", primaryColor: "#0E7C7B",
  sidebarBg: "#f8f8f8", sidebarActiveBg: "#0E7C7B12", sidebarAccent: "#0E7C7B",
  logo: "",
  labels: { lead: "Guest", leads: "Guests", contact: "Contact", conversion: "Booking" },
  team: {
    pageSubtitle: "Manage your hotel staff.",
    rolePlaceholder: "Front Desk Executive",
    deptPlaceholder: "Guest Services",
    skillsPlaceholder: "Check-in/out, Guest Relations, Housekeeping",
    permissionModuleLabels: { DASHBOARD: "Dashboard", EVENTS: "Bookings", CRM: "Guests", VENDORS: "Vendors", TEAM: "Team", TIMESHEET: "Shifts", ACCOUNTING: "Accounting", INVENTORY: "Rooms & Inventory", PROCUREMENT: "Procurement" },
  },
  features: { overview: true, leads: true, pipeline: true, contacts: true, calls: true, syncLogs: false, conversions: true, settings: true, import: false, adIntegrations: false, websiteCrawler: false, nurture: true, scoring: true, routing: false, crm: true, booking: true, tickets: true, knowledgeBase: false, media: true, qrCodes: false, reports: false, campaigns: false, forms: true, messages: true, templates: true, aiCampaigns: false, aiAgent: true, copilot: true, webhooks: true, sms: true, widget: true, tasks: true, integrations: true, analytics: false, studio: false, events: true, finance: false, procurement: true, inventory: true, teamHr: true, publicProfile: true, properties: false, shipments: false, channelPartners: false, paymentSchedules: false, projects: false, voiceAgent: false, portfolio: false, resaleListings: false, nriProfiles: false, constructionErp: false, documentSearch: false, physicalDocuments: false, alliedInventory: false, salesTargets: false, cashFlowForecast: false, revenueShare: false, launchControl: false, onboardingProgress: false },
};

const healthcare: NicheConfig = {
  businessName: "CarePlus Clinic", primaryColor: "#2563EB",
  sidebarBg: "#f8f8f8", sidebarActiveBg: "#2563EB12", sidebarAccent: "#2563EB",
  logo: "",
  labels: { lead: "Patient Inquiry", leads: "Patient Inquiries", contact: "Patient", conversion: "Appointment" },
  team: {
    pageSubtitle: "Manage your clinical and front-desk staff.",
    rolePlaceholder: "Front Desk Coordinator",
    deptPlaceholder: "Patient Care",
    skillsPlaceholder: "Scheduling, Patient Intake, Insurance Verification",
    permissionModuleLabels: { DASHBOARD: "Dashboard", EVENTS: "Appointments", CRM: "Patients", VENDORS: "Vendors", TEAM: "Team", TIMESHEET: "Shifts", ACCOUNTING: "Billing", INVENTORY: "Supplies", PROCUREMENT: "Procurement" },
  },
  features: { overview: true, leads: true, pipeline: true, contacts: true, calls: true, syncLogs: false, conversions: true, settings: true, import: false, adIntegrations: false, websiteCrawler: false, nurture: true, scoring: true, routing: true, crm: true, booking: true, tickets: true, knowledgeBase: true, media: false, qrCodes: false, reports: true, campaigns: false, forms: true, messages: true, templates: true, aiCampaigns: false, aiAgent: true, copilot: true, webhooks: true, sms: true, widget: true, tasks: true, integrations: true, analytics: false, studio: false, events: true, finance: true, procurement: true, inventory: true, teamHr: true, publicProfile: true, properties: false, shipments: false, channelPartners: false, paymentSchedules: false, projects: false, voiceAgent: false, portfolio: false, resaleListings: false, nriProfiles: false, constructionErp: false, documentSearch: false, physicalDocuments: false, alliedInventory: false, salesTargets: false, cashFlowForecast: false, revenueShare: false, launchControl: false, onboardingProgress: false },
};

const agency: NicheConfig = {
  businessName: "GrowthEdge Marketing", primaryColor: "#DB2777",
  sidebarBg: "#f8f8f8", sidebarActiveBg: "#DB277712", sidebarAccent: "#DB2777",
  logo: "",
  labels: { lead: "Prospect", leads: "Prospects", contact: "Client", conversion: "Signed Client" },
  team: {
    pageSubtitle: "Manage your agency team.",
    rolePlaceholder: "Account Manager",
    deptPlaceholder: "Client Services",
    skillsPlaceholder: "Paid Media, SEO, Client Reporting",
    permissionModuleLabels: { DASHBOARD: "Dashboard", EVENTS: "Campaigns", CRM: "CRM", VENDORS: "Vendors", TEAM: "Team", TIMESHEET: "Timesheet", ACCOUNTING: "Accounting", INVENTORY: "Inventory", PROCUREMENT: "Procurement" },
  },
  features: { overview: true, leads: true, pipeline: true, contacts: true, calls: true, syncLogs: false, conversions: true, settings: true, import: true, adIntegrations: true, websiteCrawler: true, nurture: true, scoring: true, routing: true, crm: true, booking: true, tickets: true, knowledgeBase: true, media: true, qrCodes: true, reports: true, campaigns: true, forms: true, messages: true, templates: true, aiCampaigns: true, aiAgent: true, copilot: true, webhooks: true, sms: true, widget: true, tasks: true, integrations: true, analytics: true, studio: true, events: true, finance: true, procurement: false, inventory: false, teamHr: true, publicProfile: true, properties: false, shipments: false, channelPartners: false, paymentSchedules: false, projects: false, voiceAgent: false, portfolio: false, resaleListings: false, nriProfiles: false, constructionErp: false, documentSearch: false, physicalDocuments: false, alliedInventory: false, salesTargets: false, cashFlowForecast: false, revenueShare: false, launchControl: false, onboardingProgress: false },
};

const logistics: NicheConfig = {
  businessName: "SwiftFreight Logistics", primaryColor: "#EA580C",
  sidebarBg: "#f8f8f8", sidebarActiveBg: "#EA580C12", sidebarAccent: "#EA580C",
  logo: "",
  labels: { lead: "Shipper", leads: "Shippers", contact: "Contact", conversion: "Shipment" },
  team: {
    pageSubtitle: "Manage your logistics team.",
    rolePlaceholder: "Fleet Coordinator",
    deptPlaceholder: "Operations",
    skillsPlaceholder: "Route Planning, Dispatch, Customer Follow-up",
    permissionModuleLabels: { DASHBOARD: "Dashboard", EVENTS: "Shipments", CRM: "Shippers", VENDORS: "Vendors", TEAM: "Team", TIMESHEET: "Timesheet", ACCOUNTING: "Accounting", INVENTORY: "Inventory", PROCUREMENT: "Procurement" },
  },
  features: { overview: true, leads: true, pipeline: true, contacts: true, calls: true, syncLogs: false, conversions: true, settings: true, import: false, adIntegrations: false, websiteCrawler: false, nurture: true, scoring: true, routing: true, crm: true, booking: true, tickets: true, knowledgeBase: false, media: true, qrCodes: true, reports: true, campaigns: false, forms: true, messages: true, templates: true, aiCampaigns: false, aiAgent: true, copilot: true, webhooks: true, sms: true, widget: true, tasks: true, integrations: true, analytics: false, studio: false, events: false, finance: true, procurement: true, inventory: true, teamHr: true, publicProfile: true, properties: false, shipments: true, channelPartners: false, paymentSchedules: false, projects: false, voiceAgent: false, portfolio: false, resaleListings: false, nriProfiles: false, constructionErp: false, documentSearch: false, physicalDocuments: false, alliedInventory: false, salesTargets: false, cashFlowForecast: false, revenueShare: false, launchControl: false, onboardingProgress: false },
};

const eventMarketing: NicheConfig = {
  businessName: "EventPro Marketing", primaryColor: "#0E9D6E",
  sidebarBg: "#f8f8f8", sidebarActiveBg: "#0E9D6E12", sidebarAccent: "#0E9D6E",
  logo: "",
  labels: { lead: "Client", leads: "Clients", contact: "Contact", conversion: "Booking" },
  team: {
    pageSubtitle: "Manage your event team.",
    rolePlaceholder: "Event Manager",
    deptPlaceholder: "Operations",
    skillsPlaceholder: "Event Planning, Vendor Coordination",
    permissionModuleLabels: { DASHBOARD: "Dashboard", EVENTS: "Events", CRM: "CRM", VENDORS: "Vendors", TEAM: "Team", TIMESHEET: "Timesheet", ACCOUNTING: "Accounting", INVENTORY: "Inventory", PROCUREMENT: "Procurement" },
  },
  features: { overview: true, leads: true, pipeline: true, contacts: true, calls: true, syncLogs: false, conversions: true, settings: true, import: false, adIntegrations: false, websiteCrawler: false, nurture: true, scoring: true, routing: true, crm: true, booking: true, tickets: true, knowledgeBase: true, media: true, qrCodes: true, reports: true, campaigns: true, forms: true, messages: true, templates: true, aiCampaigns: true, aiAgent: true, copilot: true, webhooks: true, sms: true, widget: true, tasks: true, integrations: true, analytics: false, studio: false, events: true, finance: true, procurement: true, inventory: true, teamHr: true, publicProfile: true, properties: false, shipments: false, channelPartners: false, paymentSchedules: false, projects: false, voiceAgent: false, portfolio: false, resaleListings: false, nriProfiles: false, constructionErp: false, documentSearch: false, physicalDocuments: false, alliedInventory: false, salesTargets: false, cashFlowForecast: false, revenueShare: false, launchControl: false, onboardingProgress: false },
};

const nicheMap: Record<string, NicheConfig> = {
  realestate,
  hospitality,
  healthcare,
  logistics,
  "event-marketing-agency": eventMarketing,
  agency,
};

const subdomainToNiche: Record<string, string> = {
  realestate: "realestate",
  hospitality: "hospitality",
  healthcare: "healthcare",
  agency: "agency",
  logistics: "logistics",
};

function detectNicheFromHost(): string | null {
  try {
    const host = window.location.hostname;
    const sub = host.split(".")[0];
    return subdomainToNiche[sub] || null;
  } catch {
    return null;
  }
}

const hostNiche = detectNicheFromHost();
const envNiche = hostNiche || import.meta.env.VITE_NICHE_NAME || "agency";
let currentConfig: NicheConfig = nicheMap[envNiche] || agency;

const industryToNiche: Record<string, string> = {
  "real-estate": "realestate",
  "real estate": "realestate",
  hospitality: "hospitality",
  hotel: "hospitality",
  healthcare: "healthcare",
  clinic: "healthcare",
  logistics: "logistics",
  transport: "logistics",
  events: "event-marketing-agency",
  wedding: "event-marketing-agency",
  "event planning": "event-marketing-agency",
  agency: "agency",
  marketing: "agency",
};

let configListeners: Array<() => void> = [];

export function onConfigChange(fn: () => void): () => void {
  configListeners.push(fn);
  return () => { configListeners = configListeners.filter(l => l !== fn); };
}

export async function initNicheConfig(): Promise<void> {
  const subdomainNiche = detectNicheFromHost();
  const token = getToken();
  if (!token) return; // not logged in yet — subdomain-based default already applied
  try {
    const res = await fetch("/api/business-settings", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error("Failed to fetch settings");
    const settings = await res.json();
    if (!subdomainNiche) {
      const industry = settings?.industry?.toLowerCase().trim();
      if (industry && industryToNiche[industry]) {
        currentConfig = { ...nicheMap[industryToNiche[industry]] };
      }
      if (settings?.businessName) currentConfig.businessName = settings.businessName;
    }
    configListeners.forEach(fn => fn());
  } catch {
  }
}

export function getNicheName(): string {
  return Object.entries(nicheMap).find(([, c]) => c === currentConfig)?.[0] || envNiche;
}

export function getBusinessName(): string {
  return currentConfig.businessName;
}

export function getPrimaryColor(): string {
  return currentConfig.primaryColor;
}

export function getNicheLogo(): string {
  return currentConfig.logo;
}

export function getSidebarBg(): string {
  return currentConfig.sidebarBg;
}

export function getSidebarActiveBg(): string {
  return currentConfig.sidebarActiveBg;
}

export function getSidebarAccent(): string {
  return currentConfig.sidebarAccent;
}

export function applyNicheTheme(): void {
  const root = document.documentElement;
  root.style.setProperty("--primary", currentConfig.primaryColor);
  root.style.setProperty("--ring", currentConfig.primaryColor);
  root.style.setProperty("--primary-light", `${currentConfig.primaryColor}22`);
  root.style.setProperty("--sidebar-active-fg", currentConfig.primaryColor);
}

export function getLabel(key: keyof NicheConfig["labels"]): string {
  return currentConfig.labels[key];
}

export function getTeamConfig(): NicheConfig["team"] {
  return currentConfig.team;
}

export function getPermissionModuleLabel(module: string): string {
  return currentConfig.team.permissionModuleLabels[module] || module.replace(/_/g, " ");
}

export function isFeatureEnabled(key: keyof NicheConfig["features"]): boolean {
  return currentConfig.features[key];
}
