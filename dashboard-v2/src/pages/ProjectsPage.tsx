import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, X, Building, MapPin, Image as ImageIcon, FileText, Upload } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { api, apiUpload } from "../lib/api";
import toast from "react-hot-toast";
import { Dialog } from "../components/ui/dialog";

const statusColors: Record<string, string> = {
  PLANNING: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  UNDER_CONSTRUCTION: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  READY_TO_MOVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  COMPLETED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

const statusOptions = Object.keys(statusColors);

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ name: "", location: "", address: "", reraId: "", status: "UNDER_CONSTRUCTION", possessionDate: "" });
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingBrochure, setPendingBrochure] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const brochureInputRef = useRef<HTMLInputElement>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api("/projects?limit=50");
      setProjects(res.data || []);
    } catch { toast.error("Failed to load projects"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const resetForm = () => {
    setForm({ name: "", location: "", address: "", reraId: "", status: "UNDER_CONSTRUCTION", possessionDate: "" });
    setPendingImages([]);
    setPendingBrochure(null);
  };

  const closeForm = () => { setShowForm(false); resetForm(); };

  const handleCreate = async () => {
    try {
      const created = await api("/projects", {
        method: "POST",
        body: JSON.stringify({ ...form, possessionDate: form.possessionDate || undefined }),
        headers: { "Content-Type": "application/json" },
      });

      if (pendingImages.length > 0 || pendingBrochure) {
        setUploadingMedia(true);
        try {
          if (pendingImages.length > 0) {
            const fd = new FormData();
            pendingImages.forEach(f => fd.append("images", f));
            await apiUpload(`/projects/${created.id}/images`, fd);
          }
          if (pendingBrochure) {
            const fd = new FormData();
            fd.append("brochure", pendingBrochure);
            await apiUpload(`/projects/${created.id}/brochure`, fd);
          }
        } catch {
          toast.error("Project created, but media upload failed");
        } finally {
          setUploadingMedia(false);
        }
      }

      toast.success("Project created");
      setShowForm(false);
      resetForm();
      fetchProjects();
    } catch { toast.error("Failed to create project"); }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Projects</h1>
          <p className="text-sm text-[var(--muted-foreground)]">{projects.length} developments · unit inventory, availability & sales velocity</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="#/import?entity=project"
            className="inline-flex items-center h-9 px-4 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          >
            Import
          </a>
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Project
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-40 rounded-xl bg-[var(--card)] border border-[var(--border)] animate-pulse" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 text-[var(--muted-foreground)]">No projects yet — add your first development.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p: any) => {
            const total = p._count?.units || 0;
            const sold = p.unitSummary?.SOLD || 0;
            const booked = p.unitSummary?.BOOKED || 0;
            const percentSold = total > 0 ? Math.round(((sold + booked) / total) * 100) : 0;
            return (
              <a key={p.id} href={`#/projects/${p.id}`} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 hover:border-[var(--ring)] transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-[var(--foreground)]">{p.name}</h3>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusColors[p.status] || ""}`}>{p.status?.replace(/_/g, " ")}</span>
                </div>
                {p.location && (
                  <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] mb-3">
                    <MapPin size={11} /> {p.location}
                  </div>
                )}
                <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] mb-2">
                  <Building size={11} /> {p._count?.towers || 0} tower(s) · {total} units
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                  <div className="h-full bg-[var(--primary)]" style={{ width: `${percentSold}%` }} />
                </div>
                <div className="text-xs text-[var(--muted-foreground)] mt-1">{percentSold}% sold or booked</div>
              </a>
            );
          })}
        </div>
      )}

      {showForm && (
        <Dialog
          open
          onClose={closeForm}
          title="Add Project"
          maxWidth="max-w-lg"
          footer={
            <>
              <Button variant="outline" onClick={closeForm}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!form.name || uploadingMedia}>
                {uploadingMedia ? "Uploading..." : "Create"}
              </Button>
            </>
          }
        >
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1">Project Name *</label>
                <Input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="e.g. Prestige Lakeside Habitat" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1">Location</label>
                <Input value={form.location} onChange={e => setForm((f: any) => ({ ...f, location: e.target.value }))} placeholder="e.g. Whitefield, Bangalore" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1">Address</label>
                <Input value={form.address} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Status</label>
                <select value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))} className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm">
                  {statusOptions.map(k => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Possession Date</label>
                <Input type="date" value={form.possessionDate} onChange={e => setForm((f: any) => ({ ...f, possessionDate: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1">RERA ID</label>
                <Input value={form.reraId} onChange={e => setForm((f: any) => ({ ...f, reraId: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-[var(--border)]">
              <div>
                <label className="text-sm font-medium block mb-1.5"><ImageIcon className="h-3.5 w-3.5 inline mr-1" /> Photos</label>
                {pendingImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {pendingImages.map((f, i) => (
                      <div key={i} className="relative group">
                        <img src={URL.createObjectURL(f)} alt="" className="h-16 w-16 rounded object-cover border border-[var(--border)]" />
                        <button type="button" onClick={() => setPendingImages(prev => prev.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => setPendingImages(prev => [...prev, ...Array.from(e.target.files || [])])} />
                <Button type="button" variant="outline" onClick={() => imageInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5 mr-1.5" /> Add photos
                </Button>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5"><FileText className="h-3.5 w-3.5 inline mr-1" /> Brochure (PDF)</label>
                {pendingBrochure && (
                  <div className="flex items-center gap-2 mb-2 text-sm">
                    <span className="text-[var(--muted-foreground)]">{pendingBrochure.name}</span>
                    <button type="button" onClick={() => setPendingBrochure(null)} className="text-red-500 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                  </div>
                )}
                <input ref={brochureInputRef} type="file" accept="application/pdf" className="hidden"
                  onChange={e => setPendingBrochure(e.target.files?.[0] || null)} />
                <Button type="button" variant="outline" onClick={() => brochureInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5 mr-1.5" /> Add brochure
                </Button>
              </div>
            </div>
        </Dialog>
      )}
    </div>
  );
}
