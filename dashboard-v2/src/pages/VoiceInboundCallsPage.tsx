import { useEffect, useState } from 'react';
import { fetchVoiceEngineCalls, VoiceEngineCall } from '../lib/data';
import { PhoneIncoming, Loader2 } from 'lucide-react';

export default function VoiceInboundCallsPage() {
  const [calls, setCalls] = useState<VoiceEngineCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVoiceEngineCalls({ direction: 'inbound', limit: 100 }).then(setCalls).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-1.5 mb-0.5">
        <PhoneIncoming size={13} className="text-[var(--primary)]" />
        <span className="text-[11px] font-medium text-[var(--primary)] uppercase tracking-wider">Outreach · Calling</span>
      </div>
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">Inbound Calls</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Calls received by your employees' phone numbers</p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-x-auto">
        {loading ? (
          <div className="p-10 text-center text-[var(--muted-foreground)]"><Loader2 size={20} className="animate-spin inline mr-2" />Loading...</div>
        ) : calls.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">No inbound calls yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                <th className="p-3 font-medium">From</th>
                <th className="p-3 font-medium">Employee</th>
                <th className="p-3 font-medium">Outcome</th>
                <th className="p-3 font-medium">Duration</th>
                <th className="p-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="p-3 text-[var(--foreground)]">{c.toNumber}</td>
                  <td className="p-3 text-[var(--muted-foreground)]">{c.employee?.name || '—'}</td>
                  <td className="p-3">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-[var(--muted-foreground)]">{c.disposition || 'pending'}</span>
                  </td>
                  <td className="p-3 text-[var(--muted-foreground)]">{c.durationS ? `${c.durationS}s` : '—'}</td>
                  <td className="p-3 text-[var(--muted-foreground)]">{new Date(c.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
