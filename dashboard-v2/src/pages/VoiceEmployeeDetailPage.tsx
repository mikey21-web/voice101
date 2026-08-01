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
    <div className="flex gap-6 animate-fade-in">
    <div className="space-y-6 flex-1">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <button onClick={() => { window.location.hash = '/voice-employees'; }} className="h-9 w-9 rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors shrink-0 mt-0.5">
            <ArrowLeft size={14} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">{employee.name}</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
              {employee.status} · {employee.isPublished ? `published rev ${employee.revision}` : 'never published'}
              {employee.hasUnpublishedChanges && <span className="text-amber-600 dark:text-amber-400"> · unpublished changes</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleShowVersions} className="h-9 px-3 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1.5">
            <History size={14} /> Versions
          </button>
          <button onClick={handleSave} disabled={saving} className="h-9 px-3 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1.5 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save draft
          </button>
          <button onClick={handlePublish} disabled={publishing} className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5">
            {publishing ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />} Publish
          </button>
        </div>
      </div>

      {showVersions && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-2">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Publish history</h3>
          {versions.length === 0 ? (
            <p className="text-xs text-[var(--muted-foreground)]">No published versions yet.</p>
          ) : versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
              <span className="text-sm text-[var(--foreground)]">Revision {v.revision}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted-foreground)]">{new Date(v.createdAt).toLocaleString()}</span>
                <button onClick={() => handleRestore(v.revision)} className="h-7 px-2.5 rounded-md border border-[var(--border)] text-xs text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">Restore</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] space-y-4">
        <h3 className="font-semibold text-sm text-[var(--foreground)]">Identity</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Role</label>
            <input value={role} onChange={(e) => setRole(e.target.value)} className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Greeting</label>
          <textarea value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} rows={2}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] resize-none" placeholder="Hi {{first_name}}, this is..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Persona &amp; instructions</label>
          <textarea value={agentInformation} onChange={(e) => setAgentInformation(e.target.value)} rows={3}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Call-end rules</label>
          <textarea value={callEndRules} onChange={(e) => setCallEndRules(e.target.value)} rows={2}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] resize-none" />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
          <span className="text-sm font-medium text-[var(--foreground)]">Natural spoken-Telugu style</span>
          <button type="button" onClick={() => setStylePackEnabled((v) => !v)} className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium ${stylePackEnabled ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-[var(--muted-foreground)]'}`}>
            {stylePackEnabled ? <ToggleRight size={13} /> : <ToggleLeft size={13} />} {stylePackEnabled ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-[var(--foreground)]">Call flow — sections</h3>
          <button onClick={addSection} className="h-8 px-3 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1.5">
            <Plus size={12} /> Add step
          </button>
        </div>
        <p className="text-[11px] text-[var(--muted-foreground)] -mt-1">A step with no "next" is a closing step. Steps run in order unless you set a condition.</p>
        {sections.map((section, idx) => (
          <div key={section.sectionKey} className="rounded-lg border border-[var(--border)] p-3 space-y-2">
            <div className="flex items-center gap-2">
              <GripVertical size={14} className="text-[var(--muted-foreground)] shrink-0" />
              <input value={section.label} onChange={(e) => updateSection(idx, { label: e.target.value })}
                className="flex-1 h-8 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-sm font-medium text-[var(--foreground)]" placeholder="Step label" />
              <button onClick={() => moveSection(idx, -1)} disabled={idx === 0} className="h-8 w-8 rounded-md border border-[var(--border)] text-xs text-[var(--muted-foreground)] disabled:opacity-30 hover:bg-[var(--accent)]">↑</button>
              <button onClick={() => moveSection(idx, 1)} disabled={idx === sections.length - 1} className="h-8 w-8 rounded-md border border-[var(--border)] text-xs text-[var(--muted-foreground)] disabled:opacity-30 hover:bg-[var(--accent)]">↓</button>
              <button onClick={() => removeSection(idx)} className="h-8 w-8 rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:text-rose-600 hover:border-rose-300"><Trash2 size={12} /></button>
            </div>
            <textarea value={section.prompt} onChange={(e) => updateSection(idx, { prompt: e.target.value })} rows={2}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--foreground)] resize-none" placeholder="What should the agent do in this step?" />
            <div className="flex items-center gap-2">
              <input
                value={section.edges[0]?.to_key || ''}
                onChange={(e) => updateSection(idx, { edges: e.target.value ? [{ to_key: e.target.value, condition: section.edges[0]?.condition || 'once done' }] : [] })}
                placeholder="next step key (blank = closing step)"
                className="flex-1 h-7 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-[11px] text-[var(--foreground)]"
              />
              <input
                value={section.edges[0]?.condition || ''}
                onChange={(e) => updateSection(idx, { edges: [{ to_key: section.edges[0]?.to_key || '', condition: e.target.value }] })}
                placeholder="condition, e.g. 'after they answer'"
                className="flex-1 h-7 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-[11px] text-[var(--foreground)]"
              />
            </div>
            <p className="text-[10px] text-[var(--muted-foreground)]">Step key: <code>{section.sectionKey}</code></p>
          </div>
        ))}
        {sections.length === 0 && <p className="text-xs text-[var(--muted-foreground)] text-center py-4">No steps yet — add one to build the call flow.</p>}
      </div>

      <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-[var(--foreground)]">Data to capture</h3>
          <button onClick={addVariable} className="h-8 px-3 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1.5">
            <Plus size={12} /> Add variable
          </button>
        </div>
        {variables.map((v, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <input value={v.key} onChange={(e) => updateVariable(idx, { key: e.target.value.replace(/\s+/g, '_').toLowerCase() })} placeholder="key"
              className="w-1/4 h-8 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)]" />
            <input value={v.label} onChange={(e) => updateVariable(idx, { label: e.target.value })} placeholder="What this captures"
              className="flex-1 h-8 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)]" />
            <select value={v.source} onChange={(e) => updateVariable(idx, { source: e.target.value as 'pre' | 'capture' })}
              className="h-8 rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 text-xs text-[var(--foreground)]">
              <option value="capture">During call</option>
              <option value="pre">Before call</option>
            </select>
            <button onClick={() => removeVariable(idx)} className="h-8 w-8 rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:text-rose-600 hover:border-rose-300 shrink-0"><Trash2 size={12} /></button>
          </div>
        ))}
        {variables.length === 0 && <p className="text-xs text-[var(--muted-foreground)] text-center py-2">No variables — the agent won't capture structured data from calls.</p>}
      </div>

      <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] space-y-3">
        <h3 className="font-semibold text-sm text-[var(--foreground)] flex items-center gap-2"><BookOpen size={14} className="text-[var(--primary)]" /> Knowledge base</h3>
        <textarea value={knowledgeBase} onChange={(e) => setKnowledgeBase(e.target.value)} rows={3}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] resize-none font-mono"
          placeholder='Q: What are your hours? A: 9am-6pm, Mon-Sat&#10;Q: Do you offer delivery? A: Yes, free within the city' />
        <p className="text-[10px] text-[var(--muted-foreground)]">Format: Q: ... / A: ... (one per line pair)</p>
      </div>

      <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] space-y-4">
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-[var(--foreground)]">How strictly does the agent follow the script?</h3>
          <p className="text-[10px] text-[var(--muted-foreground)]">Left = more natural & improvises freely. Right = sticks to sections exactly, in order, adds nothing that isn't written.</p>
        </div>
        <div className="space-y-2">
          <input type="range" min="1" max="5" value={scriptStrictness} onChange={(e) => setScriptStrictness(Number(e.target.value))}
            className="w-full h-2 bg-[var(--border)] rounded-lg appearance-none cursor-pointer" />
          <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
            <span>Flexible</span>
            <span className="font-medium">{['Conversational', 'Natural', 'Balanced', 'Structured', 'Strict'][scriptStrictness - 1]}</span>
            <span>Strict</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-[var(--foreground)] flex items-center gap-2"><Users size={14} /> Max concurrent calls</h3>
          <input type="number" min="1" max="100" value={maxConcurrentCalls} onChange={(e) => setMaxConcurrentCalls(Number(e.target.value))}
            className="w-20 h-8 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)] text-center" />
        </div>
        <p className="text-[10px] text-[var(--muted-foreground)]">How many calls at the same time during campaigns. Higher = faster but more expensive.</p>
      </div>

      {trainingExamples.length > 0 && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/40 p-5 space-y-3">
          <h3 className="font-semibold text-sm text-emerald-900 dark:text-emerald-300">Training examples applied ({trainingExamples.length})</h3>
          <div className="space-y-2">
            {trainingExamples.slice(0, 3).map((ex, i) => (
              <div key={i} className="rounded-lg bg-white dark:bg-emerald-900/20 p-2 border border-emerald-200 dark:border-emerald-900/40">
                <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 uppercase">Issue: {ex.issue}</p>
                <p className="text-xs text-[var(--foreground)] mt-1">Fix: {ex.correction}</p>
              </div>
            ))}
            {trainingExamples.length > 3 && <p className="text-[10px] text-emerald-700 dark:text-emerald-400">+ {trainingExamples.length - 3} more</p>}
          </div>
        </div>
      )}

      <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] space-y-3">
        <h3 className="font-semibold text-sm text-[var(--foreground)] flex items-center gap-2"><PhoneCall size={14} className="text-[var(--primary)]" /> Test call</h3>
        {!employee.isPublished && <p className="text-xs text-amber-600 dark:text-amber-400">Publish this employee before test-calling it.</p>}
        <div className="flex gap-2">
          <input value={testNumber} onChange={(e) => setTestNumber(e.target.value)} placeholder="+91XXXXXXXXXX"
            className="flex-1 h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" />
          <button onClick={handleTestCall} disabled={testingCall || !employee.isPublished}
            className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2">
            {testingCall ? <Loader2 size={14} className="animate-spin" /> : <PhoneCall size={14} />} Call
          </button>
        </div>
      </div>
    </div>

    <div className="sticky top-6 h-fit w-80 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white p-5 shadow-lg space-y-4">
      <div className="flex items-center gap-2">
        <Mic size={16} className="animate-pulse" />
        <h3 className="font-bold text-sm">Swara</h3>
      </div>
      <p className="text-xs opacity-90">Just tell me what you want — speak or type, and I'll update the whole flow.</p>

      <div className="rounded-lg bg-white/10 p-3 space-y-2">
        <textarea
          value={swaraInput}
          onChange={(e) => setSwaraInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && handleSwaraUpdate()}
          placeholder="e.g. 'make the call friendlier' or 'add urgency before closing'"
          className="w-full h-20 rounded-lg bg-white/20 text-white text-xs placeholder-white/60 p-2 resize-none focus:bg-white/30 transition-colors"
        />
        <button
          onClick={handleSwaraUpdate}
          disabled={swaraLoading || !swaraInput.trim()}
          className="w-full h-8 rounded-lg bg-white text-purple-600 font-medium text-xs hover:bg-opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
        >
          {swaraLoading ? <Loader2 size={12} className="animate-spin" /> : <Mic size={12} />}
          Update script
        </button>
      </div>

      <div className="space-y-2 pt-2 border-t border-white/20">
        <button onClick={() => setSwaraInput('add urgency before closing')} className="w-full text-left px-2 py-1.5 text-xs hover:bg-white/10 rounded transition-colors">
          Add urgency before closing
        </button>
        <button onClick={() => setSwaraInput('make the whole call friendlier')} className="w-full text-left px-2 py-1.5 text-xs hover:bg-white/10 rounded transition-colors">
          Make the whole call friendlier
        </button>
        <button onClick={() => setSwaraInput('add a product to pitch')} className="w-full text-left px-2 py-1.5 text-xs hover:bg-white/10 rounded transition-colors">
          Add a product to pitch
        </button>
        <button onClick={() => setSwaraInput('handle a price objection')} className="w-full text-left px-2 py-1.5 text-xs hover:bg-white/10 rounded transition-colors">
          Handle a price objection
        </button>
      </div>
    </div>
    </div>
  );
}
