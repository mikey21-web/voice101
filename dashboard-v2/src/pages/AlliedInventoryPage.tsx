import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';

export default function AlliedInventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ projectId: '', type: 'PARKING', label: '', priceRupees: '' });

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const [i, b, p] = await Promise.all([
        api('/allied-inventory/items'),
        api('/allied-inventory/release-batches'),
        api('/projects').catch(() => []),
      ]);
      setItems(i); setBatches(b); setProjects(p);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await api('/allied-inventory/items', { method: 'POST', body: JSON.stringify({ ...form, priceRupees: form.priceRupees ? Number(form.priceRupees) : undefined }) });
      toast.success('Item created'); setShowCreate(false); load();
    } catch (e: any) { toast.error(e.message || 'Failed to create item'); }
  };

  const approveBatch = async (id: string) => {
    try { await api(`/allied-inventory/release-batches/${id}/approve`, { method: 'POST' }); toast.success('Batch released'); load(); }
    catch (e: any) { toast.error(e.message || 'Failed to approve batch'); }
  };

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;

  if (error) {
    return (
      <div className="p-6">
        <Card><CardContent className="pt-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Couldn't load allied inventory.</p>
          <Button variant="outline" onClick={load}>Retry</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Allied Inventory</h1><p className="text-sm text-muted-foreground">Parking, storage, terraces and controlled release batches</p></div>
        <Button onClick={() => setShowCreate(!showCreate)}><Plus className="mr-2 h-4 w-4" /> New Item</Button>
      </div>

      {showCreate && (
        <Card><CardContent className="pt-4 space-y-3">
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}>
            <option value="">Select project</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            <option value="PARKING">Parking</option><option value="STORAGE">Storage</option>
            <option value="TERRACE">Terrace</option><option value="SERVANT_ROOM">Servant Room</option><option value="OTHER">Other</option>
          </select>
          <Input placeholder="Label (e.g. Basement Slot B-12)" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
          <Input type="number" placeholder="Price (rupees)" value={form.priceRupees} onChange={e => setForm({ ...form, priceRupees: e.target.value })} />
          <div className="flex gap-2"><Button onClick={create}>Create</Button><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button></div>
        </CardContent></Card>
      )}

      {items.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground">No allied inventory items yet.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((it: any) => (
            <Card key={it.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{it.type}</Badge>
                  <Badge variant={it.status === 'AVAILABLE' ? 'default' : 'secondary'}>{it.status}</Badge>
                </div>
                <CardTitle className="text-base mt-2">{it.label}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {it.priceRupees && <p className="font-semibold">₹{it.priceRupees.toLocaleString()}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Inventory Release Batches</CardTitle></CardHeader>
        <CardContent>
          {batches.length === 0 ? <p className="text-sm text-muted-foreground">No release batches planned.</p> : (
            <div className="space-y-2">
              {batches.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.unitIds?.length ?? 0} units · release {new Date(b.releaseAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={b.status === 'RELEASED' ? 'default' : 'outline'}>{b.status}</Badge>
                    {b.status === 'PLANNED' && <Button size="sm" onClick={() => approveBatch(b.id)}>Approve & Release</Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
