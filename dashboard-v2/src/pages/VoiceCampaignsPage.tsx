import React, { useState, useEffect, useRef } from 'react';
import { fetchLeads, fetchVoiceCampaigns, createVoiceCampaign, pauseVoiceCampaign, resumeVoiceCampaign, downloadVoiceCampaignReport, VoiceCampaign, VoiceRetryConfig } from '../lib/data';
import type { Lead } from '../lib/types';
import { Megaphone, Plus, Pause, Play, RefreshCw, Phone, X, ChevronRight, ChevronLeft, Check, Download, Upload, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';

interface CsvContact { phone: string; name?: string; }

/** Minimal CSV parser: no quoted-field/embedded-comma support — fine for a two-column phone/name template. */
function parseContactsCsv(text: string): { contacts: CsvContact[]; error: string | null } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { contacts: [], error: 'File is empty' };
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const phoneIdx = headers.findIndex((h) => h === 'phone_number' || h === 'phone');
  const nameIdx = headers.findIndex((h) => h === 'name' || h === 'first_name');
  if (phoneIdx === -1) return { contacts: [], error: 'CSV must have a "phone_number" (or "phone") column' };

  const contacts: CsvContact[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(',').map((c) => c.trim());
    const phone = cols[phoneIdx];
    if (!phone) continue;
    contacts.push({ phone, name: nameIdx !== -1 ? cols[nameIdx] : undefined });
  }
  return { contacts, error: null };
}

function downloadCsvTemplate() {
  const csv = 'phone_number,name\n9876543210,Jane Doe\n+919876543211,John Smith';
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'contacts-template.csv'; a.click();
  URL.revokeObjectURL(url);
}

const LANG = 'te';

const STEPS = ['Details', 'Contacts', 'Settings', 'Review'];

const DEFAULT_RETRY: VoiceRetryConfig = { enabled: false, maxRetries: 2, retryDelaySeconds: 120, retryOnBusy: true, retryOnNoAnswer: true, retryOnVoicemail: true };

export default function VoiceCampaignsPage() {
  const [campaigns, setCampaigns] = useState<VoiceCampaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const lang = LANG;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [contactMode, setContactMode] = useState<'leads' | 'csv'>('leads');
  const [csvContacts, setCsvContacts] = useState<CsvContact[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvError, setCsvError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [concurrency, setConcurrency] = useState(1);
  const [retry, setRetry] = useState<VoiceRetryConfig>(DEFAULT_RETRY);
  // Dograh's schedule_config restricts calling to a recurring daily time window
  // (not a one-time future start) — applied to every day of the week when enabled.
  const [callingHoursEnabled, setCallingHoursEnabled] = useState(false);
  const [callingHoursStart, setCallingHoursStart] = useState('09:00');
  const [callingHoursEnd, setCallingHoursEnd] = useState('19:00');

  const load = () => {
    Promise.all([fetchVoiceCampaigns(), fetchLeads(1, { hasPhone: 'true' })])
      .then(([c, l]) => {
        setCampaigns(c.campaigns || []);
        setLeads(l.data || []);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openModal = () => {
    setStep(0); setName(''); setSelected(new Set());
    setConcurrency(1); setRetry(DEFAULT_RETRY); setCallingHoursEnabled(false); setCallingHoursStart('09:00'); setCallingHoursEnd('19:00');
    setContactMode('leads'); setCsvContacts([]); setCsvFileName(''); setCsvError(null);
    setModalOpen(true);
  };

  const handleCsvUpload = (file: File) => {
    setCsvFileName(file.name);
    file.text().then((text) => {
      const { contacts, error } = parseContactsCsv(text);
      setCsvContacts(contacts);
      setCsvError(error);
    });
  };

  const toggleLead = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const canAdvance = step === 0 ? name.trim().length > 0 : step === 1 ? (contactMode === 'leads' ? selected.size > 0 : csvContacts.length > 0) : true;

  const handleCreate = async () => {
    setCreating(true);
    try {
      const scheduleConfig = callingHoursEnabled
        ? { enabled: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata', slots: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, startTime: callingHoursStart, endTime: callingHoursEnd })) }
        : undefined;
      const res = await createVoiceCampaign(name.trim(), contactMode === 'leads' ? Array.from(selected) : [], lang, {
        maxConcurrency: concurrency,
        retryConfig: retry.enabled ? retry : undefined,
        scheduleConfig,
        contacts: contactMode === 'csv' ? csvContacts : undefined,
      });
      toast.success(`Campaign launched — calling ${res.leadCount} leads`);
      setModalOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handlePauseResume = async (c: VoiceCampaign) => {
    setBusyId(c.id);
    try {
      if (c.state === 'paused') {
        await resumeVoiceCampaign(c.id);
        toast.success('Campaign resumed');
      } else {
        await pauseVoiceCampaign(c.id);
        toast.success('Campaign paused');
      }
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
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
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Campaigns</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">Call lists of leads using the AI voice agent</p>
        </div>
        <button
          onClick={openModal}
          className="h-10 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shrink-0"
        >
          <Plus size={16} />
          New
        </button>
      </div>

      <section>
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">Active Campaigns</h2>
        {campaigns.length === 0 ? (
          <div className="py-10 text-center">
            <Megaphone size={28} className="mx-auto mb-3 text-[var(--muted-foreground)]" />
            <p className="text-sm font-medium text-[var(--foreground)]">No campaigns yet</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">Create your first voice call campaign to start reaching out to your leads.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c) => (
              <div key={c.id} onClick={() => { window.location.hash = `#/voice-campaigns/${c.id}`; }} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2.5 hover:bg-[var(--accent)] cursor-pointer transition-colors">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">{c.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {c.processed_rows}/{c.total_rows} called
                    {c.failed_rows > 0 && ` · ${c.failed_rows} failed`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    c.state === 'running' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                    c.state === 'paused' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                    'bg-gray-100 dark:bg-gray-800 text-[var(--muted-foreground)]'
                  }`}>
                    {c.state}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadVoiceCampaignReport(c.id); }}
                    className="h-7 w-7 rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors flex items-center justify-center"
                    title="Export CSV"
                  >
                    <Download size={12} />
                  </button>
                  {(c.state === 'running' || c.state === 'paused') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePauseResume(c); }}
                      disabled={busyId === c.id}
                      className="h-7 px-2 rounded-md border border-[var(--border)] text-xs text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1"
                    >
                      {c.state === 'paused' ? <Play size={11} /> : <Pause size={11} />}
                      {c.state === 'paused' ? 'Resume' : 'Pause'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {modalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between p-5 border-b border-[var(--border)]">
              <div>
                <h2 className="text-base font-bold text-[var(--foreground)]">Create New Campaign</h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Call your leads at scale with the AI voice agent</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 px-5 pt-4">
              {STEPS.map((s, i) => (
                <React.Fragment key={s}>
                  <div className="flex flex-col items-center gap-1">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                      i < step ? 'bg-[var(--primary)] text-white' :
                      i === step ? 'bg-[var(--primary)] text-white' :
                      'bg-[var(--muted)] text-[var(--muted-foreground)]'
                    }`}>
                      {i < step ? <Check size={13} /> : i + 1}
                    </div>
                    <span className={`text-[11px] ${i === step ? 'text-[var(--primary)] font-medium' : 'text-[var(--muted-foreground)]'}`}>{s}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`h-0.5 w-8 mb-4 ${i < step ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}`} />}
                </React.Fragment>
              ))}
            </div>

            <div className="p-5 min-h-[240px]">
              {step === 0 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Campaign Name *</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Weekend Site Visit Push"
                      autoFocus
                      className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                    />
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <div className="flex rounded-lg border border-[var(--border)] p-0.5 mb-3">
                    <button
                      onClick={() => setContactMode('leads')}
                      className={`flex-1 h-8 rounded-md text-xs font-medium transition-colors ${contactMode === 'leads' ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
                    >
                      From Leads
                    </button>
                    <button
                      onClick={() => setContactMode('csv')}
                      className={`flex-1 h-8 rounded-md text-xs font-medium transition-colors ${contactMode === 'csv' ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
                    >
                      Upload CSV
                    </button>
                  </div>

                  {contactMode === 'leads' ? (
                    <>
                      <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Select leads to call ({selected.size} selected)</p>
                      <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
                        {leads.length === 0 && (
                          <div className="p-4 text-xs text-[var(--muted-foreground)] text-center">No leads with a phone number found</div>
                        )}
                        {leads.map((lead) => (
                          <label key={lead.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-[var(--accent)] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selected.has(lead.id)}
                              onChange={() => toggleLead(lead.id)}
                              className="w-4 h-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/30"
                            />
                            <span className="text-[var(--foreground)] flex-1">{lead.contact?.name || 'Unnamed'}</span>
                            <span className="text-[var(--muted-foreground)] text-xs">{lead.contact?.phone}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--accent)]/30 p-3">
                        <p className="text-xs text-[var(--foreground)] font-medium mb-1">CSV format</p>
                        <p className="text-[11px] text-[var(--muted-foreground)]">Columns: <code className="font-mono">phone_number</code> (required), <code className="font-mono">name</code> (optional). 10-digit numbers are treated as India (+91); include a country code for others.</p>
                        <button onClick={downloadCsvTemplate} className="mt-2 text-xs text-[var(--primary)] hover:underline flex items-center gap-1">
                          <FileText size={12} /> Download template
                        </button>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvUpload(f); }}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-24 rounded-lg border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)] flex flex-col items-center justify-center gap-1.5 text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
                      >
                        <Upload size={18} />
                        <span className="text-xs">{csvFileName || 'Click to upload a CSV file'}</span>
                      </button>

                      {csvError && <p className="text-xs text-rose-600">{csvError}</p>}
                      {csvContacts.length > 0 && !csvError && (
                        <div>
                          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1"><Check size={12} /> {csvContacts.length} contact{csvContacts.length > 1 ? 's' : ''} ready</p>
                          <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
                            {csvContacts.slice(0, 20).map((c, i) => (
                              <div key={i} className="flex items-center justify-between px-3 py-1.5 text-sm">
                                <span className="text-[var(--foreground)]">{c.name || 'Unnamed'}</span>
                                <span className="text-[var(--muted-foreground)] text-xs">{c.phone}</span>
                              </div>
                            ))}
                            {csvContacts.length > 20 && <div className="px-3 py-1.5 text-xs text-[var(--muted-foreground)]">+{csvContacts.length - 20} more</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-[var(--muted-foreground)]">Concurrent Call Limit</label>
                      <span className="text-xs font-semibold text-[var(--foreground)]">{concurrency} call{concurrency > 1 ? 's' : ''}</span>
                    </div>
                    <input
                      type="range" min={1} max={20} value={concurrency}
                      onChange={(e) => setConcurrency(parseInt(e.target.value, 10))}
                      className="w-full accent-[var(--primary)]"
                    />
                    <p className="text-[11px] text-[var(--muted-foreground)] mt-1">How many calls run at the same time.</p>
                  </div>

                  <div className="border-t border-[var(--border)] pt-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)] cursor-pointer">
                      <input type="checkbox" checked={retry.enabled} onChange={(e) => setRetry((r) => ({ ...r, enabled: e.target.checked }))} className="w-4 h-4 rounded border-[var(--border)] text-[var(--primary)]" />
                      Auto-retry unanswered calls (busy / no-answer / voicemail)
                    </label>
                    {retry.enabled && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                        <div>
                          <label className="block text-[11px] text-[var(--muted-foreground)] mb-1">Max retries per contact</label>
                          <input type="number" min={1} max={10} value={retry.maxRetries} onChange={(e) => setRetry((r) => ({ ...r, maxRetries: parseInt(e.target.value, 10) || 1 }))} className="w-full h-8 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)]" />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[var(--muted-foreground)] mb-1">Delay between retries (sec)</label>
                          <input type="number" min={30} max={3600} step={30} value={retry.retryDelaySeconds} onChange={(e) => setRetry((r) => ({ ...r, retryDelaySeconds: parseInt(e.target.value, 10) || 30 }))} className="w-full h-8 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)]" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[var(--border)] pt-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)] cursor-pointer">
                      <input type="checkbox" checked={callingHoursEnabled} onChange={(e) => setCallingHoursEnabled(e.target.checked)} className="w-4 h-4 rounded border-[var(--border)] text-[var(--primary)]" />
                      Only call during specific hours
                    </label>
                    {callingHoursEnabled && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                        <div>
                          <label className="block text-[11px] text-[var(--muted-foreground)] mb-1">From</label>
                          <input type="time" value={callingHoursStart} onChange={(e) => setCallingHoursStart(e.target.value)} className="w-full h-8 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)]" />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[var(--muted-foreground)] mb-1">To</label>
                          <input type="time" value={callingHoursEnd} onChange={(e) => setCallingHoursEnd(e.target.value)} className="w-full h-8 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)]" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm py-1.5 border-b border-[var(--border)]">
                    <span className="text-[var(--muted-foreground)]">Campaign name</span>
                    <span className="font-medium text-[var(--foreground)]">{name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm py-1.5 border-b border-[var(--border)]">
                    <span className="text-[var(--muted-foreground)]">Contacts to call</span>
                    <span className="font-medium text-[var(--foreground)]">{contactMode === 'leads' ? selected.size : csvContacts.length}{contactMode === 'csv' ? ' (from CSV)' : ''}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm py-1.5 border-b border-[var(--border)]">
                    <span className="text-[var(--muted-foreground)]">Concurrency</span>
                    <span className="font-medium text-[var(--foreground)]">{concurrency} calls</span>
                  </div>
                  <div className="flex items-center justify-between text-sm py-1.5 border-b border-[var(--border)]">
                    <span className="text-[var(--muted-foreground)]">Auto-retry</span>
                    <span className="font-medium text-[var(--foreground)]">{retry.enabled ? `Up to ${retry.maxRetries}x` : 'Off'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm py-1.5">
                    <span className="text-[var(--muted-foreground)]">Calling hours</span>
                    <span className="font-medium text-[var(--foreground)]">{callingHoursEnabled ? `${callingHoursStart}–${callingHoursEnd}` : 'Anytime'}</span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] pt-2">Calls start immediately once launched.</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-5 border-t border-[var(--border)]">
              <button
                onClick={() => setStep((s) => s - 1)}
                disabled={step === 0}
                className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                <ChevronLeft size={14} />
                Back
              </button>
              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canAdvance}
                  className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-1.5"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5"
                >
                  {creating ? <RefreshCw size={14} className="animate-spin" /> : <Phone size={14} />}
                  {creating ? 'Launching...' : 'Launch Campaign'}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
