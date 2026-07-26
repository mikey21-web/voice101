import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Edit2, Trash2, TrendingUp, Users } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { api, resolveMediaUrl } from "../lib/api";
import toast from "react-hot-toast";
import { Dialog } from "../components/ui/dialog";

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  INACTIVE: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  SUSPENDED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const statusOptions = Object.keys(statusColors);

export default function ChannelPartnersPage() {
  const [partners, setPartners] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [performance, setPerformance] = useState<any>(null);
  const [performanceFor, setPerformanceFor] = useState<string | null>(null);

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await api(`/channel-partners?${params}`);
      setPartners(res.data || []);
      setTotal(res.meta?.total || 0);
    } catch { toast.error("Failed to load agents"); }
    finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchPartners(); }, [fetchPartners]);

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this agent? Their leads will be kept but unlinked.")) return;
    try {
      await api(`/channel-partners/${id}`, { method: "DELETE" });
      toast.success("Agent removed");
      fetchPartners();
    } catch { toast.error("Failed to remove"); }
  };

  const viewPerformance = async (id: string) => {
    setPerformanceFor(id);
    try {
      const res = await api(`/channel-partners/${id}/performance`);
      setPerformance(res);
    } catch { toast.error("Failed to load performance"); setPerformanceFor(null); }
  };

  const formatMoney = (n: number) => {
    if (!n) return "₹0";
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
    return `₹${n.toLocaleString()}`;
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Agents</h1>
          <p className="text-sm text-[var(--muted-foreground)]">{total} agents · leads sourced, converted, and commission owed</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="#/import?entity=channelPartner"
            className="inline-flex items-center h-9 px-4 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          >
            Import
          </a>
          <Button onClick={() => { window.location.hash = "/channel-partners/new"; }}>
            <Plus className="h-4 w-4 mr-2" /> Add Agent
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input placeholder="Search name, company, phone..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm">
          <option value="">All Status</option>
          {statusOptions.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--muted-foreground)]">Loading...</div>
      ) : partners.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted-foreground)]">No agents yet</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {partners.map((p: any) => (
            <div key={p.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-11 w-11 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center font-semibold shrink-0 overflow-hidden">
                    {p.metadata?.photoUrl ? (
                      <img src={resolveMediaUrl(p.metadata.photoUrl)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      p.name?.[0]?.toUpperCase() || "?"
                    )}
                  </div>
                  <div className="min-w-0">
                    <a href={`#/channel-partners/${p.id}`} className="font-semibold text-[var(--foreground)] hover:text-[var(--primary)] transition-colors truncate block">
                      {p.name}
                    </a>
                    <p className="text-xs text-[var(--muted-foreground)] truncate">{p.company || "Independent"}</p>
                  </div>
                </div>
                <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status] || ""}`}>{p.status}</span>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-[var(--muted)] px-3 py-2">
                  <div className="text-[10px] text-[var(--muted-foreground)] uppercase">Leads</div>
                  <div className="font-semibold text-[var(--foreground)] flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />{p._count?.leads ?? 0}
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--muted)] px-3 py-2">
                  <div className="text-[10px] text-[var(--muted-foreground)] uppercase">Commission</div>
                  <div className="font-semibold text-[var(--foreground)]">{p.commissionRate != null ? `${p.commissionRate}%` : "-"}</div>
                </div>
              </div>

              {p.phone && <p className="mt-3 text-xs text-[var(--muted-foreground)]">{p.phone}</p>}

              <div className="mt-4 flex gap-1.5">
                <button onClick={() => viewPerformance(p.id)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">
                  <TrendingUp className="h-3.5 w-3.5" /> Performance
                </button>
                <a href={`#/channel-partners/${p.id}/edit`} className="p-1.5 hover:bg-[var(--accent)] rounded-lg inline-flex items-center"><Edit2 className="h-4 w-4" /></a>
                <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2 items-center">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-[var(--muted-foreground)]">Page {page} of {Math.ceil(total / 20)}</span>
          <Button variant="outline" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      {performanceFor && (
        <Dialog open onClose={() => { setPerformanceFor(null); setPerformance(null); }} title={performance?.name || "Performance"} maxWidth="max-w-md">
          {!performance ? (
            <div className="text-sm text-[var(--muted-foreground)]">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="text-xs text-[var(--muted-foreground)] uppercase">Leads Sourced</div>
                <div className="text-xl font-bold">{performance.totalLeads}</div>
              </div>
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="text-xs text-[var(--muted-foreground)] uppercase">Converted</div>
                <div className="text-xl font-bold">{performance.convertedLeads}</div>
              </div>
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="text-xs text-[var(--muted-foreground)] uppercase">Conversion Rate</div>
                <div className="text-xl font-bold">{(performance.conversionRate * 100).toFixed(1)}%</div>
              </div>
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="text-xs text-[var(--muted-foreground)] uppercase">Deal Value</div>
                <div className="text-xl font-bold">{formatMoney(performance.convertedValue)}</div>
              </div>
              <div className="col-span-2 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-3">
                <div className="text-xs text-[var(--muted-foreground)] uppercase">Commission Owed ({performance.commissionRate}%)</div>
                <div className="text-2xl font-bold text-[var(--primary)]">{formatMoney(performance.commissionOwed)}</div>
              </div>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
