import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import toast from 'react-hot-toast';
import { Plus, Globe, CheckCircle2, XCircle } from 'lucide-react';

export default function NriProfilesPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ leadId: '', country: 'USA', city: '', timezone: '', preferredContactMethod: 'WHATSAPP', notes: '' });
  const [countryFilter, setCountryFilter] = useState('');

  const load = async () => {
    try { setProfiles(await api('/nri-profiles')); } catch { /* noop */ }
    try { setStats(await api('/nri-profiles/stats')); } catch { /* noop */ }
    try { setLeads(await api('/leads')); } catch { /* noop */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    try { await api(`/nri-profiles`, { method: `POST`, body: JSON.stringify(form) }); toast.success('NRI profile created'); setShowCreate(false); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;

  const filtered = profiles.filter(p => !countryFilter || p.country === countryFilter);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold">NRI / International Buyers</h1><p className="text-sm text-muted-foreground">Profiles and document status</p></div>
        <Button onClick={() => setShowCreate(!showCreate)}><Plus className="mr-2 h-4 w-4" /> New NRI Profile</Button>
      </div>

      {showCreate && (
        <Card><CardContent className="pt-4 space-y-3">
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.leadId} onChange={e => setForm({ ...form, leadId: e.target.value })}>
            <option value="">Select lead</option>
            {leads.map((l: any) => <option key={l.id} value={l.id}>{l.contact?.name} ({l.contact?.phone})</option>)}
          </select>
          <Input placeholder="Country" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
          <Input placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
          <div className="flex gap-2"><Button onClick={create}>Create</Button><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button></div>
        </CardContent></Card>
      )}

      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total NRI</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Verified</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-emerald-600">{stats.documentsVerified}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pending</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-amber-600">{stats.pendingDocuments}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Verification Rate</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.verificationRate}%</p></CardContent></Card>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex gap-2">{stats?.byCountry?.map((c: any) => (
          <Button key={c.country} size="sm" variant={countryFilter === c.country ? 'default' : 'outline'} onClick={() => setCountryFilter(countryFilter === c.country ? '' : c.country)}>{c.country} ({c._count})</Button>
        ))}</div>
        {filtered.map((p: any) => (
          <Card key={p.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div><CardTitle className="text-base">{p.lead?.contact?.name}</CardTitle><p className="text-xs text-muted-foreground">{p.lead?.contact?.phone}</p></div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="flex items-center gap-1"><Globe className="h-3 w-3" />{p.country}</Badge>
                  {p.documentsVerified ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-amber-500" />}
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
