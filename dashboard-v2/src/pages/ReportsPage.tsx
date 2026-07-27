import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import toast from "react-hot-toast";
import { Dialog } from "../components/ui/dialog";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Save, Play, Plus, Edit3, Trash2, Share2, RefreshCw } from "lucide-react";

const ENTITIES = ["lead", "conversion", "ticket", "revenue", "property", "project", "unit"] as const;
const METRICS: Record<string, string[]> = {
  lead: ["count", "avg(score)"],
  conversion: ["count", "sum(amount)"],
  ticket: ["count"],
  revenue: ["count", "sum(amount)"],
  property: ["count", "sum(price)", "avg(price)"],
  project: ["count", "sum(budget)", "avg(budget)"],
  unit: ["count", "sum(price)", "avg(price)"],
};
const GROUP_BYS: Record<string, string[]> = {
  lead: ["status", "source", "segment", "assignedAgent", "createdAt"],
  conversion: ["status", "source", "createdAt"],
  ticket: ["status", "priority", "assignedAgent", "createdAt"],
  revenue: ["source", "createdAt"],
  property: ["status", "type", "location", "createdAt"],
  project: ["status", "priority", "manager", "createdAt"],
  unit: ["status", "type", "location", "createdAt"],
};
const CHART_TYPES = ["bar", "line", "pie"] as const;

const COLORS = ["#0e9d6e", "#0891b2", "#d97706", "#dc2626", "#059669", "#6366f1", "#e11d48", "#0369a1"];

function transformSeries(labels: string[], series: { name: string; data: number[] }[]) {
  return labels.map((label, i) => {
    const point: any = { name: label };
    series.forEach(s => { point[s.name] = s.data[i]; });
    return point;
  });
}

export default function ReportsPage() {
  const [entity, setEntity] = useState("lead");
  const [metric, setMetric] = useState("count");
  const [groupBy, setGroupBy] = useState("status");
  const [chartType, setChartType] = useState("bar");
  const [result, setResult] = useState<{ labels: string[]; series: { name: string; data: number[] }[] } | null>(null);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState<any[]>([]);
  const [showSave, setShowSave] = useState(false);
  const [reportName, setReportName] = useState("");
  const [reportShared, setReportShared] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadSaved = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api("/reports");
      setSaved(res || []);
    } catch {
      setSaved([]);
      setError("Failed to load saved reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSaved(); }, [refreshKey]);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await api("/reports/run", {
        method: "POST",
        body: JSON.stringify({ entity, metric, groupBy }),
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to run report");
      toast.error(err.message || "Failed to run report");
    }
    setRunning(false);
  };

  const handleSave = async () => {
    if (!reportName.trim()) return toast.error("Report name required");
    try {
      await api("/reports", {
        method: "POST",
        body: JSON.stringify({ name: reportName, entity, config: { metric, groupBy, chartType }, isShared: reportShared }),
      });
      toast.success("Report saved");
      setShowSave(false);
      setReportName("");
      loadSaved();
    } catch (err: any) { toast.error(err.message || "Failed to save"); }
  };

  const handleLoad = (report: any) => {
    setEntity(report.entity);
    setMetric(report.config.metric || "count");
    setGroupBy(report.config.groupBy || "status");
    setChartType(report.config.chartType || "bar");
    setShowSaved(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`/reports/${id}`, { method: "DELETE" });
      toast.success("Report deleted");
      loadSaved();
    } catch { toast.error("Failed to delete"); }
  };

  const chartData = result ? transformSeries(result.labels, result.series) : [];

  const renderChart = () => {
    if (!result || chartData.length === 0) {
      return <div className="flex items-center justify-center h-64 text-sm text-[var(--muted-foreground)]">Run a report to see results</div>;
    }

    if (chartType === "pie") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={chartData} dataKey={result.series[0].name} nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    const Chart = chartType === "line" ? LineChart : BarChart;
    return (
      <ResponsiveContainer width="100%" height={300}>
        <Chart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }} />
          <Legend />
          {result.series.map((s, i) =>
            chartType === "line" ? (
              <Line key={s.name} type="monotone" dataKey={s.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
            ) : (
              <Bar key={s.name} dataKey={s.name} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            )
          )}
        </Chart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Report Builder</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Build custom reports and save them for later</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => { setRefreshKey(k => k + 1); }} title="Refresh"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={() => setShowSaved(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">
            <BarChart3 size={16} /> Saved Reports
          </button>
          <button onClick={() => setShowSave(true)} disabled={!result}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors shadow-sm">
            <Save size={16} /> Save Report
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Entity</label>
            <select value={entity} onChange={e => { setEntity(e.target.value); setMetric(METRICS[e.target.value]?.[0] || "count"); setGroupBy(GROUP_BYS[e.target.value]?.[0] || "status"); }}
              className="w-full mt-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50">
              {ENTITIES.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}s</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Metric</label>
            <select value={metric} onChange={e => setMetric(e.target.value)}
              className="w-full mt-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50">
              {(METRICS[entity] || []).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Group By</label>
            <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
              className="w-full mt-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50">
              {(GROUP_BYS[entity] || []).map(g => <option key={g} value={g}>{g.replace(/([A-Z])/g, ' $1').trim()}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Chart Type</label>
            <div className="flex gap-1 mt-1">
              {CHART_TYPES.map(t => (
                <button key={t} onClick={() => setChartType(t)}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                    chartType === t ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                  }`}>
                  {t === "bar" ? <BarChart3 size={14} /> : t === "line" ? <TrendingUp size={14} /> : <PieChartIcon size={14} />}
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={handleRun} disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors">
            <Play size={16} /> {running ? "Running..." : "Run Report"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">
          {entity.charAt(0).toUpperCase() + entity.slice(1)}s by {groupBy.replace(/([A-Z])/g, ' $1').trim()}
        </h3>
        {error && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        {renderChart()}
      </div>

      {/* Save Modal */}
      {showSave && (
        <Dialog
          open
          onClose={() => setShowSave(false)}
          title="Save Report"
          maxWidth="max-w-sm"
          footer={
            <>
              <button onClick={() => setShowSave(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--foreground)] border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] transition-colors cursor-pointer">Cancel</button>
              <button onClick={handleSave}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 transition-colors cursor-pointer">Save</button>
            </>
          }
        >
          <input value={reportName} onChange={e => setReportName(e.target.value)} placeholder="Report name" autoFocus
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={reportShared} onChange={e => setReportShared(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/30" />
            <span className="text-sm text-[var(--foreground)]">Share with team</span>
          </label>
        </Dialog>
      )}

      {/* Saved Reports Modal */}
      {showSaved && (
        <Dialog open onClose={() => setShowSaved(false)} title="Saved Reports" maxWidth="max-w-lg">
          <div className="max-h-[55vh] overflow-y-auto space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw size={20} className="animate-spin text-[var(--muted-foreground)]" />
              </div>
            )}
            {error && (
              <div className="flex items-center justify-center py-4 px-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            {!loading && !error && saved.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-8">No saved reports yet. Build and save one!</p>
            ) : !loading && !error && saved.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)] truncate">{r.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {r.entity.charAt(0).toUpperCase() + r.entity.slice(1)} · {r.owner?.name || 'Unknown'}
                    {r.isShared && ' · Shared'}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-3">
                  <button onClick={() => handleLoad(r)}
                    className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-light)] transition-colors cursor-pointer" title="Load">
                    <Play size={14} />
                  </button>
                  <button onClick={() => handleDelete(r.id)}
                    className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Dialog>
      )}
    </div>
  );
}
