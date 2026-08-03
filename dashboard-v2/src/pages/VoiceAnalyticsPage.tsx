import { useState, useEffect } from 'react';
import { fetchVoiceAnalytics, VoiceAnalytics } from '../lib/data';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2, TrendingUp, Phone, Clock, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

export default function VoiceAnalyticsPage() {
  const [analytics, setAnalytics] = useState<VoiceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);

  useEffect(() => {
    setLoading(true);
    fetchVoiceAnalytics(hours)
      .then(setAnalytics)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [hours]);

  if (loading || !analytics) {
    return (
      <div className="p-10 text-center text-[var(--muted-foreground)]">
        <Loader2 size={20} className="animate-spin inline mr-2" />
        Loading analytics...
      </div>
    );
  }

  const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Voice Analytics</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">Call volume, costs, performance funnels, and agent metrics</p>
        </div>
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)]"
        >
          <option value={24}>24 hours</option>
          <option value={168}>7 days</option>
          <option value={720}>30 days</option>
        </select>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="space-y-2">
          <p className="text-sm text-[var(--muted-foreground)] flex items-center gap-1.5"><Phone size={14} /> Total Calls</p>
          <p className="text-3xl font-bold text-[var(--foreground)]">{analytics.totalCalls}</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-[var(--muted-foreground)] flex items-center gap-1.5"><Clock size={14} /> Avg Duration</p>
          <p className="text-3xl font-bold text-[var(--foreground)]">{analytics.avgDuration.toFixed(0)}<span className="text-lg ml-1">s</span></p>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-[var(--muted-foreground)] flex items-center gap-1.5"><TrendingUp size={14} /> Success Rate</p>
          <p className="text-3xl font-bold text-emerald-600">{(analytics.successRate * 100).toFixed(1)}%</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-[var(--muted-foreground)] flex items-center gap-1.5"><DollarSign size={14} /> Total Cost</p>
          <p className="text-3xl font-bold text-[var(--foreground)]">₹{analytics.totalCost.toFixed(0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="border border-[var(--border)] rounded-lg p-6">
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Calls & Cost by Employee</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics.byEmployee}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="calls" fill="#0F766E" name="Calls" />
              <Bar dataKey="cost" fill="#10b981" name="Cost (₹)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-[var(--border)] rounded-lg p-6">
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Call Funnel</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={[
              { name: 'Entered', value: analytics.funnel.entered },
              { name: 'Engaged (>30s)', value: analytics.funnel.engaged },
              { name: 'Completed', value: analytics.funnel.completed },
            ]} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
              <Bar dataKey="value" fill="#06b6d4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-2">
          <p className="text-sm text-[var(--muted-foreground)]">Engagement Rate</p>
          <p className="text-3xl font-bold text-[var(--foreground)]">{(analytics.funnel.engagementRate * 100).toFixed(1)}%</p>
          <p className="text-xs text-[var(--muted-foreground)]">calls lasted over 30s</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-[var(--muted-foreground)]">Completion Rate</p>
          <p className="text-3xl font-bold text-[var(--foreground)]">{(analytics.funnel.completionRate * 100).toFixed(1)}%</p>
          <p className="text-xs text-[var(--muted-foreground)]">of engaged calls</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-[var(--muted-foreground)]">Cost per Call</p>
          <p className="text-3xl font-bold text-[var(--foreground)]">₹{(analytics.totalCost / Math.max(analytics.totalCalls, 1)).toFixed(2)}</p>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">Employee Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)] font-medium">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Calls</th>
                <th className="px-4 py-3">Total Duration</th>
                <th className="px-4 py-3">Avg Duration</th>
                <th className="px-4 py-3">Total Cost</th>
                <th className="px-4 py-3">Cost/Call</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {analytics.byEmployee.map((emp, idx) => (
                <tr key={idx} className="hover:bg-[var(--accent)]/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">{emp.name}</td>
                  <td className="px-4 py-3 text-[var(--foreground)]">{emp.calls}</td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">{emp.duration}s</td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">{emp.calls > 0 ? (emp.duration / emp.calls).toFixed(0) : 0}s</td>
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">₹{emp.cost.toFixed(0)}</td>
                  <td className="px-4 py-3 text-[var(--foreground)]">₹{emp.calls > 0 ? (emp.cost / emp.calls).toFixed(2) : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
