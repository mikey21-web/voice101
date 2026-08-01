import { useEffect, useState } from 'react';
import { fetchVoiceEngineCalls, redialVoiceEngineCall, VoiceEngineCall } from '../lib/data';
import { MessageSquare, Loader2, RotateCw } from 'lucide-react';
import toast from 'react-hot-toast';

/** All calls placed/received across every VoiceEmployee — the new engine's equivalent of
 * Outpero's "All Conversations". Deliberately separate from the legacy Call Logs page, which
 * still reads the old single-workflow endpoint. */
export default function VoiceAllConversationsPage() {
  const [calls, setCalls] = useState<VoiceEngineCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [redialingId, setRedialingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchVoiceEngineCalls({ limit: 100 }).then(setCalls).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleRedial = async (id: string) => {
    setRedialingId(id);
    try { await redialVoiceEngineCall(id); toast.success('Redial placed'); load(); }
    catch (e: any) { toast.error(e.message); }
    finally { setRedialingId(null); }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">All Conversations</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-2">Every call across all employees. Quality scores and call outcomes.</p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-[var(--muted-foreground)]"><Loader2 size={20} className="animate-spin inline mr-2" />Loading...</div>
      ) : calls.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--muted-foreground)]">No conversations yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)] font-medium">
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Quality</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {calls.map((c) => (
                <tr key={c.id} className="hover:bg-[var(--accent)]/40 transition-colors">
                  <td className="px-4 py-3 text-[var(--foreground)]">
                    <p className="font-medium">{c.toNumber}</p>
                    {c.summary && <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-[200px] truncate">{c.summary}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">{c.employee?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-[var(--muted-foreground)]">{c.disposition || 'pending'}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">{c.durationS ? `${c.durationS}s` : '—'}</td>
                  <td className="px-4 py-3">
                    {c.quality ? (
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        c.quality.score >= 80 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : c.quality.score >= 50 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                      }`}>{c.quality.score}</span>
                    ) : <span className="text-xs text-[var(--muted-foreground)]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">{new Date(c.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleRedial(c.id)} disabled={redialingId === c.id}
                      className="h-8 w-8 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center justify-center disabled:opacity-40">
                      {redialingId === c.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
