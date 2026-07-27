import React, { useState, useEffect } from 'react';
import { fetchScoringRules, createScoringRule, deleteScoringRule } from '../lib/data';
import { Plus, Trash2, Play, X, TestTube, Gauge, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

export default function ScoringPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', field: '', operator: 'contains', value: '', points: 0 });
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => {
    setLoading(true);
    setError(null);
    return fetchScoringRules()
      .then((r: any) => setRules(r.data || r))
      .catch(() => setError('Failed to load scoring rules'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', field: '', operator: 'contains', value: '', points: 0 });
    setTestResult(null);
    setShowCreate(true);
  };

  const openEdit = (rule: any) => {
    setEditingId(rule.id);
    setForm({ name: rule.name, field: rule.field, operator: rule.operator, value: rule.value || '', points: rule.points || 0 });
    setTestResult(null);
    setShowCreate(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (editingId) {
        await api(`/scoring-rules/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...form, points: Number(form.points) }),
        });
        toast.success('Rule updated');
      } else {
        await createScoringRule({ ...form, points: Number(form.points) });
        toast.success('Rule created');
      }
      setShowCreate(false);
      setEditingId(null);
      setForm({ name: '', field: '', operator: 'contains', value: '', points: 0 });
      refresh();
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    try { await deleteScoringRule(id); refresh(); toast.success('Deleted'); } catch (e: any) { toast.error(e.message); }
  };

  const test = async () => {
    try {
      const r = await api('/scoring-rules/test', {
        method: 'POST',
        body: JSON.stringify({ ...form, points: Number(form.points), testValues: [{ [form.field]: form.value }] }),
      });
      setTestResult(r);
    } catch {}
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Scoring Rules</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">{rules.length} rules configured</p>
        </div>
        <button
          onClick={openCreate}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus size={16} /> Add Rule
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 animate-scale-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">{editingId ? 'Edit Rule' : 'New Rule'}</h3>
            {editingId && (
              <span className="text-xs text-[var(--muted-foreground)]">Editing: {form.name}</span>
            )}
          </div>
          {error && (
            <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <input
              placeholder="Rule name"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
              required
            />
            <input
              placeholder="Field name"
              value={form.field}
              onChange={e => setForm({ ...form, field: e.target.value })}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
              required
            />
            <select
              value={form.operator}
              onChange={e => setForm({ ...form, operator: e.target.value })}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
            >
              {['equals', 'contains', 'starts_with', 'exists', 'gt', 'gte', 'lt', 'lte'].map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <input
              placeholder="Value"
              value={form.value}
              onChange={e => setForm({ ...form, value: e.target.value })}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
            />
            <input
              type="number"
              placeholder="Points"
              value={form.points || ''}
              onChange={e => setForm({ ...form, points: parseInt(e.target.value) || 0 })}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" disabled={submitting} className="h-8 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
            <button type="button" onClick={test} className="h-8 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1">
              <TestTube size={12} /> Test
            </button>
            <button type="button" onClick={() => { setShowCreate(false); setEditingId(null); setTestResult(null); setError(null); }} className="h-8 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">
              <X size={14} />
            </button>
          </div>
          {testResult && (
            <pre className="mt-3 text-xs bg-[var(--muted)] text-[var(--foreground)] p-3 rounded-lg border border-[var(--border)]">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          )}
        </form>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Gauge size={18} className="animate-pulse" /> Loading scoring rules...
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center justify-center py-12 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="text-sm text-red-500">{error}</div>
        </div>
      )}

      {!loading && !error && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Field</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Operator</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Points</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-[var(--muted-foreground)]">No scoring rules</td></tr>
                ) : (
                  rules.map((r: any) => (
                    <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)]/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-[var(--foreground)]">{r.name}</td>
                      <td className="px-4 py-3 text-sm text-[var(--muted-foreground)] font-mono">{r.field}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full bg-[var(--muted)] text-xs text-[var(--muted-foreground)]">{r.operator}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--foreground)]">{r.value}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-sm text-[var(--foreground)]">{r.points}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.active
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {r.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { openEdit(r); }} className="p-1.5 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors" title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => remove(r.id)} className="p-1.5 rounded-md hover:bg-[var(--accent)] text-red-400 hover:text-red-600 transition-colors" title="Delete">
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
      )}
    </div>
  );
}
