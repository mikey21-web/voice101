import { useState, useEffect } from 'react';
import {
  fetchVoiceEmployee, updateVoiceEmployee, publishVoiceEmployee, fetchVoiceEmployeeVersions,
  restoreVoiceEmployeeVersion, testCallVoiceEmployee, fetchVoiceTrainingExamples, VoiceEmployee, VoiceEmployeeSection,
  VoiceEmployeeVariable, VoiceEmployeeVersion,
} from '../lib/data';
import { ArrowLeft, Plus, Trash2, Rocket, Loader2, Save, History, PhoneCall, GripVertical, ToggleLeft, ToggleRight, Mic, BookOpen, Users } from 'lucide-react';
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
  const [trainingExamples, setTrainingExamples] = useState<any[]>([]);
  const [swaraInput, setSwaraInput] = useState('');
  const [swaraLoading, setSwaraLoading] = useState(false);

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
      fetchVoiceTrainingExamples(id).then(setTrainingExamples).catch(() => {});
    }).catch((err) => toast.error(err.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await updateVoiceEmployee(id, {
        name, role, welcomeMessage, agentInformation, callEndRules,
        stylePackEnabled, aiAcknowledgementEnabled,
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
    if (!swaraInput.trim()) return;
    setSwaraLoading(true);
    try {
      const suggestions = generateSwaraSuggestions(swaraInput);
      toast.success(`${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'} applied. Review and save.`);
      setSwaraInput('');
    } catch (e: any) { toast.error(e.message); }
    finally { setSwaraLoading(false); }
  };

  const generateSwaraSuggestions = (input: string) => {
    const lower = input.toLowerCase();
    const suggestions: any[] = [];

    if (lower.includes('friendly') || lower.includes('warm')) {
      setAgentInformation((prev) => prev + '\n• Keep the tone warm and friendly, like talking to a friend.');
      suggestions.push('Tone updated to friendly');
    }
    if (lower.includes('urgent') || lower.includes('hurry')) {
      setCallEndRules((prev) => prev + '\n• Mention urgency or limited-time offer before closing.');
      suggestions.push('Added urgency to call-end rules');
    }
    if (lower.includes('budget') || lower.includes('price')) {
      if (!variables.find((v) => v.key === 'budget')) {
        setVariables((prev) => [...prev, { key: 'budget', label: 'Budget range', source: 'capture', required: false, extractHint: null }]);
        suggestions.push('Added budget capture variable');
      }
    }
    if (lower.includes('knowledge') || lower.includes('faq')) {
      setKnowledgeBase('Q: What are your hours?\nA: 9am-6pm, Monday to Saturday.\n\nQ: Do you offer discounts?\nA: Yes, special offers for first-time customers.');
      suggestions.push('Added sample knowledge base');
    }
    if (lower.includes('strict') || lower.includes('follow script')) {
      setScriptStrictness(5);
      suggestions.push('Set script adherence to strict');
    }
    if (lower.includes('flexible') || lower.includes('natural')) {
      setScriptStrictness(1);
      suggestions.push('Set script adherence to flexible');
    }

    return suggestions.length > 0 ? suggestions : ['No changes detected — try "make it friendlier" or "add urgency"'];
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
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <button onClick={() => { window.location.hash = '/voice-employees'; }} className="h-10 w-10 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors shrink-0 -ml-2">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">{employee.name}</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-2">
              {employee.status} {employee.isPublished && `· rev ${employee.revision}`}
              {employee.hasUnpublishedChanges && <span className="text-amber-600 dark:text-amber-400"> · unsaved</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleShowVersions} className="h-10 px-4 rounded-lg text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors flex items-center gap-2">
            <History size={16} /> Versions
          </button>
          <button onClick={handleSave} disabled={saving} className="h-10 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
          </button>
          <button onClick={handlePublish} disabled={publishing} className="h-10 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2">
            {publishing ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />} Publish
          </button>
        </div>
      </div>

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
  );
}
