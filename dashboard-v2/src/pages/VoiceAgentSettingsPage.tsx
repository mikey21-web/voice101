import React, { useState, useEffect } from 'react';
import { fetchVoiceAgentSettings, updateVoiceAgentSettings, toggleVoiceAgentAmd, VoiceAgentSettings, fetchVoiceCustomFields, addVoiceCustomField, deleteVoiceCustomField, VoiceCustomField, fetchVoices, fetchVoiceConfig, updateVoiceConfig, VoiceOption, VOICE_PROVIDERS, fetchAmbientNoise, updateAmbientNoise, getAmbientNoiseUploadUrl, AmbientNoiseConfig, generateCallFlow, applyCallFlow, GeneratedFlowDraft } from '../lib/data';
import { Phone, RefreshCw, Save, ShieldCheck, ShieldOff, Database, Plus, Trash2, ToggleLeft, ToggleRight, Mic, Check, Volume2, Upload, Sparkles, AlertTriangle, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

const LANG = 'te';

export default function VoiceAgentSettingsPage() {
  const lang = LANG;
  const [settings, setSettings] = useState<VoiceAgentSettings | null>(null);
  const [form, setForm] = useState({ greeting: '', persona: '', antiEarlyHangupEnabled: false, checklistCopy: '', stylePackEnabled: true, aiAcknowledgementEnabled: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<VoiceCustomField[]>([]);
  const [newField, setNewField] = useState<VoiceCustomField>({ name: '', type: 'string', prompt: '' });
  const [addingField, setAddingField] = useState(false);
  const [deletingField, setDeletingField] = useState<string | null>(null);

  // Voice picker: provider select drives which voice catalogue is loaded; current selection
  // comes from the live Dograh org config so this reflects reality even if it was last changed
  // outside this UI. Speed defaults to 1 until a config/voice is loaded.
  const [voiceProvider, setVoiceProvider] = useState('sarvam');
  const [currentVoice, setCurrentVoice] = useState<{ provider: string | null; voice: string | null }>({ provider: null, voice: null });
  const [voiceSpeed, setVoiceSpeed] = useState(1);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [savingVoice, setSavingVoice] = useState<string | null>(null);

  // Ambient background noise: same "toggle + volume" shape as the naturalness style pack
  // toggles above, plus a file picker since Dograh only supports a custom-uploaded clip (no
  // built-in preset library) — see getAmbientNoiseUploadUrl.
  const [ambient, setAmbient] = useState<AmbientNoiseConfig>({ enabled: false, volume: 0.3, storageKey: null });
  const [uploadingAmbient, setUploadingAmbient] = useState(false);
  const [savingAmbientToggle, setSavingAmbientToggle] = useState(false);

  // AI flow builder: "describe it, we build it" — generate() is pure (no side effects); apply()
  // is the one explicit-confirm write that replaces the whole call-flow graph, so the draft is
  // always shown for review before that button becomes reachable.
  const [flowDescription, setFlowDescription] = useState('');
  const [flowDraft, setFlowDraft] = useState<GeneratedFlowDraft | null>(null);
  const [generatingFlow, setGeneratingFlow] = useState(false);
  const [applyingFlow, setApplyingFlow] = useState(false);

  const load = (language: string) => {
    setLoading(true);
    Promise.all([fetchVoiceAgentSettings(language), fetchVoiceCustomFields(language), fetchVoiceConfig(), fetchAmbientNoise(language)])
      .then(([s, f, vc, amb]) => {
        setSettings(s);
        setForm({ greeting: s.greeting, persona: s.persona, antiEarlyHangupEnabled: s.antiEarlyHangupEnabled, checklistCopy: s.checklistCopy, stylePackEnabled: s.stylePackEnabled, aiAcknowledgementEnabled: s.aiAcknowledgementEnabled });
        setFields(f);
        setCurrentVoice({ provider: vc.provider, voice: vc.voice });
        if (vc.provider) setVoiceProvider(vc.provider);
        if (vc.speed) setVoiceSpeed(vc.speed);
        setAmbient(amb);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(lang); }, [lang]);

  useEffect(() => {
    setVoicesLoading(true);
    fetchVoices(voiceProvider, lang)
      .then(setVoices)
      .catch((e) => toast.error(e.message))
      .finally(() => setVoicesLoading(false));
  }, [voiceProvider, lang]);

  const handleSelectVoice = async (voiceId: string) => {
    setSavingVoice(voiceId);
    try {
      const updated = await updateVoiceConfig({ provider: voiceProvider, voiceId, speed: voiceSpeed });
      setCurrentVoice({ provider: updated.provider, voice: updated.voice });
      toast.success('Voice updated');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingVoice(null);
    }
  };

  const handleToggleAmbient = async () => {
    setSavingAmbientToggle(true);
    try {
      const updated = await updateAmbientNoise({ enabled: !ambient.enabled }, lang);
      setAmbient(updated);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingAmbientToggle(false);
    }
  };

  const handleAmbientVolumeCommit = async (volume: number) => {
    try {
      const updated = await updateAmbientNoise({ volume }, lang);
      setAmbient(updated);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAmbientUpload = async (file: File) => {
    setUploadingAmbient(true);
    try {
      const { uploadUrl, storageKey } = await getAmbientNoiseUploadUrl(file.name, file.size, file.type || 'audio/wav', lang);
      const putRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'audio/wav' }, body: file });
      if (!putRes.ok) throw new Error('Upload to storage failed');
      const updated = await updateAmbientNoise({ storageKey, enabled: true }, lang);
      setAmbient(updated);
      toast.success('Ambient noise clip uploaded');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingAmbient(false);
    }
  };

  const handleGenerateFlow = async () => {
    if (!flowDescription.trim()) { toast.error('Describe what the call should do first'); return; }
    setGeneratingFlow(true);
    setFlowDraft(null);
    try {
      const draft = await generateCallFlow(flowDescription.trim());
      setFlowDraft(draft);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGeneratingFlow(false);
    }
  };

  const handleApplyFlow = async () => {
    if (!flowDraft) return;
    setApplyingFlow(true);
    try {
      await applyCallFlow(flowDraft, lang);
      toast.success('Call flow applied — reloading settings');
      setFlowDraft(null);
      setFlowDescription('');
      load(lang);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setApplyingFlow(false);
    }
  };

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
      setForm({ greeting: updated.greeting, persona: updated.persona, antiEarlyHangupEnabled: updated.antiEarlyHangupEnabled, checklistCopy: updated.checklistCopy, stylePackEnabled: updated.stylePackEnabled, aiAcknowledgementEnabled: updated.aiAcknowledgementEnabled });
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

      <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] space-y-4">
        <h3 className="font-semibold text-sm text-[var(--foreground)] flex items-center gap-2">
          <Sparkles size={15} className="text-[var(--primary)]" />
          Build a call flow from a description
        </h3>
        <p className="text-xs text-[var(--muted-foreground)] -mt-2">
          Describe what the call should accomplish. This replaces the qualifying questions and outcomes below — review the draft carefully before applying.
        </p>
        <textarea
          value={flowDescription}
          onChange={(e) => setFlowDescription(e.target.value)}
          className="w-full h-20 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 resize-none"
          placeholder="e.g. Call new leads, ask what property type and area they want, their budget and timeline, and book a site visit if they're ready within 3 months."
        />
        <button
          type="button"
          onClick={handleGenerateFlow}
          disabled={generatingFlow}
          className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {generatingFlow ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {generatingFlow ? 'Generating...' : 'Generate draft'}
        </button>

        {flowDraft && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4 space-y-3">
            <div className="flex items-start gap-2 text-amber-800 dark:text-amber-400">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <p className="text-xs">Review before applying — this replaces the live call flow's steps and outcomes. The persona/greeting below will also become the new settings above.</p>
            </div>

            <div>
              <p className="text-xs font-medium text-[var(--muted-foreground)] mb-0.5">Persona</p>
              <p className="text-sm text-[var(--foreground)]">{flowDraft.persona}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--muted-foreground)] mb-0.5">Greeting</p>
              <p className="text-sm text-[var(--foreground)]">{flowDraft.greeting}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1">Steps ({flowDraft.steps.length})</p>
              <div className="space-y-1.5">
                {flowDraft.steps.map((s) => (
                  <div key={s.key} className="text-xs bg-[var(--card)] rounded-md border border-[var(--border)] px-2.5 py-1.5">
                    <span className="font-medium text-[var(--foreground)]">{s.label}: </span>
                    <span className="text-[var(--muted-foreground)]">{s.prompt}</span>
                    {s.extract.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {s.extract.map((v) => (
                          <span key={v.name} className="inline-block px-1.5 py-0.5 rounded bg-[var(--accent)] text-[10px] text-[var(--muted-foreground)]">{v.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1">Outcomes ({flowDraft.outcomes.length})</p>
              <div className="space-y-1.5">
                {flowDraft.outcomes.map((o) => (
                  <div key={o.key} className="text-xs bg-[var(--card)] rounded-md border border-[var(--border)] px-2.5 py-1.5">
                    <span className="font-medium text-[var(--foreground)]">{o.label}</span>
                    <span className="text-[var(--muted-foreground)]"> — if {o.condition}</span>
                    <div className="text-[var(--muted-foreground)] mt-0.5">{o.closingPrompt}</div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleApplyFlow}
              disabled={applyingFlow}
              className="h-9 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {applyingFlow ? <RefreshCw size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {applyingFlow ? 'Applying...' : 'Apply to live call flow'}
            </button>
          </div>
        )}
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

      <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-[var(--foreground)] flex items-center gap-2">
            <Mic size={15} className="text-[var(--primary)]" />
            Voice
          </h3>
          {currentVoice.voice && (
            <span className="text-[11px] text-[var(--muted-foreground)]">
              Currently: <span className="font-medium text-[var(--foreground)]">{currentVoice.voice}</span> ({currentVoice.provider})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {VOICE_PROVIDERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setVoiceProvider(p)}
              className={`h-7 px-3 rounded-full text-xs font-medium capitalize transition-colors ${
                voiceProvider === p
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {voicesLoading ? (
          <div className="py-6 text-center text-[var(--muted-foreground)]"><RefreshCw size={16} className="animate-spin inline mr-2" />Loading voices...</div>
        ) : voices.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)] py-3">No voices available for {voiceProvider}.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {voices.map((v) => {
              const isCurrent = currentVoice.provider === voiceProvider && currentVoice.voice === v.voice_id;
              return (
                <button
                  key={v.voice_id}
                  type="button"
                  onClick={() => handleSelectVoice(v.voice_id)}
                  disabled={savingVoice === v.voice_id}
                  className={`text-left rounded-lg border px-3 py-2 transition-colors disabled:opacity-50 ${
                    isCurrent ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)] hover:border-[var(--primary)]/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--foreground)]">{v.name}</span>
                    {savingVoice === v.voice_id ? <RefreshCw size={12} className="animate-spin text-[var(--muted-foreground)]" /> : isCurrent ? <Check size={13} className="text-[var(--primary)]" /> : null}
                  </div>
                  <span className="text-[11px] text-[var(--muted-foreground)] capitalize">{[v.gender, v.accent].filter(Boolean).join(' · ') || ' '}</span>
                </button>
              );
            })}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Speed ({voiceSpeed.toFixed(2)}x)</label>
          <input
            type="range" min={0.5} max={1.5} step={0.05}
            value={voiceSpeed}
            onChange={(e) => setVoiceSpeed(Number(e.target.value))}
            onMouseUp={() => currentVoice.voice && handleSelectVoice(currentVoice.voice)}
            className="w-full"
          />
        </div>
      </div>

      <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 size={15} className="text-[var(--primary)]" />
            <div>
              <h3 className="font-semibold text-sm text-[var(--foreground)]">Ambient background noise</h3>
              <p className="text-[11px] text-[var(--muted-foreground)]">Faint background sound mixed under every call — kills the "silent room" feel</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleAmbient}
            disabled={savingAmbientToggle || !ambient.storageKey}
            title={!ambient.storageKey ? 'Upload a clip first' : undefined}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition-colors shrink-0 disabled:opacity-40 ${
              ambient.enabled
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-gray-100 dark:bg-gray-800 text-[var(--muted-foreground)]'
            }`}
          >
            {savingAmbientToggle ? <RefreshCw size={13} className="animate-spin" /> : ambient.enabled ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
            {ambient.enabled ? 'On' : 'Off'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[var(--border)] text-xs font-medium cursor-pointer hover:bg-[var(--accent)] transition-colors ${uploadingAmbient ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploadingAmbient ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
            {ambient.storageKey ? 'Replace clip' : 'Upload a clip'}
            <input
              type="file" accept="audio/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAmbientUpload(f); e.target.value = ''; }}
            />
          </label>
          {ambient.storageKey && <span className="text-[11px] text-[var(--muted-foreground)]">Clip uploaded</span>}
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Volume ({Math.round(ambient.volume * 100)}%)</label>
          <input
            type="range" min={0} max={1} step={0.05}
            value={ambient.volume}
            onChange={(e) => setAmbient((p) => ({ ...p, volume: Number(e.target.value) }))}
            onMouseUp={(e) => handleAmbientVolumeCommit(Number((e.target as HTMLInputElement).value))}
            className="w-full"
          />
        </div>
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
            <p className="text-sm font-medium text-[var(--foreground)]">Natural spoken-Telugu style</p>
            <p className="text-xs text-[var(--muted-foreground)]">Spoken-form word substitutions, varied acknowledgements, fillers, one-question-per-turn, no reading captured details back</p>
          </div>
          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, stylePackEnabled: !p.stylePackEnabled }))}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition-colors shrink-0 ml-3 ${
              form.stylePackEnabled
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-gray-100 dark:bg-gray-800 text-[var(--muted-foreground)]'
            }`}
          >
            {form.stylePackEnabled ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
            {form.stylePackEnabled ? 'On' : 'Off'}
          </button>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">AI disclosure</p>
            <p className="text-xs text-[var(--muted-foreground)]">Appends "AI" to the agent's name and answers honestly if directly asked</p>
          </div>
          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, aiAcknowledgementEnabled: !p.aiAcknowledgementEnabled }))}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition-colors shrink-0 ml-3 ${
              form.aiAcknowledgementEnabled
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-gray-100 dark:bg-gray-800 text-[var(--muted-foreground)]'
            }`}
          >
            {form.aiAcknowledgementEnabled ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
            {form.aiAcknowledgementEnabled ? 'On' : 'Off'}
          </button>
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
