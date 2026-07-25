import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { consumePendingFilter, PENDING_FILTER_APPLIED_EVENT } from "../lib/pendingSearch";
import toast from "react-hot-toast";
import { Plus, Search, MessageSquare, Clock, AlertCircle } from "lucide-react";
import { createPortal } from "react-dom";

const statusColors: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  WAITING_ON_CUSTOMER: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  RESOLVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CLOSED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const priorityColors: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  MEDIUM: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  URGENT: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentInternal, setCommentInternal] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLButtonElement | null>(null);

  const loadTickets = async (st = statusFilter, q = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (st) params.set("status", st);
      if (q) params.set("search", q);
      const res = await api(`/tickets?${params}`);
      setTickets(res.data || res);
    } catch { /* mock */ }
    setLoading(false);
  };

  const applyPendingFilter = () => {
    const pending = consumePendingFilter('tickets');
    if (!pending) return;
    const status = pending.filters?.status || "";
    setSearch(pending.filters?.search || "");
    setStatusFilter(status);
    setHighlightId(pending.highlightId || null);
    loadTickets(status);
  };

  useEffect(() => {
    applyPendingFilter();
    const onApplied = (e: Event) => {
      if ((e as CustomEvent<string>).detail === 'tickets') applyPendingFilter();
    };
    window.addEventListener(PENDING_FILTER_APPLIED_EVENT, onApplied);
    return () => window.removeEventListener(PENDING_FILTER_APPLIED_EVENT, onApplied);
  }, []);

  useEffect(() => {
    if (!highlightId || !highlightRef.current) return;
    highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setHighlightId(null), 3000);
    return () => clearTimeout(t);
  }, [highlightId, tickets]);

  const filtered = tickets.filter(t => !search || t.subject?.toLowerCase().includes(search.toLowerCase()) || t.lead?.contact?.name?.toLowerCase().includes(search.toLowerCase()));

  const statuses = ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Tickets</h1>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 transition-colors">
          <Plus size={16} /> New Ticket
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets..." className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-9 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); loadTickets(e.target.value); }} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50">
          <option value="">All statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[var(--muted-foreground)]">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-[var(--muted-foreground)]">No tickets found</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filtered.map(ticket => (
              <motion.button
                key={ticket.id}
                ref={highlightId === ticket.id ? highlightRef : undefined}
                onClick={() => setSelected(ticket)}
                animate={highlightId === ticket.id ? { backgroundColor: ['rgba(99,102,241,0.25)', 'rgba(99,102,241,0)', 'rgba(99,102,241,0.25)', 'rgba(99,102,241,0)'] } : undefined}
                transition={highlightId === ticket.id ? { duration: 2.4, times: [0, 0.33, 0.66, 1] } : undefined}
                className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-[var(--accent)] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-[var(--foreground)] truncate">{ticket.subject}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusColors[ticket.status] || ""}`}>{ticket.status?.replace(/_/g, " ")}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${priorityColors[ticket.priority] || ""}`}>{ticket.priority}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                    <span>{ticket.lead?.contact?.name || "Unknown"}</span>
                    <span className="flex items-center gap-1"><Clock size={12} />{new Date(ticket.createdAt).toLocaleDateString()}</span>
                    {ticket.comments?.length > 0 && <span className="flex items-center gap-1"><MessageSquare size={12} />{ticket.comments.length}</span>}
                    {ticket.dueAt && new Date(ticket.dueAt) < new Date() && ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
                      <span className="flex items-center gap-1 text-red-500"><AlertCircle size={12} />SLA breached</span>
                    )}
                  </div>
                </div>
                {ticket.assignedAgent && <span className="text-xs text-[var(--muted-foreground)] shrink-0">{ticket.assignedAgent.name}</span>}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateTicketModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadTickets(); }} />}
      {selected && <TicketDetailModal ticket={selected} onClose={() => setSelected(null)} onUpdated={() => loadTickets()} />}
    </div>
  );
}

function CreateTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ subject: "", description: "", priority: "MEDIUM", leadId: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/tickets", { method: "POST", body: JSON.stringify(form) });
      toast.success("Ticket created");
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Failed to create ticket");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">New Ticket</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Subject" required className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" rows={4} required className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
          <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50">
            <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
          </select>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">Cancel</button>
            <button type="submit" className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 transition-colors">Create</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function TicketDetailModal({ ticket, onClose, onUpdated }: { ticket: any; onClose: () => void; onUpdated: () => void }) {
  const [detail, setDetail] = useState<any>(ticket);
  const [commentText, setCommentText] = useState("");
  const [commentInternal, setCommentInternal] = useState(true);

  useEffect(() => {
    api(`/tickets/${ticket.id}`).then(setDetail).catch(() => setDetail(ticket));
  }, [ticket.id]);

  const updateStatus = async (status: string) => {
    try {
      await api(`/tickets/${ticket.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      toast.success("Status updated");
      onUpdated();
    } catch (err: any) { toast.error(err.message); }
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    try {
      await api(`/tickets/${ticket.id}/comments`, { method: "POST", body: JSON.stringify({ content: commentText, isInternal: commentInternal }) });
      setCommentText("");
      const upd = await api(`/tickets/${ticket.id}`).catch(() => null);
      if (upd) setDetail(upd);
      toast.success("Comment added");
    } catch (err: any) { toast.error(err.message); }
  };

  const comments = detail.comments || ticket.comments || [];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl h-[80vh] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg flex flex-col overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-[var(--foreground)] truncate">{detail.subject}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusColors[detail.status] || ""}`}>{detail.status?.replace(/_/g, " ")}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${priorityColors[detail.priority] || ""}`}>{detail.priority}</span>
              <span className="text-xs text-[var(--muted-foreground)]">{detail.lead?.contact?.name || "Unknown"}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">✕</button>
        </div>

        <div className="flex gap-2 px-6 py-3 border-b border-[var(--border)]">
          {["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"].map(s => (
            <button key={s} onClick={() => updateStatus(s)} disabled={s === detail.status} className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${s === detail.status ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]" : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"}`}>
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">{detail.description}</p>
          {detail.dueAt && (
            <div className={`text-xs flex items-center gap-1 ${new Date(detail.dueAt) < new Date() && detail.status !== "RESOLVED" && detail.status !== "CLOSED" ? "text-red-500" : "text-[var(--muted-foreground)]"}`}>
              <AlertCircle size={12} /> SLA due: {new Date(detail.dueAt).toLocaleString()}
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Comments ({comments.length})</h3>
            {comments.map((c: any) => (
              <div key={c.id} className={`rounded-lg p-3 ${c.isInternal ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800" : "bg-[var(--muted)]"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{c.user?.name || "Unknown"}</span>
                  <div className="flex items-center gap-2">
                    {c.isInternal && <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Internal</span>}
                    <span className="text-[10px] text-[var(--muted-foreground)]">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <p className="text-sm text-[var(--foreground)]">{c.content}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-2 mb-2">
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
              <input type="checkbox" checked={commentInternal} onChange={e => setCommentInternal(e.target.checked)} className="rounded border-[var(--border)]" /> Internal note
            </label>
          </div>
          <div className="flex gap-2">
            <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Add a comment..." onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(); } }} className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
            <button onClick={addComment} disabled={!commentText.trim()} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors">Send</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
