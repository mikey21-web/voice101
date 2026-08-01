import { useEffect, useState } from 'react';
import { fetchVoiceEngineBilling, VoiceEngineBilling } from '../lib/data';
import { BarChart3, Loader2 } from 'lucide-react';

/** Per-employee minutes/cost, the one real usage signal we have without a payment processor
 * wired in — see VoiceBillingService's own doc comment for why credits stay at 0. */
export default function VoicePerformancePage() {
  const [billing, setBilling] = useState<VoiceEngineBilling | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVoiceEngineBilling().then(setBilling).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Performance</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-2">Minutes and cost per employee, lifetime</p>
      </div>

      {loading ? (
        <div className="p-10 text-center text-[var(--muted-foreground)]"><Loader2 size={20} className="animate-spin inline mr-2" />Loading...</div>
      ) : !billing ? null : (
        <>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="text-2xl font-bold text-[var(--foreground)]">{billing.lifetime.minutesUsedTotal}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Total minutes used</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="text-2xl font-bold text-[var(--foreground)]">₹{billing.lifetime.spentInr}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Total spent</p>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-x-auto">
            {billing.employees.length === 0 ? (
              <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">No employees yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                    <th className="p-3 font-medium">Employee</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Voice</th>
                    <th className="p-3 font-medium">Minutes used</th>
                    <th className="p-3 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {billing.employees.map((e) => (
                    <tr key={e.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="p-3 text-[var(--foreground)]">{e.name} <span className="text-[var(--muted-foreground)]">— {e.role}</span></td>
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          e.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-[var(--muted-foreground)]'
                        }`}>{e.status}</span>
                      </td>
                      <td className="p-3 text-[var(--muted-foreground)]">{e.voiceProvider}</td>
                      <td className="p-3 text-[var(--foreground)]">{e.minutesUsed}</td>
                      <td className="p-3 text-[var(--foreground)]">₹{e.costInr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
