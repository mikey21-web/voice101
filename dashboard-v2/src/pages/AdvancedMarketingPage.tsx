import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';

export default function AdvancedMarketingPage() {
  const [pages, setPages] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [spend, setSpend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showSegment, setShowSegment] = useState(false);
  const [segmentForm, setSegmentForm] = useState({ name: '', status: '', source: '' });
  const [preview, setPreview] = useState<Record<string, any>>({});

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const [p, s, sp] = await Promise.all([
        api('/landing-pages'), api('/audience-segments'), api('/ad-spend/report'),
      ]);
      setPages(p); setSegments(s); setSpend(sp);
    } catch { setError(true); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const createSegment = async () => {
    const filters: any = {};
    if (segmentForm.status) filters.status = segmentForm.status;
    if (segmentForm.source) filters.source = segmentForm.source;
    try {
      await api('/audience-segments', { method: 'POST', body: JSON.stringify({ name: segmentForm.name, filters }) });
      toast.success('Segment created'); setShowSegment(false); load();
    } catch (e: any) { toast.error(e.message || 'Failed to create segment'); }
  };

  const previewSegment = async (id: string) => {
    try { setPreview({ ...preview, [id]: await api(`/audience-segments/${id}/preview`) }); }
    catch (e: any) { toast.error(e.message || 'Failed to preview segment'); }
  };

  const publishPage = async (id: string) => {
    try { await api(`/landing-pages/${id}/publish`, { method: 'POST' }); toast.success('Page published'); load(); }
    catch (e: any) { toast.error(e.message || 'Failed to publish'); }
  };

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;

  if (error) {
    return (
      <div className="p-6">
        <Card><CardContent className="pt-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Couldn't load marketing data.</p>
          <Button variant="outline" onClick={load}>Retry</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold">Advanced Marketing</h1><p className="text-sm text-muted-foreground">Landing pages, audience segments, ad spend</p></div>

      <Card>
        <CardHeader><CardTitle>Landing Pages</CardTitle></CardHeader>
        <CardContent>
          {pages.length === 0 ? <p className="text-sm text-muted-foreground">No landing pages yet.</p> : (
            <div className="space-y-2">
              {pages.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <div><p className="text-sm font-medium">{p.title}</p><p className="text-xs text-muted-foreground">/{p.slug}</p></div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.status === 'PUBLISHED' ? 'default' : 'outline'}>{p.status}</Badge>
                    {p.status === 'DRAFT' && <Button size="sm" onClick={() => publishPage(p.id)}>Publish</Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Audience Segments</CardTitle>
          <Button size="sm" onClick={() => setShowSegment(!showSegment)}><Plus className="mr-2 h-4 w-4" /> New Segment</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showSegment && (
            <div className="space-y-2 border rounded-md p-3">
              <Input placeholder="Segment name" value={segmentForm.name} onChange={e => setSegmentForm({ ...segmentForm, name: e.target.value })} />
              <Input placeholder="Filter: lead status (e.g. NEW)" value={segmentForm.status} onChange={e => setSegmentForm({ ...segmentForm, status: e.target.value })} />
              <Input placeholder="Filter: source (e.g. FACEBOOK)" value={segmentForm.source} onChange={e => setSegmentForm({ ...segmentForm, source: e.target.value })} />
              <div className="flex gap-2"><Button size="sm" onClick={createSegment}>Create</Button><Button size="sm" variant="outline" onClick={() => setShowSegment(false)}>Cancel</Button></div>
            </div>
          )}
          {segments.length === 0 ? <p className="text-sm text-muted-foreground">No segments yet.</p> : (
            <div className="space-y-2">
              {segments.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <p className="text-sm font-medium">{s.name}</p>
                  <div className="flex items-center gap-3">
                    {preview[s.id] && <span className="text-xs text-muted-foreground">{preview[s.id].count} leads</span>}
                    <Button size="sm" variant="outline" onClick={() => previewSegment(s.id)}>Preview</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Ad Spend by Source</CardTitle>
          <label className="cursor-pointer inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--primary)] text-white text-xs font-medium hover:opacity-90">
            Upload CSV
            <input type="file" accept=".csv" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const fd = new FormData(); fd.append('file', f);
              try {
                const res = await api('/ad-spend/csv', { method: 'POST', body: fd, headers: {} });
                toast.success(`Imported ${res.imported} rows${res.errors?.length ? ` with ${res.errors.length} errors` : ''}`);
                load();
              } catch (e: any) { toast.error(e.message || 'CSV import failed'); }
              e.target.value = '';
            }} />
          </label>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[var(--muted-foreground)] mb-3">CSV format: source, date (YYYY-MM-DD), amount, campaign (optional), currency (optional)</p>
          {spend.length === 0 ? <p className="text-sm text-muted-foreground">No ad spend imported yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="pb-2 font-medium">Source</th><th className="pb-2 font-medium">Spend</th><th className="pb-2 font-medium">Leads</th><th className="pb-2 font-medium">Cost/Lead</th></tr></thead><tbody>
                {spend.map((s: any) => (
                  <tr key={s.source} className="border-b last:border-0">
                    <td className="py-2">{s.source}</td>
                    <td className="py-2">₹{(s.spendPaise / 100).toLocaleString()}</td>
                    <td className="py-2">{s.leadCount}</td>
                    <td className="py-2">{s.costPerLeadPaise ? `₹${(s.costPerLeadPaise / 100).toLocaleString()}` : '—'}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
