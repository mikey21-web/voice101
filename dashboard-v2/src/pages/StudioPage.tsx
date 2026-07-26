import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import toast from "react-hot-toast";
import { Dialog } from "../components/ui/dialog";
import { Plus, Pencil, Trash2, GripVertical, X, Check, ChevronUp, ChevronDown, ToggleLeft, ToggleRight } from "lucide-react";

const TARGETS = ["CONTACT", "LEAD", "TICKET"] as const;
const FIELD_TYPES = ["TEXT", "NUMBER", "DATE", "BOOLEAN", "DROPDOWN"] as const;

interface FieldDef {
  id: string;
  name: string;
  key: string;
  type: string;
  target: string;
  options: string[];
  required: boolean;
  active: boolean;
  displayOrder: number;
}

export default function StudioPage() {
  const [target, setTarget] = useState("CONTACT");
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FieldDef | null>(null);

  const load = useCallback(async (t = target) => {
    setLoading(true);
    try {
      const res = await api(`/custom-fields/definitions?target=${t}`);
      setFields(res.data || []);
    } catch { setFields([]); }
    setLoading(false);
  }, [target]);

  useEffect(() => { load(target); }, [target]);

  const handleDelete = async (id: string) => {
    try {
      await api(`/custom-fields/definitions/${id}`, { method: "DELETE" });
      toast.success("Field archived");
      load();
    } catch { toast.error("Failed to archive"); }
  };

  const handleReorder = async (id: string, dir: "up" | "down") => {
    const idx = fields.findIndex(f => f.id === id);
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === fields.length - 1) return;
    const swapped = [...fields];
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    [swapped[idx], swapped[swapIdx]] = [swapped[swapIdx], swapped[idx]];
    try {
      await api("/custom-fields/reorder", {
        method: "PATCH",
        body: JSON.stringify({ ids: swapped.map(f => f.id) }),
      });
      setFields(swapped);
      toast.success("Reordered");
    } catch { toast.error("Reorder failed"); }
  };

  const handleToggleActive = async (field: FieldDef) => {
    try {
      await api(`/custom-fields/definitions/${field.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !field.active }),
      });
      load();
      toast.success(field.active ? "Field hidden" : "Field active");
    } catch { toast.error("Failed to toggle"); }
  };

  const activeFields = fields.filter(f => f.active);
  const archivedFields = fields.filter(f => !f.active);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Custom Fields Studio</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Define custom fields for leads, contacts, and tickets</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 transition-colors shadow-sm">
          <Plus size={16} /> New Field
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TARGETS.map(t => (
          <button key={t} onClick={() => setTarget(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              target === t ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm" : "bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)]/70 hover:bg-[var(--accent)]"
            }`}>
            {t.charAt(0) + t.slice(1).toLowerCase() + "s"}
          </button>
        ))}
      </div>

      {showForm && (
        <FieldForm target={target} initial={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-[var(--muted-foreground)]">
            <div className="animate-spin h-5 w-5 border-2 border-[var(--primary)] border-t-transparent rounded-full mx-auto mb-2" />
            Loading fields...
          </div>
        ) : activeFields.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--muted-foreground)]">
            No custom fields defined for {target.toLowerCase()}s yet.
          </div>
        ) : (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                    <th className="py-3 px-4 w-10" />
                    <th className="py-3 px-4 font-semibold text-[var(--muted-foreground)] text-xs uppercase tracking-wider">Name</th>
                    <th className="py-3 px-4 font-semibold text-[var(--muted-foreground)] text-xs uppercase tracking-wider">Key</th>
                    <th className="py-3 px-4 font-semibold text-[var(--muted-foreground)] text-xs uppercase tracking-wider">Type</th>
                    <th className="py-3 px-4 font-semibold text-[var(--muted-foreground)] text-xs uppercase tracking-wider">Required</th>
                    <th className="py-3 px-4 font-semibold text-[var(--muted-foreground)] text-xs uppercase tracking-wider">Active</th>
                    <th className="py-3 px-4 w-24 font-semibold text-[var(--muted-foreground)] text-xs uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeFields.map((field, i) => (
                    <tr key={field.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)]/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => handleReorder(field.id, "up")} disabled={i === 0}
                            className="p-0.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-20 transition-colors cursor-pointer disabled:cursor-not-allowed">
                            <ChevronUp size={14} />
                          </button>
                          <button onClick={() => handleReorder(field.id, "down")} disabled={i === activeFields.length - 1}
                            className="p-0.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-20 transition-colors cursor-pointer disabled:cursor-not-allowed">
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-[var(--foreground)]">{field.name}</td>
                      <td className="py-3 px-4 text-[var(--muted-foreground)] font-mono text-xs">{field.key}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-[var(--muted)] text-xs font-medium text-[var(--foreground)]">
                          {field.type}
                        </span>
                      </td>
                      <td className="py-3 px-4">{field.required ? <Check size={16} className="text-green-500" /> : <X size={16} className="text-[var(--muted-foreground)]" />}</td>
                      <td className="py-3 px-4">
                        <button onClick={() => handleToggleActive(field)}
                          className="cursor-pointer transition-colors">
                          {field.active ? <ToggleRight size={18} className="text-[var(--primary)]" /> : <ToggleLeft size={18} className="text-[var(--muted-foreground)]" />}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditing(field); setShowForm(true); }}
                            className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(field.id)}
                            className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="block sm:hidden space-y-3 p-4">
              {activeFields.map((field, i) => (
                <div key={field.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="font-medium text-[var(--foreground)]">{field.name}</div>
                      <div className="text-xs text-[var(--muted-foreground)] font-mono">{field.key}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleReorder(field.id, "up")} disabled={i === 0}
                        className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-20 transition-colors cursor-pointer disabled:cursor-not-allowed">
                        <ChevronUp size={14} />
                      </button>
                      <button onClick={() => handleReorder(field.id, "down")} disabled={i === activeFields.length - 1}
                        className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-20 transition-colors cursor-pointer disabled:cursor-not-allowed">
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-[var(--muted)] text-xs font-medium text-[var(--foreground)]">
                      {field.type}
                    </span>
                    {field.required ? (
                      <span className="flex items-center gap-1 text-xs text-green-600"><Check size={12} /> Required</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]"><X size={12} /> Optional</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <button onClick={() => handleToggleActive(field)}
                      className="flex items-center gap-2 cursor-pointer transition-colors text-sm">
                      {field.active ? <ToggleRight size={18} className="text-[var(--primary)]" /> : <ToggleLeft size={18} className="text-[var(--muted-foreground)]" />}
                      <span className="text-[var(--muted-foreground)]">{field.active ? "Active" : "Inactive"}</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditing(field); setShowForm(true); }}
                        className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(field.id)}
                        className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {archivedFields.length > 0 && (
        <details className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <summary className="px-4 py-3 text-sm font-medium text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)] transition-colors">
            Archived Fields ({archivedFields.length})
          </summary>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <tbody>
                {archivedFields.map(field => (
                  <tr key={field.id} className="border-t border-[var(--border)] opacity-60 hover:opacity-100 transition-opacity">
                    <td className="py-2 px-4 font-medium text-[var(--foreground)]">{field.name}</td>
                    <td className="py-2 px-4 text-[var(--muted-foreground)] font-mono text-xs">{field.key}</td>
                    <td className="py-2 px-4">
                      <button onClick={() => handleToggleActive(field)}
                        className="p-1 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer text-xs underline">
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="block sm:hidden space-y-2 p-4">
            {archivedFields.map(field => (
              <div key={field.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 opacity-60 hover:opacity-100 transition-opacity">
                <div className="space-y-0.5">
                  <div className="font-medium text-[var(--foreground)] text-sm">{field.name}</div>
                  <div className="text-xs text-[var(--muted-foreground)] font-mono">{field.key}</div>
                </div>
                <button onClick={() => handleToggleActive(field)}
                  className="text-xs font-medium text-[var(--primary)] hover:underline cursor-pointer">
                  Restore
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function FieldForm({ target, initial, onClose, onSaved }: { target: string; initial: FieldDef | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [key, setKey] = useState(initial?.key || "");
  const [type, setType] = useState(initial?.type || "TEXT");
  const [required, setRequired] = useState(initial?.required || false);
  const [options, setOptions] = useState(initial?.options?.join("\n") || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Name is required");
    if (!key.trim() && !initial) return toast.error("Key is required");
    setSaving(true);
    try {
      const body: any = { name: name.trim(), required };
      if (type === "DROPDOWN") body.options = options.split("\n").map(s => s.trim()).filter(Boolean);
      if (initial) {
        await api(`/custom-fields/definitions/${initial.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        body.key = key.trim().toLowerCase().replace(/\s+/g, "_");
        body.type = type;
        body.target = target;
        await api("/custom-fields/definitions", { method: "POST", body: JSON.stringify(body) });
      }
      toast.success(initial ? "Field updated" : "Field created");
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
    setSaving(false);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={initial ? "Edit Field" : "New Custom Field"}
      maxWidth="max-w-md"
      footer={
        <>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--foreground)] border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] transition-colors cursor-pointer">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors cursor-pointer">
            {saving ? "Saving..." : initial ? "Update" : "Create"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Field Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Industry" autoFocus
            className="w-full mt-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Field Key</label>
          <input value={key} onChange={e => setKey(e.target.value)} placeholder="e.g. industry" disabled={!!initial}
            className="w-full mt-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 disabled:opacity-50" />
        </div>
        {!initial && (
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Type</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full mt-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50">
              {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
        {type === "DROPDOWN" && (
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Options (one per line)</label>
            <textarea value={options} onChange={e => setOptions(e.target.value)} rows={4}
              className="w-full mt-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/30" />
          <span className="text-sm text-[var(--foreground)]">Required field</span>
        </label>
      </div>
    </Dialog>
  );
}
