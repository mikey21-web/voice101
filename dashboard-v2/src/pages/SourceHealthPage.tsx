import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

const statusVariant: Record<string, "success" | "warning" | "secondary"> = {
  ACTIVE: "success",
  STALE: "warning",
  NEVER_CONNECTED: "secondary",
};

const providerLabels: Record<string, string> = {
  indiamart: "IndiaMART",
  "99acres": "99acres",
  justdial: "JustDial",
  magicbricks: "MagicBricks",
  housing: "Housing.com",
  tradeindia: "TradeIndia",
};

export default function SourceHealthPage() {
  const [health, setHealth] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replaying, setReplaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api("/portal-integrations/health");
      setHealth(res);
    } catch (e: any) {
      setError(e.message || "Failed to load connector health");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const replay = async (provider: string) => {
    setReplaying(provider);
    try {
      const res = await api(`/portal-integrations/health/${provider}/replay`, { method: "POST" });
      toast.success(res.message || `Replayed ${provider}`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Replay failed");
    }
    setReplaying(null);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Lead Sources / Integration Health</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">Portal webhook connectors — failures are tracked and replayable</p>
      </div>

      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last lead received</TableHead>
            <TableHead>7-day volume</TableHead>
            <TableHead>Created / Dup</TableHead>
            <TableHead>Failed (7d)</TableHead>
            <TableHead>Replay</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={7} className="text-center text-[var(--muted-foreground)] py-8">
              <div className="flex flex-col items-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
                <span>Loading connector health...</span>
              </div>
            </TableCell></TableRow>
          ) : error ? (
            <TableRow><TableCell colSpan={7} className="text-center py-8">
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm text-red-500">{error}</span>
                <button onClick={load} className="text-xs text-[var(--primary)] hover:underline">Try again</button>
              </div>
            </TableCell></TableRow>
          ) : (
            health.map(h => (
              <TableRow key={h.provider}>
                <TableCell className="font-medium text-[var(--foreground)]">{providerLabels[h.provider] || h.provider}</TableCell>
                <TableCell><Badge variant={statusVariant[h.status] || "secondary"}>{h.status.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell className="text-xs text-[var(--muted-foreground)]">{h.lastEventAt ? new Date(h.lastEventAt).toLocaleString() : "Never"}</TableCell>
                <TableCell className="text-sm text-[var(--foreground)]">{h.last7DaysCount}</TableCell>
                <TableCell className="text-xs text-[var(--muted-foreground)]">{h.createdCount7d} / {h.duplicateCount7d}</TableCell>
                <TableCell>
                  {h.failedCount7d > 0 ? (
                    <span className="text-sm font-semibold text-red-600">{h.failedCount7d}</span>
                  ) : (
                    <span className="text-xs text-[var(--muted-foreground)]">0</span>
                  )}
                </TableCell>
                <TableCell>
                  <button onClick={() => replay(h.provider)} disabled={replaying === h.provider || !h.lastFailedEventId}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--accent)] disabled:opacity-40"
                    title={h.lastFailedEventId ? "Replay last failed event" : "No failed events to replay"}>
                    <RefreshCw size={12} className={replaying === h.provider ? "animate-spin" : ""} />
                    Replay
                  </button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
    </div>
  );
}
