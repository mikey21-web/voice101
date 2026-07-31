import { useState, useEffect } from 'react';
import {
  fetchVoiceEmployees, createVoiceEmployee, publishVoiceEmployee, activateVoiceEmployee,
  deactivateVoiceEmployee, deleteVoiceEmployee, VoiceEmployee,
} from '../lib/data';
import { Users, Plus, Loader2, Rocket, Power, Trash2, X, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

/** The core "My Employees" surface of the voice engine — list, create, publish, activate.
 * Mirrors Outpero's employee list: each row is a hire-able AI agent, draft until published. */
export default function VoiceEmployeesPage() {
  const [employees, setEmployees] = useState<VoiceEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [voiceProvider, setVoiceProvider] = useState('sarvam');
  const [voiceId, setVoiceId] = useState('anushka');

  const load = () => {
    setLoading(true);
    fetchVoiceEmployees().then(setEmployees).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim()) { toast.error('Name and role are required'); return; }
    setCreating(true);
    try {
      const employee = await createVoiceEmployee({
        name: name.trim(), role: role.trim(), voiceProvider, voiceId,
        sections: [
          { sectionKey: 'greet', label: 'Greet & Qualify', prompt: 'Introduce yourself and find out what the caller needs, one question at a time.', order: 1, edges: [] },
        ],
      });
      toast.success(`${employee.name} created — add sections, then publish`);
      setModalOpen(false);
      setName(''); setRole('');
      load();
      window.location.hash = `/voice-employees/${employee.id}`;
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <Users size={13} className="text-[var(--primary)]" />
            <span className="text-[11px] font-medium text-[var(--primary)] uppercase tracking-wider">Outreach</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">AI Employees</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Voice agents you've hired — each with its own script, voice and phone number</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Plus size={14} /> Hire Employee
        </button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-[var(--muted-foreground)]"><Loader2 size={20} className="animate-spin inline mr-2" />Loading...</div>
      ) : employees.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-10 text-center text-sm text-[var(--muted-foreground)]">
          No employees yet. Hire your first one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <div key={emp.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-sm)] flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0 cursor-pointer" onClick={() => { window.location.hash = `/voice-employees/${emp.id}`; }}>
                  <p className="font-semibold text-sm text-[var(--foreground)] truncate">{emp.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)] truncate">{emp.role}</p>
                </div>
                <span className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  emp.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-[var(--muted-foreground)]'
                }`}>
                  {emp.status}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
                <span>{emp.voiceProvider}/{emp.voiceName || emp.voiceId}</span>
                <span>·</span>
                <span>{emp.sections?.length || 0} sections</span>
                <span>·</span>
                <span>{emp.isPublished ? `rev ${emp.revision}` : 'draft'}</span>
              </div>

              {emp.hasUnpublishedChanges && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">Unpublished changes</p>
              )}

              <div className="flex items-center gap-1.5 mt-1">
                <button
                  onClick={() => handlePublish(emp.id)}
                  disabled={busyId === emp.id}
                  className="flex-1 h-8 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {busyId === emp.id ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />}
                  Publish
                </button>
                <button
                  onClick={() => handleToggleActive(emp)}
                  disabled={busyId === emp.id || !emp.isPublished}
                  title={!emp.isPublished ? 'Publish first' : undefined}
                  className={`h-8 w-8 rounded-lg border border-[var(--border)] flex items-center justify-center transition-colors disabled:opacity-40 ${
                    emp.status === 'active' ? 'text-emerald-600' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
                  }`}
                >
                  <Power size={12} />
                </button>
                <button
                  onClick={() => { window.location.hash = `/voice-employees/${emp.id}`; }}
                  className="h-8 w-8 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors flex items-center justify-center"
                >
                  <ChevronRight size={12} />
                </button>
                <button
                  onClick={() => handleDelete(emp.id, emp.name)}
                  disabled={busyId === emp.id}
                  className="h-8 w-8 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-rose-600 hover:border-rose-300 transition-colors flex items-center justify-center disabled:opacity-50"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[var(--foreground)]">Hire an AI Employee</h3>
              <button onClick={() => setModalOpen(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riya"
                  className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Role</label>
                <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Real Estate Lead Qualifier"
                  className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20" />
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
              <p className="text-[11px] text-[var(--muted-foreground)]">Creates a starter section — edit the full flow after creation.</p>
              <button type="submit" disabled={creating}
                className="w-full h-9 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {creating ? 'Creating...' : 'Create Employee'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
