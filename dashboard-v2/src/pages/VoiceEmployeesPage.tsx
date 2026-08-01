import { useMemo, useState, useEffect } from 'react';
import {
  fetchVoiceEmployees, createVoiceEmployee, publishVoiceEmployee, activateVoiceEmployee,
  deactivateVoiceEmployee, deleteVoiceEmployee, generateVoiceEmployeeDraft,
  VoiceEmployee, GeneratedFlowDraft,
} from '../lib/data';
import { Users, Plus, Loader2, Rocket, Power, Trash2, X, ChevronRight, Sparkles, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

type StatusFilter = 'all' | 'active' | 'draft';

/** The core "My Employees" surface of the voice engine — list, create, publish, activate.
 * Mirrors Outpero's employee list: stat strip, status filters, and a "describe the call, we build
 * the flow" hire wizard instead of a bare form. */
export default function VoiceEmployeesPage() {
  const [employees, setEmployees] = useState<VoiceEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const load = () => {
    setLoading(true);
    fetchVoiceEmployees().then(setEmployees).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => employees.filter((e) => {
    if (statusFilter === 'active' && e.status !== 'active') return false;
    if (statusFilter === 'draft' && e.isPublished) return false;
    if (search.trim() && !`${e.name} ${e.role}`.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  }), [employees, statusFilter, search]);

  const activeCount = employees.filter((e) => e.status === 'active').length;
  const draftCount = employees.filter((e) => !e.isPublished).length;

  const handlePublish = async (id: string) => {
    setBusyId(id);
    try { await publishVoiceEmployee(id); toast.success('Published'); load(); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusyId(null); }
  };

  const handleToggleActive = async (emp: VoiceEmployee) => {
    setBusyId(emp.id);
    try {
      if (emp.status === 'active') { await deactivateVoiceEmployee(emp.id); toast.success('Deactivated'); }
      else { await activateVoiceEmployee(emp.id); toast.success('Activated'); }
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusyId(null); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}? This can't be undone.`)) return;
    setBusyId(id);
    try { await deleteVoiceEmployee(id); toast.success('Removed'); load(); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">My Employees</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">Voice agents you've hired. Each runs with its own script and phone number.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="h-10 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Plus size={16} /> Hire
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <StatCard label="Total" value={employees.length} hint={`${filtered.length} shown`} />
        <StatCard label="Active" value={activeCount} hint={`${employees.length - activeCount} paused`} />
        <StatCard label="Drafts" value={draftCount} hint="unpublished" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees..."
          className="flex-1 h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]"
        />
        <div className="flex gap-2">
          {(['all', 'active', 'draft'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === f ? 'bg-[var(--primary)] text-white' : 'bg-[var(--accent)] text-[var(--foreground)] hover:opacity-75'
              }`}
            >
              {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Draft'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-[var(--muted-foreground)]"><Loader2 size={20} className="animate-spin inline mr-2" />Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-[var(--muted-foreground)] mb-4">{employees.length === 0 ? 'No employees yet.' : 'No employees match this filter.'}</p>
          {employees.length === 0 && (
            <button onClick={() => setModalOpen(true)} className="inline-flex h-10 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90">
              <Plus size={16} className="mr-2" /> Hire your first employee
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((emp) => (
            <div
              key={emp.id}
              onClick={() => { window.location.hash = `/voice-employees/${emp.id}`; }}
              className="rounded-lg border border-[var(--border)] p-4 hover:bg-[var(--accent)]/50 cursor-pointer transition-colors space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-semibold flex-shrink-0">
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--foreground)] truncate">{emp.name}</p>
                  <p className="text-sm text-[var(--muted-foreground)] truncate">{emp.role}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${
                  emp.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-[var(--muted-foreground)]'
                }`}>
                  {emp.status === 'active' ? 'Active' : 'Paused'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center py-2 border-y border-[var(--border)]">
                <div>
                  <p className="text-lg font-bold text-[var(--foreground)]">{emp.sections?.length || 0}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Steps</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--foreground)]">{emp.variables?.length || 0}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Variables</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--foreground)]">{emp.isPublished ? `v${emp.revision}` : '—'}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{emp.isPublished ? 'Live' : 'Draft'}</p>
                </div>
              </div>

              {emp.hasUnpublishedChanges && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Unsaved changes</p>
              )}

              <div className="flex gap-1.5 pt-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handlePublish(emp.id)}
                  disabled={busyId === emp.id}
                  className="flex-1 h-9 rounded-lg bg-[var(--primary)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-1"
                >
                  {busyId === emp.id ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                </button>
                <button
                  onClick={() => handleToggleActive(emp)}
                  disabled={busyId === emp.id || !emp.isPublished}
                  title={!emp.isPublished ? 'Publish first' : undefined}
                  className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                    emp.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'hover:bg-[var(--accent)] text-[var(--muted-foreground)]'
                  } disabled:opacity-40`}
                >
                  <Power size={14} />
                </button>
                <button
                  onClick={() => handleDelete(emp.id, emp.name)}
                  disabled={busyId === emp.id}
                  className="h-9 w-9 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[var(--muted-foreground)] hover:text-rose-600 transition-colors flex items-center justify-center disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={() => setModalOpen(true)}
            className="rounded-lg border-2 border-dashed border-[var(--border)] p-4 flex flex-col items-center justify-center gap-2 min-h-[200px] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-colors"
          >
            <div className="h-10 w-10 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
              <Plus size={18} />
            </div>
            <p className="text-sm font-medium text-[var(--foreground)]">Hire another</p>
          </button>
        </div>
      )}

      {modalOpen && <HireWizard onClose={() => setModalOpen(false)} onCreated={(id) => { setModalOpen(false); load(); window.location.hash = `/voice-employees/${id}`; }} />}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <p className="text-sm font-medium text-[var(--muted-foreground)] mb-2">{label}</p>
      <p className="text-3xl font-bold text-[var(--foreground)]">{value}</p>
      <p className="text-xs text-[var(--muted-foreground)] mt-1">{hint}</p>
    </div>
  );
}

/** "Tell us how the call should go" — one free-text description generates a full section-graph
 * draft (persona, greeting, qualifying steps, outcomes) via CallFlowGeneratorService, which the
 * user reviews before it's created as a real VoiceEmployee. */
function HireWizard({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [step, setStep] = useState<'describe' | 'review'>('describe');
  const [description, setDescription] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [voiceProvider, setVoiceProvider] = useState('sarvam');
  const [voiceId, setVoiceId] = useState('anushka');
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<GeneratedFlowDraft | null>(null);

  const handleGenerate = async () => {
    if (!description.trim()) { toast.error('Describe how the call should go first'); return; }
    setGenerating(true);
    try {
      const result = await generateVoiceEmployeeDraft(description.trim(), businessName.trim() || undefined);
      setDraft(result);
      setStep('review');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleBuild = async () => {
    if (!draft) return;
    setCreating(true);
    try {
      const employee = await createVoiceEmployee({
        name: draft.name, role: draft.role, voiceProvider, voiceId,
        agentInformation: draft.persona, welcomeMessage: draft.greeting,
        sections: draft.steps.map((s, i) => ({
          sectionKey: s.key, label: s.label, prompt: s.prompt, order: i + 1,
          edges: i < draft.steps.length - 1 ? [{ to_key: draft.steps[i + 1].key, condition: 'always' }] : [],
        })),
        variables: draft.steps.flatMap((s) => s.extract.map((v) => ({ key: v.name, label: v.prompt, source: 'capture' as const, required: false }))),
      });
      toast.success(`${employee.name} created — review the flow, then publish`);
      onCreated(employee.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
            {step === 'review' && (
              <button onClick={() => setStep('describe')} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ArrowLeft size={16} /></button>
            )}
            {step === 'describe' ? 'Tell us how the call should go' : `Review ${draft?.name}`}
          </h3>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><X size={16} /></button>
        </div>

        {step === 'describe' ? (
          <div className="space-y-3">
            <p className="text-xs text-[var(--muted-foreground)]">List it in your own words — first this, then that. We'll turn your steps into a call flow, set up the variables, and have your employee ready.</p>
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Business name (optional)</label>
              <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Skyline Heights"
                className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Call goal</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5}
                placeholder="e.g. Greet the caller, find out their budget and timeline, confirm interest in a site visit, then book a slot if qualified..."
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Voice provider</label>
                <select value={voiceProvider} onChange={(e) => setVoiceProvider(e.target.value)}
                  className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)]">
                  <option value="sarvam">Sarvam</option>
                  <option value="cartesia">Cartesia</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Voice ID</label>
                <input value={voiceId} onChange={(e) => setVoiceId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" />
              </div>
            </div>
            <button onClick={handleGenerate} disabled={generating}
              className="w-full h-9 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {generating ? 'Building the flow...' : 'Build the flow'}
            </button>
          </div>
        ) : draft ? (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="rounded-lg bg-[var(--accent)]/40 p-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">{draft.role}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">{draft.persona}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1">Greeting</p>
              <p className="text-sm text-[var(--foreground)]">{draft.greeting}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1">{draft.steps.length} call steps</p>
              <div className="space-y-1.5">
                {draft.steps.map((s) => (
                  <div key={s.key} className="rounded-lg border border-[var(--border)] p-2 text-xs">
                    <p className="font-medium text-[var(--foreground)]">{s.label}</p>
                    <p className="text-[var(--muted-foreground)]">{s.prompt}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1">{draft.outcomes.length} outcomes</p>
              <div className="space-y-1.5">
                {draft.outcomes.map((o) => (
                  <div key={o.key} className="rounded-lg border border-[var(--border)] p-2 text-xs">
                    <p className="font-medium text-[var(--foreground)]">{o.label}</p>
                    <p className="text-[var(--muted-foreground)]">{o.closingPrompt}</p>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={handleBuild} disabled={creating}
              className="w-full h-9 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
              {creating ? 'Creating...' : 'Create this employee'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
