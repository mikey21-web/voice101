import { useState, useEffect, useCallback } from "react";
import { Plus, X, CheckCircle2, Clock, AlertTriangle, Ban, FileText, Printer } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { api } from "../lib/api";
import toast from "react-hot-toast";
import LeadPicker from "../components/LeadPicker";
import { Dialog } from "../components/ui/dialog";

const statusMeta: Record<string, { color: string; icon: any; label: string }> = {
  PENDING: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Clock, label: "Pending" },
  PAID: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2, label: "Paid" },
  OVERDUE: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: AlertTriangle, label: "Overdue" },
  WAIVED: { color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", icon: Ban, label: "Waived" },
};

export default function PaymentSchedulesPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState<{ id: string; label: string } | null>(null);
  const [form, setForm] = useState<any>({ label: "", amount: "", dueDate: "", notes: "" });
  const [demandLetter, setDemandLetter] = useState<any | null>(null);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await api(`/payment-schedules?${params}`);
      setSchedules(Array.isArray(res) ? res : res.data || []);
    } catch { toast.error("Failed to load payment schedules"); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const resetForm = () => { setForm({ label: "", amount: "", dueDate: "", notes: "" }); setSelectedLead(null); };

  const handleCreate = async () => {
    if (!selectedLead) return;
    try {
      await api("/payment-schedules", {
        method: "POST",
        body: JSON.stringify({
          leadId: selectedLead.id,
          label: form.label,
          amount: Number(form.amount),
          dueDate: form.dueDate || undefined,
          notes: form.notes || undefined,
        }),
        headers: { "Content-Type": "application/json" },
      });
      toast.success("Payment milestone created — reminders scheduled");
      setShowForm(false);
      resetForm();
      fetchSchedules();
    } catch { toast.error("Failed to create payment milestone"); }
  };

  const markPaid = async (id: string) => {
    try {
      await api(`/payment-schedules/${id}/mark-paid`, { method: "POST" });
      toast.success("Marked paid — reminders cancelled");
      fetchSchedules();
    } catch { toast.error("Failed to update"); }
  };

  const waive = async (id: string) => {
    try {
      await api(`/payment-schedules/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "WAIVED" }),
        headers: { "Content-Type": "application/json" },
      });
      toast.success("Milestone waived");
      fetchSchedules();
    } catch { toast.error("Failed to update"); }
  };

  const genDemandLetter = async (scheduleId: string) => {
    try {
      const doc = await api("/demand-letters", { method: "POST", body: JSON.stringify({ paymentScheduleId: scheduleId }), headers: { "Content-Type": "application/json" } });
      setDemandLetter(doc);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate demand letter. Ensure an approved DEMAND_LETTER template exists.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this payment milestone?")) return;
    try {
      await api(`/payment-schedules/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      fetchSchedules();
    } catch { toast.error("Failed to delete"); }
  };

  const formatMoney = (n: number, currency = "INR") => {
    try { return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n); }
    catch { return `${currency} ${n}`; }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Payments & Collections</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Booking, registration & possession milestones — automated reminders 3 days before and on the due date</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Milestone
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm">
          <option value="">All Status</option>
          {Object.keys(statusMeta).map(k => <option key={k} value={k}>{statusMeta[k].label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-[var(--muted-foreground)]">Loading...</div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-8 text-[var(--muted-foreground)]">No payment milestones yet</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(
            schedules.reduce<Record<string, any[]>>((groups, s: any) => {
              const key = s.leadId || "unknown";
              (groups[key] ||= []).push(s);
              return groups;
            }, {})
          ).map(([leadId, group]) => {
            const buyerName = group[0]?.lead?.contact?.name || "Unknown buyer";
            const total = group.reduce((sum, s) => sum + s.amount, 0);
            const paid = group.filter(s => s.status === "PAID").reduce((sum, s) => sum + s.amount, 0);
            const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
            const ordered = [...group].sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));

            return (
              <div key={leadId} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-[var(--foreground)]">{buyerName}</div>
                  <div className="text-sm text-[var(--muted-foreground)]">{formatMoney(paid)} / {formatMoney(total)} collected ({pct}%)</div>
                </div>
                <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  {ordered.map((s: any) => {
                    const meta = statusMeta[s.status] || statusMeta.PENDING;
                    const Icon = meta.icon;
                    return (
                      <div key={s.id} className="min-w-[200px] flex-1 rounded-lg border border-[var(--border)] p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-[var(--foreground)]">{s.label}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${meta.color}`}>
                            <Icon className="h-3 w-3" /> {meta.label}
                          </span>
                        </div>
                        <div className="text-sm font-mono text-[var(--foreground)]">{formatMoney(s.amount, s.currency)}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">Due {formatDate(s.dueDate)}</div>
                        <div className="flex gap-1 flex-wrap">
                          {["PENDING", "OVERDUE"].includes(s.status) && (
                            <button onClick={() => genDemandLetter(s.id)} className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:opacity-80 inline-flex items-center gap-1">
                              <FileText className="h-3 w-3" /> Demand letter
                            </button>
                          )}
                          {(s.status === "PENDING" || s.status === "OVERDUE") && (
                            <button onClick={() => markPaid(s.id)} className="text-xs px-2 py-1 rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:opacity-80">Mark paid</button>
                          )}
                          {s.status === "PENDING" && (
                            <button onClick={() => waive(s.id)} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:opacity-80">Waive</button>
                          )}
                          <button onClick={() => handleDelete(s.id)} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-500"><X className="h-4 w-4" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {demandLetter && (
        <Dialog
          open
          onClose={() => setDemandLetter(null)}
          title="Demand Letter"
          maxWidth="max-w-2xl"
          footer={
            <button onClick={() => window.print()} className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20">
              <Printer className="h-4 w-4" /> Print
            </button>
          }
        >
          <div className="max-h-[60vh] overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap font-serif">
            {demandLetter.snapshot?.body || demandLetter.snapshot || "No content"}
          </div>
        </Dialog>
      )}

      {showForm && (
        <Dialog
          open
          onClose={() => setShowForm(false)}
          title="Add Payment Milestone"
          maxWidth="max-w-md"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!selectedLead || !form.label || !form.amount}>Create</Button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium block mb-1">Buyer *</label>
              <LeadPicker value={selectedLead} onChange={setSelectedLead} placeholder="Search by name, email, or phone..." />
              <p className="text-xs text-[var(--muted-foreground)] mt-1">You can also add a milestone directly from a buyer's row on the Leads page.</p>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Milestone *</label>
              <Input value={form.label} onChange={e => setForm((f: any) => ({ ...f, label: e.target.value }))} placeholder="e.g. Booking Amount, Registration, Possession" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Amount (₹) *</label>
              <Input type="number" value={form.amount} onChange={e => setForm((f: any) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Due Date</label>
              <Input type="date" value={form.dueDate} onChange={e => setForm((f: any) => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 min-h-[60px] text-sm" />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
