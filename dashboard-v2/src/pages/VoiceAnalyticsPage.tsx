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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">Voice Analytics</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Call performance, costs, and funnel metrics</p>
        </div>
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)]"
        >
          <option value={24}>Last 24 hours</option>
          <option value={168}>Last 7 days</option>
          <option value={720}>Last 30 days</option>
        </select>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-4 space-y-1">
          <p className="text-xs font-medium text-[var(--muted-foreground)] flex items-center gap-1.5"><Phone size={12} /> Total Calls</p>
          <p className="text-2xl font-bold text-[var(--foreground)]">{analytics.totalCalls}</p>
        </div>
        <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-4 space-y-1">
          <p className="text-xs font-medium text-[var(--muted-foreground)] flex items-center gap-1.5"><Clock size={12} /> Avg Duration</p>
          <p className="text-2xl font-bold text-[var(--foreground)]">{analytics.avgDuration.toFixed(0)}s</p>
        </div>
        <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-4 space-y-1">
          <p className="text-xs font-medium text-[var(--muted-foreground)] flex items-center gap-1.5"><TrendingUp size={12} /> Success Rate</p>
          <p className="text-2xl font-bold text-emerald-600">{(analytics.successRate * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-4 space-y-1">
          <p className="text-xs font-medium text-[var(--muted-foreground)] flex items-center gap-1.5"><DollarSign size={12} /> Total Cost</p>
          <p className="text-2xl font-bold text-[var(--foreground)]">₹{analytics.totalCost.toFixed(0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Calls & Cost by Employee</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.byEmployee}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                labelStyle={{ color: 'var(--foreground)' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="calls" fill="#8b5cf6" name="Calls" />
              <Bar dataKey="cost" fill="#10b981" name="Cost (₹)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Call Funnel</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={[
                { name: 'Entered', value: analytics.funnel.entered },
                { name: 'Engaged (>30s)', value: analytics.funnel.engaged },
                { name: 'Completed', value: analytics.funnel.completed },
              ]}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
              <Bar dataKey="value" fill="#06b6d4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-4">
          <p className="text-xs text-[var(--muted-foreground)] mb-1">Engagement Rate</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-[var(--foreground)]">{(analytics.funnel.engagementRate * 100).toFixed(1)}%</p>
            <p className="text-xs text-[var(--muted-foreground)] mb-1">of calls lasted >30s</p>
          </div>
        </div>
        <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-4">
          <p className="text-xs text-[var(--muted-foreground)] mb-1">Completion Rate</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-[var(--foreground)]">{(analytics.funnel.completionRate * 100).toFixed(1)}%</p>
            <p className="text-xs text-[var(--muted-foreground)] mb-1">of engaged calls</p>
          </div>
        </div>
        <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-4">
          <p className="text-xs text-[var(--muted-foreground)] mb-1">Cost per Call</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-[var(--foreground)]">₹{(analytics.totalCost / Math.max(analytics.totalCalls, 1)).toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-5">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Employee Performance Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                <th className="p-3 font-medium">Employee</th>
                <th className="p-3 font-medium">Calls</th>
                <th className="p-3 font-medium">Total Duration</th>
                <th className="p-3 font-medium">Avg Duration</th>
                <th className="p-3 font-medium">Total Cost</th>
                <th className="p-3 font-medium">Cost/Call</th>
              </tr>
            </thead>
            <tbody>
              {analytics.byEmployee.map((emp, idx) => (
                <tr key={idx} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--accent)]">
                  <td className="p-3 text-[var(--foreground)]">{emp.name}</td>
                  <td className="p-3 text-[var(--foreground)]">{emp.calls}</td>
                  <td className="p-3 text-[var(--muted-foreground)]">{emp.duration}s</td>
                  <td className="p-3 text-[var(--muted-foreground)]">{emp.calls > 0 ? (emp.duration / emp.calls).toFixed(0) : 0}s</td>
                  <td className="p-3 text-[var(--foreground)]">₹{emp.cost.toFixed(0)}</td>
                  <td className="p-3 text-[var(--foreground)]">₹{emp.calls > 0 ? (emp.cost / emp.calls).toFixed(2) : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
