import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import toast from "react-hot-toast";
import { Check, X, Clock } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Badge } from "../components/ui/badge";

function formatPaise(paise?: string | number) {
  if (paise == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(paise) / 100);
}

/** One screen for everything awaiting a decision — discounts, cost sheets, and any generic ApprovalRequest. */
export default function ApprovalsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api("/approvals/pending");
      setItems(res);
    } catch (e: any) {
      setError(e.message || "Failed to load approvals");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const isCopilotAction = (item: any) => item.type?.startsWith("copilot_");

  const act = async (item: any, decision: "approve" | "reject") => {
    try {
      const [prefix, id] = item.id.split(":");
      if (prefix === "approval" && isCopilotAction(item) && decision === "approve") {
        await api("/copilot/confirm-action", { method: "POST", body: JSON.stringify({ pendingActionId: id }) });
      } else {
        const path = prefix === "offer" ? `/offers/${id}/${decision}`
          : prefix === "cost-sheet" ? `/cost-sheets/${id}/approve`
          : `/approvals/${id}/${decision}`;
        await api(path, { method: "POST" });
      }
      toast.success(decision === "approve" ? "Approved" : "Rejected");
      load();
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Approvals</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">{items.length} awaiting a decision</p>
      </div>

      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Summary</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={5} className="text-center text-[var(--muted-foreground)] py-8">
              <div className="flex flex-col items-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
                <span>Loading approvals...</span>
              </div>
            </TableCell></TableRow>
          ) : error ? (
            <TableRow><TableCell colSpan={5} className="text-center py-8">
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm text-red-500">{error}</span>
                <button onClick={load} className="text-xs text-[var(--primary)] hover:underline">Try again</button>
              </div>
            </TableCell></TableRow>
          ) : items.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center text-[var(--muted-foreground)] py-8">
              Nothing waiting on you right now.
            </TableCell></TableRow>
          ) : (
            items.map(item => {
              const iscopilot = isCopilotAction(item);
              const toolLabel = iscopilot ? item.type.replace("copilot_", "").replace(/_/g, " ") : item.type.replace(/_/g, " ");
              return (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {iscopilot && <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide">Mikey</span>}
                    <Badge variant={iscopilot ? "default" : "warning"}>{toolLabel}</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-[var(--foreground)]">{item.summary}</TableCell>
                <TableCell className="text-sm text-[var(--foreground)]">{formatPaise(item.amountPaise)}</TableCell>
                <TableCell className="text-xs text-[var(--muted-foreground)] inline-flex items-center gap-1"><Clock size={12} /> {new Date(item.requestedAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <button onClick={() => act(item, "approve")} className="text-xs px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 inline-flex items-center gap-1"><Check size={12} /> {iscopilot ? "Run it" : "Approve"}</button>
                    <button onClick={() => act(item, "reject")} className="text-xs px-2 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200 inline-flex items-center gap-1"><X size={12} /> Reject</button>
                  </div>
                </TableCell>
              </TableRow>
            );
            })
          )}
        </TableBody>
      </Table>
    </div>
    </div>
  );
}
