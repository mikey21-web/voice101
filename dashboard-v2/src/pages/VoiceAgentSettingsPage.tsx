import React, { useState, useEffect } from 'react';
import { fetchVoiceAgentSettings, updateVoiceAgentSettings, toggleVoiceAgentAmd, VoiceAgentSettings, fetchVoiceCustomFields, addVoiceCustomField, deleteVoiceCustomField, VoiceCustomField } from '../lib/data';
import { Phone, RefreshCw, Save, ShieldCheck, ShieldOff, Database, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';

const LANG = 'te';

export default function VoiceAgentSettingsPage() {
  const lang = LANG;
  const [settings, setSettings] = useState<VoiceAgentSettings | null>(null);
  const [form, setForm] = useState({ greeting: '', persona: '', antiEarlyHangupEnabled: false, checklistCopy: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<VoiceCustomField[]>([]);
  const [newField, setNewField] = useState<VoiceCustomField>({ name: '', type: 'string', prompt: '' });
  const [addingField, setAddingField] = useState(false);
  const [deletingField, setDeletingField] = useState<string | null>(null);

  const load = (language: string) => {
    setLoading(true);
    Promise.all([fetchVoiceAgentSettings(language), fetchVoiceCustomFields(language)])
      .then(([s, f]) => {
        setSettings(s);
        setForm({ greeting: s.greeting, persona: s.persona, antiEarlyHangupEnabled: s.antiEarlyHangupEnabled, checklistCopy: s.checklistCopy });
        setFields(f);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(lang); }, [lang]);

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newField.name.trim() || !newField.prompt.trim()) { toast.error('Field name and description are required'); return; }
    setAddingField(true);
    try {
      const updated = await addVoiceCustomField(newField, lang);
      setFields(updated);
      setNewField({ name: '', type: 'string', prompt: '' });
      toast.success('Field added');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAddingField(false);
    }
  };

  const handleDeleteField = async (name: string) => {
    setDeletingField(name);
    try {
      const updated = await deleteVoiceCustomField(name, lang);
      setFields(updated);
      toast.success('Field removed');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeletingField(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateVoiceAgentSettings(form, lang);
      setSettings(updated);
      setForm({ greeting: updated.greeting, persona: updated.persona, antiEarlyHangupEnabled: updated.antiEarlyHangupEnabled, checklistCopy: updated.checklistCopy });
      toast.success('Voice agent settings saved');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAmd = async () => {
    const next = !settings?.voicemailDetectionEnabled;
    try {
      const r = await toggleVoiceAgentAmd(next);
      setSettings((prev) => prev ? { ...prev, voicemailDetectionEnabled: r.voicemailDetectionEnabled } : prev);
      toast.success(r.voicemailDetectionEnabled ? 'Voicemail detection enabled' : 'Voicemail detection disabled');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) return (
    <div className="space-y-6 animate-fade-in">
      <div className="h-8 w-48 rounded-lg bg-[var(--card)] animate-pulse" />
      <div className="h-64 rounded-lg bg-[var(--card)] border border-[var(--border)] animate-pulse" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <Phone size={13} className="text-[var(--primary)]" />
            <span className="text-[11px] font-medium text-[var(--primary)] uppercase tracking-wider">Outreach</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">Voice Agent Settings</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Tune the greeting, persona, and conversation safeguards for the AI voice agent (Telugu)</p>
        </div>
      </div>

      <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          {settings?.voicemailDetectionEnabled ? (
            <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ShieldOff size={16} className="text-[var(--muted-foreground)]" />
          )}
          <span className="text-sm font-medium text-[var(--foreground)]">Voicemail detection</span>
        </div>
        <button
          onClick={handleToggleAmd}
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
            settings?.voicemailDetectionEnabled
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
              : 'bg-gray-100 dark:bg-gray-800 text-[var(--muted-foreground)]'
          }`}
        >
          {settings?.voicemailDetectionEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          {settings?.voicemailDetectionEnabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      <form onSubmit={handleSave} className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Greeting</label>
          <textarea
            value={form.greeting}
            onChange={e => setForm(p => ({ ...p, greeting: e.target.value }))}
            className="w-full h-20 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 resize-none"
            placeholder="Hi {{first_name}}, this is Riya from..."
          />
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1">Supports <code>{'{{first_name}}'}</code> and other lead variables.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Persona &amp; instructions</label>
          <textarea
            value={form.persona}
            onChange={e => setForm(p => ({ ...p, persona: e.target.value }))}
            className="w-full h-36 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
            placeholder="You are Riya, a warm and professional real estate lead qualifier..."
          />
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1">Applied to every step of the call.</p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Anti-early-hangup guard</p>
            <p className="text-xs text-[var(--muted-foreground)]">Prevents routing to cold-lead/wrong-number in the first ~10 seconds</p>
          </div>
          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, antiEarlyHangupEnabled: !p.antiEarlyHangupEnabled }))}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition-colors ${
              form.antiEarlyHangupEnabled
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-gray-100 dark:bg-gray-800 text-[var(--muted-foreground)]'
            }`}
          >
            {form.antiEarlyHangupEnabled ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
            {form.antiEarlyHangupEnabled ? 'On' : 'Off'}
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">End-call checklist</label>
          <textarea
            value={form.checklistCopy}
            onChange={e => setForm(p => ({ ...p, checklistCopy: e.target.value }))}
            className="w-full h-20 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 resize-none"
            placeholder="Before saying goodbye: (1) confirm the caller has no more questions, (2) give them one clear summary line of what happens next, (3) then say goodbye."
          />
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1">Applied to every end-call node. Leave empty to remove the checklist.</p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] space-y-4">
        <h3 className="font-semibold text-sm text-[var(--foreground)] flex items-center gap-2">
          <Database size={15} className="text-[var(--primary)]" />
          Data Collection
        </h3>
        <p className="text-xs text-[var(--muted-foreground)] -mt-2">Extra information the agent should ask for and capture, beyond the core qualification questions.</p>

        {fields.length > 0 && (
          <div className="space-y-2">
            {fields.map((f) => (
              <div key={f.name} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">{f.name} <span className="text-[var(--muted-foreground)] font-normal">({f.type})</span></p>
                  <p className="text-xs text-[var(--muted-foreground)]">{f.prompt}</p>
                </div>
                <button
                  onClick={() => handleDeleteField(f.name)}
                  disabled={deletingField === f.name}
                  className="h-7 w-7 rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:text-rose-600 hover:border-rose-300 transition-colors flex items-center justify-center shrink-0"
                >
                  {deletingField === f.name ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddField} className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
          <div className="flex gap-2">
            <input
              value={newField.name}
              onChange={(e) => setNewField((p) => ({ ...p, name: e.target.value.replace(/\s+/g, '_').toLowerCase() }))}
              placeholder="field_name"
              className="w-1/3 h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
            />
            <select
              value={newField.type}
              onChange={(e) => setNewField((p) => ({ ...p, type: e.target.value as VoiceCustomField['type'] }))}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)]"
            >
              <option value="string">Text</option>
              <option value="number">Number</option>
              <option value="boolean">Yes/No</option>
            </select>
            <input
              value={newField.prompt}
              onChange={(e) => setNewField((p) => ({ ...p, prompt: e.target.value }))}
              placeholder="What should the agent ask, e.g. best time to call back"
              className="flex-1 h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
            />
          </div>
          <button
            type="submit"
            disabled={addingField}
            className="self-start h-8 px-3 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {addingField ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
            Add Field
          </button>
        </form>
      </div>
    </div>
  );
}
