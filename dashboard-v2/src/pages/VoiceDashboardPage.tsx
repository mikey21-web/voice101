import { useEffect, useMemo, useState } from 'react';
import { fetchVoiceEmployees, fetchVoiceEngineCalls, VoiceEmployee, VoiceEngineCall } from '../lib/data';
import { LayoutDashboard, Users, Megaphone, PhoneCall, Hash, Database, Loader2 } from 'lucide-react';

/** Voice engine home — mirrors Outpero's dashboard: a status hero, quick actions into the rest
 * of the "Outreach" nav, and a recent-calls feed. All numbers are computed from real employee +
 * call data already on hand, no invented metrics. */
export default function VoiceDashboardPage() {
  const [employees, setEmployees] = useState<VoiceEmployee[]>([]);
  const [calls, setCalls] = useState<VoiceEngineCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchVoiceEmployees(), fetchVoiceEngineCalls({ limit: 10 })])
      .then(([e, c]) => { setEmployees(e); setCalls(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeCount = employees.filter((e) => e.status === 'active').length;
  const todayCalls = useMemo(() => {
    const today = new Date().toDateString();
    return calls.filter((c) => new Date(c.createdAt).toDateString() === today);
  }, [calls]);
  const qualifiedCount = calls.filter((c) => c.disposition === 'qualified').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-1.5 mb-0.5">
        <LayoutDashboard size={13} className="text-[var(--primary)]" />
        <span className="text-[11px] font-medium text-[var(--primary)] uppercase tracking-wider">Outreach</span>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-indigo-950 to-indigo-900 text-white p-6">
        <p className="text-xs uppercase tracking-wider text-indigo-300">Voice Engine</p>
        <h1 className="text-2xl font-bold mt-1">Your AI team is handling the calling.</h1>
        <p className="text-sm text-indigo-200 mt-1">{activeCount} employee{activeCount === 1 ? '' : 's'} active right now.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
          <HeroStat label="Employees" value={employees.length} />
          <HeroStat label="Active" value={activeCount} />
          <HeroStat label="Calls today" value={todayCalls.length} />
          <HeroStat label="Qualified" value={qualifiedCount} />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-[var(--foreground)] mb-3">Quick actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <QuickAction icon={Users} label="Hire employee" hint="Add an AI teammate" href="/voice-employees" />
          <QuickAction icon={Megaphone} label="New campaign" hint="Bulk-call a list" href="/voice-campaigns" />
          <QuickAction icon={Database} label="View leads" hint="Results & follow-ups" href="/voice-leads-results" />
          <QuickAction icon={Hash} label="Phone numbers" hint="Buy & route lines" href="/voice-phone-numbers" />
          <QuickAction icon={PhoneCall} label="Call log" hint="Every conversation" href="/voice-all-conversations" />
          <QuickAction icon={PhoneCall} label="Instant lead" hint="Call one number now" href="/voice-instant-leads" />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-[var(--foreground)] mb-3">Recent calls</p>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-x-auto">
          {loading ? (
            <div className="p-10 text-center text-[var(--muted-foreground)]"><Loader2 size={20} className="animate-spin inline mr-2" />Loading...</div>
          ) : calls.length === 0 ? (
            <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">No calls yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                  <th className="p-3 font-medium">Contact</th>
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
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-indigo-300">{label}</p>
    </div>
  );
}

function QuickAction({ icon: Icon, label, hint, href }: { icon: any; label: string; hint: string; href: string }) {
  return (
    <button
      onClick={() => { window.location.hash = href; }}
      className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 flex items-center gap-3 text-left hover:bg-[var(--accent)] transition-colors"
    >
      <div className="h-9 w-9 rounded-lg bg-[var(--accent)] flex items-center justify-center shrink-0">
        <Icon size={16} className="text-[var(--primary)]" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--foreground)] truncate">{label}</p>
        <p className="text-xs text-[var(--muted-foreground)] truncate">{hint}</p>
      </div>
    </button>
  );
}
