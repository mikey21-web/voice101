import { useState, useEffect } from 'react';
import { fetchVoiceCampaignRuns, getVoiceCampaignProgress, fetchVoiceCampaigns, downloadVoiceCampaignReport, VoiceCallRun } from '../lib/data';
import { Megaphone, Loader2, ArrowLeft, Download } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import VoiceCallDetailDrawer from '../components/VoiceCallDetailDrawer';

function getCampaignId() {
  const hash = window.location.hash.replace('#', '');
  return hash.split('/')[2] || '';
}

const DISPOSITION_COLORS: Record<string, string> = {
  completed: '#10b981', answered: '#10b981',
  no_answer: '#f59e0b', 'no-answer': '#f59e0b', busy: '#f59e0b',
  failed: '#ef4444', voicemail: '#6366f1', unknown: '#9ca3af',
};

export default function VoiceCampaignDetailPage() {
  const id = getCampaignId();
  const [progress, setProgress] = useState<any>(null);
  const [name, setName] = useState('');
  const [runs, setRuns] = useState<VoiceCallRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<VoiceCallRun | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      getVoiceCampaignProgress(parseInt(id, 10)).then(setProgress).catch(() => null),
      fetchVoiceCampaigns().then((r) => setName(r.campaigns.find((c) => c.id === parseInt(id, 10))?.name || '')).catch(() => {}),
      fetchVoiceCampaignRuns(parseInt(id, 10)).then((r) => setRuns(r.runs)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [id]);

  const dispositionCounts: Record<string, number> = {};
  for (const r of runs) dispositionCounts[r.disposition] = (dispositionCounts[r.disposition] || 0) + 1;

  if (loading) return <div className="p-6 text-center text-[var(--muted-foreground)]"><Loader2 size={20} className="animate-spin inline mr-2" />Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <button onClick={() => { window.location.hash = '#/voice-campaigns'; }} className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
        <ArrowLeft size={14} /> Back to Campaigns
      </button>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <Megaphone size={13} className="text-[var(--primary)]" />
            <span className="text-[11px] font-medium text-[var(--primary)] uppercase tracking-wider">Outreach</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">{name || `Campaign #${id}`}</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{progress?.processed_rows ?? 0}/{progress?.total_rows ?? 0} contacts called</p>
        </div>
        <button onClick={() => downloadVoiceCampaignReport(parseInt(id, 10))} className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] flex items-center gap-2">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {Object.keys(dispositionCounts).length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 max-w-md">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-2">Status Breakdown</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={Object.entries(dispositionCounts).map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                {Object.keys(dispositionCounts).map((key) => <Cell key={key} fill={DISPOSITION_COLORS[key.toLowerCase()] || '#9ca3af'} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-x-auto">
        <h2 className="text-sm font-semibold text-[var(--foreground)] p-4 pb-0">Contacts</h2>
        {runs.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">No calls placed yet.</div>
        ) : (
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="border-b border-t border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                <th className="p-3 font-medium">Lead</th>
                <th className="p-3 font-medium">Phone</th>
                <th className="p-3 font-medium">Outcome</th>
                <th className="p-3 font-medium">Duration</th>
                <th className="p-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} onClick={() => setSelected(r)} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--accent)] cursor-pointer">
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
                  <td className="p-3 text-[var(--muted-foreground)]">{new Date(r.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && <VoiceCallDetailDrawer run={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
