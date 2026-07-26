import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, X, MapPin, TrendingUp, Building2, ArrowLeft, Upload, Image as ImageIcon, FileText, History, User, Clock, RefreshCw } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { api, apiUpload } from "../lib/api";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";
import { Dialog } from "../components/ui/dialog";

function getProjectId(): string {
  const hash = window.location.hash.replace('#', '');
  return hash.split('/')[2] || '';
}

const statusColors: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700",
  BLOCKED: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700",
  BOOKED: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  SOLD: "bg-gray-200 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600",
  ON_HOLD: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
};

const statusOptions = Object.keys(statusColors);

const BULK_UNIT_FIELDS = ["unitNumber", "towerName", "floor", "unitType", "areaSqft", "price", "currency", "facing"] as const;
const NUMERIC_UNIT_FIELDS = new Set(["floor", "areaSqft", "price"]);

/** Minimal CSV parser: no embedded-comma/quote support needed for a unit import sheet. */
function parseUnitCsv(text: string): Array<Record<string, any>> {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = line.split(",").map(c => c.trim());
    const row: Record<string, any> = {};
    header.forEach((key, i) => {
      if (!BULK_UNIT_FIELDS.includes(key as any) || cells[i] === undefined || cells[i] === "") return;
      row[key] = NUMERIC_UNIT_FIELDS.has(key) ? Number(cells[i]) : cells[i];
    });
    return row;
  }).filter(r => r.unitNumber);
}

export default function ProjectDetailPage() {
  const projectId = getProjectId();
  const [project, setProject] = useState<any>(null);
  const [grid, setGrid] = useState<any>(null);
  const [velocity, setVelocity] = useState<any>(null);
  const [showTowerForm, setShowTowerForm] = useState(false);
  const [towerForm, setTowerForm] = useState({ name: "", totalFloors: "" });
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [unitForm, setUnitForm] = useState<any>({ towerId: "", unitNumber: "", floor: "", unitType: "", areaSqft: "", price: "" });
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkRows, setBulkRows] = useState<Array<Record<string, any>>>([]);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkResult, setBulkResult] = useState<{ created: number; skippedCount: number; skipped: Array<{ unitNumber: string; reason: string }> } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const brochureInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [p, g, v] = await Promise.all([
        api(`/projects/${projectId}`),
        api(`/projects/${projectId}/grid`),
        api(`/projects/${projectId}/velocity`),
      ]);
      setProject(p);
      setGrid(g);
      setVelocity(v);
    } catch { toast.error("Failed to load project"); }
  }, [projectId]);

  useEffect(() => { if (projectId) refresh(); }, [projectId, refresh]);

  const uploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingMedia(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append("images", f));
      await apiUpload(`/projects/${projectId}/images`, fd);
      toast.success("Photos added");
      refresh();
    } catch { toast.error("Failed to upload photos"); }
    finally { setUploadingMedia(false); }
  };

  const removeImage = async (url: string) => {
    try {
      await api(`/projects/${projectId}/images?url=${encodeURIComponent(url)}`, { method: "DELETE" });
      toast.success("Photo removed");
      refresh();
    } catch { toast.error("Failed to remove photo"); }
  };

  const uploadBrochure = async (file: File | null) => {
    if (!file) return;
    setUploadingMedia(true);
    try {
      const fd = new FormData();
      fd.append("brochure", file);
      await apiUpload(`/projects/${projectId}/brochure`, fd);
      toast.success("Brochure uploaded");
      refresh();
    } catch { toast.error("Failed to upload brochure"); }
    finally { setUploadingMedia(false); }
  };

  const removeBrochure = async () => {
    try {
      await api(`/projects/${projectId}/brochure`, { method: "DELETE" });
      toast.success("Brochure removed");
      refresh();
    } catch { toast.error("Failed to remove brochure"); }
  };

  const addTower = async () => {
    try {
      await api(`/projects/${projectId}/towers`, {
        method: "POST",
        body: JSON.stringify({ name: towerForm.name, totalFloors: towerForm.totalFloors ? Number(towerForm.totalFloors) : undefined }),
        headers: { "Content-Type": "application/json" },
      });
      toast.success("Tower added");
      setShowTowerForm(false);
      setTowerForm({ name: "", totalFloors: "" });
      refresh();
    } catch { toast.error("Failed to add tower"); }
  };

  const addUnit = async () => {
    try {
      await api(`/projects/${projectId}/units`, {
        method: "POST",
        body: JSON.stringify({
          towerId: unitForm.towerId || undefined,
          unitNumber: unitForm.unitNumber,
          floor: unitForm.floor ? Number(unitForm.floor) : undefined,
          unitType: unitForm.unitType || undefined,
          areaSqft: unitForm.areaSqft ? Number(unitForm.areaSqft) : undefined,
          price: unitForm.price ? Number(unitForm.price) : undefined,
        }),
        headers: { "Content-Type": "application/json" },
      });
      toast.success("Unit added");
      setShowUnitForm(false);
      setUnitForm({ towerId: "", unitNumber: "", floor: "", unitType: "", areaSqft: "", price: "" });
      refresh();
    } catch { toast.error("Failed to add unit — check the unit number isn't already used in this project"); }
  };

  const handleBulkFile = async (file: File) => {
    setBulkFileName(file.name);
    setBulkResult(null);
    const text = await file.text();
    const rows = parseUnitCsv(text);
    if (rows.length === 0) toast.error("No valid rows found — check the header row has 'unitNumber'");
    setBulkRows(rows);
  };

  const runBulkImport = async () => {
    setBulkLoading(true);
    try {
      const res = await api(`/projects/${projectId}/units/bulk-import`, {
        method: "POST",
        body: JSON.stringify({ units: bulkRows }),
        headers: { "Content-Type": "application/json" },
      });
      setBulkResult(res);
      toast.success(`Imported ${res.created} unit(s)${res.skippedCount ? `, skipped ${res.skippedCount}` : ""}`);
      refresh();
    } catch { toast.error("Bulk import failed"); }
    finally { setBulkLoading(false); }
  };

  const closeBulkForm = () => {
    setShowBulkForm(false);
    setBulkRows([]);
    setBulkFileName("");
    setBulkResult(null);
  };

  const updateUnitStatus = async (unitId: string, status: string) => {
    try {
      await api(`/units/${unitId}`, { method: "PATCH", body: JSON.stringify({ status }), headers: { "Content-Type": "application/json" } });
      toast.success(`Marked ${status.toLowerCase()}`);
      setEditingUnit(null);
      refresh();
    } catch { toast.error("Failed to update unit"); }
  };

  const formatMoney = (n: number) => {
    if (!n) return "-";
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
    return `₹${n.toLocaleString()}`;
  };

  if (!project || !grid || !velocity) {
    return <div className="p-6 text-sm text-[var(--muted-foreground)]">Loading project...</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      <a href="#/projects" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
        <ArrowLeft size={14} /> All Projects
      </a>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{project.name}</h1>
          {project.location && <div className="flex items-center gap-1 text-sm text-[var(--muted-foreground)] mt-1"><MapPin size={13} /> {project.location}</div>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTowerForm(true)}><Plus className="h-4 w-4 mr-1" /> Tower</Button>
          <Button variant="outline" onClick={() => setShowBulkForm(true)}><Upload className="h-4 w-4 mr-1" /> Bulk Import</Button>
          <Button onClick={() => setShowUnitForm(true)}><Plus className="h-4 w-4 mr-1" /> Unit</Button>
        </div>
      </div>

      {/* Media: photos + brochure */}
      <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4 space-y-3">
        <div>
          <label className="text-sm font-medium block mb-1.5"><ImageIcon className="h-3.5 w-3.5 inline mr-1" /> Photos</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(project.images || []).map((img: any, i: number) => (
              <div key={i} className="relative group">
                <img src={img.url} alt="" className="h-20 w-20 rounded object-cover border border-[var(--border)]" />
                <button type="button" onClick={() => removeImage(img.url)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => uploadImages(e.target.files)} />
          <Button variant="outline" disabled={uploadingMedia} onClick={() => imageInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> {uploadingMedia ? "Uploading..." : "Add photos"}
          </Button>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5"><FileText className="h-3.5 w-3.5 inline mr-1" /> Brochure (PDF)</label>
          {project.brochureUrl && (
            <div className="flex items-center gap-2 mb-2 text-sm">
              <a href={project.brochureUrl} target="_blank" rel="noreferrer" className="text-[var(--primary)] hover:underline">View current brochure</a>
              <button type="button" onClick={removeBrochure} className="text-red-500 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          <input ref={brochureInputRef} type="file" accept="application/pdf" className="hidden" onChange={e => uploadBrochure(e.target.files?.[0] || null)} />
          <Button variant="outline" disabled={uploadingMedia} onClick={() => brochureInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> {project.brochureUrl ? "Replace brochure" : "Add brochure"}
          </Button>
        </div>
      </div>

      {/* Velocity stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4">
          <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide mb-1">Total Units</div>
          <div className="text-2xl font-bold text-[var(--foreground)]">{velocity.totalUnits}</div>
        </div>
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4">
          <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide mb-1">% Sold</div>
          <div className="text-2xl font-bold text-[var(--foreground)]">{velocity.percentSold}%</div>
        </div>
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4">
          <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide mb-1">% Sold or Booked</div>
          <div className="text-2xl font-bold text-[var(--primary)] inline-flex items-center gap-1"><TrendingUp size={16} />{velocity.percentMoving}%</div>
        </div>
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4">
          <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide mb-1">Available</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{velocity.statusBreakdown.AVAILABLE}</div>
        </div>
      </div>

      {/* Monthly velocity trend */}
      {velocity.monthly.length > 0 && (
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-5">
          <h3 className="font-semibold text-sm text-[var(--foreground)] mb-3">Sales Velocity (last 12 months)</h3>
          <div className="flex items-end gap-2 h-24">
            {velocity.monthly.map((m: any) => {
              const max = Math.max(...velocity.monthly.map((x: any) => x.booked + x.sold), 1);
              const height = ((m.booked + m.sold) / max) * 100;
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <div className="text-[10px] text-[var(--muted-foreground)]">{m.booked + m.sold}</div>
                  <div className="w-full bg-[var(--primary)] rounded-t" style={{ height: `${Math.max(height, 4)}%` }} />
                  <div className="text-[10px] text-[var(--muted-foreground)]">{m.month.slice(5)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Availability grid */}
      <div>
        <div className="flex items-center gap-4 mb-3 text-xs">
          {statusOptions.map(s => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded border ${statusColors[s]}`} /> {s.replace(/_/g, " ")}
            </span>
          ))}
        </div>
        {grid.towers.map((tower: any) => (
          <div key={tower.towerId || "no-tower"} className="mb-6">
            <h3 className="font-semibold text-sm text-[var(--foreground)] mb-2 flex items-center gap-1.5">
              <Building2 size={14} /> {tower.towerName || "Units"}
            </h3>
            <div className="space-y-1.5">
              {tower.floors.map((f: any) => (
                <div key={f.floor} className="flex items-center gap-2">
                  <span className="text-xs text-[var(--muted-foreground)] w-14 shrink-0">{f.floor >= 0 ? `Floor ${f.floor}` : "—"}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {f.units.map((u: any) => (
                      <button
                        key={u.id}
                        onClick={() => setEditingUnit(u)}
                        title={`${u.unitNumber} · ${u.unitType || ""} · ${formatMoney(u.price)}${u.buyerName ? ` · ${u.buyerName}` : ''}`}
                        className={`h-9 min-w-[3.5rem] px-2 rounded border text-xs font-medium transition-transform hover:scale-105 ${statusColors[u.status] || ""}`}
                      >
                        {u.unitNumber}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Tower form */}
      {showTowerForm && (
        <Dialog
          open
          onClose={() => setShowTowerForm(false)}
          title="Add Tower"
          maxWidth="max-w-sm"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowTowerForm(false)}>Cancel</Button>
              <Button onClick={addTower} disabled={!towerForm.name}>Add</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input value={towerForm.name} onChange={e => setTowerForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Tower A" />
            <Input type="number" value={towerForm.totalFloors} onChange={e => setTowerForm(f => ({ ...f, totalFloors: e.target.value }))} placeholder="Total floors (optional)" />
          </div>
        </Dialog>
      )}

      {/* Unit form */}
      {showUnitForm && (
        <Dialog
          open
          onClose={() => setShowUnitForm(false)}
          title="Add Unit"
          maxWidth="max-w-md"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowUnitForm(false)}>Cancel</Button>
              <Button onClick={addUnit} disabled={!unitForm.unitNumber}>Add</Button>
            </>
          }
        >
          <div className="space-y-3">
            {grid.towers.length > 0 && grid.towers[0].towerId && (
              <select value={unitForm.towerId} onChange={e => setUnitForm((f: any) => ({ ...f, towerId: e.target.value }))} className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm">
                <option value="">No tower</option>
                {grid.towers.map((t: any) => t.towerId && <option key={t.towerId} value={t.towerId}>{t.towerName}</option>)}
              </select>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input value={unitForm.unitNumber} onChange={e => setUnitForm((f: any) => ({ ...f, unitNumber: e.target.value }))} placeholder="Unit no. e.g. 502" />
              <Input type="number" value={unitForm.floor} onChange={e => setUnitForm((f: any) => ({ ...f, floor: e.target.value }))} placeholder="Floor" />
              <Input value={unitForm.unitType} onChange={e => setUnitForm((f: any) => ({ ...f, unitType: e.target.value }))} placeholder="e.g. 3BHK" />
              <Input type="number" value={unitForm.areaSqft} onChange={e => setUnitForm((f: any) => ({ ...f, areaSqft: e.target.value }))} placeholder="Area (sqft)" />
              <Input type="number" value={unitForm.price} onChange={e => setUnitForm((f: any) => ({ ...f, price: e.target.value }))} placeholder="Price (₹)" className="col-span-2" />
            </div>
          </div>
        </Dialog>
      )}

      {/* Bulk unit import */}
      {showBulkForm && (
        <Dialog
          open
          onClose={closeBulkForm}
          title="Bulk Import Units (CSV)"
          maxWidth="max-w-lg"
          footer={
            <>
              <Button variant="outline" onClick={closeBulkForm}>Close</Button>
              <Button onClick={runBulkImport} disabled={bulkRows.length === 0 || bulkLoading}>
                {bulkLoading ? "Importing..." : `Import ${bulkRows.length || ""} Unit(s)`}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-[var(--muted-foreground)]">
              CSV header row: <code className="text-[11px]">unitNumber,towerName,floor,unitType,areaSqft,price,currency,facing</code>.
              Only <code className="text-[11px]">unitNumber</code> is required; towers referenced by name are created automatically. Duplicate unit numbers are skipped.
            </p>
            <input
              type="file" accept=".csv,text/csv"
              onChange={e => e.target.files?.[0] && handleBulkFile(e.target.files[0])}
              className="w-full text-sm text-[var(--foreground)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:text-[var(--primary-foreground)] file:px-3 file:py-1.5 file:text-xs file:font-medium"
            />
            {bulkFileName && !bulkResult && (
              <div className="text-sm text-[var(--foreground)]">{bulkFileName}: {bulkRows.length} row(s) ready to import</div>
            )}
            {bulkResult && (
              <div className="rounded-lg border border-[var(--border)] p-3 text-sm space-y-1">
                <div className="text-green-600 dark:text-green-400 font-medium">{bulkResult.created} unit(s) created</div>
                {bulkResult.skippedCount > 0 && (
                  <div className="text-amber-600 dark:text-amber-400">
                    {bulkResult.skippedCount} skipped
                    <div className="mt-1 max-h-24 overflow-y-auto text-xs text-[var(--muted-foreground)]">
                      {bulkResult.skipped.map((s, i) => <div key={i}>{s.unitNumber}: {s.reason}</div>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Dialog>
      )}

      {/* Unit detail drawer */}
      {editingUnit && <UnitDetailDrawer unitId={editingUnit.id} onClose={() => setEditingUnit(null)} onStatusChanged={() => { setEditingUnit(null); refresh(); }} />}
    </div>
  );
}

function UnitDetailDrawer({ unitId, onClose, onStatusChanged }: { unitId: string; onClose: () => void; onStatusChanged: () => void }) {
  const [unit, setUnit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await api(`/units/${unitId}`);
        setUnit(data);
      } catch (e: any) {
        setError(e.message || "Failed to load unit details");
      }
      setLoading(false);
    })();
  }, [unitId]);

  const updateUnitStatus = async (status: string) => {
    try {
      await api(`/units/${unitId}`, { method: "PATCH", body: JSON.stringify({ status }), headers: { "Content-Type": "application/json" } });
      toast.success(`Marked ${status.toLowerCase()}`);
      const data = await api(`/units/${unitId}`);
      setUnit(data);
      onStatusChanged();
    } catch (e: any) {
      toast.error(e.message || "Failed to update unit");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-[var(--card)] border-l border-[var(--border)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--foreground)]">Unit Details</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--accent)]"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" /></div>
        ) : error ? (
          <div className="p-4 text-sm text-red-500">{error}</div>
        ) : unit ? (
          <div className="p-4 space-y-4">
            {/* Header info */}
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg border-2 flex items-center justify-center text-xs font-bold ${statusColors[unit.status] || ""}`}>
                {unit.unitNumber?.slice(-2)}
              </div>
              <div>
                <div className="text-lg font-bold text-[var(--foreground)]">Unit {unit.unitNumber}</div>
                <Badge variant={unit.status === "AVAILABLE" ? "success" : unit.status === "BOOKED" ? "default" : unit.status === "ON_HOLD" ? "destructive" : unit.status === "SOLD" ? "secondary" : "warning"} className="mt-0.5">
                  {unit.status?.replace(/_/g, " ")}
                </Badge>
              </div>
            </div>

            {/* Quick attributes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {unit.tower?.name && <div className="rounded-lg bg-[var(--background)] p-3"><div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wide">Tower</div><div className="text-sm font-medium text-[var(--foreground)] mt-0.5">{unit.tower.name}</div></div>}
              {unit.floor != null && <div className="rounded-lg bg-[var(--background)] p-3"><div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wide">Floor</div><div className="text-sm font-medium text-[var(--foreground)] mt-0.5">{unit.floor}</div></div>}
              {unit.unitType && <div className="rounded-lg bg-[var(--background)] p-3"><div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wide">Type</div><div className="text-sm font-medium text-[var(--foreground)] mt-0.5">{unit.unitType}</div></div>}
              {unit.areaSqft && <div className="rounded-lg bg-[var(--background)] p-3"><div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wide">Area</div><div className="text-sm font-medium text-[var(--foreground)] mt-0.5">{unit.areaSqft} sqft</div></div>}
              {unit.price && <div className="rounded-lg bg-[var(--background)] p-3 col-span-2"><div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wide">Price</div><div className="text-sm font-medium text-[var(--foreground)] mt-0.5">{(unit.price >= 10000000 ? `₹${(unit.price / 10000000).toFixed(2)} Cr` : unit.price >= 100000 ? `₹${(unit.price / 100000).toFixed(2)} L` : `₹${unit.price.toLocaleString()}`)}</div></div>}
              {unit.facing && <div className="rounded-lg bg-[var(--background)] p-3"><div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wide">Facing</div><div className="text-sm font-medium text-[var(--foreground)] mt-0.5">{unit.facing}</div></div>}
            </div>

            {/* Lead info */}
            {unit.lead && (
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)] mb-1"><User size={14} /> Linked Lead</div>
                <div className="text-sm text-[var(--muted-foreground)]">{unit.lead.contact?.name || "—"}</div>
                {unit.lead.contact?.phone && <div className="text-xs text-[var(--muted-foreground)]">{unit.lead.contact.phone}</div>}
              </div>
            )}

            {/* Status history */}
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)] mb-2"><History size={14} /> Status History</div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {(unit.statusHistory || []).slice(-10).reverse().map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-[var(--background)]">
                    <span><span className="text-[var(--muted-foreground)]">{h.fromStatus}</span> → <span className="text-[var(--foreground)]">{h.toStatus}</span></span>
                    <span className="text-[var(--muted-foreground)]">{new Date(h.changedAt || h.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
                {(!unit.statusHistory || unit.statusHistory.length === 0) && <div className="text-xs text-[var(--muted-foreground)]">No history</div>}
              </div>
            </div>

            {/* Active hold info */}
            {unit.status === "ON_HOLD" && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400 mb-1"><Clock size={14} /> Active Hold</div>
              </div>
            )}

            {/* Status actions */}
            <div>
              <div className="text-sm font-semibold text-[var(--foreground)] mb-2">Change Status</div>
              <div className="grid grid-cols-2 gap-2">
                {statusOptions.map(s => (
                  <button key={s} onClick={() => updateUnitStatus(s)}
                    className={`h-9 rounded-lg border text-xs font-medium transition-all hover:scale-105 ${statusColors[s]} ${unit.status === s ? 'ring-2 ring-[var(--primary)]' : ''}`}>
                    {s.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
