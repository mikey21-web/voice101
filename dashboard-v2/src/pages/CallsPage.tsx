import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";
import { useSocket } from "../hooks";
import toast from "react-hot-toast";
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Smartphone, Plus, Check, Download } from "lucide-react";
import { toCsv, downloadCsv } from "../lib/csv";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Dialog } from "../components/ui/dialog";

const sourceVariant: Record<string, "default" | "success" | "secondary"> = {
  SIM: "default",
  WHATSAPP: "success",
  TWILIO: "secondary",
};

const missedStatuses = new Set(["NO_ANSWER", "BUSY", "FAILED", "MISSED"]);

function formatDuration(sec?: number | null) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<any[]>([]);
  const [stats, setStats] = useState<{ callsToday: number; missedToday: number; avgDurationSec: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPair, setShowPair] = useState(false);
  const { lastEvent } = useSocket();
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [callsRes, statsRes] = await Promise.all([
        api("/call-tracking/calls"),
        api("/call-tracking/stats"),
      ]);
      setCalls(callsRes.data || callsRes);
      setStats(statsRes);
    } catch (e: any) {
      setError(e.message || 'Failed to load calls');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === "call.synced") {
      load();
    } else if (lastEvent.type === "call.summarized") {
      const p = lastEvent.payload as any;
      setCalls(prev => prev.map(c => c.id === p.callLogId ? { ...c, summary: p.summary, transcript: p.transcript, summaryStatus: "DONE" } : c));
    }
  }, [lastEvent, load]);

  const filteredCalls = calls.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = c.contact?.name || c.fromNumber || '';
    return name.toLowerCase().includes(q) || (c.fromNumber && c.fromNumber.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Calls</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCsv('calls', toCsv(filteredCalls.map((c: any) => ({
              time: c.createdAt, contact: c.contact?.name, phone: c.fromNumber,
              direction: c.direction, durationSec: c.durationSec, source: c.source,
              disposition: c.disposition, notes: c.notes,
            }))))}
            disabled={!filteredCalls.length}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={16} /> Export
          </button>
          <button onClick={() => setShowPair(true)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">
            <Smartphone size={16} className="text-[var(--primary)]" /> Pair a device
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-[var(--muted-foreground)]">Calls today</CardTitle>
            <Phone size={16} className="text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-[var(--foreground)]">{stats?.callsToday ?? "—"}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-[var(--muted-foreground)]">Missed / no-answer today</CardTitle>
            <PhoneMissed size={16} className="text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-[var(--foreground)]">{stats?.missedToday ?? "—"}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-[var(--muted-foreground)]">Avg. duration today</CardTitle>
            <Phone size={16} className="text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-[var(--foreground)]">{formatDuration(stats?.avgDurationSec)}</div></CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Filter by contact name or number..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 w-full max-w-xs rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
        />
      </div>

      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Number</TableHead>
            <TableHead>Direction</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Recording</TableHead>
            <TableHead>Disposition</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={10} className="text-center text-[var(--muted-foreground)] py-8">
              <div className="flex flex-col items-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
                <span>Loading calls...</span>
              </div>
            </TableCell></TableRow>
          ) : error ? (
            <TableRow><TableCell colSpan={10} className="text-center py-8">
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm text-red-500">{error}</span>
                <button onClick={load} className="text-xs text-[var(--primary)] hover:underline">Try again</button>
              </div>
            </TableCell></TableRow>
          ) : filteredCalls.length === 0 ? (
            <TableRow><TableCell colSpan={10} className="text-center text-[var(--muted-foreground)] py-8">
              {search ? 'No calls match your filter' : 'No calls synced yet. Pair a device to get started.'}
            </TableCell></TableRow>
          ) : (
            filteredCalls.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">{new Date(c.createdAt).toLocaleString()}</TableCell>
                <TableCell className="font-medium text-[var(--foreground)]">
                  {c.contact?.name || c.fromNumber}
                  {c.summary && <div className="text-xs text-[var(--muted-foreground)] font-normal mt-0.5 max-w-[220px] truncate" title={c.summary}>{c.summary}</div>}
                  {c.summaryStatus === "PENDING" && c.recordingUrl && <div className="text-xs text-[var(--muted-foreground)] font-normal mt-0.5 italic">Transcribing...</div>}
                </TableCell>
                <TableCell className="text-xs text-[var(--muted-foreground)]">{c.fromNumber}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--foreground)]">
                    {c.direction === "INBOUND" ? <PhoneIncoming size={13} /> : <PhoneOutgoing size={13} />}
                    {c.direction === "INBOUND" ? "Inbound" : "Outbound"}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-[var(--foreground)]">{formatDuration(c.durationSec)}</TableCell>
                <TableCell><Badge variant={sourceVariant[c.source] || "secondary"}>{c.source}</Badge></TableCell>
                <TableCell>
                  {missedStatuses.has(c.status) ? (
                    <Badge variant="destructive">{c.status.replace(/_/g, " ")}</Badge>
                  ) : (
                    <Badge variant="success">{c.status.replace(/_/g, " ")}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {c.recordingUrl ? (
                    <audio controls className="h-8 w-48" preload="metadata">
                      <source src={c.recordingUrl} type="audio/mpeg" />
                    </audio>
                  ) : (
                    <span className="text-xs text-[var(--muted-foreground)]">—</span>
                  )}
                </TableCell>
                <DispositionCell call={c} onUpdate={(id, disposition) => {
                  setCalls(prev => prev.map(call => call.id === id ? { ...call, disposition } : call));
                }} />
                <NotesCell call={c} onUpdate={(id, notes) => {
                  setCalls(prev => prev.map(call => call.id === id ? { ...call, notes } : call));
                }} />
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>

      {showPair && <PairDeviceModal onClose={() => setShowPair(false)} />}
    </div>
  );
}

const DISPOSITIONS = [
  "connected_qualified", "connected_follow_up", "wrong_number", "no_answer",
  "busy", "switched_off", "not_interested", "site_visit_scheduled", "lost",
];

function DispositionCell({ call, onUpdate }: { call: any; onUpdate: (id: string, disposition: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [nextActionAt, setNextActionAt] = useState("");

  const save = async (disposition: string) => {
    if (!disposition) return;
    setSaving(true);
    try {
      await api(`/call-tracking/calls/${call.id}/disposition`, {
        method: "PATCH",
        body: JSON.stringify({ disposition, nextActionAt: nextActionAt ? new Date(nextActionAt).toISOString() : undefined }),
      });
      onUpdate(call.id, disposition);
      toast.success("Disposition saved");
    } catch {
      toast.error("Failed to save disposition");
    }
    setSaving(false);
  };

  return (
    <TableCell>
      <div className="flex flex-col gap-1">
        <select
          value={call.disposition || ""}
          onChange={e => save(e.target.value)}
          disabled={saving}
          className="h-7 rounded border border-[var(--border)] bg-[var(--background)] px-1 text-xs text-[var(--foreground)]"
        >
          <option value="">Set outcome...</option>
          {DISPOSITIONS.map(d => <option key={d} value={d}>{d.replace(/_/g, " ")}</option>)}
        </select>
        {!call.disposition && (
          <input
            type="datetime-local"
            value={nextActionAt}
            onChange={e => setNextActionAt(e.target.value)}
            title="Follow-up date (optional, set before choosing an outcome)"
            className="h-6 rounded border border-[var(--border)] bg-[var(--background)] px-1 text-[10px] text-[var(--foreground)]"
          />
        )}
      </div>
    </TableCell>
  );
}

function NotesCell({ call, onUpdate }: { call: any; onUpdate: (id: string, notes: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(call.notes || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editing]);

  const handleSave = async () => {
    if (saving) return;
    const trimmed = value.trim();
    // If user cleared the note, delete it instead of saving empty string
    if (!trimmed && !call.notes) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await api(`/call-tracking/calls/${call.id}/notes`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: trimmed }),
      });
      setSaved(true);
      onUpdate(call.id, trimmed);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  // Show "+ Add note" when empty and not editing
  if (!call.notes && !editing) {
    return (
      <TableCell>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-[var(--primary)] hover:underline"
        >
          + Add note
        </button>
      </TableCell>
    );
  }

  // Show textarea when editing
  if (editing) {
    return (
      <TableCell>
        <div className="flex items-start gap-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); } }}
            className="w-40 h-16 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50"
          />
          {saved && <Check size={14} className="text-emerald-500 shrink-0 mt-1" />}
        </div>
      </TableCell>
    );
  }

  // Show notes text with edit button on hover
  return (
    <TableCell>
      <div className="flex items-center gap-1 group">
        <span className="text-xs text-[var(--foreground)] max-w-[150px] truncate block" title={call.notes}>
          {call.notes}
        </span>
        <button
          onClick={() => { setEditing(true); setValue(call.notes || ''); }}
          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          title="Edit note"
        >
          ✏️
        </button>
      </div>
    </TableCell>
  );
}

function PairDeviceModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [pairing, setPairing] = useState<{ pairingCode: string; expiresAt: string } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await api("/call-tracking/devices/pair-code", { method: "POST", body: JSON.stringify({ name: name || undefined }) });
      setPairing(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate pairing code");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!pairing) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((new Date(pairing.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pairing]);

  return (
    <Dialog open onClose={onClose} title="Pair a device" description="Generate a code, then enter it in the mobile app to start syncing calls.">
      {!pairing ? (
        <div className="space-y-4">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Device label (e.g. Sarah's phone)"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
          />
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">Cancel</button>
            <button onClick={generate} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors">
              <Plus size={16} /> Generate code
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-center">
          <div className="rounded-lg bg-[var(--muted)] py-6">
            <div className="text-4xl font-bold tracking-[0.3em] text-[var(--foreground)]">{pairing.pairingCode}</div>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            {secondsLeft > 0 ? `Expires in ${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, "0")}` : "Code expired — generate a new one"}
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setPairing(null)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">New code</button>
            <button onClick={onClose} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 transition-colors">Done</button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
