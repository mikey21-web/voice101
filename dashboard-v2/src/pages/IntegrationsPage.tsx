import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Globe, CheckCircle, XCircle, Copy, Mail, Save, Eye, EyeOff, Building, Cloud, Zap, X, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchWebhooks, fetchIntegrations, createIntegration, deleteIntegration, testIntegration, updateIntegration } from '../lib/data';
import { api } from '../lib/api';

const channels = [
  {
    name: 'Telegram',
    icon: MessageCircle,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    desc: 'Leads and notifications sent to your Telegram bot',
    auto: true,
  },
  {
    name: 'Chat Widget',
    icon: Globe,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    desc: 'Embeddable chat widget for your website',
    auto: true,
  },
];

const crmProviders = [
  {
    id: 'HUBSPOT',
    name: 'HubSpot',
    icon: Building,
    color: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    desc: 'Sync contacts, companies, deals, and tickets from HubSpot CRM',
    fields: [
      { key: 'apiKey', label: 'Private App Token', type: 'password', required: true, placeholder: 'Enter your HubSpot private app token' },
    ],
  },
  {
    id: 'SALESFORCE',
    name: 'Salesforce',
    icon: Cloud,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    desc: 'Sync leads, contacts, accounts, and opportunities from Salesforce',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'Connected app client ID' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, placeholder: 'Connected app client secret' },
      { key: 'username', label: 'Username', type: 'text', required: true, placeholder: 'Salesforce username' },
      { key: 'password', label: 'Password', type: 'password', required: true, placeholder: 'Salesforce password' },
      { key: 'securityToken', label: 'Security Token', type: 'password', required: true, placeholder: 'Salesforce security token' },
    ],
  },
  {
    id: 'ZOHO',
    name: 'Zoho',
    icon: Zap,
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-900/20',
    desc: 'Sync leads, contacts, accounts, and deals from Zoho CRM',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'Zoho client ID' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, placeholder: 'Zoho client secret' },
      { key: 'refreshToken', label: 'Refresh Token', type: 'password', required: true, placeholder: 'Zoho refresh token' },
      { key: 'region', label: 'Region', type: 'select', required: false, default: 'us', options: [
        { value: 'us', label: 'United States' },
        { value: 'eu', label: 'Europe' },
        { value: 'in', label: 'India' },
        { value: 'au', label: 'Australia' },
        { value: 'cn', label: 'China' },
      ]},
    ],
  },
];

export default function IntegrationsPage() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [emailConfig, setEmailConfig] = useState({ smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '', smtpFrom: '', imapHost: '', imapPort: '993', imapUser: '', imapPass: '', imapTls: true });
  const [showPass, setShowPass] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [crmIntegrations, setCrmIntegrations] = useState<any[]>([]);
  const [crmLoading, setCrmLoading] = useState(true);
  const [crmModal, setCrmModal] = useState<{
    provider: typeof crmProviders[0];
    integration?: any;
    config: Record<string, string>;
    saving: boolean;
  } | null>(null);
  const [crmTestingId, setCrmTestingId] = useState<string | null>(null);
  const [crmShowPass, setCrmShowPass] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchWebhooks().then((r: any) => setWebhooks(r.data || r || [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchIntegrations()
      .then((r: any) => setCrmIntegrations(Array.isArray(r) ? r : r.data || r || []))
      .catch(() => toast.error('Failed to load integrations'))
      .finally(() => setCrmLoading(false));
  }, []);

  const telegramWebhook = webhooks.find((w: any) => w.type === 'telegram');
  const telegramActive = telegramWebhook?.status === 'available' || telegramWebhook?.active;

  const embedCode = `<script src="https://deploysafe.in/widget/embed.js" data-widget-id="default"></script>`;

  const handleSave = async () => {
    setSaving(true);
    try {
      const envKey = (name: string) => {
        const map: Record<string, string> = {
          smtpHost: 'SMTP_HOST', smtpPort: 'SMTP_PORT', smtpUser: 'SMTP_USER',
          smtpPass: 'SMTP_PASS', smtpFrom: 'SMTP_FROM',
          imapHost: 'IMAP_HOST', imapPort: 'IMAP_PORT', imapUser: 'IMAP_USER',
          imapPass: 'IMAP_PASS', imapTls: 'IMAP_TLS',
        };
        return map[name];
      };
      const body: any = {};
      for (const [key, val] of Object.entries(emailConfig)) {
        const ek = envKey(key);
        if (ek) body[ek] = key === 'imapTls' ? String(val) : val;
      }
      await api('/env-config', { method: 'PUT', body: JSON.stringify(body) }).catch(() => {
        toast.success('Settings saved (restart required for some changes)');
      });
      toast.success('Email config saved');
    } catch (err: any) { toast.error(err.message || 'Failed to save'); }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await api('/email/test', { method: 'POST' }).catch(() => ({ success: false, error: 'Test endpoint not available' }));
      toast.success(res.success ? 'Connection successful' : `Test failed: ${res.error}`);
    } catch { toast.error('Test failed'); }
    setTesting(false);
  };

  const toggleShow = (key: string) => setShowPass(prev => ({ ...prev, [key]: !prev[key] }));

  const pwInput = (label: string, key: string) => (
    <div className="relative">
      <input type={showPass[key] ? 'text' : 'password'} value={(emailConfig as any)[key] || ''}
        onChange={e => setEmailConfig(f => ({ ...f, [key]: e.target.value }))}
        placeholder={label}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 pr-8 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
      <button type="button" onClick={() => toggleShow(key)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer">
        {showPass[key] ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );

  // --- CRM helpers ---

  const getCrmIntegration = (type: string) => crmIntegrations.find((i: any) => i.type === type);

  const isCrmConnected = (type: string) => {
    const integ = getCrmIntegration(type);
    return integ && (integ.status === 'CONNECTED' || integ.status === 'connected' || integ.status === 'ACTIVE' || integ.status === 'active');
  };

  const openCrmConnect = (provider: typeof crmProviders[0]) => {
    const existing = getCrmIntegration(provider.id);
    const config: Record<string, string> = {};
    if (existing?.config) {
      for (const field of provider.fields) {
        config[field.key] = ((existing.config as Record<string, any>)[field.key] as string) || '';
      }
    }
    // Apply defaults for fields not yet set
    for (const field of provider.fields) {
      if (!config[field.key] && field.type === 'select' && field.default) {
        config[field.key] = field.default;
      }
    }
    setCrmModal({ provider, integration: existing, config, saving: false });
  };

  const handleCrmSave = async () => {
    if (!crmModal) return;
    const { provider, integration, config } = crmModal;

    // Validate required fields
    for (const field of provider.fields) {
      if (field.required && !config[field.key]?.trim()) {
        toast.error(`${field.label} is required`);
        return;
      }
    }

    setCrmModal(prev => prev ? { ...prev, saving: true } : null);
    try {
      if (integration) {
        await updateIntegration(integration.id, { config });
        toast.success(`${provider.name} connection updated`);
      } else {
        await createIntegration({ type: provider.id, name: `${provider.name} CRM`, config });
        toast.success(`${provider.name} connected successfully`);
      }
      // Refresh the list
      const r = await fetchIntegrations();
      setCrmIntegrations(Array.isArray(r) ? r : r.data || r || []);
      setCrmModal(null);
    } catch (err: any) {
      toast.error(err.message || `Failed to connect ${provider.name}`);
    } finally {
      setCrmModal(prev => prev ? { ...prev, saving: false } : null);
    }
  };

  const handleCrmDisconnect = async (id: string, name: string) => {
    if (!window.confirm(`Disconnect ${name}? This will remove the integration configuration.`)) return;
    try {
      await deleteIntegration(id);
      toast.success(`${name} disconnected`);
      const r = await fetchIntegrations();
      setCrmIntegrations(Array.isArray(r) ? r : r.data || r || []);
    } catch (err: any) {
      toast.error(err.message || `Failed to disconnect ${name}`);
    }
  };

  const handleCrmTest = async (id: string) => {
    setCrmTestingId(id);
    try {
      const res = await testIntegration(id);
      toast.success(res.message || 'Connection test successful');
    } catch (err: any) {
      toast.error(err.message || 'Connection test failed');
    } finally {
      setCrmTestingId(null);
    }
  };

  const handleCrmConfigChange = (key: string, value: string) => {
    setCrmModal(prev => prev ? { ...prev, config: { ...prev.config, [key]: value } } : null);
  };

  const toggleCrmShowPass = (key: string) => setCrmShowPass(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Connected Channels</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">Your channels are auto-configured. No setup needed</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Telegram */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${telegramActive ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-800'} flex items-center justify-center`}>
                <MessageCircle size={20} className={telegramActive ? 'text-blue-500' : 'text-gray-400'} />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--foreground)]">Telegram</h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">@lead_automation_bot</p>
              </div>
            </div>
            {telegramActive ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <CheckCircle size={12} /> Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                <XCircle size={12} /> Inactive
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">{channels[0].desc}</p>
          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <span className="font-medium text-[var(--foreground)]">Bot Token:</span>
            <code className="px-2 py-0.5 rounded bg-[var(--muted)] text-[var(--foreground)]">configured in .env</code>
          </div>
        </div>

        {/* Chat Widget */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                <Globe size={20} className="text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--foreground)]">Chat Widget</h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{channels[1].desc}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <CheckCircle size={12} /> Active
            </span>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">Embed this script on your website:</p>
          <div className="relative mt-2">
            <pre className="text-xs text-[var(--foreground)] bg-[var(--muted)] rounded-lg p-3 overflow-x-auto border border-[var(--border)] whitespace-pre-wrap break-all">
              {embedCode}
            </pre>
            <button
              onClick={() => { navigator.clipboard.writeText(embedCode); toast.success('Copied!'); }}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Email (SMTP + IMAP) */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center">
              <Mail size={20} className="text-cyan-500" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--foreground)]">Email (SMTP + IMAP)</h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">2-way email sync. Send and receive emails from your CRM</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* SMTP */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider">SMTP (Outgoing)</h4>
            <input type="text" value={emailConfig.smtpHost} onChange={e => setEmailConfig(f => ({ ...f, smtpHost: e.target.value }))} placeholder="SMTP Host" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="text" value={emailConfig.smtpPort} onChange={e => setEmailConfig(f => ({ ...f, smtpPort: e.target.value }))} placeholder="Port (587)" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
              <input type="text" value={emailConfig.smtpFrom} onChange={e => setEmailConfig(f => ({ ...f, smtpFrom: e.target.value }))} placeholder="From address" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
            </div>
            <input type="text" value={emailConfig.smtpUser} onChange={e => setEmailConfig(f => ({ ...f, smtpUser: e.target.value }))} placeholder="SMTP Username" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
            {pwInput('SMTP Password', 'smtpPass')}
          </div>

          {/* IMAP */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider">IMAP (Incoming)</h4>
            <input type="text" value={emailConfig.imapHost} onChange={e => setEmailConfig(f => ({ ...f, imapHost: e.target.value }))} placeholder="IMAP Host" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="text" value={emailConfig.imapPort} onChange={e => setEmailConfig(f => ({ ...f, imapPort: e.target.value }))} placeholder="Port (993)" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] cursor-pointer">
                <input type="checkbox" checked={emailConfig.imapTls} onChange={e => setEmailConfig(f => ({ ...f, imapTls: e.target.checked }))} className="w-4 h-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/30" />
                <span className="text-xs text-[var(--foreground)]">TLS</span>
              </label>
            </div>
            <input type="text" value={emailConfig.imapUser} onChange={e => setEmailConfig(f => ({ ...f, imapUser: e.target.value }))} placeholder="IMAP Username" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
            {pwInput('IMAP Password', 'imapPass')}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--muted-foreground)]">Changes may require a server restart to take effect.</p>
          <div className="flex items-center gap-2">
            <button onClick={handleTest} disabled={testing}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50 transition-colors cursor-pointer">
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors cursor-pointer">
              <Save size={15} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* ===== CRM Connections ===== */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">CRM Connections</h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Connect your CRM to sync leads, contacts, and deals automatically</p>
          </div>
        </div>

        {crmLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-[var(--muted-foreground)]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {crmProviders.map(provider => {
              const integration = getCrmIntegration(provider.id);
              const connected = isCrmConnected(provider.id);
              const Icon = provider.icon;
              return (
                <div key={provider.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${connected ? provider.bg : 'bg-gray-50 dark:bg-gray-800'} flex items-center justify-center`}>
                        <Icon size={20} className={connected ? provider.color : 'text-gray-400'} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[var(--foreground)]">{provider.name}</h3>
                        {integration?.lastTested && (
                          <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                            Last tested: {new Date(integration.lastTested).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    {connected ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <CheckCircle size={12} /> Connected
                      </span>
                    ) : integration ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <XCircle size={12} /> Error
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        <XCircle size={12} /> Disconnected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--muted-foreground)] flex-1">{provider.desc}</p>
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[var(--border)]">
                    {connected ? (
                      <>
                        <button
                          onClick={() => openCrmConnect(provider)}
                          className="flex-1 px-3 py-2 rounded-lg text-sm font-medium border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer"
                        >
                          Configure
                        </button>
                        <button
                          onClick={() => handleCrmTest(integration!.id)}
                          disabled={crmTestingId === integration!.id}
                          className="px-3 py-2 rounded-lg text-sm font-medium border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          {crmTestingId === integration!.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            'Test'
                          )}
                        </button>
                        <button
                          onClick={() => handleCrmDisconnect(integration!.id, provider.name)}
                          className="p-2 rounded-lg text-sm font-medium border border-red-200 dark:border-red-900/30 bg-[var(--card)] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                          title={`Disconnect ${provider.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => openCrmConnect(provider)}
                        className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 transition-colors cursor-pointer"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== CRM Connect/Configure Modal ===== */}
      {crmModal && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setCrmModal(null)}
        >
          <div
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl w-full max-w-md shadow-2xl animate-fade-in overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${crmModal.provider.bg} flex items-center justify-center`}>
                  {React.createElement(crmModal.provider.icon, { size: 18, className: crmModal.provider.color })}
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">
                    {crmModal.integration ? 'Configure' : 'Connect'} {crmModal.provider.name}
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {crmModal.integration ? 'Update your credentials' : 'Enter your CRM credentials'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCrmModal(null)}
                className="p-1.5 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body - form fields */}
            <div className="p-5 space-y-3 max-h-80 overflow-y-auto">
              {crmModal.provider.fields.map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-[var(--foreground)] mb-1.5">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={crmModal.config[field.key] || field.default || ''}
                      onChange={e => handleCrmConfigChange(field.key, e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
                    >
                      {field.options?.map((opt: { value: string; label: string }) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'password' ? (
                    <div className="relative">
                      <input
                        type={crmShowPass[field.key] ? 'text' : 'password'}
                        value={crmModal.config[field.key] || ''}
                        onChange={e => handleCrmConfigChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 pr-8 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
                      />
                      <button
                        type="button"
                        onClick={() => toggleCrmShowPass(field.key)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                      >
                        {crmShowPass[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={crmModal.config[field.key] || ''}
                      onChange={e => handleCrmConfigChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-5 pt-0">
              <button
                onClick={() => setCrmModal(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCrmSave}
                disabled={crmModal.saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {crmModal.saving ? (
                  <><Loader2 size={14} className="animate-spin" /> Connecting...</>
                ) : (
                  <>{crmModal.integration ? 'Save Changes' : 'Connect'}</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
