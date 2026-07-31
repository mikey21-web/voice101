import { useState, useEffect } from 'react';
import { fetchVoiceCallLogs, VoiceCallRun } from '../lib/data';
import { PhoneCall, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import VoiceCallDetailDrawer from '../components/VoiceCallDetailDrawer';

export default function VoiceCallLogsPage() {
  const [runs, setRuns] = useState<VoiceCallRun[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<VoiceCallRun | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchVoiceCallLogs(page, 50)
      .then((r) => { setRuns(r.runs); setTotalPages(r.totalPages || 1); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-1.5 mb-0.5">
        <PhoneCall size={13} className="text-[var(--primary)]" />
        <span className="text-[11px] font-medium text-[var(--primary)] uppercase tracking-wider">Outreach</span>
      </div>
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">Call Logs</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Every call the voice agent has made, across all campaigns and languages</p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-x-auto">
        {loading ? (
          <div className="p-10 text-center text-[var(--muted-foreground)]"><Loader2 size={20} className="animate-spin inline mr-2" />Loading...</div>
        ) : runs.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">No calls yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Lead</th>
                <th className="p-3 font-medium">Phone</th>
                <th className="p-3 font-medium">Outcome</th>
                <th className="p-3 font-medium">Duration</th>
                <th className="p-3 font-medium">Quality</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} onClick={() => setSelected(r)} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--accent)] cursor-pointer">
                  <td className="p-3 text-[var(--foreground)]">{new Date(r.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                  <td className="p-3 text-[var(--foreground)]">
                    {r.leadName || 'Unknown'}
                    {r.summary && <div className="text-xs text-[var(--muted-foreground)] font-normal mt-0.5 max-w-[220px] truncate" title={r.summary}>{r.summary}</div>}
                    {!r.summary && r.recordingUrl && <div className="text-xs text-[var(--muted-foreground)] font-normal mt-0.5 italic">Transcribing...</div>}
                  </td>
                  <td className="p-3 text-[var(--muted-foreground)]">{r.calledNumber || '—'}</td>
                  <td className="p-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.answered ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>{r.disposition}</span>
                  </td>
                  <td className="p-3 text-[var(--muted-foreground)]">{r.durationSeconds}s</td>
                  <td className="p-3">
                    {r.quality ? (
                      <span
                        title={`${r.quality.violations.length} issue${r.quality.violations.length === 1 ? '' : 's'} across ${r.quality.agentTurns} turns`}
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.quality.score >= 80
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : r.quality.score >= 50
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {r.quality.score}/100
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--muted-foreground)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-8 w-8 rounded-lg border border-[var(--border)] flex items-center justify-center disabled:opacity-40"><ChevronLeft size={14} /></button>
          <span className="text-xs text-[var(--muted-foreground)]">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-8 w-8 rounded-lg border border-[var(--border)] flex items-center justify-center disabled:opacity-40"><ChevronRight size={14} /></button>
        </div>
      )}

      {selected && <VoiceCallDetailDrawer run={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
