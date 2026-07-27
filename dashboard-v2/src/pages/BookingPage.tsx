import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Plus, Trash2, X, Calendar, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BookingPage() {
  const [data, setData] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', provider: 'CALENDLY', config: '{"calendarLink":"https://calendly.com/you/30min"}' });
  const [configError, setConfigError] = useState('');

  const refresh = () => api('/booking-settings').then((r: any) => setData(r.data || r)).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const resetForm = () => {
    setForm({ name: '', provider: 'CALENDLY', config: '{}' });
    setShowCreate(false);
    setEditingId(null);
    setConfigError('');
  };

  const startEdit = (b: any) => {
    setForm({
      name: b.name || '',
      provider: b.provider || 'CALENDLY',
      config: b.config ? JSON.stringify(b.config, null, 2) : '{}',
    });
    setEditingId(b.id);
    setShowCreate(true);
    setConfigError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let parsedConfig: any;
    try {
      parsedConfig = JSON.parse(form.config);
      setConfigError('');
    } catch {
      setConfigError('Invalid JSON — please fix the config field');
      return;
    }
    try {
      const body = { ...form, config: parsedConfig };
      if (editingId) {
        await api(`/booking-settings/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) });
        toast.success('Booking setting updated');
      } else {
        await api('/booking-settings', { method: 'POST', body: JSON.stringify(body) });
        toast.success('Booking setting created');
      }
      resetForm();
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this booking setting?')) return;
    try {
      await api(`/booking-settings/${id}`, { method: 'DELETE' });
      refresh();
      toast.success('Deleted');
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Booking Settings</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">{data.length} configurations</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus size={16} /> Add Booking
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 animate-scale-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Name"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
              required
            />
            <select
              value={form.provider}
              onChange={e => setForm({ ...form, provider: e.target.value })}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
            >
              {['CALENDLY', 'GOOGLE_CALENDAR'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="col-span-2 space-y-1">
              <textarea
                placeholder='Config JSON'
                value={form.config}
                onChange={e => { setForm({ ...form, config: e.target.value }); setConfigError(''); }}
                className={`w-full h-20 rounded-lg border px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 font-mono bg-[var(--background)] ${
                  configError ? 'border-red-400' : 'border-[var(--border)]'
                }`}
              />
              {configError && <p className="text-xs text-red-500">{configError}</p>}
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" className="h-8 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90">
              {editingId ? 'Update' : 'Save'}
            </button>
            <button type="button" onClick={resetForm} className="h-8 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">
              <X size={14} />
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.length === 0 && (
          <div className="col-span-full text-center py-12 text-[var(--muted-foreground)]">No booking settings</div>
        )}
        {data.map((b: any) => (
          <div key={b.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                  <Calendar size={16} className="text-[var(--primary)]" />
                </div>
                <div>
                  <div className="font-medium text-sm text-[var(--foreground)]">{b.name}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">{b.provider}</div>
                </div>
              </div>
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mb-3">
              {b.config && Object.keys(b.config).join(', ') || 'No config'}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => startEdit(b)}
                className="p-1.5 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                title="Edit"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => handleDelete(b.id)}
                className="p-1.5 rounded-md hover:bg-[var(--accent)] text-red-400 hover:text-red-600 transition-colors"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
