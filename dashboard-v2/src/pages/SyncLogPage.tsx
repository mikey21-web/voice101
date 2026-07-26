import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import toast from "react-hot-toast";
import { RefreshCw, RotateCw, CheckCircle, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Badge } from "../components/ui/badge";

interface SyncLogEntry {
  id: string;
  callLog: { id: string; fromNumber: string; toNumber: string; direction: string };
  crmType: string;
  status: "SUCCESS" | "FAILED";
  error: string | null;
  attemptAt: string;
}

interface SyncLogResponse {
  data: SyncLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function SyncLogPage() {
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res: SyncLogResponse = await api(`/call-tracking/sync-logs?${params}`);
      setLogs(res.data);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch {
      // fallback handled by api mock
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const handleRetry = async (id: string) => {
    setRetrying(id);
    try {
      await api(`/call-tracking/sync-logs/${id}/retry`, { method: "POST" });
      toast.success("Retry initiated");
      load();
    } catch (e: any) {
      toast.error(e.message || "Retry failed");
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Sync Logs</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{total} total entries</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
          >
            <option value="">All</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
          </select>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date/Time</TableHead>
            <TableHead>Call</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Error</TableHead>
            <TableHead className="w-20">Retry</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={6} className="text-center text-[var(--muted-foreground)] py-8">Loading...</TableCell></TableRow>
          ) : logs.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center text-[var(--muted-foreground)] py-8">No sync logs found.</TableCell></TableRow>
          ) : (
            logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                  {new Date(log.attemptAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-xs text-[var(--foreground)]">
                  {log.callLog.fromNumber} → {log.callLog.toNumber}
                </TableCell>
                <TableCell>
                  <Badge variant={log.crmType === "webhook" ? "secondary" : "default"}>
                    {log.crmType}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    {log.status === "SUCCESS" ? (
                      <>
                        <CheckCircle size={12} className="text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400">Success</span>
                      </>
                    ) : (
                      <>
                        <XCircle size={12} className="text-red-500" />
                        <span className="text-red-600 dark:text-red-400">Failed</span>
                      </>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-[var(--muted-foreground)] max-w-[200px] truncate" title={log.error || ""}>
                  {log.error || "—"}
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => handleRetry(log.id)}
                    disabled={retrying === log.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50 transition-colors"
                  >
                    {retrying === log.id ? (
                      <RotateCw size={11} className="animate-spin" />
                    ) : (
                      <RotateCw size={11} />
                    )}
                    Retry
                  </button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--muted-foreground)]">
          Page {page} of {totalPages}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-40 transition-colors"
          >
            <ChevronLeft size={12} /> Prev
          </button>
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
            // Show pages around current page
            let start = Math.max(1, page - 4);
            const end = Math.min(totalPages, start + 9);
            if (end - start < 9) start = Math.max(1, end - 9);
            const pageNum = start + i;
            if (pageNum > totalPages) return null;
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                  pageNum === page
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-40 transition-colors"
          >
            Next <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
