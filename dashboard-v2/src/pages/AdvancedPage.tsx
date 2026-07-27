import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Plus, Trash2, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdvancedPage() {
  const [stages, setStages] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', order: 0 });

  const refresh = () => api('/pipeline-stages').then((r: any) => setStages(r.data || r)).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/pipeline-stages', { method: 'POST', body: JSON.stringify({ ...form, order: Number(form.order) }) });
      setShowCreate(false);
      setForm({ name: '', order: 0 });
      refresh();
      toast.success('Stage created');
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Pipeline Stages</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">{stages.length} stages</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus size={16} /> Add Stage
        </button>
      </div>

      {showCreate && (
        <form onSubmit={create} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 animate-scale-in">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Name</label>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Order</label>
              <input
                type="number"
                value={form.order || ''}
                onChange={e => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                className="h-9 w-20 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
              />
            </div>
            <button type="submit" className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90">Add</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {stages.length === 0 && (
          <div className="text-center py-12 text-[var(--muted-foreground)]">No pipeline stages configured</div>
        )}
        {stages.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                <Layers size={14} className="text-[var(--primary)]" />
              </div>
              <div>
                <span className="text-xs text-[var(--muted-foreground)] font-mono mr-2">#{s.order}</span>
                <span className="font-medium text-sm text-[var(--foreground)]">{s.name}</span>
              </div>
            </div>
            <button
              onClick={() => { api(`/pipeline-stages/${s.id}`, { method: 'DELETE' }).then(refresh); toast.success('Deleted'); }}
              className="p-1.5 rounded-md hover:bg-[var(--accent)] text-red-400 hover:text-red-600 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
