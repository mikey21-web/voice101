import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import toast from "react-hot-toast";
import { Plus, MapPin, Check, X, CalendarClock, UserCheck, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { createPortal } from "react-dom";
import { Dialog } from "../components/ui/dialog";

const statusVariant: Record<string, "default" | "success" | "secondary" | "destructive" | "warning"> = {
  SCHEDULED: "default",
  CONFIRMED: "secondary",
  COMPLETED: "success",
  NO_SHOW: "destructive",
  RESCHEDULED: "warning",
  CANCELLED: "destructive",
};

const OPEN_STATUSES = new Set(["SCHEDULED", "CONFIRMED"]);

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      weekday: "short", day: "numeric", month: "short",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  } catch {
    return iso;
  }
}

export default function SiteVisitsPage() {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [outcomeFor, setOutcomeFor] = useState<any | null>(null);
  const [noShowFor, setNoShowFor] = useState<any | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = statusFilter ? `?status=${statusFilter}` : "";
      const res = await api(`/site-visits${q}`);
      setVisits(res.data || res);
    } catch (e: any) {
      setError(e.message || "Failed to load site visits");
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: string, body?: any) => {
    try {
      await api(`/site-visits/${id}/${action}`, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      toast.success("Updated");
      load();
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    }
  };

  const today = visits.filter(v => OPEN_STATUSES.has(v.status) && new Date(v.startAt).toDateString() === new Date().toDateString());

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Site Visits</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">{visits.length} visits</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus size={16} /> Schedule visit
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-[var(--muted-foreground)]">Visits today</CardTitle>
            <CalendarClock size={16} className="text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-[var(--foreground)]">{today.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-[var(--muted-foreground)]">No-shows</CardTitle>
            <X size={16} className="text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-[var(--foreground)]">{visits.filter(v => v.status === "NO_SHOW").length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-[var(--muted-foreground)]">Completed</CardTitle>
            <Check size={16} className="text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-[var(--foreground)]">{visits.filter(v => v.status === "COMPLETED").length}</div></CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
        >
          <option value="">All statuses</option>
          {["SCHEDULED", "CONFIRMED", "COMPLETED", "NO_SHOW", "RESCHEDULED", "CANCELLED"].map(s => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
          <button onClick={() => setViewMode("table")} className={`px-3 py-1.5 text-xs font-medium ${viewMode === "table" ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)] hover:bg-[var(--accent)]"}`}>Table</button>
          <button onClick={() => setViewMode("calendar")} className={`px-3 py-1.5 text-xs font-medium ${viewMode === "calendar" ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)] hover:bg-[var(--accent)]"}`}>Calendar</button>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <CalendarView visits={visits} onReschedule={setRescheduleFor} />
      ) : (

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead>Project / Unit</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={6} className="text-center text-[var(--muted-foreground)] py-8">
              <div className="flex flex-col items-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
                <span>Loading site visits...</span>
              </div>
            </TableCell></TableRow>
          ) : error ? (
            <TableRow><TableCell colSpan={6} className="text-center py-8">
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm text-red-500">{error}</span>
                <button onClick={load} className="text-xs text-[var(--primary)] hover:underline">Try again</button>
              </div>
            </TableCell></TableRow>
          ) : visits.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center text-[var(--muted-foreground)] py-8">
              No site visits scheduled yet.
            </TableCell></TableRow>
          ) : (
            visits.map(v => (
              <TableRow key={v.id}>
                <TableCell className="text-xs text-[var(--foreground)] whitespace-nowrap">{formatWhen(v.startAt)}</TableCell>
                <TableCell className="font-medium text-[var(--foreground)]">
                  {v.lead?.contact?.name || v.leadId}
                  {v.mapsUrl && (
                    <a href={v.mapsUrl} target="_blank" rel="noreferrer" className="ml-1 inline-flex text-[var(--primary)]">
                      <MapPin size={12} />
                    </a>
                  )}
                </TableCell>
                <TableCell className="text-xs text-[var(--muted-foreground)]">
                  {v.project?.name}{v.unit?.unitNumber ? ` · Unit ${v.unit.unitNumber}` : ""}
                </TableCell>
                <TableCell className="text-xs text-[var(--muted-foreground)]">{v.assignedAgent?.name || "Unassigned"}</TableCell>
                <TableCell><Badge variant={statusVariant[v.status] || "secondary"}>{v.status.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {v.status === "SCHEDULED" && (
                      <button onClick={() => act(v.id, "confirm")} className="text-xs px-2 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--accent)] text-[var(--foreground)]">Confirm</button>
                    )}
                    {OPEN_STATUSES.has(v.status) && !v.checkedInAt && (
                      <button onClick={() => { navigator.geolocation.getCurrentPosition(pos => act(v.id, "check-in", { lat: pos.coords.latitude, lng: pos.coords.longitude }), () => act(v.id, "check-in"), { timeout: 5000 }); }} className="text-xs px-2 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--accent)] text-[var(--foreground)] inline-flex items-center gap-1">
                        <UserCheck size={12} /> Check in
                      </button>
                    )}
                    {v.checkedInAt && !v.checkedOutAt && v.status !== "COMPLETED" && (
                      <button onClick={() => act(v.id, "check-out")} className="text-xs px-2 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--accent)] text-[var(--foreground)] inline-flex items-center gap-1">
                        <LogOut size={12} /> Check out
                      </button>
                    )}
                    {OPEN_STATUSES.has(v.status) && (
                      <>
                        <button onClick={() => setOutcomeFor(v)} className="text-xs px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">Complete</button>
                        <button onClick={() => setNoShowFor(v)} className="text-xs px-2 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400">No-show</button>
                        <button onClick={() => setRescheduleFor(v)} className="text-xs px-2 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--accent)] text-[var(--foreground)]">Reschedule</button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      )}

      {showCreate && <CreateVisitModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
      {outcomeFor && <OutcomeModal visit={outcomeFor} onClose={() => setOutcomeFor(null)} onDone={() => { setOutcomeFor(null); load(); }} />}
      {noShowFor && <NoShowModal visit={noShowFor} onClose={() => setNoShowFor(null)} onDone={() => { setNoShowFor(null); load(); }} />}
      {rescheduleFor && <RescheduleModal visit={rescheduleFor} onClose={() => setRescheduleFor(null)} onDone={() => { setRescheduleFor(null); load(); }} />}
    </div>
  );
}

function CreateVisitModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [leadQuery, setLeadQuery] = useState("");
  const [leadOptions, setLeadOptions] = useState<any[]>([]);
  const [leadId, setLeadId] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [form, setForm] = useState({ projectId: "", unitId: "", startAt: "", meetingPoint: "", mapsUrl: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api("/projects").then((r: any) => setProjects(r.data || r)).catch(() => {}); }, []);

  useEffect(() => {
    if (!leadQuery.trim()) { setLeadOptions([]); return; }
    const t = setTimeout(() => {
      api(`/leads?search=${encodeURIComponent(leadQuery)}&limit=8`).then((r: any) => setLeadOptions(r.data || r)).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [leadQuery]);

  useEffect(() => {
    if (!form.projectId) { setUnits([]); return; }
    api(`/units?projectId=${form.projectId}`).then((r: any) => setUnits(r.data || r)).catch(() => setUnits([]));
  }, [form.projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId || !form.projectId || !form.startAt) {
      toast.error("Buyer, project, and date/time are required");
      return;
    }
    setSaving(true);
    try {
      await api("/site-visits", {
        method: "POST",
        body: JSON.stringify({
          leadId,
          projectId: form.projectId,
          unitId: form.unitId || undefined,
          startAt: new Date(form.startAt).toISOString(),
          meetingPoint: form.meetingPoint || undefined,
          mapsUrl: form.mapsUrl || undefined,
        }),
      });
      toast.success("Site visit scheduled");
      onCreated();
    } catch (e: any) {
      toast.error(e.message || "Failed to schedule visit");
    }
    setSaving(false);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">Schedule a site visit</h2>
        <div className="space-y-3">
          <div>
            <input
              placeholder="Search buyer by name/phone/email"
              value={leadId ? leadOptions.find(l => l.id === leadId)?.contact?.name || leadQuery : leadQuery}
              onChange={e => { setLeadQuery(e.target.value); setLeadId(""); }}
              className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
            />
            {leadOptions.length > 0 && !leadId && (
              <div className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--card)] max-h-40 overflow-auto">
                {leadOptions.map(l => (
                  <button
                    type="button"
                    key={l.id}
                    onClick={() => { setLeadId(l.id); setLeadOptions([]); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--accent)] text-[var(--foreground)]"
                  >
                    {l.contact?.name || l.contact?.phone || l.id}
                  </button>
                ))}
              </div>
            )}
          </div>
          <select
            value={form.projectId}
            onChange={e => setForm({ ...form, projectId: e.target.value, unitId: "" })}
            className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
            required
          >
            <option value="">Select project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {units.length > 0 && (
            <select
              value={form.unitId}
              onChange={e => setForm({ ...form, unitId: e.target.value })}
              className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
            >
              <option value="">Any unit (optional)</option>
              {units.map((u: any) => <option key={u.id} value={u.id}>{u.unitNumber}</option>)}
            </select>
          )}
          <input
            type="datetime-local"
            value={form.startAt}
            onChange={e => setForm({ ...form, startAt: e.target.value })}
            className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
            required
          />
          <input
            placeholder="Meeting point (optional)"
            value={form.meetingPoint}
            onChange={e => setForm({ ...form, meetingPoint: e.target.value })}
            className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
          />
          <input
            placeholder="Google Maps link (optional)"
            value={form.mapsUrl}
            onChange={e => setForm({ ...form, mapsUrl: e.target.value })}
            className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)]">Cancel</button>
          <button type="submit" disabled={saving} className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? "Scheduling..." : "Schedule"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function OutcomeModal({ visit, onClose, onDone }: { visit: any; onClose: () => void; onDone: () => void }) {
  const [attended, setAttended] = useState(true);
  const [notes, setNotes] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api(`/site-visits/${visit.id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          outcome: { attended, notes },
          nextActionAt: nextActionAt ? new Date(nextActionAt).toISOString() : undefined,
        }),
      });
      toast.success("Visit marked completed");
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Failed to save outcome");
    }
    setSaving(false);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Visit outcome"
      maxWidth="max-w-md"
      footer={
        <>
          <button onClick={onClose} className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)]">Cancel</button>
          <button onClick={submit} disabled={saving} className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving..." : "Save outcome"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
          <input type="checkbox" checked={attended} onChange={e => setAttended(e.target.checked)} /> Buyer attended
        </label>
        <textarea
          placeholder="Notes / objections raised"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full h-20 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
        />
        <div>
          <label className="text-xs text-[var(--muted-foreground)]">Next follow-up (optional)</label>
          <input
            type="datetime-local"
            value={nextActionAt}
            onChange={e => setNextActionAt(e.target.value)}
            className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
          />
        </div>
      </div>
    </Dialog>
  );
}

function NoShowModal({ visit, onClose, onDone }: { visit: any; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api(`/site-visits/${visit.id}/no-show`, { method: "POST", body: JSON.stringify({ noShowReason: reason }) });
      toast.success("Marked as no-show — a recovery task was created");
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Failed to mark no-show");
    }
    setSaving(false);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Mark as no-show"
      maxWidth="max-w-md"
      footer={
        <>
          <button onClick={onClose} className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)]">Cancel</button>
          <button onClick={submit} disabled={saving} className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving..." : "Confirm no-show"}
          </button>
        </>
      }
    >
      <textarea
        placeholder="Reason (optional)"
        value={reason}
        onChange={e => setReason(e.target.value)}
        className="w-full h-20 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
      />
    </Dialog>
  );
}

function RescheduleModal({ visit, onClose, onDone }: { visit: any; onClose: () => void; onDone: () => void }) {
  const [startAt, setStartAt] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!startAt) { toast.error("Pick a new date/time"); return; }
    setSaving(true);
    try {
      await api(`/site-visits/${visit.id}/reschedule`, {
        method: "POST",
        body: JSON.stringify({ startAt: new Date(startAt).toISOString(), reason: reason || undefined }),
      });
      toast.success("Visit rescheduled");
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Failed to reschedule");
    }
    setSaving(false);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Reschedule visit"
      maxWidth="max-w-md"
      footer={
        <>
          <button onClick={onClose} className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)]">Cancel</button>
          <button onClick={submit} disabled={saving} className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving..." : "Reschedule"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <input
          type="datetime-local"
          value={startAt}
          onChange={e => setStartAt(e.target.value)}
          className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
        />
        <textarea
          placeholder="Reason (optional)"
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full h-16 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
        />
      </div>
    </Dialog>
  );
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CalendarView({ visits, onReschedule }: { visits: any[]; onReschedule: (v: any) => void }) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const grouped: Record<string, any[]> = {};
  for (const v of visits) {
    if (!["SCHEDULED", "CONFIRMED"].includes(v.status)) continue;
    const key = new Date(v.startAt).toDateString();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(v);
  }

  return (
    <div className="grid grid-cols-7 gap-px rounded-xl border border-[var(--border)] bg-[var(--border)] overflow-hidden">
      {weekDays.map((day, i) => {
        const key = day.toDateString();
        const dayVisits = grouped[key] || [];
        const isToday = key === today.toDateString();
        return (
          <div key={i} className={`min-h-[140px] bg-[var(--card)] p-2 ${isToday ? "ring-1 ring-inset ring-[var(--primary)]" : ""}`}>
            <div className={`text-xs font-semibold mb-1 text-center ${isToday ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}>
              {DAY_NAMES[i]} {day.getDate()}
            </div>
            {dayVisits.slice(0, 4).map(v => (
              <div key={v.id} className="text-xs rounded-md px-1.5 py-1 mb-1 bg-[var(--accent)] truncate cursor-pointer hover:opacity-80" onClick={() => onReschedule(v)} title={v.lead?.contact?.name || v.leadId}>
                <div className="font-medium text-[var(--foreground)] truncate">{v.lead?.contact?.name || "?"}</div>
                <div className="text-[var(--muted-foreground)]">{new Date(v.startAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}</div>
              </div>
            ))}
            {dayVisits.length > 4 && <div className="text-xs text-[var(--muted-foreground)] text-center">+{dayVisits.length - 4} more</div>}
          </div>
        );
      })}
    </div>
  );
}
