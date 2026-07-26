import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import toast from 'react-hot-toast';
import { Plus, DollarSign } from 'lucide-react';

export default function RevenueSharePage() {
  const [agreements, setAgreements] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ projectId: '', partnerName: '', partnerType: 'LANDOWNER', sharePercent: '', estimatedTotalSharePaise: '', effectiveDate: '', notes: '' });

  const load = async () => {
    try { setAgreements(await api('/revenue-share/agreements')); } catch { /* noop */ }
    try { setProjects(await api('/projects')); } catch { /* noop */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await api('/revenue-share/agreements', { method: 'POST', body: JSON.stringify({ ...form, sharePercent: parseFloat(form.sharePercent) }) });
      toast.success('Agreement created'); setShowCreate(false); load();
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Revenue Share Allocation</h1><p className="text-sm text-muted-foreground">Landowner & co-promoter settlements</p></div>
        <Button onClick={() => setShowCreate(!showCreate)}><Plus className="mr-2 h-4 w-4" /> New Agreement</Button>
      </div>

      {showCreate && (
        <Card><CardContent className="pt-4 space-y-3">
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}>
            <option value="">Select project</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Input placeholder="Partner name" value={form.partnerName} onChange={e => setForm({ ...form, partnerName: e.target.value })} />
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.partnerType} onChange={e => setForm({ ...form, partnerType: e.target.value })}>
            <option value="LANDOWNER">Landowner</option>
            <option value="CO_PROMOTER">Co-Promoter</option>
            <option value="INVESTOR">Investor</option>
            <option value="OTHER">Other</option>
          </select>
          <Input type="number" placeholder="Share percent (e.g., 25)" value={form.sharePercent} onChange={e => setForm({ ...form, sharePercent: e.target.value })} />
          <Input type="number" placeholder="Estimated total share (paise)" value={form.estimatedTotalSharePaise} onChange={e => setForm({ ...form, estimatedTotalSharePaise: e.target.value })} />
          <Input type="date" value={form.effectiveDate} onChange={e => setForm({ ...form, effectiveDate: e.target.value })} />
          <div className="flex gap-2"><Button onClick={create}>Create</Button><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button></div>
        </CardContent></Card>
      )}

      <div className="grid gap-4">
        {agreements.map((a: any) => (
          <Card key={a.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div><CardTitle className="text-lg">{a.partnerName}</CardTitle><p className="text-xs text-muted-foreground">{a.project?.name} · {a.partnerType}</p></div>
                <Badge variant={a.status === 'SETTLED' ? 'default' : 'secondary'}>{a.status || 'ACTIVE'}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div><p className="text-muted-foreground">Share</p><p className="font-semibold">{a.sharePercent}%</p></div>
                <div><p className="text-muted-foreground">Estimated</p><p className="font-semibold">₹{(Number(a.estimatedTotalSharePaise) / 100).toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">Paid to Date</p><p className="font-semibold">₹{(Number(a.paidToDatePaise) / 100).toLocaleString()}</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
