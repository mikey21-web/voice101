import { useEffect, useState } from 'react';
import { fetchVoiceEmployees, testCallVoiceEmployee, fetchVoiceEngineLeads, VoiceEmployee, VoiceEngineLead } from '../lib/data';
import { Zap, Loader2, PhoneCall } from 'lucide-react';
import toast from 'react-hot-toast';

/** Outpero's "Instant Lead Caller" — one number in, one call out right now, no CSV/campaign
 * needed. Reuses the same test-call path an employee's detail page already exercises. */
export default function VoiceInstantLeadsPage() {
  const [employees, setEmployees] = useState<VoiceEmployee[]>([]);
  const [leads, setLeads] = useState<VoiceEngineLead[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [toNumber, setToNumber] = useState('');
  const [calling, setCalling] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([fetchVoiceEmployees(), fetchVoiceEngineLeads({ limit: 20 })])
      .then(([e, l]) => {
        setEmployees(e.filter((emp) => emp.isPublished));
        setLeads(l.filter((lead) => lead.id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) { toast.error('Pick an employee'); return; }
    if (!toNumber.trim()) { toast.error('Enter a phone number'); return; }
    setCalling(true);
    try {
      await testCallVoiceEmployee(employeeId, toNumber.trim());
      toast.success('Call placed');
      setToNumber('');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCalling(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Instant Leads</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-2">Call one number right now using any published employee</p>
      </div>

      <form onSubmit={handleCall} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-3 max-w-md">
        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Employee</label>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)]">
            <option value="">Select a published employee...</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name} — {emp.role}</option>)}
          </select>
          {employees.length === 0 && !loading && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">No published employees yet — publish one first.</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Phone number</label>
          <input value={toNumber} onChange={(e) => setToNumber(e.target.value)} placeholder="+919876543210"
            className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" />
        </div>
        <button type="submit" disabled={calling}
          className="w-full h-9 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
          {calling ? <Loader2 size={14} className="animate-spin" /> : <PhoneCall size={14} />}
          {calling ? 'Calling...' : 'Call now'}
        </button>
      </form>

      <div>
        <p className="text-sm font-semibold text-[var(--foreground)] mb-3">Recent leads</p>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-x-auto">
          {loading ? (
            <div className="p-10 text-center text-[var(--muted-foreground)]"><Loader2 size={20} className="animate-spin inline mr-2" />Loading...</div>
          ) : leads.length === 0 ? (
            <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">No leads yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                  <th className="p-3 font-medium">Phone</th>
                  <th className="p-3 font-medium">Outcome</th>
                  <th className="p-3 font-medium">Summary</th>
                  <th className="p-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 text-[var(--foreground)]">{l.phone}</td>
                    <td className="p-3 text-[var(--muted-foreground)]">{l.outcome || '—'}</td>
                    <td className="p-3 text-[var(--muted-foreground)] max-w-[280px] truncate">{l.summary || '—'}</td>
                    <td className="p-3 text-[var(--muted-foreground)]">{new Date(l.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
