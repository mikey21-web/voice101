import React, { useState, useEffect } from 'react';
import { fetchOutboundWebhooks, createOutboundWebhookSub, deleteOutboundWebhookSub, testOutboundWebhookSub, OutboundWebhook } from '../lib/data';
import { Workflow, Plus, Trash2, Send, RefreshCw, Sheet, Webhook as WebhookIcon } from 'lucide-react';
import toast from 'react-hot-toast';

const EVENT = 'call.completed';

export default function VoicePostCallWorkflowsPage() {
  const [hooks, setHooks] = useState<OutboundWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<'webhook' | 'sheets' | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = () => {
    fetchOutboundWebhooks()
      .then((all) => setHooks((all || []).filter((h) => h.events.includes(EVENT))))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) { toast.error('Name and URL are required'); return; }
    setSaving(true);
    try {
      await createOutboundWebhookSub({ name: name.trim(), url: url.trim(), events: [EVENT] });
      toast.success('Post-call workflow created');
      setName(''); setUrl(''); setShowForm(null);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteOutboundWebhookSub(id);
      toast.success('Removed');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res: any = await testOutboundWebhookSub(id);
      toast.success(res?.status === 'success' ? 'Test event delivered' : `Test sent (${res?.status})`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTestingId(null);
    }
  };

  if (loading) return (
    <div className="space-y-6 animate-fade-in">
      <div className="h-8 w-48 rounded-lg bg-[var(--card)] animate-pulse" />
      <div className="h-64 rounded-lg bg-[var(--card)] border border-[var(--border)] animate-pulse" />
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Post-Call Workflows</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-2">Automatically send call data (outcome, transcript, summary) to Google Sheets, webhooks, or other APIs</p>
      </div>

      {!showForm && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => { setShowForm('sheets'); setUrl(''); }}
            className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-4 text-left hover:border-[var(--primary)] transition-colors"
          >
            <Sheet size={18} className="text-emerald-600 mb-2" />
            <p className="text-sm font-medium text-[var(--foreground)]">Save to Google Sheets</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Via a Google Apps Script Web App URL</p>
          </button>
          <button
            onClick={() => { setShowForm('webhook'); setUrl(''); }}
            className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-4 text-left hover:border-[var(--primary)] transition-colors"
          >
            <WebhookIcon size={18} className="text-[var(--primary)] mb-2" />
            <p className="text-sm font-medium text-[var(--foreground)]">Custom Webhook</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Send call data to any API</p>
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-[var(--border)] p-6 space-y-4">
          <h3 className="font-semibold text-sm text-[var(--foreground)] flex items-center gap-2">
            {showForm === 'sheets' ? <Sheet size={15} className="text-emerald-600" /> : <WebhookIcon size={15} className="text-[var(--primary)]" />}
            {showForm === 'sheets' ? 'Save to Google Sheets' : 'Custom Webhook'}
          </h3>
          {showForm === 'sheets' && (
            <p className="text-xs text-[var(--muted-foreground)]">
              In your Google Sheet, go to Extensions → Apps Script, add a <code>doPost(e)</code> function that appends <code>JSON.parse(e.postData.contents)</code> as a row,
              then Deploy → Web App and paste that URL below.
            </p>
          )}
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={showForm === 'sheets' ? 'Call Log Sheet' : 'My CRM Webhook'}
              className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">{showForm === 'sheets' ? 'Apps Script Web App URL' : 'Webhook URL'}</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Saving...' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowForm(null)} className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-5 shadow-[var(--shadow-sm)]">
        <h3 className="font-semibold text-sm text-[var(--foreground)] mb-4">Active Workflows</h3>
        {hooks.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)]">No post-call workflows configured yet</p>
        ) : (
          <div className="space-y-2">
            {hooks.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)] truncate">{h.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)] truncate">{h.url}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleTest(h.id)}
                    disabled={testingId === h.id}
                    className="h-7 px-2 rounded-md border border-[var(--border)] text-xs text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1"
                  >
                    {testingId === h.id ? <RefreshCw size={11} className="animate-spin" /> : <Send size={11} />}
                    Test
                  </button>
                  <button
                    onClick={() => handleDelete(h.id)}
                    className="h-7 w-7 rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:text-rose-600 hover:border-rose-300 transition-colors flex items-center justify-center"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
