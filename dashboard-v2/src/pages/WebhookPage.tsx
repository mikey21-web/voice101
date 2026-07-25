import React, { useState, useEffect } from 'react';
import { fetchWebhooks, testWebhook } from '../lib/data';
import { api } from '../lib/api';
import { Webhook, CheckCircle, XCircle, Clock, TestTube, ExternalLink, Shield, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Dialog } from '../components/ui/dialog';

interface CustomWebhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

const EVENT_OPTIONS = ['call.synced', 'call.recorded', 'call.summarized'];

const endpointInfo: Record<string, { label: string; description: string; auth: string; icon: string }> = {
  whatsapp: { label: 'WhatsApp', description: 'Meta WhatsApp Cloud API messages', auth: 'HMAC Signature (x-hub-signature-256)', icon: '💬' },
  telegram: { label: 'Telegram', description: 'Bot API updates', auth: 'Bot Token', icon: '✈️' },
  social: { label: 'Social Media', description: 'Facebook, Instagram, LinkedIn leads', auth: 'API Key (x-api-key)', icon: '📱' },
  voice: { label: 'Voice (Twilio)', description: 'Incoming call handling', auth: 'Twilio Signature', icon: '📞' },
  forms: { label: 'Forms', description: 'Custom form submissions', auth: 'API Key (x-api-key)', icon: '📝' },
  chatbot: { label: 'Chatbot', description: 'Chat widget messages', auth: 'API Key (x-api-key)', icon: '🤖' },
  'mobile-app': { label: 'Mobile App', description: 'App event forwarding', auth: 'API Key (x-api-key)', icon: '📲' },
  payments: { label: 'Payments', description: 'Stripe payment events', auth: 'Stripe Signature', icon: '💳' },
  indiamart: { label: 'IndiaMART', description: 'B2B buyer enquiries', auth: 'API Key or HMAC', icon: '🏭' },
  '99acres': { label: '99acres', description: 'Property enquiries', auth: 'API Key or HMAC', icon: '🏠' },
  justdial: { label: 'JustDial', description: 'Business enquiries', auth: 'API Key or HMAC', icon: '📋' },
  magicbricks: { label: 'MagicBricks', description: 'Real estate enquiries', auth: 'API Key or HMAC', icon: '🔑' },
  housing: { label: 'Housing.com', description: 'Property leads', auth: 'API Key or HMAC', icon: '🏡' },
  tradeindia: { label: 'TradeIndia', description: 'B2B buyer enquiries', auth: 'API Key or HMAC', icon: '🌐' },
};

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function WebhookPage() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [testing, setTesting] = useState<string | null>(null);
  const [customWebhooks, setCustomWebhooks] = useState<CustomWebhook[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<CustomWebhook | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomWebhook | null>(null);
  const [loadingCustom, setLoadingCustom] = useState(true);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // --- Existing webhooks ---
  useEffect(() => {
    fetchWebhooks().then((r: any) => {
      const data = r.data || r;
      if (Array.isArray(data)) {
        setWebhooks(data);
      } else {
        const types = Object.keys(endpointInfo);
        setWebhooks(types.map(t => ({
          type: t,
          url: `${API_URL}/webhooks/${t}`,
          ...endpointInfo[t],
          status: t === 'whatsapp' ? 'configured' : 'available',
          lastReceived: null,
        })));
      }
    }).catch(() => {
      const types = Object.keys(endpointInfo);
      setWebhooks(types.map(t => ({
        type: t,
        url: `${API_URL}/webhooks/${t}`,
        ...endpointInfo[t],
        status: 'available',
        lastReceived: null,
      })));
    });
  }, []);

  // --- Custom webhooks ---
  const loadCustomWebhooks = async () => {
    setLoadingCustom(true);
    try {
      const data = await api('/webhooks/outbound') as CustomWebhook[];
      setCustomWebhooks(Array.isArray(data) ? data : []);
    } catch {
      // fallback handled by mock
    } finally {
      setLoadingCustom(false);
    }
  };

  useEffect(() => {
    loadCustomWebhooks();
  }, []);

  const handleTest = async (type: string) => {
    setTesting(type);
    try {
      await testWebhook(type);
      toast.success(`${endpointInfo[type]?.label || type} webhook test passed`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTesting(null);
    }
  };

  const handleToggleActive = async (wh: CustomWebhook) => {
    try {
      await api(`/webhooks/outbound/${wh.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !wh.active }),
      });
      setCustomWebhooks(prev => prev.map(w => w.id === wh.id ? { ...w, active: !w.active } : w));
      toast.success(`${wh.name} ${wh.active ? 'paused' : 'activated'}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update webhook');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/webhooks/outbound/${deleteTarget.id}`, { method: 'DELETE' });
      setCustomWebhooks(prev => prev.filter(w => w.id !== deleteTarget.id));
      toast.success('Webhook deleted');
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ---- Custom Webhooks Section ---- */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Webhook size={13} className="text-[var(--primary)]" />
              <span className="text-[11px] font-medium text-[var(--primary)] uppercase tracking-wider">Custom</span>
            </div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">Custom Webhooks</h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Send call events to your own endpoints
            </p>
          </div>
          <button
            onClick={() => { setEditingWebhook(null); setModalOpen(true); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 transition-colors"
          >
            <Plus size={13} /> Add Webhook
          </button>
        </div>

        {loadingCustom ? (
          <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">Loading custom webhooks...</p>
        ) : customWebhooks.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">No custom webhooks yet. Click "Add Webhook" to create one.</p>
        ) : (
          <div className="space-y-2">
            {customWebhooks.map((wh) => (
              <div key={wh.id} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[var(--foreground)]">{wh.name}</span>
                    <div className="flex items-center gap-1">
                      {wh.events.map(ev => (
                        <span key={ev} className="inline-flex px-1.5 py-0.5 rounded-full bg-[var(--primary-light)] text-[10px] font-medium text-[var(--primary)]">
                          {ev}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                    <code className="truncate max-w-[300px]">{wh.url}</code>
                    <span>· Created {new Date(wh.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-[var(--muted-foreground)]">Last: —</span>
                  <button
                    onClick={() => handleToggleActive(wh)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      wh.active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${
                      wh.active ? 'translate-x-[18px]' : 'translate-x-[2px]'
                    }`} />
                  </button>
                  <button
                    onClick={() => { setEditingWebhook(wh); setModalOpen(true); }}
                    className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
                    title="Edit"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(wh)}
                    className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Existing Webhook Endpoints Section ---- */}
      <div>
        <div className="flex items-center gap-1.5 mb-0.5">
          <Webhook size={13} className="text-[var(--primary)]" />
          <span className="text-[11px] font-medium text-[var(--primary)] uppercase tracking-wider">Channels</span>
        </div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">Webhook Endpoints</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          {webhooks.length} endpoints configured. Copy these URLs into your external services
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {webhooks.map((wh) => {
          const info = endpointInfo[wh.type] || { label: wh.type, description: '', auth: 'Unknown', icon: '🔗' };
          const isActive = wh.status === 'configured' || wh.status === 'active';
          const hasRecentActivity = wh.lastReceived && new Date(wh.lastReceived).getTime() > Date.now() - 86400000;

          return (
            <div key={wh.type} className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{info.icon}</span>
                  <div>
                    <h3 className="font-semibold text-sm text-[var(--foreground)]">{info.label}</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">{info.description}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  isActive ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                  'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>
                  {isActive ? <CheckCircle size={10} /> : <Clock size={10} />}
                  {isActive ? 'Active' : 'Available'}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider w-16 shrink-0">URL</span>
                  <code className="flex-1 px-2 py-1 rounded bg-[var(--accent)] text-xs text-[var(--foreground)] font-mono truncate select-all">
                    {wh.url}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider w-16 shrink-0">Auth</span>
                  <div className="flex items-center gap-1.5">
                    <Shield size={10} className="text-[var(--muted-foreground)]" />
                    <span className="text-xs text-[var(--muted-foreground)]">{info.auth}</span>
                  </div>
                </div>
                {wh.lastReceived && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider w-16 shrink-0">Last Rx</span>
                    <span className={`text-xs ${hasRecentActivity ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--muted-foreground)]'}`}>
                      {new Date(wh.lastReceived).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleTest(wh.type)}
                  disabled={testing === wh.type}
                  className="h-8 px-3 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <TestTube size={12} />
                  {testing === wh.type ? 'Testing...' : 'Test'}
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(wh.url).then(() => toast.success('URL copied'))}
                  className="h-8 px-3 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink size={12} />
                  Copy URL
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Add/Edit Webhook Modal ---- */}
      {modalOpen && (
        <CustomWebhookModal
          webhook={editingWebhook}
          onClose={() => setModalOpen(false)}
          onSaved={(wh) => {
            if (editingWebhook) {
              setCustomWebhooks(prev => prev.map(w => w.id === wh.id ? wh : w));
            } else {
              setCustomWebhooks(prev => [...prev, wh]);
            }
            setModalOpen(false);
            setEditingWebhook(null);
          }}
        />
      )}

      {/* ---- Delete Confirmation ---- */}
      {deleteTarget && (
        <Dialog
          open
          onClose={() => setDeleteTarget(null)}
          title="Delete Webhook"
          maxWidth="max-w-sm"
          footer={
            <>
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </>
          }
        >
          <p className="text-sm text-[var(--muted-foreground)]">
            Are you sure you want to delete <strong className="text-[var(--foreground)]">{deleteTarget.name}</strong>? This action cannot be undone.
          </p>
        </Dialog>
      )}
    </div>
  );
}

/* ─── Custom Webhook Modal ─── */
function CustomWebhookModal({
  webhook,
  onClose,
  onSaved,
}: {
  webhook: CustomWebhook | null;
  onClose: () => void;
  onSaved: (wh: CustomWebhook) => void;
}) {
  const [name, setName] = useState(webhook?.name || '');
  const [url, setUrl] = useState(webhook?.url || '');
  const [events, setEvents] = useState<string[]>(webhook?.events || []);
  const [secret, setSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!url.trim()) errs.url = 'URL is required';
    else if (!isValidUrl(url.trim())) errs.url = 'Must be a valid http/https URL';
    if (events.length === 0) errs.events = 'Select at least one event';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const toggleEvent = (ev: string) => {
    setEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body: any = { name: name.trim(), url: url.trim(), events };
      if (secret.trim()) body.secret = secret.trim();

      if (webhook) {
        const updated = await api(`/webhooks/outbound/${webhook.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        }) as CustomWebhook;
        toast.success('Webhook updated');
        onSaved({ ...webhook, ...updated });
      } else {
        const created = await api('/webhooks/outbound', {
          method: 'POST',
          body: JSON.stringify(body),
        }) as CustomWebhook;
        toast.success('Webhook created');
        onSaved(created);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to save webhook');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={webhook ? 'Edit Webhook' : 'Add Webhook'}
      maxWidth="max-w-lg"
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : webhook ? 'Save Changes' : 'Create Webhook'}
          </button>
        </>
      }
    >
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Slack Notifications"
              className={`w-full rounded-lg border px-3 py-2 text-sm text-[var(--foreground)] bg-[var(--background)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 ${
                errors.name ? 'border-red-500' : 'border-[var(--border)]'
              }`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* URL */}
          <div>
            <label className="block text-xs font-medium text-[var(--foreground)] mb-1">URL</label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://hooks.example.com/events"
              className={`w-full rounded-lg border px-3 py-2 text-sm text-[var(--foreground)] bg-[var(--background)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 ${
                errors.url ? 'border-red-500' : 'border-[var(--border)]'
              }`}
            />
            {errors.url && <p className="text-xs text-red-500 mt-1">{errors.url}</p>}
          </div>

          {/* Events */}
          <div>
            <label className="block text-xs font-medium text-[var(--foreground)] mb-1.5">Events</label>
            <div className="space-y-1.5">
              {EVENT_OPTIONS.map(ev => (
                <label key={ev} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={events.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                    className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/50"
                  />
                  <span className="text-sm text-[var(--foreground)]">{ev}</span>
                </label>
              ))}
            </div>
            {errors.events && <p className="text-xs text-red-500 mt-1">{errors.events}</p>}
          </div>

          {/* Secret */}
          <div>
            <label className="block text-xs font-medium text-[var(--foreground)] mb-1">
              Secret <span className="text-[var(--muted-foreground)] font-normal">(optional — for HMAC signing)</span>
            </label>
            <input
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="Your HMAC secret key"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
            />
          </div>
        </div>
    </Dialog>
  );
}
