import React, { useState, useEffect } from 'react';
import { fetchTemplates, createTemplate, previewTemplate } from '../lib/data';
import { Plus, Eye, FileText, MessageSquare, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { Dialog } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';

const channelIcons: Record<string, any> = { WHATSAPP: MessageSquare, EMAIL: Mail, SMS: FileText };

export default function TemplatesPage() {
  const [data, setData] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'WELCOME', channel: 'WHATSAPP', body: '', variables: '["contact.name","business.name"]' });
  const [selected, setSelected] = useState<any>(null);
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState('');

  const refresh = () => fetchTemplates().then(setData).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTemplate({ ...form, variables: JSON.parse(form.variables) });
      setShowCreate(false);
      refresh();
      toast.success('Template created');
    } catch (e: any) { toast.error(e.message); }
  };

  const showPreview = async (id: string) => {
    try {
      const r = await previewTemplate(id, previewVars);
      setPreview(r.data?.rendered || r.rendered);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Message Templates</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">{data.length} templates</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="w-full sm:w-auto">
          <Plus size={16} /> Create Template
        </Button>
      </div>

      <Dialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create template"
        description="Reusable message template for WhatsApp, email, or SMS."
        maxWidth="max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" form="create-template-form">Save</Button>
          </>
        }
      >
        <form id="create-template-form" onSubmit={create} className="space-y-4">
          <Input
            label="Template name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label="Type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {['WELCOME', 'FOLLOW_UP', 'QUALIFICATION_QUESTION', 'RECONNECT', 'APPOINTMENT_LINK', 'THANK_YOU'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
            <Select label="Channel" value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })}>
              {['WHATSAPP', 'EMAIL', 'SMS'].map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <Input
            label="Variables (JSON array)"
            value={form.variables}
            onChange={e => setForm({ ...form, variables: e.target.value })}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]">Message body</label>
            <textarea
              placeholder="Message body with {{variables}}"
              value={form.body}
              onChange={e => setForm({ ...form, body: e.target.value })}
              rows={4}
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--card)] px-3.5 py-2 text-sm text-[var(--foreground)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 focus:border-[var(--ring)]"
              required
            />
          </div>
        </form>
      </Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.length === 0 && (
          <div className="col-span-full text-center py-12 text-[var(--muted-foreground)]">No templates yet</div>
        )}
        {data.map(t => {
          const Icon = channelIcons[t.channel] || FileText;
          const isSelected = selected?.id === t.id;
          return (
            <div key={t.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-[var(--muted)] flex items-center justify-center">
                      <Icon size={14} className="text-[var(--muted-foreground)]" />
                    </div>
                    <div>
                      <div className="font-medium text-sm text-[var(--foreground)]">{t.name}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">{t.type} · v{t.version}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)]">{t.channel}</span>
                </div>

                <pre className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] p-2 rounded-lg line-clamp-3">{t.body}</pre>

                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-[var(--border)] animate-fade-in">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {JSON.parse(t.variables || '[]').map((v: string) => (
                        <input
                          key={v}
                          placeholder={v}
                          value={previewVars[v] || ''}
                          onChange={e => setPreviewVars({ ...previewVars, [v]: e.target.value })}
                          className="flex-1 min-w-[100px] h-7 rounded border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => showPreview(t.id)}
                        className="h-7 px-3 rounded-lg bg-[var(--primary)] text-white text-xs font-medium hover:opacity-90"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => setSelected(null)}
                        className="h-7 px-3 rounded-lg border border-[var(--border)] text-xs text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
                      >
                        Close
                      </button>
                    </div>
                    {preview && (
                      <div className="mt-2 text-sm bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 p-3 rounded-lg">
                        {preview}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!isSelected && (
                <div className="border-t border-[var(--border)] px-4 py-2 bg-[var(--muted)]/30">
                  <button
                    onClick={() => { setSelected(t); setPreviewVars({}); setPreview(''); }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:text-[var(--primary)]/80 transition-colors"
                  >
                    <Eye size={12} /> Preview
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
