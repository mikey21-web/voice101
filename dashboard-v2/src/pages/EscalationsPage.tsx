import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import toast from "react-hot-toast";
import { HandHelping, Check } from "lucide-react";
import { Badge } from "../components/ui/badge";

const TRIGGER_LABEL: Record<string, string> = {
  LEAD_REQUESTED_HUMAN: "Asked for a person",
  DEAL_VALUE_OVER_THRESHOLD: "High value deal",
  NEGATIVE_SENTIMENT: "Unhappy on the call",
  LOW_MODEL_CONFIDENCE: "Mikey was unsure",
  PRICE_NEGOTIATION: "Price negotiation started",
  LEGAL_OR_COMMITMENT: "Legal or commitment question",
};

/**
 * Rail C. Every lead Mikey has stepped back from and paged a human for.
 *
 * While a row is here Mikey will not message that lead at all, whatever the
 * autonomy dials say. Resolving hands the lead back.
 */
export default function EscalationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api("/escalations"));
    } catch (e: any) {
      setError(e.message || "Failed to load escalations");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id: string) => {
    try {
      await api(`/escalations/${id}/resolve`, { method: "POST" });
      toast.success("Handed back to Mikey");
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not resolve");
    }
  };

  if (loading) return <div className="p-6 text-slate-500">Loading…</div>;
  if (error) return <div className="p-6 text-rose-600">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <HandHelping className="w-6 h-6" /> Needs a person
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Mikey has stopped messaging these leads and paged the owning salesperson.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-slate-500">
          Nothing waiting. Mikey is handling every live conversation.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((e) => (
            <div key={e.id} className="border rounded-lg p-4 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="font-medium">
                  {e.lead?.contact?.name || "Unknown lead"}
                  {e.lead?.contact?.phone && (
                    <span className="text-slate-500 font-normal"> · {e.lead.contact.phone}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{TRIGGER_LABEL[e.trigger] || e.trigger}</Badge>
                  <span className="text-sm text-slate-600">{e.detail}</span>
                </div>
                <div className="text-xs text-slate-400">
                  Paged {new Date(e.createdAt).toLocaleString("en-IN")}
                </div>
              </div>
              <button
                onClick={() => resolve(e.id)}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded border hover:bg-slate-50"
              >
                <Check className="w-4 h-4" /> Hand back to Mikey
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
