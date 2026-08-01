import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { fetchLeads, fetchVoiceDashboardStats, VoiceDashboardStats } from '../lib/data';
import { Phone, PhoneOff, Clock, Loader2, ChevronRight, PhoneCall, CheckCircle2, Timer, UserPlus } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const DISPOSITION_COLORS: Record<string, string> = {
  completed: '#10b981', answered: '#10b981',
  no_answer: '#f59e0b', 'no-answer': '#f59e0b', busy: '#f59e0b',
  failed: '#ef4444', voicemail: '#6366f1', unknown: '#9ca3af',
};

export default function VoiceAgentPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<VoiceDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchLeads(1, { hasPhone: 'true', limit: '10' }).then(r => setLeads(r.data || [])).catch(() => {}),
      api('/voice-agent/history').then(setHistory).catch(() => {}),
      fetchVoiceDashboardStats().then(setStats).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const call = async (leadId: string) => {
    setCalling(leadId);
    try {
      const r = await api('/voice-agent/call/' + leadId, { method: 'POST' });
      if (r.success) alert('Call initiated — Mikey will speak Telugu');
      else alert('Call failed: ' + (r.message || r.error));
    } catch (e: any) { alert('Error: ' + e.message); }
    setCalling(null);
  };

  const addAndCall = async () => {
    if (!newName.trim() || !newPhone.trim()) return;
    setAdding(true);
    try {
      const lead = await api('/leads/manual', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), phone: newPhone.trim() }),
      });
      setLeads(prev => [{ ...lead, contact: { name: newName.trim(), phone: newPhone.trim() } }, ...prev]);
      setNewName(''); setNewPhone('');
      await call(lead.id);
    } catch (e: any) { alert('Error: ' + e.message); }
    setAdding(false);
  };

  if (loading) return <div className="p-6 text-center text-[var(--muted-foreground)]"><Loader2 size={20} className="animate-spin inline mr-2" />Loading...</div>;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Voice Agent</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-2">Call leads with Mikey's AI voice — he talks, listens, and qualifies</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--primary-light)] flex items-center justify-center shrink-0"><PhoneCall size={16} className="text-[var(--primary)]" /></div>
            <div>
              <div className="text-xl font-bold text-[var(--foreground)]">{stats.totalCalls}</div>
              <div className="text-[11px] text-[var(--muted-foreground)]">Total Calls</div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--primary-light)] flex items-center justify-center shrink-0"><CheckCircle2 size={16} className="text-[var(--primary)]" /></div>
            <div>
              <div className="text-xl font-bold text-[var(--foreground)]">{stats.answerRate}%</div>
              <div className="text-[11px] text-[var(--muted-foreground)]">Answer Rate</div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--primary-light)] flex items-center justify-center shrink-0"><Timer size={16} className="text-[var(--primary)]" /></div>
            <div>
              <div className="text-xl font-bold text-[var(--foreground)]">{stats.avgDurationSeconds}s</div>
              <div className="text-[11px] text-[var(--muted-foreground)]">Avg Duration</div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--primary-light)] flex items-center justify-center shrink-0"><Clock size={16} className="text-[var(--primary)]" /></div>
            <div>
              <div className="text-xl font-bold text-[var(--foreground)]">{stats.totalMinutesUsed}</div>
              <div className="text-[11px] text-[var(--muted-foreground)]">Total Minutes Used</div>
            </div>
          </div>
        </div>
      )}

      {stats && Object.keys(stats.dispositionCounts).length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-2">Call Outcome Breakdown</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={Object.entries(stats.dispositionCounts).map(([name, value]) => ({ name, value }))}
                dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}
              >
                {Object.keys(stats.dispositionCounts).map((key) => (
                  <Cell key={key} fill={DISPOSITION_COLORS[key.toLowerCase()] || '#9ca3af'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <div>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Ready to call</h2>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] mb-3">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name"
            className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm" />
          <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+91..."
            className="w-36 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm" />
          <button onClick={addAndCall} disabled={adding || !newName.trim() || !newPhone.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 shrink-0">
            {adding ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
            {adding ? 'Calling...' : 'Add & Call'}
          </button>
        </div>
        <div className="grid gap-3">
          {leads.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No leads ready for voice outreach.</p>}
          {leads.map((l: any) => (
            <div key={l.id} className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
              <div className="h-10 w-10 rounded-full bg-[var(--muted)] flex items-center justify-center text-sm font-semibold">{(l.contact?.name || '?')[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-[var(--foreground)] truncate">{l.contact?.name || 'Unknown'}</div>
                <div className="text-xs text-[var(--muted-foreground)]">{l.contact?.phone || ''} • {l.interest || ''}</div>
              </div>
              <button onClick={() => call(l.id)} disabled={calling === l.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50">
                {calling === l.id ? <Loader2 size={13} className="animate-spin" /> : <Phone size={13} />}
                {calling === l.id ? 'Calling...' : 'Call'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">Call History</h2>
        <div className="space-y-2">
          {history.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No calls yet.</p>}
          {history.map((h: any) => (
            <div key={h.id} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]">
              <Phone size={14} className="text-[var(--muted-foreground)] shrink-0" />
              <div className="flex-1 min-w-0 text-sm">
                <span className="font-medium text-[var(--foreground)]">{h.lead?.contact?.name || 'Unknown'}</span>
                <span className="text-[var(--muted-foreground)] ml-2">{h.toNumber}</span>
              </div>
              <span className="text-xs text-[var(--muted-foreground)]">{new Date(h.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${h.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{h.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
