import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  IndianRupee,
  MessageCircle,
  Phone,
  RefreshCw,
  Users,
  Warehouse,
  Ban,
  ThumbsDown,
  Timer,
} from "lucide-react";
import { fetchBuilderCommand } from "../lib/data";
import { Button } from "../components/ui/button";

const inventoryLabels: Record<string, string> = {
  AVAILABLE: "Available",
  ON_HOLD: "On hold",
  BOOKED: "Booked",
  SOLD: "Sold",
};

const severityClass: Record<string, string> = {
  critical: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
  warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200",
};

function formatMoney(value?: number, currency = "INR") {
  if (!value) return "INR 0";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString("en-IN")}`;
  }
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function sourceLabel(source: string) {
  return source
    .replace("NINETY_NINE_ACRES", "99acres")
    .replace("HOUSING_COM", "Housing.com")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace("99Acres", "99acres");
}

function KpiCard({ icon: Icon, label, value, tone = "default" }: { icon: any; label: string; value: string | number; tone?: "default" | "danger" | "good" }) {
  const toneClass = tone === "danger" ? "text-red-600" : tone === "good" ? "text-emerald-600" : "text-[var(--foreground)]";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--muted)] text-[var(--primary)]">
          <Icon size={19} />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">{label}</p>;
}

export default function BuilderDeskPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await fetchBuilderCommand());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const inventoryRows = useMemo(() => {
    const inv = data?.inventory || {};
    return Object.keys(inventoryLabels).map(status => ({
      status,
      label: inventoryLabels[status],
      count: inv[status]?.count || 0,
      value: inv[status]?.value || 0,
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-24 animate-pulse rounded-lg bg-[var(--card)]" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 animate-pulse rounded-lg bg-[var(--card)]" />)}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="h-80 animate-pulse rounded-lg bg-[var(--card)]" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)]">Builder Desk</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">Could not load the builder command data right now.</p>
        <Button className="mt-4" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
      </div>
    );
  }

  const kpis = data.kpis || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Builder Desk</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Missed calls, no-shows, bookings, weak agents, units on hold, and money leaking — in one owner view.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          <Button onClick={() => { window.location.hash = "/leads"; }}><MessageCircle className="mr-2 h-4 w-4" /> Work Leads</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Users} label="Active leads" value={kpis.activeLeads || 0} />
        <KpiCard icon={AlertTriangle} label="Unassigned leads" value={kpis.unassignedLeads || 0} tone={kpis.unassignedLeads > 0 ? "danger" : "good"} />
        <KpiCard icon={CalendarCheck} label="Visits today" value={kpis.todayVisits || 0} />
        <KpiCard icon={IndianRupee} label="Overdue collections" value={kpis.overduePayments || 0} tone={kpis.overduePayments > 0 ? "danger" : "good"} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard icon={Clock} label="Missed calls today" value={kpis.missedCallsToday || 0} tone={kpis.missedCallsToday > 0 ? "danger" : "good"} />
        <KpiCard icon={Ban} label="No-shows this month" value={kpis.noShowsThisMonth || 0} tone={kpis.noShowsThisMonth > 5 ? "danger" : "default"} />
        <KpiCard icon={CheckCircle2} label="Bookings this month" value={kpis.bookingsThisMonth || 0} tone="good" />
        <KpiCard icon={Timer} label="Tomorrow visits" value={kpis.tomorrowVisits || 0} />
        <KpiCard icon={ThumbsDown} label="Weak agents" value={data.weakSalespeople?.length || 0} tone={data.weakSalespeople?.length > 0 ? "danger" : "good"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Urgent Lead Queue</h2>
            <a href="#/leads" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)]">Open leads <ArrowRight size={13} /></a>
          </div>
          <div className="space-y-2">
            {data.recentLeads?.length ? data.recentLeads.map((lead: any) => (
              <div key={lead.id} className="grid gap-3 rounded-lg border border-[var(--border)] p-3 md:grid-cols-[1.2fr_0.8fr_0.8fr_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">{lead.buyer}</p>
                    <span className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--muted-foreground)]">{lead.segment}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">{sourceLabel(lead.source)} · {lead.interest || "Interest unknown"} · {lead.budget || "Budget unknown"}</p>
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  <p className="font-medium text-[var(--foreground)]">{lead.assignedAgent}</p>
                  <p>{lead.channelPartner || "Direct lead"}</p>
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  <p>{lead.location || "Location unknown"}</p>
                  <p>Score {lead.score || 0}</p>
                </div>
                <div className="flex gap-2">
                  {lead.phone && <a href={`tel:${lead.phone}`} className="rounded-md border border-[var(--border)] p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><Phone size={15} /></a>}
                  <a href="#/conversations" className="rounded-md border border-[var(--border)] p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><MessageCircle size={15} /></a>
                </div>
              </div>
            )) : <EmptyState label="No active buyer leads need attention." />}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">Next Actions</h2>
          <div className="space-y-2">
            {data.nextActions?.length ? data.nextActions.map((action: any, index: number) => (
              <a key={`${action.label}-${index}`} href={action.href} className={`block rounded-lg border p-3 text-sm ${severityClass[action.severity] || severityClass.info}`}>
                <span className="font-medium">{action.label}</span>
              </a>
            )) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <CheckCircle2 className="mr-2 inline h-4 w-4" /> Nothing urgent right now.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]"><CalendarCheck size={16} /> Upcoming Site Visits</h2>
          <div className="space-y-3">
            {data.upcomingVisits?.length ? data.upcomingVisits.map((visit: any) => (
              <div key={visit.id} className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{visit.buyer}</p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">{visit.project || "Project not linked"} {visit.unit ? `· ${visit.unit}` : ""}</p>
                  </div>
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-200">{visit.status}</span>
                </div>
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">{formatDateTime(visit.startTime)} · {visit.agent}</p>
              </div>
            )) : <EmptyState label="No upcoming site visits are scheduled." />}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]"><Warehouse size={16} /> Inventory Snapshot</h2>
          <div className="space-y-3">
            {inventoryRows.map(row => (
              <div key={row.status} className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--foreground)]">{row.label}</p>
                  <p className="text-lg font-bold text-[var(--foreground)]">{row.count}</p>
                </div>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">{formatMoney(row.value)} inventory value</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]"><IndianRupee size={16} /> Collections Queue</h2>
          <div className="space-y-3">
            {data.collectionQueue?.length ? data.collectionQueue.map((payment: any) => (
              <div key={payment.id} className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{payment.buyer}</p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">{payment.label} · {payment.project || "Project not linked"}</p>
                  </div>
                  <p className="text-sm font-bold text-red-600">{formatMoney(payment.amount, payment.currency)}</p>
                </div>
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">Due {payment.dueDate ? formatDateTime(payment.dueDate) : "date not set"} · {payment.status}</p>
              </div>
            )) : <EmptyState label="No overdue collection milestones." />}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]"><Building2 size={16} /> Lead Sources Last 30 Days</h2>
          <div className="space-y-2">
            {data.sourceBreakdown?.length ? data.sourceBreakdown.map((source: any) => (
              <div key={source.source} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
                <p className="text-sm font-medium text-[var(--foreground)]">{sourceLabel(source.source)}</p>
                <p className="text-sm font-semibold text-[var(--foreground)]">{source.leads} leads</p>
              </div>
            )) : <EmptyState label="No source activity in the last 30 days." />}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]"><Users size={16} /> Top Channel Partners</h2>
          <div className="space-y-2">
            {data.topPartners?.length ? data.topPartners.map((partner: any) => (
              <div key={partner.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">{partner.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{partner.reraId || "RERA not captured"} · {partner.commissionRate || 0}% commission</p>
                </div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{partner.leadCount} leads</p>
              </div>
            )) : <EmptyState label="No active channel partner data yet." />}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]"><Clock size={16} /> Units on Hold</h2>
          <div className="space-y-2">
            {data.activeHolds?.length ? data.activeHolds.map((hold: any) => (
              <div key={hold.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">{hold.buyer}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Unit {hold.unitNumber}</p>
                </div>
                <span className={`text-xs font-medium ${new Date(hold.expiresAt).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000 ? 'text-red-600' : 'text-[var(--muted-foreground)]'}`}>
                  Expires {new Date(hold.expiresAt).toLocaleDateString('en-IN')}
                </span>
              </div>
            )) : <EmptyState label="No units currently on hold." />}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]"><ThumbsDown size={16} /> Weak Salespeople</h2>
          <div className="space-y-2">
            {data.weakSalespeople?.length ? data.weakSalespeople.map((agent: any) => (
              <div key={agent.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">{agent.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{agent.totalLeads} leads assigned</p>
                </div>
                <span className="text-sm font-semibold text-red-600">{agent.converted}/{agent.totalLeads} converted ({(agent.rate * 100).toFixed(0)}%)</span>
              </div>
            )) : <EmptyState label="All salespeople are performing well." />}
          </div>
        </div>
      </div>
    </div>
  );
}
