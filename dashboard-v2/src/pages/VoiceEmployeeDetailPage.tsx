import { useState, useEffect } from 'react';
import {
  fetchVoiceEmployee, updateVoiceEmployee, publishVoiceEmployee, fetchVoiceEmployeeVersions,
  restoreVoiceEmployeeVersion, testCallVoiceEmployee, fetchVoiceTrainingExamples, fetchVoices,
  editVoiceEmployeeFlow,
  fetchEmployeeWebhook, updateEmployeeWebhook, rotateWebhookSecret, revealWebhookSecret, fetchWebhookEvents,
  fetchPreVariables, savePreVariables, fetchDialerSettings, saveDialerSettings,
  VoiceEmployee, VoiceEmployeeSection, VoiceEmployeeVariable, VoiceEmployeeVersion, VoiceOption, VOICE_PROVIDERS,
} from '../lib/data';
import { ArrowLeft, Plus, Trash2, Rocket, Loader2, Save, History, PhoneCall, GripVertical, ToggleLeft, ToggleRight, Mic, BookOpen, Users, Check, Sparkles, Link, Eye, EyeOff, RefreshCw, Clock, List } from 'lucide-react';
import toast from 'react-hot-toast';

function getEmployeeIdFromHash(): string | null {
  const m = window.location.hash.match(/\/voice-employees\/([^/]+)/);
  return m ? m[1] : null;
}

let sectionKeyCounter = 0;
const newSectionKey = () => `section_${Date.now()}_${sectionKeyCounter++}`;

export default function VoiceEmployeeDetailPage() {
  const [id, setId] = useState<string | null>(getEmployeeIdFromHash());
  const [employee, setEmployee] = useState<VoiceEmployee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [versions, setVersions] = useState<VoiceEmployeeVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [testNumber, setTestNumber] = useState('');
  const [testingCall, setTestingCall] = useState(false);

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [agentInformation, setAgentInformation] = useState('');
  const [callEndRules, setCallEndRules] = useState('');
  const [stylePackEnabled, setStylePackEnabled] = useState(true);
  const [aiAcknowledgementEnabled, setAiAcknowledgementEnabled] = useState(true);
  const [sections, setSections] = useState<VoiceEmployeeSection[]>([]);
  const [variables, setVariables] = useState<VoiceEmployeeVariable[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState('');
  const [scriptStrictness, setScriptStrictness] = useState(2);
  const [maxConcurrentCalls, setMaxConcurrentCalls] = useState(5);
  const [maxCallDurationS, setMaxCallDurationS] = useState(300);
  const [callTimeoutMessage, setCallTimeoutMessage] = useState('');
  const [recordingNotice, setRecordingNotice] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);
  const [trainingExamples, setTrainingExamples] = useState<any[]>([]);
  const [swaraInput, setSwaraInput] = useState('');
  const [swaraLoading, setSwaraLoading] = useState(false);

  // Webhook
  const [webhook, setWebhook] = useState<any>(null);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [webhookEvents, setWebhookEvents] = useState<any[]>([]);

  // Pre-variables
  const [preVars, setPreVars] = useState<any[]>([]);
  const [preVarsSaving, setPreVarsSaving] = useState(false);

  // Dialer settings
  const [dialer, setDialer] = useState<any>(null);
  const [dialerSaving, setDialerSaving] = useState(false);

  const [voiceProvider, setVoiceProvider] = useState('smallest');
  const [voiceId, setVoiceId] = useState('');
  const [voiceName, setVoiceName] = useState('');
  const [ttsSpeed, setTtsSpeed] = useState(1);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);

  useEffect(() => {
    const onHashChange = () => setId(getEmployeeIdFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const load = () => {
    if (!id) return;
    setLoading(true);
    fetchVoiceEmployee(id).then((e) => {
      setEmployee(e);
      setName(e.name); setRole(e.role);
      setWelcomeMessage(e.welcomeMessage || ''); setAgentInformation(e.agentInformation || ''); setCallEndRules(e.callEndRules || '');
      setStylePackEnabled(e.stylePackEnabled); setAiAcknowledgementEnabled(e.aiAcknowledgementEnabled);
      setSections(e.sections.map((s) => ({ ...s })));
      setVariables(e.variables.map((v) => ({ ...v })));
      setVoiceProvider(e.voiceProvider || 'smallest');
      setVoiceId(e.voiceId || '');
      setVoiceName(e.voiceName || '');
      setTtsSpeed(e.ttsSpeed ?? 1);
      setMaxCallDurationS(e.maxCallDurationS ?? 300);
      setCallTimeoutMessage(e.callTimeoutMessage || '');
      setRecordingNotice(e.recordingNotice ?? false);
      setDeveloperMode((e as any).developerMode ?? false);
      fetchVoiceTrainingExamples(id).then(setTrainingExamples).catch(() => {});
      fetchEmployeeWebhook(id).then(setWebhook).catch(() => {});
      fetchWebhookEvents(id).then(setWebhookEvents).catch(() => {});
      fetchPreVariables(id).then(setPreVars).catch(() => {});
      fetchDialerSettings(id).then(setDialer).catch(() => {});
    }).catch((err) => toast.error(err.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    setVoicesLoading(true);
    fetchVoices(voiceProvider)
      .then(setVoices)
      .catch((e) => toast.error(e.message))
      .finally(() => setVoicesLoading(false));
  }, [voiceProvider]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await updateVoiceEmployee(id, {
        name, role, welcomeMessage, agentInformation, callEndRules,
        stylePackEnabled, aiAcknowledgementEnabled,
        voiceProvider, voiceId, voiceName, ttsSpeed,
        maxCallDurationS, callTimeoutMessage, recordingNotice, developerMode,
        sections: sections.map((s, i) => ({ ...s, order: i + 1 })),
        variables,
      });
      setEmployee(updated);
      toast.success('Draft saved');
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handlePublish = async () => {
    if (!id) return;
    setPublishing(true);
    try {
      await handleSave();
      const updated = await publishVoiceEmployee(id);
      setEmployee(updated);
      toast.success('Published — live on the phone');
    } catch (e: any) { toast.error(e.message); }
    finally { setPublishing(false); }
  };

  const loadVersions = () => {
    if (!id) return;
    fetchVoiceEmployeeVersions(id).then(setVersions).catch((e) => toast.error(e.message));
  };
  const handleShowVersions = () => { setShowVersions((v) => !v); if (!showVersions) loadVersions(); };

  const handleRestore = async (revision: number) => {
    if (!id) return;
    if (!confirm(`Restore revision ${revision} as the current draft? You'll still need to publish it.`)) return;
    try { await restoreVoiceEmployeeVersion(id, revision); toast.success('Restored as draft'); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleTestCall = async () => {
    if (!id || !testNumber.trim()) return;
    setTestingCall(true);
    try {
      const r = await testCallVoiceEmployee(id, testNumber.trim());
      toast.success(r.success ? `Calling — run ${r.callSid}` : 'Call failed');
    } catch (e: any) { toast.error(e.message); }
    finally { setTestingCall(false); }
  };

  const handleSwaraUpdate = async () => {
    if (!id || !swaraInput.trim()) return;
    setSwaraLoading(true);
    try {
      const result = await editVoiceEmployeeFlow(id, swaraInput.trim());
      setSections(result.sections.map((s, i) => ({ ...s, order: i + 1 })));
      toast.success('AI rewrote the flow. Review below, then Save + Publish to go live.');
      setSwaraInput('');
    } catch (e: any) { toast.error(e.message); }
    finally { setSwaraLoading(false); }
  };

  const addSection = () => {
    setSections((prev) => [...prev, { sectionKey: newSectionKey(), label: 'New step', prompt: '', order: prev.length + 1, enabled: true, edges: [] }]);
  };
  const updateSection = (idx: number, patch: Partial<VoiceEmployeeSection>) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };
  const removeSection = (idx: number) => setSections((prev) => prev.filter((_, i) => i !== idx));
  const moveSection = (idx: number, dir: -1 | 1) => {
    setSections((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const addVariable = () => setVariables((prev) => [...prev, { key: '', label: '', source: 'capture', required: false, extractHint: null }]);
  const updateVariable = (idx: number, patch: Partial<VoiceEmployeeVariable>) => {
    setVariables((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  };
  const removeVariable = (idx: number) => setVariables((prev) => prev.filter((_, i) => i !== idx));

  if (loading) return <div className="p-10 text-center text-[var(--muted-foreground)]"><Loader2 size={20} className="animate-spin inline mr-2" />Loading...</div>;
  if (!employee) return <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">Employee not found.</div>;

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-lg font-bold text-white">{employee.name[0]?.toUpperCase()}</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{employee.name}</h1>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${employee.isPublished ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-600 ring-1 ring-amber-200'}`}>{employee.isPublished ? 'Ready' : 'Draft'}</span>
                {employee.isPublished && <span className="text-xs text-gray-400">· {employee.mode || 'instant'}</span>}
              </div>
              <p className="mt-0.5 text-sm text-gray-500">{employee.role} · Joined {new Date(employee.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} · {employee.sections?.length || 0} steps</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href="#/talk-to-employee" className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"><Mic size={14} /> Talk</a>
            <button onClick={() => { window.location.hash = `/voice-employees/${employee.id}#chat`; }} className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">💬 Chat</button>
            <button onClick={handleTestCall} disabled={testingCall || !employee.isPublished} className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-50">📞 Test call</button>
            <span className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm text-gray-500">Paused <span className="h-4 w-8 rounded-full bg-gray-200" /></span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4 text-xs">
          {['Overview','Instant leads','Call script','Training','Actions','Outcomes','Voice','Settings'].map((t) => (
            <span key={t} className={`rounded-full px-3 py-1 font-medium ${t === 'Call script' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{t}</span>
          ))}
        </div>
      </div>
      {employee.hasUnpublishedChanges && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-amber-800">⚠ You changed how {employee.name} works — these edits aren't on live calls yet.</span>
          <span className="flex items-center gap-2">
            <button onClick={handlePublish} disabled={publishing} className="flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
              {publishing ? <Loader2 size={16} className="animate-spin" /> : '↗'} Apply to live calls
            </button>
            <button onClick={load} className="rounded-full border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">↺ Undo changes</button>
          </span>
        </div>
      )}

      <div className="space-y-8">

      {showVersions && (
        <div className="border-t border-[var(--border)] pt-6">
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Publish history</h3>
          {versions.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No published versions yet.</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                  <div>
                    <span className="text-sm font-medium text-[var(--foreground)]">Revision {v.revision}</span>
                    <p className="text-xs text-[var(--muted-foreground)]">{new Date(v.createdAt).toLocaleString()}</p>
                  </div>
                  <button onClick={() => handleRestore(v.revision)} className="px-3 py-1.5 rounded-lg text-xs text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">Restore</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--foreground)]">Identity</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Role</label>
            <input value={role} onChange={(e) => setRole(e.target.value)} className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Greeting</label>
          <textarea value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} rows={2}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] resize-none" placeholder="Hi {{first_name}}, this is..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Persona &amp; instructions</label>
          <textarea value={agentInformation} onChange={(e) => setAgentInformation(e.target.value)} rows={3}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Call-end rules</label>
          <textarea value={callEndRules} onChange={(e) => setCallEndRules(e.target.value)} rows={2}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] resize-none" />
        </div>
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm font-medium text-[var(--foreground)]">Natural spoken-Telugu style</span>
          <button type="button" onClick={() => setStylePackEnabled((v) => !v)} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium ${stylePackEnabled ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-[var(--muted-foreground)]'}`}>
            {stylePackEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />} {stylePackEnabled ? 'On' : 'Off'}
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--foreground)]">Edit with AI</h2>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">Describe the change in plain English — the AI rewrites the whole flow, which you review before publishing.</p>
        <div className="flex gap-2">
          <input
            value={swaraInput}
            onChange={(e) => setSwaraInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSwaraUpdate(); }}
            placeholder='e.g. "make the agent female, say numbers in English words, never call anyone sir or ma-am"'
            className="flex-1 h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]"
          />
          <button onClick={handleSwaraUpdate} disabled={swaraLoading || !swaraInput.trim()}
            className="h-10 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2 shrink-0">
            {swaraLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Rewrite
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--foreground)]">Call flow</h2>
          <button onClick={addSection} className="h-10 px-3 rounded-lg text-[var(--primary)] text-sm font-medium hover:bg-[var(--primary)]/10 transition-colors flex items-center gap-1.5">
            <Plus size={16} /> Add step
          </button>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">Steps run in order. A step with no "next" closes the call. Set conditions to branch.</p>
        {sections.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">No steps yet. Add one to build your call flow.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sections.map((section, idx) => (
              <div key={section.sectionKey} className="border border-[var(--border)] rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <GripVertical size={16} className="text-[var(--muted-foreground)] shrink-0" />
                  <input value={section.label} onChange={(e) => updateSection(idx, { label: e.target.value })}
                    className="flex-1 text-sm font-medium bg-transparent border-0 p-0 text-[var(--foreground)] placeholder-[var(--muted-foreground)]" placeholder="Step label" />
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveSection(idx, -1)} disabled={idx === 0} className="h-8 w-8 rounded text-xs text-[var(--muted-foreground)] disabled:opacity-20 hover:bg-[var(--accent)]">↑</button>
                    <button onClick={() => moveSection(idx, 1)} disabled={idx === sections.length - 1} className="h-8 w-8 rounded text-xs text-[var(--muted-foreground)] disabled:opacity-20 hover:bg-[var(--accent)]">↓</button>
                    <button onClick={() => removeSection(idx)} className="h-8 w-8 rounded text-[var(--muted-foreground)] hover:text-rose-600"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Prompt</label>
                  <textarea value={section.prompt} onChange={(e) => updateSection(idx, { prompt: e.target.value })} rows={2}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] resize-none" placeholder="What should the agent do in this step?" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Next step key</label>
                    <input
                      value={section.edges[0]?.to_key || ''}
                      onChange={(e) => updateSection(idx, { edges: e.target.value ? [{ to_key: e.target.value, condition: section.edges[0]?.condition || 'once done' }] : [] })}
                      placeholder="blank = closes call"
                      className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Condition</label>
                    <input
                      value={section.edges[0]?.condition || ''}
                      onChange={(e) => updateSection(idx, { edges: [{ to_key: section.edges[0]?.to_key || '', condition: e.target.value }] })}
                      placeholder="e.g. 'after they answer'"
                      className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)]"
                    />
                  </div>
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">Key: <code className="bg-[var(--accent)] px-2 py-1 rounded">{section.sectionKey}</code></p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--foreground)]">Data &amp; Knowledge</h2>
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-[var(--foreground)]">Variables to capture</label>
              <button onClick={addVariable} className="text-[var(--primary)] text-sm font-medium hover:opacity-75 flex items-center gap-1">
                <Plus size={14} /> Add
              </button>
            </div>
            {variables.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">No structured data to capture. Agent will converse naturally.</p>
            ) : (
              <div className="space-y-2">
                {variables.map((v, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input value={v.key} onChange={(e) => updateVariable(idx, { key: e.target.value.replace(/\s+/g, '_').toLowerCase() })} placeholder="key"
                      className="w-24 h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)]" />
                    <input value={v.label} onChange={(e) => updateVariable(idx, { label: e.target.value })} placeholder="What to capture"
                      className="flex-1 h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)]" />
                    <select value={v.source} onChange={(e) => updateVariable(idx, { source: e.target.value as 'pre' | 'capture' })}
                      className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)]">
                      <option value="capture">During</option>
                      <option value="pre">Before</option>
                    </select>
                    <button onClick={() => removeVariable(idx)} className="h-9 w-9 rounded-lg text-[var(--muted-foreground)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--border)] pt-6">
            <label className="block text-sm font-medium text-[var(--foreground)] mb-3">Knowledge base (Q &amp; A)</label>
            <textarea value={knowledgeBase} onChange={(e) => setKnowledgeBase(e.target.value)} rows={4}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] resize-none font-mono"
              placeholder='Q: What are your hours?&#10;A: 9am-6pm, Monday to Saturday&#10;&#10;Q: Do you offer delivery?&#10;A: Yes, free within the city' />
            <p className="text-xs text-[var(--muted-foreground)] mt-2">Format: Q: ... / A: ... (alternate lines)</p>
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-[var(--border)] pt-6">
        <h2 className="text-lg font-bold text-[var(--foreground)]">Configuration</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-3">Script adherence</label>
            <div className="space-y-3">
              <input type="range" min="1" max="5" value={scriptStrictness} onChange={(e) => setScriptStrictness(Number(e.target.value))}
                className="w-full h-2 bg-[var(--border)] rounded-lg appearance-none cursor-pointer" />
              <div className="flex justify-between text-xs">
                <span className="text-[var(--muted-foreground)]">Natural</span>
                <span className="font-medium text-[var(--foreground)]">{['Conversational', 'Natural', 'Balanced', 'Structured', 'Strict'][scriptStrictness - 1]}</span>
                <span className="text-[var(--muted-foreground)]">Strict</span>
              </div>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-3">How closely the agent follows your script sections.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-3">Max concurrent calls</label>
            <input type="number" min="1" max="100" value={maxConcurrentCalls} onChange={(e) => setMaxConcurrentCalls(Number(e.target.value))}
              className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] text-center" />
            <p className="text-xs text-[var(--muted-foreground)] mt-3">Higher = faster but more expensive.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Max call duration (seconds)</label>
            <input type="number" min="30" max="3600" value={maxCallDurationS} onChange={(e) => setMaxCallDurationS(Number(e.target.value))}
              className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" />
            <p className="text-xs text-[var(--muted-foreground)] mt-2">Hard timeout — the call hangs up politely at this limit.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Call timeout message</label>
            <textarea value={callTimeoutMessage} onChange={(e) => setCallTimeoutMessage(e.target.value)} rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] resize-none"
              placeholder="The agent's final line when the max duration is reached" />
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={recordingNotice} onChange={(e) => setRecordingNotice(e.target.checked)} className="accent-[var(--primary)] h-4 w-4" />
          <span className="text-sm text-[var(--foreground)]">Inform the caller they are being recorded</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={developerMode} onChange={(e) => setDeveloperMode(e.target.checked)} className="accent-[var(--primary)] h-4 w-4" />
          <span className="text-sm text-[var(--foreground)]">Developer mode — log full prompts and LLM outputs to console</span>
        </label>
      </section>

      <section className="space-y-4 border-t border-[var(--border)] pt-6">
        <h2 className="text-lg font-bold text-[var(--foreground)]">Voice</h2>
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
          <div className="py-6 text-center text-[var(--muted-foreground)]"><Loader2 size={16} className="animate-spin inline mr-2" />Loading voices...</div>
        ) : voices.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)] py-3">No voices available for {voiceProvider}.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {voices.map((v) => {
              const isCurrent = voiceId === v.voice_id;
              return (
                <button
                  key={v.voice_id}
                  type="button"
                  onClick={() => { setVoiceId(v.voice_id); setVoiceName(v.name); }}
                  className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                    isCurrent ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)] hover:border-[var(--primary)]/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--foreground)]">{v.name}</span>
                    {isCurrent ? <Check size={13} className="text-[var(--primary)]" /> : null}
                  </div>
                  <span className="text-[11px] text-[var(--muted-foreground)] capitalize">{[v.gender, v.accent].filter(Boolean).join(' · ') || ' '}</span>
                </button>
              );
            })}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Speed ({ttsSpeed.toFixed(2)}x)</label>
          <input type="range" min={0.5} max={1.5} step={0.05} value={ttsSpeed} onChange={(e) => setTtsSpeed(Number(e.target.value))} className="w-full" />
        </div>
      </section>

      {trainingExamples.length > 0 && (
        <section className="border-t border-[var(--border)] pt-6">
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Training applied ({trainingExamples.length})</h3>
          <div className="space-y-2">
            {trainingExamples.slice(0, 3).map((ex, i) => (
              <div key={i} className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase">Issue: {ex.issue}</p>
                <p className="text-xs text-[var(--foreground)] mt-1">Fix: {ex.correction}</p>
              </div>
            ))}
            {trainingExamples.length > 3 && <p className="text-xs text-emerald-700 dark:text-emerald-400">+ {trainingExamples.length - 3} more</p>}
          </div>
        </section>
      )}

      <section className="border-t border-[var(--border)] pt-6">
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-1">Actions &amp; tools</h2>
        <p className="text-sm text-[var(--muted-foreground)] mb-4">What the agent can do during and after a call. Tools with a gate need that integration connected first.</p>
        <div className="space-y-2">
          {(employee.actions?.length ? employee.actions : [
            { actionKey: 'end_call', label: 'End the call politely when the conversation is done', enabled: true, gated: false, gateReason: null },
            { actionKey: 'transfer_call', label: 'Transfer the call to a human teammate', enabled: false, gated: true, gateReason: 'telephony' },
            { actionKey: 'book_appointment', label: 'Book an appointment on a connected calendar', enabled: false, gated: true, gateReason: 'calendar integration' },
            { actionKey: 'send_whatsapp', label: 'Send a WhatsApp message after the call', enabled: false, gated: true, gateReason: 'WhatsApp integration' },
            { actionKey: 'custom_api', label: "Call a custom API you've configured", enabled: false, gated: false, gateReason: null },
          ]).map((a: any) => (
            <div key={a.actionKey} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">{a.label}</p>
                {a.gated && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Requires {a.gateReason}</p>
                )}
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${a.enabled ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                {a.enabled ? 'On' : a.gated ? 'Locked' : 'Off'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Lead Webhook ──────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)] pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">Lead Webhook</h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Paste this URL into your form or CRM — any hit triggers an outbound call.</p>
          </div>
          <button
            onClick={async () => { if (!id) return; const r = await updateEmployeeWebhook(id, !webhook?.enabled); setWebhook(r); }}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${webhook?.enabled ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >{webhook?.enabled ? 'Enabled' : 'Disabled'}</button>
        </div>
        {webhook?.url && (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <Link size={13} className="text-[var(--muted-foreground)] shrink-0" />
            <code className="flex-1 truncate text-xs text-[var(--foreground)]">{webhook.url}</code>
            <button onClick={() => navigator.clipboard.writeText(webhook.url)} className="text-xs text-violet-600 hover:underline">Copy</button>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <button onClick={async () => { if (!id) return; const r = await revealWebhookSecret(id); setWebhookSecret(r.secret); setShowSecret(true); }}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--hover)]">
            <Eye size={12} /> Reveal secret
          </button>
          <button onClick={async () => { if (!id) return; const r = await rotateWebhookSecret(id); setWebhookSecret(r.secret); setShowSecret(true); toast.success('Secret rotated'); }}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--hover)]">
            <RefreshCw size={12} /> Rotate secret
          </button>
        </div>
        {showSecret && webhookSecret && (
          <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
            <code className="flex-1 text-xs text-violet-800 break-all">{webhookSecret}</code>
            <button onClick={() => setShowSecret(false)} className="shrink-0"><EyeOff size={12} /></button>
          </div>
        )}
        {webhookEvents.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-[var(--muted-foreground)] hover:text-[var(--foreground)]">Recent events ({webhookEvents.length})</summary>
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {webhookEvents.slice(0, 10).map((ev, i) => (
                <div key={i} className={`flex items-center gap-2 rounded px-2 py-1 ${ev.status === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  <span className="font-medium">{ev.eventType}</span>
                  <span className="text-[10px] opacity-70">{new Date(ev.createdAt).toLocaleString()}</span>
                  {ev.errorMsg && <span className="ml-auto">{ev.errorMsg}</span>}
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      {/* ─── Pre-variables ─────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)] pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">Pre-call variables</h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Values injected into the call context before dialling — use <code className="text-xs bg-gray-100 px-1 rounded">{"{{key}}"}</code> in your script.</p>
          </div>
          <button onClick={() => setPreVars((p) => [...p, { key: '', value: '', label: '' }])}
            className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--hover)]">
            <Plus size={12} /> Add
          </button>
        </div>
        {preVars.map((v, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 items-center">
            <input value={v.key} onChange={(e) => setPreVars((p) => p.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
              placeholder="key (e.g. lead_source)" className="h-8 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-xs" />
            <input value={v.value} onChange={(e) => setPreVars((p) => p.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
              placeholder="default value" className="h-8 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-xs" />
            <button onClick={() => setPreVars((p) => p.filter((_, j) => j !== i))} className="h-8 w-8 flex items-center justify-center text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
          </div>
        ))}
        {preVars.length === 0 && <p className="text-xs text-[var(--muted-foreground)]">No pre-variables set.</p>}
        <button disabled={preVarsSaving} onClick={async () => { if (!id) return; setPreVarsSaving(true); try { await savePreVariables(id, preVars); toast.success('Saved'); } catch { toast.error('Save failed'); } finally { setPreVarsSaving(false); } }}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {preVarsSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save variables
        </button>
      </section>

      {/* ─── Dialer settings ───────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)] pt-6 space-y-4">
        <h2 className="text-lg font-bold text-[var(--foreground)]">Dialer settings</h2>
        {dialer && (
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'maxAttempts', label: 'Max attempts', type: 'number', min: 1, max: 10 },
              { key: 'retryDelayMinutes', label: 'Retry delay (minutes)', type: 'number', min: 5 },
              { key: 'callWindowStart', label: 'Call window start', type: 'time' },
              { key: 'callWindowEnd', label: 'Call window end', type: 'time' },
            ].map(({ key, label, type, min, max }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">{label}</label>
                <input type={type} min={min} max={max} value={dialer[key] ?? ''} onChange={(e) => setDialer((d: any) => ({ ...d, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                  className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" />
              </div>
            ))}
            <div className="col-span-2 flex items-center gap-3">
              <input type="checkbox" id="skipWeekends" checked={dialer.skipWeekends ?? false} onChange={(e) => setDialer((d: any) => ({ ...d, skipWeekends: e.target.checked }))} className="h-4 w-4 rounded" />
              <label htmlFor="skipWeekends" className="text-sm text-[var(--foreground)]">Skip weekends</label>
            </div>
          </div>
        )}
        <button disabled={dialerSaving} onClick={async () => { if (!id || !dialer) return; setDialerSaving(true); try { await saveDialerSettings(id, dialer); toast.success('Saved'); } catch { toast.error('Save failed'); } finally { setDialerSaving(false); } }}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {dialerSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save dialer settings
        </button>
      </section>

      <section className="border-t border-[var(--border)] pt-6">
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">Test call</h2>
        {!employee.isPublished && <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">Publish first to test.</p>}
        <div className="flex gap-2">
          <input value={testNumber} onChange={(e) => setTestNumber(e.target.value)} placeholder="+91XXXXXXXXXX"
            className="flex-1 h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" />
          <button onClick={handleTestCall} disabled={testingCall || !employee.isPublished}
            className="h-10 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2">
            {testingCall ? <Loader2 size={16} className="animate-spin" /> : <PhoneCall size={16} />} Call
          </button>
        </div>
      </section>
      </div>
    </div>
  );
}
