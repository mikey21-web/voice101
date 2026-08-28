import { useEffect, useState } from "react";
import { Users, Phone, Bot, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { fetchAdminTenants, fetchAdminStats } from "../lib/data";

export default function AdminPage() {
  const [stats, setStats] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [s, t] = await Promise.all([fetchAdminStats(), fetchAdminTenants()]);
      setStats(s);
      setTenants(t);
    } catch {
      setError("Admin access denied or server error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (error) return (
    <div className="p-8 text-center text-red-500">{error}</div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--fg)]">Admin Panel</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Platform-wide overview</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--fg)] transition-colors">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Tenants", value: stats?.tenants ?? "—", icon: Users, color: "text-violet-500" },
          { label: "Voice Employees", value: stats?.employees ?? "—", icon: Bot, color: "text-emerald-500" },
          { label: "Total Calls", value: stats?.calls ?? "—", icon: Phone, color: "text-blue-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex items-center gap-3">
              <Icon size={20} className={color} />
              <span className="text-sm text-[var(--muted)]">{label}</span>
            </div>
            <p className="mt-3 text-3xl font-bold text-[var(--fg)]">{loading ? "—" : value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Tenant list */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--fg)]">All Tenants</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                  <th className="px-5 py-3 text-left font-medium">Name</th>
                  <th className="px-5 py-3 text-left font-medium">Slug</th>
                  <th className="px-5 py-3 text-left font-medium">Plan</th>
                  <th className="px-5 py-3 text-left font-medium">Employees</th>
                  <th className="px-5 py-3 text-left font-medium">Calls</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--border)] hover:bg-[var(--hover)] transition-colors">
                    <td className="px-5 py-3 font-medium text-[var(--fg)]">{t.name}</td>
                    <td className="px-5 py-3 text-[var(--muted)]">{t.slug}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">{t.plan}</span>
                    </td>
                    <td className="px-5 py-3 text-[var(--muted)]">{t._count?.voiceEmployees ?? 0}</td>
                    <td className="px-5 py-3 text-[var(--muted)]">{t._count?.voiceCalls ?? 0}</td>
                    <td className="px-5 py-3">
                      {t.active
                        ? <span className="flex items-center gap-1 text-emerald-600"><CheckCircle size={13} /> Active</span>
                        : <span className="flex items-center gap-1 text-red-500"><XCircle size={13} /> Inactive</span>}
                    </td>
                    <td className="px-5 py-3 text-[var(--muted)]">{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {!tenants.length && (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-[var(--muted)]">No tenants found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
