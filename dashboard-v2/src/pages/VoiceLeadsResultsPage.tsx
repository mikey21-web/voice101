import { useEffect, useState } from 'react';
import { fetchVoiceEngineLeads, VoiceEngineLead } from '../lib/data';
import { Database, Loader2 } from 'lucide-react';

export default function VoiceLeadsResultsPage() {
  const [leads, setLeads] = useState<VoiceEngineLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVoiceEngineLeads({ limit: 100 }).then(setLeads).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Leads & Results</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-2">Every lead captured by a call, with outcomes and data</p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-x-auto">
        {loading ? (
          <div className="p-10 text-center text-[var(--muted-foreground)]"><Loader2 size={20} className="animate-spin inline mr-2" />Loading...</div>
        ) : leads.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">No leads captured yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                <th className="p-3 font-medium">Phone</th>
                <th className="p-3 font-medium">Outcome</th>
                <th className="p-3 font-medium">Captured</th>
                <th className="p-3 font-medium">Summary</th>
                <th className="p-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="p-3 text-[var(--foreground)]">{l.phone}</td>
                  <td className="p-3">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-[var(--muted-foreground)]">{l.outcome || '—'}</span>
                  </td>
                  <td className="p-3 text-[var(--muted-foreground)] max-w-[240px]">
                    {l.captured && typeof l.captured === 'object' && Object.keys(l.captured).length > 0
                      ? Object.entries(l.captured).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ')
                      : '—'}
                  </td>
                  <td className="p-3 text-[var(--muted-foreground)] max-w-[240px] truncate">{l.summary || '—'}</td>
                  <td className="p-3 text-[var(--muted-foreground)]">{new Date(l.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
