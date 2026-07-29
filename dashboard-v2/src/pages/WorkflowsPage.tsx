import { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Play, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchWorkflows, createWorkflow, updateWorkflow, deleteWorkflow } from '../lib/data';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    fetchWorkflows().then(setWorkflows).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, []);

  const resetForm = () => { setForm({ name: '', description: '' }); setEditingId(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    try {
      if (editingId) {
        await updateWorkflow(editingId, form);
        toast.success('Workflow updated');
      } else {
        await createWorkflow(form);
        toast.success('Workflow created');
      }
      setShowCreate(false);
      resetForm();
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleEdit = (wf: any) => {
    setForm({ name: wf.name || '', description: wf.description || '' });
    setEditingId(wf.id);
    setShowCreate(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this workflow?')) return;
    try { await deleteWorkflow(id); toast.success('Deleted'); refresh(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleToggle = async (wf: any) => {
    try {
      await updateWorkflow(wf.id, { active: !wf.active });
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Workflows</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">{workflows.length} workflows configured</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus size={16} /> Add Workflow
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 animate-scale-in space-y-3">
          <input
            placeholder="Workflow name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
            required
          />
          <input
            placeholder="Description (optional)"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
          />
          <div className="flex gap-2">
            <button type="submit" className="h-8 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90">
              {editingId ? 'Update' : 'Save'}
            </button>
            <button type="button" onClick={() => { setShowCreate(false); resetForm(); }} className="h-8 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)]">Cancel</button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Steps</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Updated</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-[var(--muted-foreground)]">Loading...</td></tr>
              ) : workflows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-[var(--muted-foreground)]">No workflows created yet.</td></tr>
              ) : (
                workflows.map((wf: any) => (
                  <tr key={wf.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)]/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--foreground)]">{wf.name}</td>
                    <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">{wf.description || '-'}</td>
                    <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">{wf._count?.steps ?? wf.steps?.length ?? 0}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggle(wf)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          wf.active !== false
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {wf.active !== false ? <Play size={10} /> : <Square size={10} />}
                        {wf.active !== false ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">{wf.updatedAt ? new Date(wf.updatedAt).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(wf)} className="p-1.5 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(wf.id)} className="p-1.5 rounded-md hover:bg-[var(--accent)] text-red-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


