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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-1.5 mb-0.5">
        <MessageSquare size={13} className="text-[var(--primary)]" />
        <span className="text-[11px] font-medium text-[var(--primary)] uppercase tracking-wider">Outreach · Results</span>
      </div>
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">All Conversations</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Every call across every employee, with quality scoring</p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-x-auto">
        {loading ? (
          <div className="p-10 text-center text-[var(--muted-foreground)]"><Loader2 size={20} className="animate-spin inline mr-2" />Loading...</div>
        ) : calls.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">No conversations yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                <th className="p-3 font-medium">Contact</th>
                <th className="p-3 font-medium">Employee</th>
                <th className="p-3 font-medium">Outcome</th>
                <th className="p-3 font-medium">Duration</th>
                <th className="p-3 font-medium">Quality</th>
                <th className="p-3 font-medium">Time</th>
                <th className="p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--accent)]">
                  <td className="p-3 text-[var(--foreground)]">
                    {c.toNumber}
                    {c.summary && <div className="text-xs text-[var(--muted-foreground)] font-normal mt-0.5 max-w-[220px] truncate" title={c.summary}>{c.summary}</div>}
                  </td>
                  <td className="p-3 text-[var(--muted-foreground)]">{c.employee?.name || '—'}</td>
                  <td className="p-3">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-[var(--muted-foreground)]">{c.disposition || 'pending'}</span>
                  </td>
                  <td className="p-3 text-[var(--muted-foreground)]">{c.durationS ? `${c.durationS}s` : '—'}</td>
                  <td className="p-3">
                    {c.quality ? (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.quality.score >= 80 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : c.quality.score >= 50 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                      }`}>{c.quality.score}/100</span>
                    ) : <span className="text-xs text-[var(--muted-foreground)]">—</span>}
                  </td>
                  <td className="p-3 text-[var(--muted-foreground)]">{new Date(c.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                  <td className="p-3">
                    <button onClick={() => handleRedial(c.id)} disabled={redialingId === c.id}
                      className="h-7 w-7 rounded-lg border border-[var(--border)] flex items-center justify-center hover:bg-[var(--accent)] disabled:opacity-50">
                      {redialingId === c.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
                    </button>
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
