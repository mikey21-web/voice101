import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Plus, Trash2, X, TestTube, Edit3, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Dialog } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';

const crmTypes = ['HUBSPOT', 'SALESFORCE', 'ZOHO'];

const systemFields = [
  { label: 'Name', value: 'contact.name' },
  { label: 'Email', value: 'contact.email' },
  { label: 'Phone', value: 'contact.phone' },
  { label: 'Company', value: 'contact.company' },
  { label: 'Location', value: 'contact.location' },
  { label: 'Status', value: 'status' },
  { label: 'Segment', value: 'segment' },
  { label: 'Source', value: 'source' },
  { label: 'Score', value: 'score' },
  { label: 'Priority', value: 'priority' },
  { label: 'Budget', value: 'budget' },
  { label: 'Interest', value: 'interest' },
  { label: 'Message', value: 'message' },
];

const crmFieldExamples: Record<string, Record<string, string>> = {
  HUBSPOT: { 'contact.name': 'firstname', 'contact.email': 'email', 'contact.phone': 'phone', 'contact.company': 'company', 'status': 'hs_lead_status', 'budget': 'closed_won_amount' },
  SALESFORCE: { 'contact.name': 'LastName', 'contact.email': 'Email', 'contact.phone': 'Phone', 'contact.company': 'Company', 'status': 'Status', 'budget': 'Budget__c' },
  ZOHO: { 'contact.name': 'Last_Name', 'contact.email': 'Email', 'contact.phone': 'Phone', 'contact.company': 'Company', 'status': 'Lead_Status', 'budget': 'Budget_Amount__c' },
};

export default function CRMPage() {
  const [data, setData] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', crmType: 'HUBSPOT' as string,
    mappings: [] as { source: string; target: string }[],
  });

  const refresh = () => api('/crm-mappings').then((r: any) => setData(r.data || r)).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const resetForm = () => {
    setForm({ name: '', crmType: 'HUBSPOT', mappings: [] });
    setEditingId(null);
  };

  const addMapping = () => setForm({ ...form, mappings: [...form.mappings, { source: '', target: '' }] });
  const removeMapping = (i: number) => setForm({ ...form, mappings: form.mappings.filter((_, idx) => idx !== i) });
  const updateMapping = (i: number, key: string, val: string) => {
    const m = [...form.mappings];
    m[i] = { ...m[i], [key]: val };

    if (key === 'source' && !m[i].target) {
      m[i].target = crmFieldExamples[form.crmType]?.[val] || '';
    }

    setForm({ ...form, mappings: m });
  };

  const handleCrmTypeChange = (t: string) => {
    const updated = form.mappings.map(m => {
      if (m.source && !m.target) {
        return { ...m, target: crmFieldExamples[t]?.[m.source] || m.target };
      }
      return m;
    });
    setForm({ ...form, crmType: t, mappings: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const valid = form.mappings.filter(m => m.source && m.target);
      const fieldMappings: Record<string, string> = {};
      valid.forEach(m => { fieldMappings[m.source] = m.target; });

      const payload = { name: form.name, crmType: form.crmType, fieldMappings };

      if (editingId) {
        await api(`/crm-mappings/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast.success('Mapping updated');
      } else {
        await api('/crm-mappings', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('CRM mapping created');
      }
      setShowCreate(false);
      resetForm();
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleEdit = (m: any) => {
    const mappings = Object.entries(m.fieldMappings || {}).map(([source, target]) => ({
      source, target: String(target),
    }));
    setForm({ name: m.name, crmType: m.crmType, mappings: mappings.length ? mappings : [] });
    setEditingId(m.id);
    setShowCreate(true);
  };

  const test = async (id: string) => {
    try {
      const r = await api(`/crm-mappings/${id}/test`, { method: 'POST' });
      toast.success(r.status + ': ' + r.message);
    } catch {}
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">CRM Mappings</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">{data.length} mappings</p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreate(true); }}>
          <Plus size={16} /> Add Mapping
        </Button>
      </div>

      <Dialog
        open={showCreate}
        onClose={() => { setShowCreate(false); resetForm(); }}
        title={editingId ? 'Edit CRM mapping' : 'Add CRM mapping'}
        description="Map your lead fields to your external CRM's field names."
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
            <Button type="submit" form="crm-mapping-form">{editingId ? 'Update' : 'Save'}</Button>
          </>
        }
      >
        <form id="crm-mapping-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Mapping name"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
            />
            <Select
              label="CRM type"
              value={form.crmType}
              onChange={e => handleCrmTypeChange(e.target.value)}
            >
              {crmTypes.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-[var(--foreground)]">Field Mappings</h3>
              <button type="button" onClick={addMapping} className="text-xs text-[var(--primary)] hover:underline">+ Add field</button>
            </div>

            {form.mappings.length === 0 && (
              <div className="text-sm text-[var(--muted-foreground)] py-3">No fields mapped yet. Click "+ Add field" to map your lead fields to CRM fields.</div>
            )}

            <div className="space-y-2">
              {form.mappings.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <Select
                      value={m.source}
                      onChange={e => updateMapping(i, 'source', e.target.value)}
                    >
                      <option value="">Select field...</option>
                      {systemFields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </Select>
                    <span className="text-[var(--muted-foreground)] text-xs">→</span>
                    <Input
                      placeholder={`${form.crmType} field name`}
                      value={m.target}
                      onChange={e => updateMapping(i, 'target', e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <button type="button" onClick={() => removeMapping(i)} className="p-1.5 rounded-md hover:bg-[var(--accent)] text-red-400"><X size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        </form>
      </Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.length === 0 ? (
          <div className="col-span-full text-center py-12 text-[var(--muted-foreground)]">No CRM mappings yet</div>
        ) : (
          data.map((m: any) => {
            const fieldCount = Object.keys(m.fieldMappings || {}).length;
            return (
              <div key={m.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-[var(--muted)] flex items-center justify-center">
                      <Building2 size={16} className="text-[var(--muted-foreground)]" />
                    </div>
                    <div>
                      <div className="font-medium text-sm text-[var(--foreground)]">{m.name}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">{m.crmType} · {fieldCount} fields</div>
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    (m.status || 'active') === 'active'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {m.status || 'active'}
                  </span>
                </div>

                {fieldCount > 0 && (
                  <div className="mb-3 bg-[var(--muted)] rounded-lg p-2 space-y-1">
                    {Object.entries(m.fieldMappings || {}).slice(0, 4).map(([source, target]) => (
                      <div key={source} className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                        <span className="font-mono">{source.split('.').pop()}</span>
                        <span>→</span>
                        <span className="font-mono">{String(target)}</span>
                      </div>
                    ))}
                    {fieldCount > 4 && (
                      <div className="text-xs text-[var(--muted-foreground)] text-center">+{fieldCount - 4} more fields</div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => test(m.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
                  >
                    <TestTube size={12} /> Test
                  </button>
                  <button
                    onClick={() => handleEdit(m)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
                  >
                    <Edit3 size={12} /> Edit
                  </button>
                  <button
                    onClick={() => { api(`/crm-mappings/${m.id}`, { method: 'DELETE' }).then(refresh); toast.success('Deleted'); }}
                    className="p-1.5 rounded-md hover:bg-[var(--accent)] text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
