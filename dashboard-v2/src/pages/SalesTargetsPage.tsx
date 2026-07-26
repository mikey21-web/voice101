import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';

export default function SalesTargetsPage() {
  const [targets, setTargets] = useState<any[]>([]);
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ scope: 'TENANT', metric: 'BOOKINGS', periodStart: '', periodEnd: '', targetValue: '' });

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const list = await api('/sales-targets');
      setTargets(list);
      const entries = await Promise.all(list.map((t: any) => api(`/sales-targets/${t.id}/progress`).then((p) => [t.id, p]).catch(() => [t.id, null])));
      setProgress(Object.fromEntries(entries));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await api('/sales-targets', { method: 'POST', body: JSON.stringify({ ...form, targetValue: Number(form.targetValue) }) });
      toast.success('Target created'); setShowCreate(false); load();
    } catch (e: any) { toast.error(e.message || 'Failed to create target'); }
  };

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;

  if (error) {
    return (
      <div className="p-6">
        <Card><CardContent className="pt-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Couldn't load sales targets.</p>
          <Button variant="outline" onClick={load}>Retry</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Sales Targets</h1><p className="text-sm text-muted-foreground">Quotas by scope and metric — always shown against the same scope, never an unfair comparison</p></div>
        <Button onClick={() => setShowCreate(!showCreate)}><Plus className="mr-2 h-4 w-4" /> New Target</Button>
      </div>

      {showCreate && (
        <Card><CardContent className="pt-4 space-y-3">
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })}>
            <option value="TENANT">Tenant-wide</option><option value="PROJECT">Project</option>
            <option value="TEAM">Team</option><option value="AGENT">Agent</option>
          </select>
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.metric} onChange={e => setForm({ ...form, metric: e.target.value })}>
            <option value="BOOKINGS">Bookings</option><option value="SITE_VISITS">Site Visits</option>
            <option value="LEAD_RESPONSE">Lead Response %</option>
            <option value="AGREEMENT_VALUE_PAISE">Agreement Value</option><option value="COLLECTIONS_PAISE">Collections</option>
          </select>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input type="date" value={form.periodStart} onChange={e => setForm({ ...form, periodStart: e.target.value })} />
            <Input type="date" value={form.periodEnd} onChange={e => setForm({ ...form, periodEnd: e.target.value })} />
          </div>
          <Input type="number" placeholder="Target value" value={form.targetValue} onChange={e => setForm({ ...form, targetValue: e.target.value })} />
          <div className="flex gap-2"><Button onClick={create}>Create</Button><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button></div>
        </CardContent></Card>
      )}

      {targets.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground">No sales targets set yet.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {targets.map((t: any) => {
            const p = progress[t.id];
            return (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{t.scope}</Badge>
                    <Badge>{t.metric.replace(/_/g, ' ')}</Badge>
                  </div>
                  <CardTitle className="text-base mt-2">
                    {new Date(t.periodStart).toLocaleDateString()} – {new Date(t.periodEnd).toLocaleDateString()}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p className="font-semibold">Target: {t.targetValue.toLocaleString()}</p>
                  {p && (
                    <>
                      <p className="text-muted-foreground">Actual: {p.actualValue.toLocaleString()} ({p.percentComplete}%)</p>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, p.percentComplete)}%` }} />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
