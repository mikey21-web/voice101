import React, { useState, useEffect, useCallback } from 'react';
import { fetchTasks, fetchAgentStatus, fetchAgentStats, updateTask } from '../lib/data';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import { CheckCircle, Circle, Phone, User, AlertTriangle, Clock, ListChecks, BarChart3, MessageSquare, ChevronRight, Send, X, Search, Calendar } from 'lucide-react';
import { Dialog } from '../components/ui/dialog';

type Tab = 'today' | 'leads' | 'activity';

function goToLead(id: string) { window.location.hash = `#/leads/${id}`; }

function SlaIndicator({ lead }: { lead: any }) {
  const anchor = new Date(lead.createdAt);
  const minutes = Math.floor((Date.now() - anchor.getTime()) / 60000);
  const isHot = lead.segment === 'HOT';
  const green = isHot ? 30 : 60;
  const red = isHot ? 120 : 240;
  let color = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (minutes >= red) color = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  else if (minutes >= green) color = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  const label = minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${color}`}>
      <Clock size={10} /> {label}
    </span>
  );
}

export default function AgentQueuePage() {
  const [tab, setTab] = useState<Tab>('today');
  const [tasks, setTasks] = useState<any[]>([]);
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [hotLeads, setHotLeads] = useState<any[]>([]);
  const [todayVisits, setTodayVisits] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [showWAComposer, setShowWAComposer] = useState(false);
  const [waLeadId, setWaLeadId] = useState('');
  const [waPhone, setWaPhone] = useState('');
  const [waText, setWaText] = useState('');
  const [sendingWA, setSendingWA] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(() => {
    fetchTasks().then((r: any) => setTasks(Array.isArray(r.data) ? r.data : Array.isArray(r) ? r : [])).catch(() => {});
    api('/leads/worklist/mine').then((r: any) => {
      setAllLeads(r.leads ?? r.data ?? []);
      setHotLeads(r.hotLeads ?? []);
      setTodayVisits(r.todayVisits ?? []);
    }).catch(() => {});
    fetchAgentStatus().then(setStatus).catch(() => {});
    fetchAgentStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const toggleTask = async (id: string, current: string) => {
    try {
      await updateTask(id, { status: current === 'done' || current === 'COMPLETED' ? 'PENDING' : 'COMPLETED' });
      refresh();
    } catch {}
  };

  const handleCall = async (leadId: string) => {
    const tid = toast.loading('Initiating call...');
    try {
      await api('/telephony/call', { method: 'POST', body: JSON.stringify({ leadId }) });
      toast.success('Call initiated!', { id: tid });
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate call', { id: tid });
    }
  };

  const handleSendWA = async () => {
    if (!waText.trim()) return;
    setSendingWA(true);
    try {
      await api('/conversations/messages', {
        method: 'POST',
        body: JSON.stringify({
          leadId: waLeadId,
          channel: 'WHATSAPP',
          direction: 'OUTBOUND',
          text: waText.trim(),
        }),
      });
      toast.success('WhatsApp sent');
      setShowWAComposer(false);
      setWaText('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send WhatsApp');
    }
    setSendingWA(false);
  };

  const openWAComposer = (leadId: string, phone: string) => {
    setWaLeadId(leadId);
    setWaPhone(phone);
    setWaText('');
    setShowWAComposer(true);
  };

  const highPriority = tasks.filter(t => t.priority === 'HIGH' || t.priority === 'high');
  const pending = tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'done');
  const filteredLeads = allLeads.filter(l =>
    !searchQuery.trim() ||
    (l.contact?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.contact?.phone || '').includes(searchQuery)
  );

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'today', label: 'Today', icon: <Clock size={18} /> },
    { key: 'leads', label: 'Leads', icon: <User size={18} /> },
    { key: 'activity', label: 'Stats', icon: <BarChart3 size={18} /> },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] pb-20 animate-fade-in">
      <div className="sticky top-0 z-10 bg-[var(--background)] border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold text-[var(--foreground)]">My Queue</h1>
          {status && (
            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
              status.online ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.online ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              {status.online ? 'Online' : 'Offline'}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'leads' && (
          <div className="mt-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPageSize(20); }}
                placeholder="Search leads by name or phone..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
              />
            </div>
          </div>
        )}
      </div>

      {tab === 'today' && (
        <div className="flex-1 px-4 py-4 space-y-4">
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { label: 'Today', value: `${stats.conversationsHandled || 0}`, icon: <ListChecks size={16} /> },
                { label: 'Qualified', value: `${stats.leadsQualified || 0}`, icon: <User size={16} /> },
                { label: 'Rate', value: `${stats.conversionRate || 0}%`, icon: <BarChart3 size={16} /> },
              ].map(s => (
                <div key={s.label} className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-3 text-center">
                  <div className="flex justify-center mb-1 text-[var(--muted-foreground)]">{s.icon}</div>
                  <div className="text-lg font-bold text-[var(--foreground)]">{s.value}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {todayVisits.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Calendar size={14} className="text-blue-500" />
                Today's Visits ({todayVisits.length})
              </h2>
              <div className="space-y-2">
                {todayVisits.map((v: any) => (
                  <div key={v.id} className="rounded-xl bg-[var(--card)] border border-blue-200 dark:border-blue-900/50 p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                        <Calendar size={14} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-[var(--foreground)] truncate">{v.contact?.name || 'Unknown'}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">{v.visitTime ? new Date(v.visitTime).toLocaleTimeString() : ''}</div>
                      </div>
                      <button onClick={() => goToLead(v.id)} className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 transition-colors">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {highPriority.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-red-500" />
                High Priority ({highPriority.length})
              </h2>
              <div className="space-y-2">
                {highPriority.map(t => (
                  <TaskCard key={t.id} task={t} onToggle={toggleTask} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
              All Tasks ({pending.length})
            </h2>
            <div className="space-y-2">
              {pending.slice(0, pageSize).map(t => (
                <TaskCard key={t.id} task={t} onToggle={toggleTask} />
              ))}
              {pending.length === 0 && (
                <div className="text-center py-8 text-sm text-[var(--muted-foreground)]">
                  <CheckCircle size={32} className="mx-auto mb-2 text-emerald-400" />
                  All caught up!
                </div>
              )}
              {pending.length > pageSize && (
                <button onClick={() => setPageSize(p => p + 20)}
                  className="w-full py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--accent)] rounded-lg transition-colors">
                  Show More ({pending.length - pageSize} remaining)
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === 'leads' && (
        <div className="flex-1 px-4 py-4 space-y-4">
          {filteredLeads.length === 0 && searchQuery && (
            <div className="text-center py-8 text-sm text-[var(--muted-foreground)]">No leads match your search</div>
          )}

          {hotLeads.length > 0 && !searchQuery && (
            <section>
              <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-500" />
                Hot Leads ({hotLeads.length})
              </h2>
              <div className="space-y-2">
                {hotLeads.map(l => (
                  <div key={l.id} className="rounded-xl bg-[var(--card)] border border-red-200 dark:border-red-900/50 p-3">
                    <div className="flex items-center justify-between">
                      <button onClick={() => goToLead(l.id)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                          <User size={14} className="text-red-600 dark:text-red-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-[var(--foreground)] truncate">
                              {l.contact?.name || 'Unknown'}
                            </div>
                            <SlaIndicator lead={l} />
                          </div>
                          <div className="text-xs text-[var(--muted-foreground)] truncate">
                            {l.interest || ''} · Score: {l.score || '-'} · {l.status}
                          </div>
                        </div>
                      </button>
                      <div className="flex gap-1 shrink-0">
                        {l.contact?.phone && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); handleCall(l.id); }}
                              className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 hover:bg-green-100 transition-colors" title="Call">
                              <Phone size={14} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); openWAComposer(l.id, l.contact.phone); }}
                              className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 hover:bg-green-100 transition-colors" title="WhatsApp">
                              <MessageSquare size={14} />
                            </button>
                          </>
                        )}
                        <button onClick={() => goToLead(l.id)}
                          className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 transition-colors" title="Open">
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
              {searchQuery ? `Search Results (${filteredLeads.length})` : `All Leads (${allLeads.length})`}
            </h2>
            <div className="space-y-2">
              {(searchQuery ? filteredLeads : allLeads).slice(0, pageSize).map(l => (
                <div key={l.id} className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-3">
                  <div className="flex items-center justify-between">
                    <button onClick={() => goToLead(l.id)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        l.segment === 'HOT' ? 'bg-red-500' : l.segment === 'WARM' ? 'bg-amber-400' : 'bg-gray-300'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-[var(--foreground)] truncate">
                            {l.contact?.name || 'Unknown'}
                          </div>
                          <SlaIndicator lead={l} />
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {l.status} · {l.source} {l.contact?.phone ? `· ${l.contact.phone}` : ''}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        l.segment === 'HOT' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        l.segment === 'WARM' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {l.segment}
                      </span>
                      {l.contact?.phone && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); handleCall(l.id); }}
                            className="p-2 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors" title="Call">
                            <Phone size={14} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openWAComposer(l.id, l.contact.phone); }}
                            className="p-2 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors" title="WhatsApp">
                            <MessageSquare size={14} />
                          </button>
                        </>
                      )}
                      <button onClick={() => goToLead(l.id)}
                        className="p-2 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors" title="Open">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {(searchQuery ? filteredLeads : allLeads).length > pageSize && (
                <button onClick={() => setPageSize(p => p + 20)}
                  className="w-full py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--accent)] rounded-lg transition-colors">
                  Show More ({(searchQuery ? filteredLeads : allLeads).length - pageSize} remaining)
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === 'activity' && (
        <div className="flex-1 px-4 py-4">
          <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Performance</h2>
            {stats ? (
              <div className="space-y-3">
                {[
                  { label: 'Conversations Handled', value: stats.conversationsHandled },
                  { label: 'Leads Qualified', value: stats.leadsQualified },
                  { label: 'Appointments Booked', value: stats.appointmentsBooked },
                  { label: 'Conversion Rate', value: `${stats.conversionRate}%` },
                  { label: 'Avg Response Time', value: `${stats.avgResponseTimeSec}s` },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--muted-foreground)]">{s.label}</span>
                    <span className="text-sm font-semibold text-[var(--foreground)]">{s.value ?? '-'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-[var(--muted-foreground)]">Loading stats...</div>
            )}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-10 bg-[var(--card)] border-t border-[var(--border)] safe-area-bottom">
        <div className="flex max-w-lg mx-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex flex-col items-center py-2.5 text-xs font-medium transition-colors ${
                tab === t.key ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]'
              }`}
            >
              {t.icon}
              <span className="mt-0.5">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Dialog
        open={showWAComposer}
        onClose={() => setShowWAComposer(false)}
        title="Send WhatsApp"
        description={`To: ${waPhone}`}
        maxWidth="max-w-md"
        footer={
          <>
            <button onClick={() => setShowWAComposer(false)} className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)]">Cancel</button>
            <button onClick={handleSendWA} disabled={sendingWA || !waText.trim()}
              className="inline-flex items-center gap-1.5 h-9 px-5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
              <Send size={13} /> {sendingWA ? 'Sending...' : 'Send'}
            </button>
          </>
        }
      >
        <textarea value={waText} onChange={e => setWaText(e.target.value)} rows={3} autoFocus
          placeholder="Type your message..."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 resize-none" />
      </Dialog>
    </div>
  );
}

function TaskCard({ task, onToggle }: { task: any; onToggle: (id: string, status: string) => void }) {
  const isDone = task.status === 'done' || task.status === 'COMPLETED';
  const isOverdue = task.dueAt && new Date(task.dueAt) < new Date() && !isDone;
  return (
    <div className={`rounded-xl bg-[var(--card)] border ${isOverdue ? 'border-red-200 dark:border-red-900/50' : 'border-[var(--border)]'} p-3 ${isDone ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <button onClick={() => onToggle(task.id, task.status)} className="shrink-0 p-0.5">
          {isDone ? <CheckCircle size={20} className="text-emerald-500" /> : <Circle size={20} className="text-[var(--muted-foreground)]" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className={`text-sm ${isDone ? 'line-through text-[var(--muted-foreground)]' : 'font-medium text-[var(--foreground)]'}`}>
            {task.title}
          </div>
          {task.lead?.contact?.name && (
            <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{task.lead.contact.name}</div>
          )}
          {isOverdue && (
            <div className="flex items-center gap-1 text-xs text-red-500 mt-0.5">
              <Clock size={11} />
              Overdue
            </div>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
          task.priority === 'HIGH' || task.priority === 'high'
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : task.priority === 'MEDIUM' || task.priority === 'medium'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
        }`}>
          {task.priority?.toLowerCase() || 'none'}
        </span>
      </div>
    </div>
  );
}
