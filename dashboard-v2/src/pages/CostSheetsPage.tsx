import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import toast from "react-hot-toast";
import { Plus, FileText, Send, Check, X, GitCompare, ArrowRightCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import BookingWizardModal from "../components/BookingWizardModal";
import { Dialog } from "../components/ui/dialog";

const statusVariant: Record<string, "default" | "success" | "secondary" | "destructive" | "warning"> = {
  DRAFT: "secondary",
  PENDING_APPROVAL: "warning",
  APPROVED: "success",
  SENT: "default",
  EXPIRED: "destructive",
  SUPERSEDED: "destructive",
};

function formatPaise(paise?: string | number) {
  if (paise == null) return "—";
  const rupees = Number(paise) / 100;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(rupees);
}

export default function CostSheetsPage() {
  const [sheets, setSheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [openSheet, setOpenSheet] = useState<any | null>(null);
  const [bookingTarget, setBookingTarget] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api("/cost-sheets");
      setSheets(res.data || res);
    } catch (e: any) {
      setError(e.message || "Failed to load cost sheets");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: string) => {
    try {
      await api(`/cost-sheets/${id}/${action}`, { method: "POST" });
      toast.success("Updated");
      load();
      if (openSheet?.id === id) {
        const fresh = await api(`/cost-sheets/${id}`);
        setOpenSheet(fresh);
      }
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Cost Sheets</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">{sheets.length} sheets</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus size={16} /> New cost sheet
        </button>
      </div>

      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Buyer</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={6} className="text-center text-[var(--muted-foreground)] py-8">
              <div className="flex flex-col items-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
                <span>Loading cost sheets...</span>
              </div>
            </TableCell></TableRow>
          ) : error ? (
            <TableRow><TableCell colSpan={6} className="text-center py-8">
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm text-red-500">{error}</span>
                <button onClick={load} className="text-xs text-[var(--primary)] hover:underline">Try again</button>
              </div>
            </TableCell></TableRow>
          ) : sheets.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center text-[var(--muted-foreground)] py-8">
              No cost sheets yet.
            </TableCell></TableRow>
          ) : (
            sheets.map(s => (
              <TableRow key={s.id} className="cursor-pointer" onClick={async () => setOpenSheet(await api(`/cost-sheets/${s.id}`))}>
                <TableCell className="font-medium text-[var(--foreground)]">{s.lead?.contact?.name || s.leadId}</TableCell>
                <TableCell className="text-xs text-[var(--muted-foreground)]">{s.unit?.unitNumber || s.unitId}</TableCell>
                <TableCell className="text-sm text-[var(--foreground)]">{formatPaise(s.totalPaise)}</TableCell>
                <TableCell><Badge variant={statusVariant[s.status] || "secondary"}>{s.status.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell className="text-xs text-[var(--muted-foreground)]">{new Date(s.createdAt).toLocaleDateString()}</TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <div className="flex gap-1">
                    {s.status === "DRAFT" && <button onClick={() => act(s.id, "submit")} className="text-xs px-2 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--accent)]">Submit</button>}
                    {s.status === "PENDING_APPROVAL" && <button onClick={() => act(s.id, "approve")} className="text-xs px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Approve</button>}
                    {s.status === "APPROVED" && <button onClick={() => act(s.id, "send")} className="text-xs px-2 py-1 rounded-md bg-[var(--primary)] text-white inline-flex items-center gap-1"><Send size={12} /> Send</button>}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>

      {showCreate && <CreateCostSheetModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
      {openSheet && <CostSheetDrawer sheet={openSheet} onClose={() => setOpenSheet(null)} onChanged={async () => { load(); setOpenSheet(await api(`/cost-sheets/${openSheet.id}`)); }} onStartBooking={() => setBookingTarget(openSheet)} />}
      {bookingTarget && <BookingWizardModal costSheet={bookingTarget} onClose={() => setBookingTarget(null)} onDone={() => { setBookingTarget(null); setOpenSheet(null); load(); }} />}
    </div>
  );
}

function CreateCostSheetModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [leadQuery, setLeadQuery] = useState("");
  const [leadOptions, setLeadOptions] = useState<any[]>([]);
  const [leadId, setLeadId] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [projectId, setProjectId] = useState("");
  const [unitId, setUnitId] = useState("");
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
    if (!projectId) { setUnits([]); return; }
    api(`/units?projectId=${projectId}`).then((r: any) => setUnits(r.data || r)).catch(() => setUnits([]));
  }, [projectId]);

  const submit = async () => {
    if (!leadId || !projectId || !unitId) { toast.error("Buyer, project, and unit are required"); return; }
    setSaving(true);
    try {
      await api("/cost-sheets", { method: "POST", body: JSON.stringify({ leadId, projectId, unitId }) });
      toast.success("Cost sheet drafted");
      onCreated();
    } catch (e: any) {
      toast.error(e.message || "Failed to create cost sheet");
    }
    setSaving(false);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="New cost sheet"
      maxWidth="max-w-md"
      footer={
        <>
          <button onClick={onClose} className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)]">Cancel</button>
          <button onClick={submit} disabled={saving} className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? "Creating..." : "Create draft"}
          </button>
        </>
      }
    >
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
                <button type="button" key={l.id} onClick={() => { setLeadId(l.id); setLeadOptions([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--accent)] text-[var(--foreground)]">
                  {l.contact?.name || l.contact?.phone || l.id}
                </button>
              ))}
            </div>
          )}
        </div>
        <select value={projectId} onChange={e => { setProjectId(e.target.value); setUnitId(""); }} className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]">
          <option value="">Select project</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={unitId} onChange={e => setUnitId(e.target.value)} className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" disabled={!units.length}>
          <option value="">{units.length ? "Select unit" : "Choose a project first"}</option>
          {units.map((u: any) => <option key={u.id} value={u.id}>{u.unitNumber}</option>)}
        </select>
      </div>
    </Dialog>
  );
}

function CostSheetDrawer({ sheet, onClose, onChanged, onStartBooking }: { sheet: any; onClose: () => void; onChanged: () => void; onStartBooking?: () => void }) {
  const [lineItems, setLineItems] = useState<any[]>(sheet.lineItems || []);
  const [saving, setSaving] = useState(false);
  const [discountPaise, setDiscountPaise] = useState("");
  const [reason, setReason] = useState("");
  const [comparing, setComparing] = useState<any | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  const editable = sheet.status === "DRAFT";
  const total = lineItems.reduce((sum, li) => sum + Number(li.amountPaise || 0), 0);

  const updateLine = (i: number, field: string, value: any) => {
    setLineItems(prev => prev.map((li, idx) => idx === i ? { ...li, [field]: value } : li));
  };
  const addLine = () => setLineItems(prev => [...prev, { code: "", label: "", amountPaise: 0, calculationType: "FLAT" }]);
  const removeLine = (i: number) => setLineItems(prev => prev.filter((_, idx) => idx !== i));

  const saveLines = async () => {
    setSaving(true);
    try {
      await api(`/cost-sheets/${sheet.id}/line-items`, {
        method: "POST",
        body: JSON.stringify({ lineItems: lineItems.map(li => ({ ...li, amountPaise: Number(li.amountPaise) })) }),
      });
      toast.success("Line items saved");
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    }
    setSaving(false);
  };

  const requestDiscount = async () => {
    if (!discountPaise) { toast.error("Enter a discount amount"); return; }
    try {
      await api("/offers", { method: "POST", body: JSON.stringify({ costSheetId: sheet.id, discountPaise: Number(discountPaise), reason: reason || undefined }) });
      toast.success("Discount requested — awaiting manager approval");
      setDiscountPaise(""); setReason("");
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Failed to request discount");
    }
  };

  const decideOffer = async (offerId: string, decision: "approve" | "reject") => {
    try {
      await api(`/offers/${offerId}/${decision}`, { method: "POST" });
      toast.success(`Offer ${decision}d`);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    }
  };

  const loadCompare = async () => {
    setCompareLoading(true);
    try {
      const all = await api(`/cost-sheets?leadId=${sheet.leadId}&limit=20`);
      const list: any[] = all.data || all;
      const older = list.filter((s: any) => s.id !== sheet.id && new Date(s.createdAt) < new Date(sheet.createdAt));
      if (older.length === 0) { toast.error("No previous version to compare"); setCompareLoading(false); return; }
      const prevId = older.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].id;
      const diff = await api(`/cost-sheets/${sheet.id}/compare/${prevId}`);
      setComparing(diff);
    } catch (e: any) {
      toast.error(e.message || "Failed to compare");
    }
    setCompareLoading(false);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-lg h-full bg-[var(--card)] border-l border-[var(--border)] p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2"><FileText size={18} /> Cost sheet</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--accent)]"><X size={18} /></button>
        </div>

        <div className="space-y-2">
          {lineItems.map((li, i) => (
            <div key={li.id || i} className="flex gap-2 items-center">
              <input disabled={!editable} value={li.label} onChange={e => updateLine(i, "label", e.target.value)} placeholder="Label" className="flex-1 h-8 rounded border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)]" />
              <input disabled={!editable} value={li.code} onChange={e => updateLine(i, "code", e.target.value)} placeholder="Code" className="w-20 h-8 rounded border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)]" />
              <input disabled={!editable} type="number" value={li.amountPaise} onChange={e => updateLine(i, "amountPaise", e.target.value)} placeholder="Paise" className="w-28 h-8 rounded border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)]" />
              {editable && <button onClick={() => removeLine(i)} className="text-red-500 hover:text-red-700"><X size={14} /></button>}
            </div>
          ))}
          {editable && (
            <button onClick={addLine} className="text-xs text-[var(--primary)] hover:underline">+ Add line item</button>
          )}
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border)]">
          <span className="text-sm font-medium text-[var(--foreground)]">Total</span>
          <span className="text-lg font-bold text-[var(--foreground)]">{formatPaise(String(total))}</span>
        </div>

        {editable && (
          <button onClick={saveLines} disabled={saving} className="mt-3 h-9 w-full rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving..." : "Save line items"}
          </button>
        )}

        {/* Actions row */}
        <div className="flex gap-2 mt-4">
          {sheet.status === "APPROVED" && onStartBooking && (
            <button onClick={onStartBooking} className="flex-1 h-9 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:opacity-90 inline-flex items-center justify-center gap-1">
              <ArrowRightCircle size={14} /> Proceed to booking
            </button>
          )}
          <button onClick={loadCompare} disabled={compareLoading} className="h-9 px-3 rounded-lg border border-[var(--border)] text-xs text-[var(--foreground)] hover:bg-[var(--accent)] inline-flex items-center gap-1">
            <GitCompare size={14} /> {compareLoading ? "Loading..." : "Compare with previous"}
          </button>
        </div>

        {/* Comparison diff */}
        {comparing && (
          <div className="mt-4 p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-[var(--foreground)]">Version comparison</h4>
              <button onClick={() => setComparing(null)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><X size={14} /></button>
            </div>
            {comparing.diff.added.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] font-medium text-green-600 uppercase mb-1">Added</div>
                {comparing.diff.added.map((li: any) => <div key={li.code} className="text-xs text-[var(--foreground)] pl-2">+ {li.label} ({li.code}) — {formatPaise(li.amountPaise)}</div>)}
              </div>
            )}
            {comparing.diff.removed.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] font-medium text-red-500 uppercase mb-1">Removed</div>
                {comparing.diff.removed.map((li: any) => <div key={li.code} className="text-xs text-[var(--muted-foreground)] pl-2 line-through">− {li.label} ({li.code}) — {formatPaise(li.amountPaise)}</div>)}
              </div>
            )}
            {comparing.diff.changed.length > 0 && (
              <div>
                <div className="text-[10px] font-medium text-amber-600 uppercase mb-1">Changed</div>
                {comparing.diff.changed.map((li: any) => (
                  <div key={li.code} className="text-xs text-[var(--foreground)] pl-2">
                    ~ {li.label} ({li.code}): {formatPaise(li.oldAmountPaise)} → {formatPaise(li.newAmountPaise)}
                  </div>
                ))}
              </div>
            )}
            {comparing.diff.added.length === 0 && comparing.diff.removed.length === 0 && comparing.diff.changed.length === 0 && (
              <div className="text-xs text-[var(--muted-foreground)]">No changes between versions</div>
            )}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">Offers / discounts</h3>
          {(sheet.offers || []).map((o: any) => (
            <div key={o.id} className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--border)] last:border-0">
              <span className="text-[var(--foreground)]">{formatPaise(o.discountPaise)} off — {o.reason || "no reason given"}</span>
              <div className="flex items-center gap-2">
                <Badge variant={o.status === "APPROVED" ? "success" : o.status === "REJECTED" ? "destructive" : "warning"}>{o.status}</Badge>
                {o.status === "PENDING" && (
                  <>
                    <button onClick={() => decideOffer(o.id, "approve")} className="text-emerald-600 hover:text-emerald-800"><Check size={14} /></button>
                    <button onClick={() => decideOffer(o.id, "reject")} className="text-red-500 hover:text-red-700"><X size={14} /></button>
                  </>
                )}
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input type="number" placeholder="Discount (paise)" value={discountPaise} onChange={e => setDiscountPaise(e.target.value)} className="flex-1 h-8 rounded border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)]" />
            <input placeholder="Reason" value={reason} onChange={e => setReason(e.target.value)} className="flex-1 h-8 rounded border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)]" />
            <button onClick={requestDiscount} className="h-8 px-3 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--accent)]">Request</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
