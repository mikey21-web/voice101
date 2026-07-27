import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { fetchProjects } from '../lib/data';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';

const ENTRY_TYPES = ['EXPECTED_COLLECTION', 'EXPECTED_COMMISSION_PAYOUT', 'EXPECTED_REFUND', 'PLANNED_EXPENSE'];
const INFLOW_TYPES = ['EXPECTED_COLLECTION'];

function money(paise: number | string | bigint | undefined) {
  return `₹${(Number(paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function CashFlowForecastPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState('');
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ entryType: 'EXPECTED_COLLECTION', amount: '', expectedDate: '', sourceType: 'manual', notes: '' });

  useEffect(() => {
    fetchProjects().then(r => {
      const list = r.data || [];
      setProjects(list);
      if (list[0]) setProjectId(list[0].id);
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try { setSummary(await api(`/cash-flow-forecast/summary/${projectId}`)); }
    catch { setSummary(null); }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.amount || !form.expectedDate) { toast.error('Amount and expected date are required'); return; }
    try {
      await api('/cash-flow-forecast', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          entryType: form.entryType,
          amountPaise: String(Math.round(Number(form.amount) * 100)),
          expectedDate: form.expectedDate,
          sourceType: form.sourceType,
          notes: form.notes || undefined,
        }),
      });
      toast.success('Forecast entry added');
      setShowCreate(false);
      setForm({ entryType: 'EXPECTED_COLLECTION', amount: '', expectedDate: '', sourceType: 'manual', notes: '' });
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const remove = async (id: string) => {
    try { await api(`/cash-flow-forecast/${id}`, { method: 'DELETE' }); toast.success('Entry removed'); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const byMonth: any[] = summary?.byMonth || [];
  const maxAmount = Math.max(1, ...byMonth.flatMap((m: any) => [Number(m.inflows), Number(m.outflows)]));

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Cash Flow Forecasting</h1><p className="text-sm text-muted-foreground">Expected collections vs. payouts, by project and by month</p></div>
        <Button onClick={() => setShowCreate(!showCreate)} disabled={!projectId}><Plus className="mr-2 h-4 w-4" /> New Entry</Button>
      </div>

      <select className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm" value={projectId} onChange={e => setProjectId(e.target.value)}>
        <option value="">Select project</option>
        {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      {showCreate && (
        <Card><CardContent className="pt-4 space-y-3">
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.entryType} onChange={e => setForm({ ...form, entryType: e.target.value })}>
            {ENTRY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
          <Input type="number" placeholder="Amount (₹)" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          <Input type="date" value={form.expectedDate} onChange={e => setForm({ ...form, expectedDate: e.target.value })} />
          <Input placeholder="Source (e.g. Booking milestone, Construction draw, Land payment)" value={form.sourceType} onChange={e => setForm({ ...form, sourceType: e.target.value })} />
          <Input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-2"><Button onClick={create}>Create</Button><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button></div>
        </CardContent></Card>
      )}

      {loading ? (
        <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>
      ) : !projectId ? (
        <p className="text-muted-foreground">Select a project to see its cash flow forecast.</p>
      ) : !summary ? (
        <p className="text-muted-foreground">No forecast data yet for this project.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground uppercase">Expected inflows</p>
              <p className="text-xl font-bold text-emerald-600">{money(summary.totalExpectedInflowsPaise)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground uppercase">Expected outflows</p>
              <p className="text-xl font-bold text-red-600">{money(summary.totalExpectedOutflowsPaise)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground uppercase">Net position</p>
              <p className={`text-xl font-bold ${Number(summary.netPositionPaise) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{money(summary.netPositionPaise)}</p>
            </CardContent></Card>
          </div>

          {byMonth.length > 0 && (
            <Card><CardHeader className="pb-2"><CardTitle className="text-base">Monthly inflows vs. outflows</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {byMonth.map((m: any) => (
                  <div key={m.month} className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground"><span>{m.month}</span><span>{money(m.inflows)} in · {money(m.outflows)} out</span></div>
                    <div className="flex gap-1 h-2">
                      <div className="bg-emerald-500 rounded-l" style={{ width: `${(Number(m.inflows) / maxAmount) * 100}%` }} />
                      <div className="bg-red-500 rounded-r" style={{ width: `${(Number(m.outflows) / maxAmount) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3">
            {(summary.entries || []).length === 0 && <p className="text-muted-foreground">No entries yet.</p>}
            {(summary.entries || []).map((e: any) => (
              <Card key={e.id}>
                <CardContent className="pt-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={INFLOW_TYPES.includes(e.entryType) ? 'default' : 'secondary'}>{e.entryType.replace(/_/g, ' ')}</Badge>
                      <span className="text-sm font-semibold">{money(e.amountPaise)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{e.sourceType} · {new Date(e.expectedDate).toLocaleDateString()}{e.notes ? ` · ${e.notes}` : ''}</p>
                  </div>
                  <button onClick={() => remove(e.id)} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-500"><Trash2 className="h-4 w-4" /></button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
