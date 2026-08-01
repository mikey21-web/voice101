import { useEffect, useState } from 'react';
import {
  fetchVoiceEngineNumbers, addVoiceEngineNumber, setVoiceEngineNumberKyc, assignVoiceEngineNumber,
  fetchVoiceEmployees, VoiceEngineNumber, VoiceEmployee,
} from '../lib/data';
import { Hash, Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function VoicePhoneNumbersPage() {
  const [numbers, setNumbers] = useState<VoiceEngineNumber[]>([]);
  const [employees, setEmployees] = useState<VoiceEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNumber, setNewNumber] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([fetchVoiceEngineNumbers(), fetchVoiceEmployees()])
      .then(([n, e]) => { setNumbers(n); setEmployees(e); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNumber.trim()) return;
    setAdding(true);
    try { await addVoiceEngineNumber(newNumber.trim()); toast.success('Number added'); setNewNumber(''); load(); }
    catch (err: any) { toast.error(err.message); }
    finally { setAdding(false); }
  };

  const handleVerifyKyc = async (id: string) => {
    setBusyId(id);
    try { await setVoiceEngineNumberKyc(id, 'verified'); toast.success('Marked verified'); load(); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusyId(null); }
  };

  const handleAssign = async (id: string, employeeId: string) => {
    if (!employeeId) return;
    setBusyId(id);
    try { await assignVoiceEngineNumber(id, employeeId); toast.success('Assigned'); load(); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Phone Numbers</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-2">Numbers your employees call from and receive calls on</p>
      </div>

      <form onSubmit={handleAdd} className="flex items-center gap-2 max-w-md">
        <input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="+919876543210"
          className="flex-1 h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]" />
        <button type="submit" disabled={adding}
          className="h-9 px-3 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
          {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
        </button>
      </form>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-x-auto">
        {loading ? (
          <div className="p-10 text-center text-[var(--muted-foreground)]"><Loader2 size={20} className="animate-spin inline mr-2" />Loading...</div>
        ) : numbers.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">No numbers yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                <th className="p-3 font-medium">Number</th>
                <th className="p-3 font-medium">Provider</th>
                <th className="p-3 font-medium">KYC</th>
                <th className="p-3 font-medium">Assign to</th>
              </tr>
            </thead>
            <tbody>
              {numbers.map((n) => (
                <tr key={n.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="p-3 text-[var(--foreground)]">{n.number}</td>
                  <td className="p-3 text-[var(--muted-foreground)]">{n.provider}</td>
                  <td className="p-3">
                    {n.kycStatus === 'verified' ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">verified</span>
                    ) : (
                      <button onClick={() => handleVerifyKyc(n.id)} disabled={busyId === n.id}
                        className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 disabled:opacity-50">
                        {n.kycStatus} — mark verified
                      </button>
                    )}
                  </td>
                  <td className="p-3">
                    <select
                      defaultValue=""
                      disabled={n.kycStatus !== 'verified' || busyId === n.id}
                      onChange={(e) => handleAssign(n.id, e.target.value)}
                      className="h-8 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)] disabled:opacity-50"
                    >
                      <option value="">{n.kycStatus !== 'verified' ? 'Complete KYC first' : 'Select employee...'}</option>
                      {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
