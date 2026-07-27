import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/useAuth';
import {
  Users, Target, TrendingUp, BarChart3, Activity,
  Zap, AlertTriangle, AlertCircle, CheckCircle,
  DollarSign, Clock, Phone, MessageSquare, Calendar,
  ChevronRight, Loader2, ArrowUpRight, ArrowDownRight,
  CheckSquare, UserCheck, Building2, MapPin, Bot,
  Volume2, VolumeX, ChevronLeft, Bed, Bath,
  Maximize2, Star,
} from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DailyBrief {
  date: string;
  summary: {
    newLeadsYesterday: number;
    newLeadsToday: number;
    hotLeads: number;
    totalLeads: number;
    slowAgents: Array<{ id: string; name: string; hotLeadCount: number; responseTimeHours: number }>;
  };
  sources: Array<{
    name: string; leads7d: number; leadsYesterday: number;
    leadsPrevious7d: number; changePercent: number; alert: 'drop' | 'surge' | 'normal';
  }>;
  revenueAtRisk: { totalPaise: number; overdueCollectionsPaise: number; bookingsAtRisk: number; currency: string };
  readyForBooking: Array<{
    leadId: string; leadName: string; phone: string;
    interest: string; daysSinceLastContact: number; missingCostSheet: boolean;
  }>;
  channelConflicts: Array<{
    leadId: string; leadName: string; partners: string[]; projects: string[];
  }>;
  pendingApprovals: {
    count: number;
    items: Array<{ id: string; type: string; title: string; description: string; createdAt: string }>;
  };
  todayVisits: Array<{
    id: string; leadId: string; leadName: string; phone: string;
    startAt: string; projectName?: string; interest?: string;
    lastMessage?: string; budget?: string;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Mock Data — EstateRocket sections                                  */
/* ------------------------------------------------------------------ */

const STATS = [
  { icon: Building2, label: "Total Listings", value: "428", delta: "+12.4%", timeframe: "vs last month", positive: true },
  { icon: TrendingUp, label: "Active Deals", value: "86", delta: "+8.1%", timeframe: "vs last month", positive: true },
  { icon: DollarSign, label: "Revenue MTD", value: "₹2.4Cr", delta: "+18.6%", timeframe: "vs last month", positive: true },
  { icon: Users, label: "Pending Inquiries", value: "34", delta: "-4.2%", timeframe: "vs last month", positive: false },
];

const SALES_DATA = [
  { month: "Jan", sales: 14500000, rentals: 3500000 },
  { month: "Feb", sales: 18000000, rentals: 3200000 },
  { month: "Mar", sales: 16000000, rentals: 4200000 },
  { month: "Apr", sales: 23500000, rentals: 3800000 },
  { month: "May", sales: 20000000, rentals: 4400000 },
  { month: "Jun", sales: 26000000, rentals: 4100000 },
];

const LISTING_MIX = [
  { label: "Residential", value: 42, color: "#0F766E" },
  { label: "Commercial", value: 28, color: "#3b82f6" },
  { label: "Luxury", value: 20, color: "#d97706" },
  { label: "Land & Plot", value: 10, color: "#8b5cf6" },
];

const PROPERTIES = [
  { id: 1, title: "Palm Grove Villa, Whitefield", price: "₹1.05Cr", type: "Modern Villa", beds: 4, baths: 3, sqft: 3200, agent: "Priya Sharma", agentInitials: "PS", status: "For Sale" },
  { id: 2, title: "Sea Breeze Tower, Marine Drive", price: "₹72L", type: "Waterfront Apartment", beds: 3, baths: 2, sqft: 2100, agent: "Arun Mehta", agentInitials: "AM", status: "For Sale" },
  { id: 3, title: "Emerald Estate, DLF Phase 5", price: "₹1.75Cr", type: "Luxury Villa", beds: 6, baths: 4, sqft: 5800, agent: "Neha Kapoor", agentInitials: "NK", status: "Featured" },
  { id: 4, title: "Garden Residency, Banjara Hills", price: "₹45L", type: "Cozy Cottage", beds: 2, baths: 1, sqft: 1200, agent: "Rahul Verma", agentInitials: "RV", status: "New" },
  { id: 5, title: "Lakeview Apartments, Powai", price: "₹85L", type: "Premium Condo", beds: 3, baths: 2, sqft: 1850, agent: "Priya Sharma", agentInitials: "PS", status: "For Sale" },
  { id: 6, title: "Golden Tulip, Sector 62 Noida", price: "₹1.2Cr", type: "Penthouse", beds: 4, baths: 3, sqft: 2800, agent: "Arun Mehta", agentInitials: "AM", status: "Featured" },
  { id: 7, title: "Sanskriti Residency, Electronic City", price: "₹32L", type: "Studio Apartment", beds: 1, baths: 1, sqft: 650, agent: "Rahul Verma", agentInitials: "RV", status: "New" },
  { id: 8, title: "Riverside Enclave, Koregaon Park", price: "₹2.1Cr", type: "Independent House", beds: 5, baths: 4, sqft: 4500, agent: "Neha Kapoor", agentInitials: "NK", status: "For Sale" },
];

const PROPERTY_IMAGES: Record<number, string> = {
  1: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=280&fit=crop",
  2: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=280&fit=crop",
  3: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&h=280&fit=crop",
  4: "https://images.unsplash.com/photo-1600566753086-00f18f6bae82?w=400&h=280&fit=crop",
  5: "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=400&h=280&fit=crop",
  6: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=400&h=280&fit=crop",
  7: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=280&fit=crop",
  8: "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=400&h=280&fit=crop",
};

const DEALS = [
  { property: "Palm Grove Villa, Whitefield", buyer: "Suresh & Anita Reddy", amount: "₹1.05Cr", status: "Closing", date: "2026-07-28" },
  { property: "Sea Breeze Tower, Marine Drive", buyer: "Vikram Patel", amount: "₹72L", status: "Under Contract", date: "2026-07-25" },
  { property: "Emerald Estate, DLF Phase 5", buyer: "The Chopra Family Trust", amount: "₹1.75Cr", status: "Negotiation", date: "2026-07-22" },
  { property: "Lakeview Apartments, Powai", buyer: "Deepa Iyer", amount: "₹85L", status: "Under Contract", date: "2026-07-20" },
  { property: "Riverside Enclave, Koregaon Park", buyer: "Arvind & Meera Nair", amount: "₹2.1Cr", status: "Closing", date: "2026-07-18" },
  { property: "Golden Tulip, Sector 62 Noida", buyer: "Rajesh Gupta", amount: "₹1.2Cr", status: "Negotiation", date: "2026-07-15" },
];

const AGENTS = [
  { name: "Priya Sharma", initials: "PS", role: "Senior Agent", listings: 24, volume: "₹6.8Cr", closed: 18, color: "bg-emerald-500" },
  { name: "Arun Mehta", initials: "AM", role: "Luxury Specialist", listings: 18, volume: "₹4.8Cr", closed: 14, color: "bg-blue-500" },
  { name: "Neha Kapoor", initials: "NK", role: "Commercial Lead", listings: 15, volume: "₹5.3Cr", closed: 12, color: "bg-amber-500" },
  { name: "Rahul Verma", initials: "RV", role: "Residential Agent", listings: 11, volume: "₹3.2Cr", closed: 9, color: "bg-violet-500" },
  { name: "Kavita Joshi", initials: "KJ", role: "Luxury Rentals", listings: 9, volume: "₹2.1Cr", closed: 7, color: "bg-pink-500" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const formatINR = (paise: number) => {
  const amount = paise / 100;
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`;
  return `₹${amount.toLocaleString('en-IN')}`;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

const todayLabel = () =>
  new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const daysAgo = (n: number) => {
  if (n === 0) return 'today';
  if (n === 1) return 'yesterday';
  return `${n} days ago`;
};


function buildBriefSpeech(brief: DailyBrief, firstName: string): string {
  const s = brief.summary;
  const parts: string[] = [];
  parts.push(`Good morning${firstName ? ' ' + firstName : ''}. Here's where things stand.`);
  parts.push(`${s.newLeadsYesterday} new leads yesterday, ${s.hotLeads} hot right now out of ${s.totalLeads} total.`);
  if (brief.revenueAtRisk.totalPaise > 0) {
    parts.push(`${formatINR(brief.revenueAtRisk.totalPaise)} in revenue is at risk across ${brief.revenueAtRisk.bookingsAtRisk} bookings.`);
  }
  if (s.slowAgents.length > 0) {
    parts.push(`${s.slowAgents.length} agent${s.slowAgents.length > 1 ? 's are' : ' is'} responding slowly to hot leads.`);
  }
  if (brief.pendingApprovals.count > 0) {
    parts.push(`${brief.pendingApprovals.count} action${brief.pendingApprovals.count > 1 ? 's are' : ' is'} waiting on your approval.`);
  }
  if (brief.todayVisits.length > 0) {
    parts.push(`${brief.todayVisits.length} site visit${brief.todayVisits.length > 1 ? 's' : ''} scheduled today.`);
  }
  return parts.join(' ');
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function PageFallback() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-60 rounded-xl" />
        <Skeleton className="h-60 rounded-xl" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EstateRocket Sub-components                                        */
/* ------------------------------------------------------------------ */

function StatCard({ icon: Icon, label, value, delta, timeframe, positive, delay }: {
  icon: any; label: string; value: string; delta: string; timeframe: string; positive: boolean; delay: string;
}) {
  return (
    <div className={`rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 animate-fade-up ${delay}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">{label}</span>
        <div className="h-9 w-9 rounded-lg bg-[var(--primary-light)] flex items-center justify-center">
          <Icon size={16} className="text-[var(--primary)]" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold font-[family-name:var(--font-display)] text-[var(--foreground)] tabular-nums">{value}</span>
        <span className={`text-xs font-semibold flex items-center gap-0.5 ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
          {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {delta}
        </span>
      </div>
      <p className="text-xs text-[var(--muted-foreground)] mt-1">{timeframe}</p>
    </div>
  );
}

function SalesChart({ data }: { data: typeof SALES_DATA }) {
  const maxVal = Math.max(...data.map(d => d.sales));
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 animate-fade-up delay-4">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] text-[var(--foreground)]">Sales & Rentals Overview</h2>
          <p className="text-xs text-[var(--muted-foreground)]">Monthly performance</p>
        </div>
        <select className="text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-[var(--foreground)]">
          <option>This Year</option>
          <option>Last Year</option>
        </select>
      </div>
      <div className="flex items-end gap-3 h-40">
        {data.map(d => (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
            <div className="flex gap-0.5 w-full h-full items-end">
              <div
                className="flex-1 rounded-t-sm bg-[var(--chart-emerald)] transition-all duration-500"
                style={{ height: `${(d.sales / maxVal) * 100}%` }}
              />
              <div
                className="flex-1 rounded-t-sm bg-[var(--chart-blue)] transition-all duration-500"
                style={{ height: `${(d.rentals / maxVal) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-[var(--muted-foreground)] font-medium">{d.month}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-emerald)]" />
          <span className="text-xs text-[var(--muted-foreground)]">Sales</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-blue)]" />
          <span className="text-xs text-[var(--muted-foreground)]">Rentals</span>
        </div>
      </div>
    </div>
  );
}

function ListingMixDonut({ mix }: { mix: typeof LISTING_MIX }) {
  const segments = mix.map((item, i, arr) => {
    const prevSum = arr.slice(0, i).reduce((s, x) => s + x.value, 0);
    const start = (prevSum / 100) * 360;
    const end = ((prevSum + item.value) / 100) * 360;
    return { ...item, start, end };
  });
  const gradient = segments.map(s => `${s.color} ${s.start}deg ${s.end}deg`).join(', ');

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 animate-fade-up delay-5">
      <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] text-[var(--foreground)] mb-1">Listing Mix</h2>
      <p className="text-xs text-[var(--muted-foreground)] mb-5">Distribution by type</p>
      <div className="flex items-center gap-6">
        <div className="relative">
          <div
            className="h-32 w-32 rounded-full"
            style={{ background: `conic-gradient(${gradient})` }}
          >
            <div className="absolute inset-1.5 rounded-full bg-[var(--card)] flex items-center justify-center">
              <span className="text-xs font-semibold text-[var(--muted-foreground)]">100%</span>
            </div>
          </div>
        </div>
        <div className="space-y-2.5">
          {mix.map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: item.color }} />
              <span className="text-xs text-[var(--foreground)] min-w-20">{item.label}</span>
              <span className="text-xs font-semibold text-[var(--foreground)]">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PropertyCard({ property, index }: { property: typeof PROPERTIES[0]; index: number }) {
  return (
    <div className={`rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden animate-fade-up delay-${index + 3}`}>
      <div className="relative h-40 overflow-hidden">
        <img
          src={PROPERTY_IMAGES[property.id]}
          alt={property.title}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          loading="lazy"
        />
        <span className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          property.status === 'Featured' ? 'bg-amber-400 text-amber-950' :
          property.status === 'New' ? 'bg-emerald-500 text-white' :
          'bg-white/90 text-[var(--foreground)]'
        }`}>
          {property.status}
        </span>
        <span className="absolute top-2 right-2 text-xs font-bold bg-white/90 text-[var(--foreground)] px-2 py-0.5 rounded-full">
          {property.price}
        </span>
      </div>
      <div className="p-3.5">
        <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">{property.title}</h3>
        <p className="text-xs text-[var(--muted-foreground)] mb-2.5">{property.type}</p>
        <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)] mb-3">
          <span className="flex items-center gap-1"><Bed size={12} /> {property.beds}</span>
          <span className="flex items-center gap-1"><Bath size={12} /> {property.baths}</span>
          <span className="flex items-center gap-1"><Maximize2 size={12} /> {property.sqft.toLocaleString()} sqft</span>
        </div>
        <div className="flex items-center gap-2 pt-2.5 border-t border-[var(--border)]">
          <span className="h-6 w-6 rounded-full bg-[var(--primary)] text-[10px] font-semibold text-white flex items-center justify-center">
            {property.agentInitials}
          </span>
          <span className="text-xs text-[var(--muted-foreground)]">{property.agent}</span>
        </div>
      </div>
    </div>
  );
}

function DealsTimeline({ deals }: { deals: typeof DEALS }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 animate-fade-up delay-7">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] text-[var(--foreground)]">Active Deals</h2>
          <p className="text-xs text-[var(--muted-foreground)]">{deals.length} ongoing transactions</p>
        </div>
        <a href="#" className="group text-xs font-medium text-[var(--primary)] flex items-center gap-1">
          View All
          <ChevronRight size={12} className="transition-transform duration-150 group-hover:translate-x-0.5" />
        </a>
      </div>
      <div className="space-y-0">
        {deals.map((deal, i) => (
          <div key={i} className="flex items-start gap-3 pb-3 mb-3 border-b border-[var(--border)] last:border-0 last:mb-0 last:pb-0">
            <div className="relative flex flex-col items-center">
              <div className={`h-2.5 w-2.5 rounded-full mt-1.5 ${
                deal.status === 'Closing' ? 'bg-emerald-500' :
                deal.status === 'Under Contract' ? 'bg-blue-500' : 'bg-amber-500'
              }`} />
              {i < deals.length - 1 && <div className="w-px flex-1 bg-[var(--border)] min-h-6" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">{deal.property}</p>
                <span className="text-xs font-semibold text-[var(--foreground)] shrink-0 ml-2">{deal.amount}</span>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">{deal.buyer}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  deal.status === 'Closing' ? 'bg-emerald-50 text-emerald-700' :
                  deal.status === 'Under Contract' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {deal.status}
                </span>
                <span className="text-[10px] text-[var(--muted-foreground)]">{deal.date}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopAgents({ agents }: { agents: typeof AGENTS }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 animate-fade-up delay-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] text-[var(--foreground)]">Top Agents</h2>
          <p className="text-xs text-[var(--muted-foreground)]">Best performers this month</p>
        </div>
      </div>
      <div className="space-y-3">
        {agents.map((agent, i) => (
          <div key={agent.name} className="flex items-center gap-3 pb-3 border-b border-[var(--border)] last:border-0 last:pb-0">
            <span className={`h-8 w-8 rounded-lg ${agent.color} text-white text-xs font-semibold flex items-center justify-center shrink-0`}>
              {agent.initials}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)]">{agent.name}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{agent.role}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-[var(--foreground)]">{agent.volume}</p>
              <p className="text-[10px] text-[var(--muted-foreground)]">{agent.closed} closed</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Existing CRM Sub-components (unchanged)                            */
/* ------------------------------------------------------------------ */

function StatDonut({ percent, color }: { percent: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="relative h-20 w-20 rounded-full shrink-0"
      style={{ background: `conic-gradient(${color} ${clamped * 3.6}deg, var(--muted) 0deg)` }}
    >
      <div className="absolute inset-1.5 rounded-full bg-[var(--card)] flex items-center justify-center">
        <span className="text-sm font-bold text-[var(--foreground)]">{clamped}%</span>
      </div>
    </div>
  );
}

function HeroStatCard({ label, value, sublabel }: { label: string; value: number | string; sublabel: string }) {
  return (
    <div className="rounded-xl p-6 flex items-center justify-between border border-[var(--border)] bg-[var(--card)]">
      <div>
        <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
        <p className="text-3xl font-bold mt-1 text-[var(--foreground)]">{value}</p>
        <p className="text-xs text-[var(--muted-foreground)] mt-2">{sublabel}</p>
      </div>
      <div className="h-11 w-11 rounded-full bg-[var(--primary-light)] flex items-center justify-center shrink-0">
        <Building2 size={20} className="text-[var(--primary)]" />
      </div>
    </div>
  );
}

function HotLeadRatioCard({ hot, total }: { hot: number; total: number }) {
  const percent = total > 0 ? Math.round((hot / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 flex items-center gap-4">
      <StatDonut percent={percent} color="var(--chart-amber)" />
      <div>
        <p className="text-xs font-semibold text-emerald-600 bg-emerald-50 inline-block px-2 py-0.5 rounded-full mb-1">
          {hot} hot
        </p>
        <p className="text-2xl font-bold text-[var(--foreground)]">{total}</p>
        <p className="text-xs text-[var(--muted-foreground)]">total active leads</p>
      </div>
    </div>
  );
}

function StatChip({ icon: Icon, label, value, alert }: {
  icon: any; label: string; value: string | number; alert?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
      alert
        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400'
        : 'border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]'
    }`}>
      <Icon size={14} className={alert ? '' : 'text-[var(--muted-foreground)]'} />
      <span className="text-sm font-semibold">{value}</span>
      <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
    </div>
  );
}

function RevenueCard({ data }: { data: DailyBrief['revenueAtRisk'] | null }) {
  if (!data) return null;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center gap-2 mb-1">
        <DollarSign size={16} className="text-red-500" />
        <h3 className="font-semibold text-sm text-[var(--foreground)]">Revenue at Risk</h3>
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[var(--foreground)]">{formatINR(data.totalPaise)}</span>
          <span className="text-xs text-[var(--muted-foreground)]">at risk</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle size={12} className="text-amber-500" />
          <span className="text-[var(--muted-foreground)]">
            <strong className="text-amber-600">{formatINR(data.overdueCollectionsPaise)}</strong> overdue collections
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar size={12} className="text-amber-500" />
          <span className="text-[var(--muted-foreground)]">
            <strong className="text-amber-600">{data.bookingsAtRisk}</strong> booking{data.bookingsAtRisk !== 1 ? 's' : ''} may slip
          </span>
        </div>
      </div>
      <a href="#/collections" className="group mt-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)]">
        View Details <ChevronRight size={12} className="transition-transform duration-150 group-hover:translate-x-0.5" />
      </a>
    </div>
  );
}

function ApprovalsCard({ data }: { data: DailyBrief['pendingApprovals'] | null }) {
  if (!data) return null;
  const isEmpty = !data.items || data.items.length === 0;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center gap-2 mb-1">
        <CheckSquare size={16} className="text-[var(--primary)]" />
        <h3 className="font-semibold text-sm text-[var(--foreground)]">Pending Approvals</h3>
        {!isEmpty && (
          <span className="ml-auto text-xs font-semibold bg-[var(--primary)]/10 text-[var(--primary)] px-2 py-0.5 rounded-full">
            {data.count}
          </span>
        )}
      </div>
      {isEmpty ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle size={16} />
          <span>All caught up — no actions waiting</span>
        </div>
      ) : (
        <>
          <div className="mt-3 space-y-1">
            {data.items.slice(0, 5).map(item => (
              <div key={item.id} className="flex items-start gap-2 py-1.5 border-b border-[var(--border)] last:border-0">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm text-[var(--foreground)] truncate">{item.title}</div>
                  <div className="text-xs text-[var(--muted-foreground)] truncate">{item.description}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <a href="#/approvals"
              className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:border-[var(--border-strong)] transition-all duration-150 active:scale-[0.97]">
              Approve All
            </a>
            <a href="#/approvals"
              className="inline-flex items-center justify-center rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]">
              Review <ChevronRight size={12} className="ml-0.5" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}

function LeadPulseCard({ summary, sources }: {
  summary: DailyBrief['summary'] | null;
  sources: DailyBrief['sources'] | null;
}) {
  if (!summary) return null;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center gap-2 mb-1">
        <Activity size={16} className="text-[var(--primary)]" />
        <h3 className="font-semibold text-sm text-[var(--foreground)]">Lead Pulse</h3>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-y-2 gap-x-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-emerald-500" />
          <span className="text-lg font-bold text-[var(--foreground)]">{summary.newLeadsYesterday}</span>
          <span className="text-xs text-[var(--muted-foreground)]">yesterday</span>
        </div>
        <div className="flex items-center gap-2">
          <Users size={14} className="text-blue-500" />
          <span className="text-lg font-bold text-[var(--foreground)]">{summary.newLeadsToday}</span>
          <span className="text-xs text-[var(--muted-foreground)]">today</span>
        </div>
        <div className="flex items-center gap-2">
          <Target size={14} className="text-orange-500" />
          <span className="text-lg font-bold text-[var(--foreground)]">{summary.hotLeads}</span>
          <span className="text-xs text-[var(--muted-foreground)]">hot</span>
        </div>
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-violet-500" />
          <span className="text-lg font-bold text-[var(--foreground)]">{summary.totalLeads}</span>
          <span className="text-xs text-[var(--muted-foreground)]">total active</span>
        </div>
      </div>

      {sources && sources.length > 0 && (
        <>
          <div className="mt-4 pt-3 border-t border-[var(--border)]">
            <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Source Health</span>
          </div>
          <div className="mt-2 space-y-1.5">
            {sources.slice(0, 4).map(s => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span className="text-[var(--foreground)]">{s.name}</span>
                <div className="flex items-center gap-1.5">
                  {s.alert === 'drop' && <ArrowDownRight size={12} className="text-red-500" />}
                  {s.alert === 'surge' && <ArrowUpRight size={12} className="text-amber-500" />}
                  {s.alert === 'normal' && <span className="text-emerald-500 text-xs">●</span>}
                  <span className={`text-xs font-medium ${
                    s.alert === 'drop' ? 'text-red-500' : s.alert === 'surge' ? 'text-amber-500' : 'text-emerald-500'
                  }`}>
                    {s.changePercent > 0 ? '+' : ''}{s.changePercent}%
                  </span>
                  {s.alert === 'drop' && <AlertTriangle size={11} className="text-red-400" />}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AgentWatchCard({ agents }: { agents: DailyBrief['summary']['slowAgents'] | null }) {
  if (!agents || agents.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center gap-2 mb-1">
          <Users size={16} className="text-emerald-500" />
          <h3 className="font-semibold text-sm text-[var(--foreground)]">Agent Watch</h3>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle size={16} />
          <span>All agents responding on time</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center gap-2 mb-1">
        <Users size={16} className="text-amber-500" />
        <h3 className="font-semibold text-sm text-[var(--foreground)]">Agent Watch</h3>
        <span className="ml-auto text-xs font-semibold bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
          {agents.length} slow
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {agents.map(a => (
          <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
            <div className="flex items-center gap-2">
              <AlertCircle size={12} className="text-amber-500 shrink-0" />
              <a href="#/manager-dashboard" className="text-sm font-medium text-[var(--foreground)] hover:text-[var(--primary)] transition-colors">
                {a.name}
              </a>
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">
              <span className="text-amber-600 font-semibold">{a.hotLeadCount}</span> hot · {a.responseTimeHours}h response
            </div>
          </div>
        ))}
      </div>
      <a href="#/queue" className="group mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)]">
        View Agent Queue <ChevronRight size={12} className="transition-transform duration-150 group-hover:translate-x-0.5" />
      </a>
    </div>
  );
}

function ReadyForBookingCard({ items }: { items: DailyBrief['readyForBooking'] | null }) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle size={16} className="text-emerald-500" />
          <h3 className="font-semibold text-sm text-[var(--foreground)]">Ready for Booking</h3>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle size={16} />
          <span>No leads ready for booking right now</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center gap-2 mb-1">
        <Target size={16} className="text-emerald-500" />
        <h3 className="font-semibold text-sm text-[var(--foreground)]">Ready for Booking</h3>
        <span className="ml-auto text-xs font-semibold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>
      <div className="mt-3 space-y-3">
        {items.slice(0, 4).map(lead => (
          <div key={lead.leadId} className="pb-3 border-b border-[var(--border)] last:border-0 last:pb-0">
            <div className="flex items-start justify-between">
              <div>
                <a href={`#/leads/${lead.leadId}`}
                  className="text-sm font-semibold text-[var(--foreground)] hover:text-[var(--primary)] transition-colors">
                  {lead.leadName}
                </a>
                <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] mt-0.5">
                  <Phone size={10} />
                  <span>{lead.phone}</span>
                </div>
              </div>
              {lead.missingCostSheet && (
                <span className="text-[10px] font-semibold bg-amber-50 text-amber-600 px-2 py-0.5 rounded shrink-0">
                  No cost sheet
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
              <span>{lead.interest}</span>
              <span>·</span>
              <span>Last contact: {daysAgo(lead.daysSinceLastContact)}</span>
            </div>
          </div>
        ))}
      </div>
      <a href="#/cost-sheets" className="group mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)]">
        Send Cost Sheet <ChevronRight size={12} className="transition-transform duration-150 group-hover:translate-x-0.5" />
      </a>
    </div>
  );
}

function ChannelConflictsCard({ conflicts }: { conflicts: DailyBrief['channelConflicts'] | null }) {
  if (!conflicts || conflicts.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={16} className="text-emerald-500" />
          <h3 className="font-semibold text-sm text-[var(--foreground)]">Channel Conflicts</h3>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle size={16} />
          <span>No channel partner conflicts detected</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center gap-2 mb-1">
        <Zap size={16} className="text-amber-500" />
        <h3 className="font-semibold text-sm text-[var(--foreground)]">Channel Conflicts</h3>
        <span className="ml-auto text-xs font-semibold bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
          {conflicts.length}
        </span>
      </div>
      <div className="mt-3 space-y-3">
        {conflicts.slice(0, 4).map(c => (
          <div key={c.leadId} className="pb-3 border-b border-[var(--border)] last:border-0 last:pb-0">
            <a href={`#/leads/${c.leadId}`}
              className="text-sm font-semibold text-[var(--foreground)] hover:text-[var(--primary)] transition-colors">
              {c.leadName}
            </a>
            <div className="mt-1 space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                <UserCheck size={11} className="shrink-0" />
                <span>{c.partners.join(' ↔ ')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                <Building2 size={11} className="shrink-0" />
                <span>{c.projects.join(', ')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <a href="#/channel-partners" className="group mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)]">
        Resolve <ChevronRight size={12} className="transition-transform duration-150 group-hover:translate-x-0.5" />
      </a>
    </div>
  );
}

function TodayVisitsCard({ visits }: { visits: DailyBrief['todayVisits'] | null }) {
  if (!visits || visits.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center gap-2 mb-1">
          <Calendar size={16} className="text-[var(--muted-foreground)]" />
          <h3 className="font-semibold text-sm text-[var(--foreground)]">Today's Site Visits</h3>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Calendar size={16} />
          <span>No visits scheduled today. A quiet day?</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center gap-2 mb-1">
        <Calendar size={16} className="text-[var(--primary)]" />
        <h3 className="font-semibold text-sm text-[var(--foreground)]">Today's Site Visits</h3>
        <span className="ml-auto text-xs font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
          {visits.length}
        </span>
      </div>
      <div className="mt-3 space-y-4">
        {visits.map(v => (
          <div key={v.id} className="pb-4 border-b border-[var(--border)] last:border-0 last:pb-0">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-[var(--primary)] shrink-0" />
                <a href={`#/leads/${v.leadId}`}
                  className="text-sm font-semibold text-[var(--foreground)] hover:text-[var(--primary)] transition-colors">
                  {v.leadName}
                </a>
                <span className="text-xs text-[var(--muted-foreground)]">{v.phone}</span>
              </div>
              <span className="text-xs font-medium bg-[var(--muted)] px-2 py-0.5 rounded text-[var(--foreground)]">
                {formatTime(v.startAt)}
              </span>
            </div>
            {v.interest && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">{v.interest}</p>
            )}
            {v.lastMessage && (
              <div className="mt-1.5 flex items-start gap-1.5 text-xs text-[var(--muted-foreground)] bg-[var(--background)] rounded-lg p-2">
                <MessageSquare size={11} className="shrink-0 mt-0.5" />
                <span>&ldquo;{v.lastMessage}&rdquo;</span>
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
              {v.projectName && (
                <span className="flex items-center gap-1">
                  <MapPin size={10} /> {v.projectName}
                </span>
              )}
              {v.budget && (
                <span className="flex items-center gap-1">
                  <DollarSign size={10} /> {v.budget}
                </span>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <a href={`#/leads/${v.leadId}`}
                className="group inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--foreground)] hover:border-[var(--border-strong)] transition-all duration-150 active:scale-[0.97]">
                View Brief <ChevronRight size={10} className="transition-transform duration-150 group-hover:translate-x-0.5" />
              </a>
              <a href={`#/site-visits`}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-600 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.97]">
                Mark Complete <CheckCircle size={10} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                         */
/* ------------------------------------------------------------------ */

export default function OverviewPage() {
  const { user } = useAuth();
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voiceOn, setVoiceOn] = useState(() => localStorage.getItem('mikeyVoiceOn') !== 'false');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api('/mikey/daily-brief')
      .then(data => { if (!cancelled) setBrief(data); })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const firstName = (user?.name || user?.email || '').split(/[\s@]/)[0];
  const s = brief?.summary;
  const rar = brief?.revenueAtRisk;
  const pa = brief?.pendingApprovals;

  const speakBrief = async (force = false) => {
    if (!brief) return;
    const today = new Date().toISOString().slice(0, 10);
    if (!force) {
      if (!voiceOn) return;
      if (localStorage.getItem('mikeyBriefSpokenOn') === today) return;
    }
    try {
      const text = buildBriefSpeech(brief, firstName);
      const res = await api('/copilot/speak', { method: 'POST', body: JSON.stringify({ text }) });
      if (!res.audioBase64) return;
      localStorage.setItem('mikeyBriefSpokenOn', today);
      const audio = new Audio(`data:${res.mimeType};base64,${res.audioBase64}`);
      audioRef.current?.pause();
      audioRef.current = audio;
      audio.play().catch(() => {});
    } catch {
      // Voice is a nice-to-have — never break the dashboard over TTS failing.
    }
  };

  useEffect(() => { speakBrief(); }, [brief]);

  const toggleVoice = () => {
    setVoiceOn(prev => {
      const next = !prev;
      localStorage.setItem('mikeyVoiceOn', String(next));
      if (!next) audioRef.current?.pause();
      return next;
    });
  };

  if (loading) return <PageFallback />;

  const headerContent = (
    <>
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-600 tracking-wide">
            <Bot size={12} />
            Mikey
          </span>
          <span className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-[0.15em]">
            {todayLabel()}
          </span>
          <button
            onClick={() => (voiceOn ? speakBrief(true) : toggleVoice())}
            title={voiceOn ? "Replay spoken briefing" : "Voice briefing off — click to unmute"}
            className={`ml-auto p-1.5 rounded-md transition-colors ${voiceOn ? "text-[var(--primary)] bg-[var(--primary-light)]" : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"}`}
          >
            {voiceOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          {voiceOn && (
            <button
              onClick={toggleVoice}
              title="Mute voice briefing"
              className="text-[10px] text-[var(--muted-foreground)] hover:underline"
            >
              mute
            </button>
          )}
        </div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {greeting()}, {firstName}
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Here&rsquo;s your real estate overview for today
        </p>
      </div>

      {(s || error) && (
        <div className="flex flex-wrap gap-2">
          {s && <StatChip icon={TrendingUp} label="yesterday" value={s.newLeadsYesterday} />}
          {s && <StatChip icon={Target} label="hot now" value={s.hotLeads} />}
          {s && <StatChip icon={Users} label="agents slow" value={s.slowAgents.length} alert={s.slowAgents.length > 0} />}
          {rar && <StatChip icon={DollarSign} label="at risk" value={formatINR(rar.totalPaise)} alert={rar.totalPaise > 0} />}
          {pa && <StatChip icon={CheckSquare} label="pending approvals" value={pa.count} />}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          <AlertCircle size={12} />
          <span>Couldn&apos;t load full briefing: {error}</span>
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="space-y-4">
        {headerContent}
      </div>

      {/* ── EstateRocket Sections ── */}

      {/* Timeframe pill group */}
      <div className="flex items-center justify-end animate-fade-up">
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--accent)]">
          {["7D", "1M", "3M", "1Y"].map(p => (
            <button key={p} className={`text-xs font-medium px-3 py-1.5 rounded-md transition-all duration-150 ${
              p === "1M" ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat, i) => (
          <StatCard key={stat.label} {...stat} delay={`delay-${i + 1}`} />
        ))}
      </div>

      {/* Sales chart + Listing Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SalesChart data={SALES_DATA} />
        </div>
        <ListingMixDonut mix={LISTING_MIX} />
      </div>

      {/* Recently Added Listings */}
      <div className="animate-fade-up delay-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] text-[var(--foreground)]">Recently Added Listings</h2>
            <p className="text-xs text-[var(--muted-foreground)]">Latest properties on the market</p>
          </div>
          <a href="#" className="group text-xs font-medium text-[var(--primary)] flex items-center gap-1">
            View All
            <ChevronRight size={12} className="transition-transform duration-150 group-hover:translate-x-0.5" />
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PROPERTIES.slice(0, 4).map((p, i) => (
            <PropertyCard key={p.id} property={p} index={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {PROPERTIES.slice(4).map((p, i) => (
            <PropertyCard key={p.id} property={p} index={i + 4} />
          ))}
        </div>
      </div>

      {/* Active Deals + Top Agents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DealsTimeline deals={DEALS} />
        <TopAgents agents={AGENTS} />
      </div>

      {/* ── Separator ── */}
      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-[var(--border)]" />
        <span className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">CRM Daily Brief</span>
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>

      {/* ── Existing CRM Cards ── */}
      {brief && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <HeroStatCard
            label="Total Active Leads"
            value={brief.summary.totalLeads}
            sublabel={`${brief.summary.newLeadsToday} new today, ${brief.summary.newLeadsYesterday} yesterday`}
          />
          <HotLeadRatioCard hot={brief.summary.hotLeads} total={brief.summary.totalLeads} />
        </div>
      )}

      {brief && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RevenueCard data={brief.revenueAtRisk} />
          <ApprovalsCard data={brief.pendingApprovals} />
        </div>
      )}

      {brief && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LeadPulseCard summary={brief.summary} sources={brief.sources} />
          <AgentWatchCard agents={brief.summary.slowAgents} />
        </div>
      )}

      {brief && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ReadyForBookingCard items={brief.readyForBooking} />
          <ChannelConflictsCard conflicts={brief.channelConflicts} />
        </div>
      )}

      {brief && (
        <TodayVisitsCard visits={brief.todayVisits} />
      )}
    </div>
  );
}
