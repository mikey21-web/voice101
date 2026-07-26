import { useState, useEffect } from "react";
import { ArrowLeft, Phone, Mail, ShieldCheck, Users, TrendingUp, Loader2, Edit2 } from "lucide-react";
import { api, resolveMediaUrl } from "../lib/api";

function getPartnerId() {
  const hash = window.location.hash.replace("#", "");
  return hash.split("/")[2] || "";
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  SUSPENDED: "bg-red-100 text-red-800",
};

const formatMoney = (n: number) => {
  if (!n) return "₹0";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString()}`;
};

export default function AgentDetailPage() {
  const [partner, setPartner] = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = getPartnerId();
    if (!id) return;
    setLoading(true);
    Promise.all([
      api(`/channel-partners/${id}`),
      api(`/channel-partners/${id}/performance`),
    ])
      .then(([p, perf]) => { setPartner(p); setPerformance(perf); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="p-6 text-center text-[var(--muted-foreground)]">
        Agent not found.
        <a href="#/channel-partners" className="block mt-2 text-[var(--primary)] hover:underline">Back to Agents</a>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in max-w-3xl">
      <a href="#/channel-partners" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Agents
      </a>

      {/* Profile header */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center text-2xl font-bold shrink-0 overflow-hidden">
            {partner.metadata?.photoUrl ? (
              <img src={resolveMediaUrl(partner.metadata.photoUrl)} alt="" className="h-full w-full object-cover" />
            ) : (
              partner.name?.[0]?.toUpperCase() || "?"
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[var(--foreground)]">{partner.name}</h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[partner.status] || ""}`}>
                {partner.status}
              </span>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">{partner.company || "Independent Agent"}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
              {partner.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {partner.phone}</span>}
              {partner.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {partner.email}</span>}
              {partner.reraId && <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> {partner.reraId}</span>}
            </div>
          </div>
        </div>
        <a href={`#/channel-partners/${partner.id}/edit`} className="p-2 rounded-lg hover:bg-[var(--accent)] shrink-0" title="Edit agent">
          <Edit2 className="h-4 w-4" />
        </a>
      </div>

      {/* Performance stats */}
      {performance && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] uppercase">
              <Users className="h-3.5 w-3.5" /> Leads Sourced
            </div>
            <div className="mt-1 text-xl font-bold text-[var(--foreground)]">{performance.totalLeads}</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] uppercase">
              <TrendingUp className="h-3.5 w-3.5" /> Converted
            </div>
            <div className="mt-1 text-xl font-bold text-[var(--foreground)]">{performance.convertedLeads}</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="text-xs text-[var(--muted-foreground)] uppercase">Conversion Rate</div>
            <div className="mt-1 text-xl font-bold text-[var(--foreground)]">{(performance.conversionRate * 100).toFixed(1)}%</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="text-xs text-[var(--muted-foreground)] uppercase">Deal Value</div>
            <div className="mt-1 text-xl font-bold text-[var(--foreground)]">{formatMoney(performance.convertedValue)}</div>
          </div>
        </div>
      )}

      {performance && (
        <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary-light)] p-5">
          <div className="text-xs text-[var(--primary)] uppercase font-medium">Commission Owed ({performance.commissionRate}%)</div>
          <div className="mt-1 text-2xl font-bold text-[var(--primary)]">{formatMoney(performance.commissionOwed)}</div>
        </div>
      )}

      {partner.notes && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="font-semibold text-sm text-[var(--foreground)] mb-2">Notes</h3>
          <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-line">{partner.notes}</p>
        </div>
      )}
    </div>
  );
}
