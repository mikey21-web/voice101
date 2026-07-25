import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Phone, Mail, AlertTriangle, Home, Building2, MessageSquare, StickyNote, X, IndianRupee } from "lucide-react";
import { api } from "../lib/api";

interface Props {
  leadId: string;
  onClose: () => void;
}

const fieldLabels: Record<string, string> = {
  property_type: "Property Type", budget_range: "Budget", bedrooms: "Bedrooms",
  location: "Preferred Location", move_in_timeline: "Timeline", financing_status: "Financing",
};

/** Everything an agent needs on one screen before walking into a site visit. */
export default function PreVisitBrief({ leadId, onClose }: Props) {
  const [brief, setBrief] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api(`/leads/${leadId}/brief`).then(res => { if (!cancelled) setBrief(res); })
      .catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [leadId]);

  const formatMoney = (n: number) => {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
    return `₹${n.toLocaleString()}`;
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-[var(--card)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">Pre-Visit Brief</h2>
            <p className="text-xs text-[var(--muted-foreground)]">Everything you need before you walk in</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-[var(--muted-foreground)]">Loading brief...</div>
        ) : !brief ? (
          <div className="p-6 text-center text-sm text-[var(--muted-foreground)]">Couldn't load brief</div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Buyer header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-[var(--foreground)]">{brief.buyer.name}</h3>
                <div className="flex items-center gap-3 mt-1 text-sm text-[var(--muted-foreground)]">
                  {brief.buyer.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {brief.buyer.phone}</span>}
                  {brief.buyer.email && <span className="inline-flex items-center gap-1"><Mail size={12} /> {brief.buyer.email}</span>}
                </div>
              </div>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                brief.lead.segment === 'HOT' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                brief.lead.segment === 'WARM' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' :
                'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              }`}>
                {brief.lead.segment} · Score {brief.lead.score}
              </span>
            </div>

            {/* Upcoming visit */}
            {brief.upcomingBooking && (
              <div className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-3 text-sm">
                <span className="font-medium text-[var(--foreground)]">Today's visit: </span>
                <span className="text-[var(--muted-foreground)]">
                  {brief.upcomingBooking.title} — {new Date(brief.upcomingBooking.startTime).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}
                  {brief.upcomingBooking.property ? ` at ${brief.upcomingBooking.property.title}` : ''}
                </span>
              </div>
            )}

            {/* Preferences */}
            {Object.keys(brief.preferences).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">What they told us</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(brief.preferences).map(([k, v]) => v ? (
                    <div key={k} className="text-sm">
                      <span className="text-[var(--muted-foreground)]">{fieldLabels[k] || k}: </span>
                      <span className="font-medium text-[var(--foreground)]">{String(v)}</span>
                    </div>
                  ) : null)}
                </div>
              </div>
            )}

            {/* Objections */}
            {brief.objections.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={13} /> Watch out for
                </h4>
                <div className="space-y-1.5">
                  {brief.objections.map((o: any, i: number) => (
                    <div key={i} className="text-sm text-[var(--foreground)] bg-amber-50 dark:bg-amber-900/20 rounded px-2.5 py-1.5">
                      "{o.text}"
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Matching units */}
            {brief.matchingProperties.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Home size={13} /> Matching units to show
                </h4>
                <div className="space-y-2">
                  {brief.matchingProperties.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-2.5">
                      {p.images?.[0] && <img src={p.images[0].url} alt="" className="h-10 w-10 rounded object-cover" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--foreground)] truncate">{p.title}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">{p.location} · {p.bedrooms ? `${p.bedrooms}BHK` : ''}</div>
                      </div>
                      <div className="text-sm font-mono font-semibold text-[var(--foreground)] inline-flex items-center gap-0.5">
                        <IndianRupee size={11} />{p.price ? formatMoney(p.price).replace('₹', '') : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Matching project units (builder inventory) */}
            {brief.matchingUnits?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Building2 size={13} /> Matching units to show
                </h4>
                <div className="space-y-2">
                  {brief.matchingUnits.map((u: any) => (
                    <div key={u.id} className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--foreground)] truncate">
                          {u.project?.name} — Unit {u.unitNumber}{u.tower ? ` (${u.tower.name})` : ''}
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {u.unitType || ''} {u.floor ? `· Floor ${u.floor}` : ''} {u.areaSqft ? `· ${u.areaSqft} sqft` : ''}
                        </div>
                      </div>
                      <div className="text-sm font-mono font-semibold text-[var(--foreground)] inline-flex items-center gap-0.5">
                        <IndianRupee size={11} />{u.price ? formatMoney(u.price).replace('₹', '') : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent conversation */}
            {brief.recentMessages.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MessageSquare size={13} /> Recent conversation
                </h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {brief.recentMessages.slice().reverse().map((m: any, i: number) => (
                    <div key={i} className={`text-sm px-2.5 py-1.5 rounded-lg max-w-[85%] ${m.direction === 'INBOUND' ? 'bg-[var(--muted)] text-[var(--foreground)]' : 'bg-[var(--primary)]/10 text-[var(--foreground)] ml-auto'}`}>
                    {m.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Internal notes */}
            {brief.notes.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <StickyNote size={13} /> Team notes
                </h4>
                <div className="space-y-1.5">
                  {brief.notes.map((n: any, i: number) => (
                    <div key={i} className="text-sm text-[var(--foreground)]">
                      {n.content} <span className="text-xs text-[var(--muted-foreground)]">— {n.by}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
