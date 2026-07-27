import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Bot, Activity, CheckCircle, Calendar, Send, RefreshCw, Brain, Users, Clock, AlertTriangle, TrendingUp, Target, Shield, Bell, Undo2, ThumbsUp, ThumbsDown } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MikeyPage() {
  const [status, setStatus] = useState<any>(null);
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [pendingRules, setPendingRules] = useState<any[]>([]);
  const [activeRules, setActiveRules] = useState<any[]>([]);
  const [autonomousActions, setAutonomousActions] = useState<any[]>([]);
  const [policies, setPolicies] = useState<Record<string, string>>({});
  const [killSwitches, setKillSwitches] = useState<any[]>([]);
  const [pausing, setPausing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'outcomes' | 'insights' | 'staff' | 'activity' | 'autonomy'>('overview');
  const [goalInput, setGoalInput] = useState('');

  const togglePause = async () => {
    const paused = killSwitches.find((k: any) => k.key === 'mikey_paused');
    const isPaused = paused?.enabled === true;
    setPausing(true);
    try {
      if (isPaused) {
        await api('/admin/ai-kill-switches/mikey_paused/disable', { method: 'POST' });
        toast.success('Mikey resumed — scans will run on the next cycle');
      } else {
        await api('/admin/ai-kill-switches/mikey_paused/enable', { method: 'POST' });
        toast.success('Mikey paused — no autonomous scans or actions until resumed');
      }
      fetchAll();
    } catch (e: any) {
      if (e.message?.includes('403') || e.message?.includes('Forbidden')) {
        toast.error('Only owners and admins can pause Mikey');
      } else {
        toast.error(e.message || 'Failed to toggle pause');
      }
    } finally {
      setPausing(false);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s, o, i, st, a, act, pr, ar, aa, pol, ks] = await Promise.all([
        api('/mikey/status').catch(() => null),
        api('/mikey/outcomes').catch(() => []),
        api('/mikey/temporal-insights').catch(() => []),
        api('/mikey/staff').catch(() => []),
        api('/mikey/actions').catch(() => []),
        api('/mikey/activity').catch(() => []),
        api('/mikey/memory/rules/pending?tenantId=default-tenant').catch(() => []),
        api('/mikey/memory/rules/active?tenantId=default-tenant').catch(() => []),
        api('/mikey/autonomous-actions').catch(() => []),
        api('/mikey/autonomy-policies?tenantId=default-tenant').catch(() => ({})),
        api('/admin/ai-kill-switches').catch(() => []),
      ]);
      setStatus(s);
      setOutcomes(Array.isArray(o) ? o : o?.data || []);
      setInsights(Array.isArray(i) ? i : []);
      setStaff(Array.isArray(st) ? st : []);
      setActions(Array.isArray(a) ? a : []);
      setActivity(Array.isArray(act) ? act : []);
      setPendingRules(Array.isArray(pr) ? pr : []);
      setActiveRules(Array.isArray(ar) ? ar : []);
      setAutonomousActions(Array.isArray(aa) ? aa : []);
      setPolicies(pol && typeof pol === 'object' ? pol : {});
      setKillSwitches(Array.isArray(ks) ? ks : []);
    } catch (e: any) {
      toast.error('Failed to load Mikey data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const approveRule = async (id: string) => {
    try {
      await api(`/mikey/memory/rules/approve/${id}`, { method: 'POST', body: JSON.stringify({ approvedById: 'dashboard' }) });
      toast.success('Rule approved — Mikey will start applying it');
      fetchAll();
    } catch (e: any) { toast.error(e.message || 'Failed to approve rule'); }
  };

  const rejectRule = async (id: string) => {
    try {
      await api(`/mikey/memory/rules/retire/${id}`, { method: 'POST' });
      toast.success('Rule rejected');
      fetchAll();
    } catch (e: any) { toast.error(e.message || 'Failed to reject rule'); }
  };

  const setPolicyLevel = async (category: string, level: string) => {
    const previous = policies[category];
    setPolicies({ ...policies, [category]: level }); // optimistic — this is a low-stakes settings toggle
    try {
      await api(`/mikey/autonomy-policies/${category}`, { method: 'POST', body: JSON.stringify({ tenantId: 'default-tenant', level }) });
      toast.success(`${category.replace(/_/g, ' ')} set to ${level}`);
    } catch (e: any) {
      setPolicies({ ...policies, [category]: previous });
      toast.error(e.message || 'Failed to update policy');
    }
  };

  const undoAction = async (id: string) => {
    try {
      await api(`/mikey/autonomous-actions/${id}/undo`, { method: 'POST' });
      toast.success('Undone');
      fetchAll();
    } catch (e: any) { toast.error(e.message || 'Could not undo this action'); }
  };

  const [defining, setDefining] = useState(false);

  const handleDefineOutcome = async () => {
    if (!goalInput.trim() || defining) return;
    setDefining(true);
    try {
      // The run itself (several chained LLM calls) can take 60-90s — the endpoint
      // returns as soon as the outcome is defined and the run has started in the
      // background, so we poll for progress instead of awaiting the whole chain.
      await api('/copilot/outcomes', {
        method: 'POST',
        body: JSON.stringify({
          goal: goalInput.trim(),
          metric: 'conversion_rate',
          target: 30,
          current: 20,
        }),
      });
      toast.success('Jarvis is on it — running the steps now');
      setGoalInput('');
      setActiveTab('outcomes');
      fetchAll();

      let polls = 0;
      const interval = setInterval(() => {
        polls += 1;
        fetchAll();
        if (polls >= 20) clearInterval(interval); // ~80s of polling, then stop
      }, 4000);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDefining(false);
    }
  };

  const cancelOutcome = async (id: string) => {
    try {
      await api(`/copilot/outcomes/${id}/cancel`, { method: 'POST' });
      toast.success('Outcome cancelled');
      fetchAll();
    } catch (e: any) {
      toast.error(e.message || 'Failed to cancel outcome');
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-fade-in">
        <div className="h-8 w-48 bg-[var(--muted)] rounded-lg animate-pulse" />
        <div className="h-4 w-72 bg-[var(--muted)] rounded-lg animate-pulse" />
        <div className="grid grid-cols-4 gap-4 mt-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-[var(--muted)] rounded-lg animate-pulse" />)}
        </div>
        <div className="h-64 bg-[var(--muted)] rounded-lg animate-pulse mt-4" />
      </div>
    );
  }

  const activeOutcomes = outcomes.filter((o: any) => o.status === 'active');
  const completedOutcomes = outcomes.filter((o: any) => o.status === 'completed');

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-7 h-7 text-[var(--primary)]" />
            Mikey Command Center
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Unified intelligence — proactive, autonomous, always learning
          </p>
        </div>
        <button onClick={fetchAll} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] text-sm transition-colors">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[var(--muted-foreground)] text-xs font-medium uppercase tracking-wider mb-2">
            <Activity className="w-3.5 h-3.5" />
            Active Outcomes
          </div>
          <div className="text-2xl font-bold">{activeOutcomes.length}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[var(--muted-foreground)] text-xs font-medium uppercase tracking-wider mb-2">
            <CheckCircle className="w-3.5 h-3.5" />
            Completed
          </div>
          <div className="text-2xl font-bold">{completedOutcomes.length}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[var(--muted-foreground)] text-xs font-medium uppercase tracking-wider mb-2">
            <Users className="w-3.5 h-3.5" />
            Agents Tracked
          </div>
          <div className="text-2xl font-bold">{staff.length}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[var(--muted-foreground)] text-xs font-medium uppercase tracking-wider mb-2">
            <TrendingUp className="w-3.5 h-3.5" />
            Insights
          </div>
          <div className="text-2xl font-bold">{insights.length}</div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-[var(--border)] pb-2">
        {(['overview', 'activity', 'autonomy', 'outcomes', 'insights', 'staff'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${activeTab === tab ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>
            {tab === 'overview' && <Activity className="w-4 h-4 inline mr-1.5" />}
            {tab === 'activity' && <Bell className="w-4 h-4 inline mr-1.5" />}
            {tab === 'autonomy' && <Brain className="w-4 h-4 inline mr-1.5" />}
            {tab === 'outcomes' && <Target className="w-4 h-4 inline mr-1.5" />}
            {tab === 'insights' && <TrendingUp className="w-4 h-4 inline mr-1.5" />}
            {tab === 'staff' && <Users className="w-4 h-4 inline mr-1.5" />}
            {tab}
            {tab === 'autonomy' && pendingRules.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">{pendingRules.length}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-[var(--primary)]" />
              Define New Outcome
            </h2>
            <div className="flex gap-3">
              <input
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                placeholder="e.g. Increase conversion rate by 20% this month..."
                className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                onKeyDown={e => e.key === 'Enter' && handleDefineOutcome()}
              />
              <button onClick={handleDefineOutcome} disabled={defining} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {defining ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {defining ? 'Running...' : 'Define'}
              </button>
            </div>
          </div>

          {status && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[var(--primary)]" />
                Outcome Progress
              </h2>
              <div className="space-y-3">
                {(status.outcomes || []).slice(0, 5).map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{o.goal}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {o.status} — {o.progress}/{o.steps} steps
                      </p>
                    </div>
                    <div className="ml-4 w-24">
                      <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                        <div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${o.steps > 0 ? (o.progress / o.steps) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
                {(!status.outcomes || status.outcomes.length === 0) && (
                  <p className="text-sm text-[var(--muted-foreground)]">No outcomes defined yet. Tell Mikey what you want to achieve.</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-[var(--primary)]" />
                Autonomous Rules
              </h2>
              <div className="space-y-2">
                {(actions || []).slice(0, 5).map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--background)] text-sm">
                    <span className="font-mono text-xs">{r.tool}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.risk === 'low' ? 'bg-green-500/10 text-green-600' :
                      r.risk === 'medium' ? 'bg-yellow-500/10 text-yellow-600' :
                      'bg-red-500/10 text-red-600'
                    }`}>
                      {r.risk}
                    </span>
                  </div>
                ))}
                {actions.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No action rules configured.</p>}
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[var(--primary)]" />
                Proactive Findings
              </h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                Mikey scans every 5 minutes for stale leads, conversion anomalies, and source shifts. Critical findings auto-trigger actions.
              </p>
              <div className="mt-3 flex gap-2 flex-wrap">
                <span className="text-xs px-2 py-1 rounded-full border border-[var(--border)] text-[var(--muted-foreground)]">Stale hot leads</span>
                <span className="text-xs px-2 py-1 rounded-full border border-[var(--border)] text-[var(--muted-foreground)]">Conversion anomalies</span>
                <span className="text-xs px-2 py-1 rounded-full border border-[var(--border)] text-[var(--muted-foreground)]">Lead source shifts</span>
                <span className="text-xs px-2 py-1 rounded-full border border-[var(--border)] text-[var(--muted-foreground)]">Staff performance</span>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mt-3">
                Findings emit via Socket.IO on <code className="text-[var(--primary)]">mikey.*</code> channels.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            Everything Mikey has noticed and done — persisted, so it's still here after a restart.
          </p>
          {activity.length === 0 && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 text-center">
              <Bell className="w-12 h-12 text-[var(--muted-foreground)] mx-auto mb-3" />
              <p className="text-[var(--muted-foreground)]">Nothing yet — Mikey scans every 5 minutes.</p>
            </div>
          )}
          {activity.map((a: any) => (
            <div key={a.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-start gap-3">
              <span className={`mt-0.5 shrink-0 text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                a.severity === 'critical' ? 'bg-red-500/10 text-red-600' :
                a.severity === 'warning' ? 'bg-amber-500/10 text-amber-600' :
                'bg-blue-500/10 text-blue-600'
              }`}>
                {a.severity}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium capitalize">{a.title}</p>
                {a.description && <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{a.description}</p>}
              </div>
              <span className="text-xs text-[var(--muted-foreground)] shrink-0">
                {new Date(a.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'autonomy' && (
        <div className="space-y-6">
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Global Kill Switch
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                {killSwitches.find((k: any) => k.key === 'mikey_paused')?.enabled
                  ? 'All autonomous scans and actions are currently paused. No Mikey activity until resumed.'
                  : 'Mikey is active and scanning every 5 minutes. Toggle to pause all autonomous behavior.'}
              </p>
            </div>
            <button
              onClick={togglePause}
              disabled={pausing}
              className={`shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                killSwitches.find((k: any) => k.key === 'mikey_paused')?.enabled
                  ? 'bg-green-500/20 text-green-600 hover:bg-green-500/30 border border-green-500/30'
                  : 'bg-red-500/20 text-red-600 hover:bg-red-500/30 border border-red-500/30'
              } disabled:opacity-50`}
            >
              {pausing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : killSwitches.find((k: any) => k.key === 'mikey_paused')?.enabled ? (
                'Resume Mikey'
              ) : (
                'Pause All Autonomous Actions'
              )}
            </button>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
              <Shield className="w-5 h-5 text-[var(--primary)]" />
              Policies
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-3">
              What Mikey is allowed to act on, per category. "Autonomous" acts on its own within the daily cap/quiet-hours/cooldown guardrails; "Observe" detects and reports but never acts; "Off" turns detection-driven action off entirely for that category.
            </p>
            <div className="space-y-2">
              {[
                { key: 'lead_assignment', label: 'Auto-assign unassigned/stale leads to the least-loaded agent' },
                { key: 'lead_messaging', label: 'Send re-engagement WhatsApp nudges to stale hot leads' },
                { key: 'task_escalation', label: 'Escalate overdue tasks to high priority' },
                { key: 'jarvis_tools', label: 'Execute tool calls from chat/voice (site visits, holds, tickets, etc.)' },
              ].map(({ key, label }) => (
                <div key={key} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{key.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{label}</p>
                  </div>
                  <select
                    value={policies[key] || 'autonomous'}
                    onChange={(e) => setPolicyLevel(key, e.target.value)}
                    className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs font-medium"
                  >
                    <option value="autonomous">Autonomous</option>
                    <option value="observe">Observe only</option>
                    <option value="off">Off</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
              <Brain className="w-5 h-5 text-[var(--primary)]" />
              Learned Rules Awaiting Review
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-3">
              Mikey proposes these after reflecting on won/lost outcomes. Nothing here changes behavior until you approve it.
            </p>
            {pendingRules.length === 0 ? (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 text-center text-sm text-[var(--muted-foreground)]">
                Nothing waiting on you right now.
              </div>
            ) : (
              <div className="space-y-2">
                {pendingRules.map((r: any) => (
                  <div key={r.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{r.rule}</p>
                        {r.rationale && <p className="text-xs text-[var(--muted-foreground)] mt-1">{r.rationale}</p>}
                        {r.category && <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">{r.category}</span>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => approveRule(r.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 text-xs font-medium hover:bg-green-500/20 transition-colors">
                          <ThumbsUp className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button onClick={() => rejectRule(r.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 text-xs font-medium hover:bg-red-500/20 transition-colors">
                          <ThumbsDown className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {activeRules.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Active Rules</h2>
              <div className="space-y-1.5">
                {activeRules.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm">
                    <span className="min-w-0 truncate">{r.rule}</span>
                    <span className="shrink-0 text-xs text-[var(--muted-foreground)] ml-3">applied {r.applyCount}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
              <Shield className="w-5 h-5 text-[var(--primary)]" />
              What Mikey Did On Its Own
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-3">
              Every action Mikey took without being asked, in the last 24 hours. Reversible actions can be undone.
            </p>
            {autonomousActions.length === 0 ? (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 text-center text-sm text-[var(--muted-foreground)]">
                Nothing autonomous happened in the last 24 hours.
              </div>
            ) : (
              <div className="space-y-2">
                {autonomousActions.map((a: any) => (
                  <div key={a.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        <span className="font-mono text-xs text-[var(--primary)]">{a.tool}</span>
                        {a.result && <span className="text-[var(--muted-foreground)]"> — {a.result}</span>}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                        {a.findingType.replace(/_/g, ' ')} · {new Date(a.createdAt).toLocaleString()}
                        {a.undone && <span className="ml-2 text-amber-600">undone</span>}
                      </p>
                    </div>
                    {a.undoable && !a.undone && (
                      <button onClick={() => undoAction(a.id)} className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium hover:bg-[var(--accent)] transition-colors">
                        <Undo2 className="w-3.5 h-3.5" /> Undo
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'outcomes' && (
        <div className="space-y-4">
          {outcomes.length === 0 && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 text-center">
              <Target className="w-12 h-12 text-[var(--muted-foreground)] mx-auto mb-3" />
              <p className="text-[var(--muted-foreground)]">No outcomes yet. Tell Mikey a goal!</p>
            </div>
          )}
          {outcomes.map((o: any) => (
            <div key={o.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3 gap-3">
                <h3 className="font-semibold min-w-0 truncate">{o.goal}</h3>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                    o.status === 'active' ? 'bg-blue-500/10 text-blue-600' :
                    o.status === 'awaiting_approval' ? 'bg-amber-500/10 text-amber-600' :
                    o.status === 'completed' ? 'bg-green-500/10 text-green-600' :
                    o.status === 'cancelled' ? 'bg-[var(--muted)] text-[var(--muted-foreground)]' :
                    'bg-red-500/10 text-red-600'
                  }`}>
                    {o.status.replace(/_/g, ' ')}
                  </span>
                  {(o.status === 'active' || o.status === 'awaiting_approval') && (
                    <button onClick={() => cancelOutcome(o.id)} className="text-xs px-2.5 py-1 rounded-full border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-[var(--muted-foreground)] mb-3">
                {o.metric} — target: {o.target} (current: {o.current})
              </p>
              {o.status === 'awaiting_approval' && (
                <div className="mb-3 text-xs px-3 py-2 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-between gap-2">
                  <span>Paused on a step that needs your approval (payment or proposal action).</span>
                  <a href="#/copilot" className="font-medium underline shrink-0">Review in Copilot</a>
                </div>
              )}
              <div className="space-y-2">
                {(o.steps || []).map((s: any) => (
                  <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--background)]">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      s.status === 'completed' ? 'bg-green-500/20 text-green-600' :
                      s.status === 'failed' ? 'bg-red-500/20 text-red-600' :
                      s.status === 'in_progress' ? 'bg-blue-500/20 text-blue-600' :
                      'bg-[var(--muted)] text-[var(--muted-foreground)]'
                    }`}>
                      {s.status === 'completed' ? '✓' : s.status === 'failed' ? '✗' : s.status === 'in_progress' ? <RefreshCw className="w-3 h-3 animate-spin" /> : String(o.steps.indexOf(s) + 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">{s.description}</span>
                      {s.result && <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate">{s.result}</p>}
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)] capitalize shrink-0">{s.status.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="space-y-4">
          {insights.length === 0 && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 text-center">
              <TrendingUp className="w-12 h-12 text-[var(--muted-foreground)] mx-auto mb-3" />
              <p className="text-[var(--muted-foreground)]">Not enough lead data yet (need 20+ leads in 30 days).</p>
            </div>
          )}
          {insights.map((insight: any, i: number) => (
            <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  insight.lift > 0 ? 'bg-green-500/10 text-green-600' : 'bg-orange-500/10 text-orange-600'
                }`}>
                  {insight.lift > 0 ? '+' : ''}{insight.lift.toFixed(0)}% lift
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {insight.type === 'day_of_week' && `Day: ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][insight.dayOfWeek]}`}
                  {insight.type === 'source_time' && `${insight.source} on ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][insight.dayOfWeek]}`}
                </span>
              </div>
              <p className="text-sm">{insight.recommendation}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-2">
                {insight.leadCount} leads — {insight.type === 'day_of_week' ? 'day' : 'source-day'} conversion {(insight.conversionRate * 100).toFixed(1)}% vs baseline {(insight.baselineRate * 100).toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="space-y-4">
          {staff.length === 0 && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 text-center">
              <Users className="w-12 h-12 text-[var(--muted-foreground)] mx-auto mb-3" />
              <p className="text-[var(--muted-foreground)]">No agent data yet. Agents need 3+ leads in 90 days.</p>
            </div>
          )}
          {staff.map((agent: any) => {
            const bestSource = Object.entries(agent.bySource || {}).sort(([, a]: any, [, b]: any) => b.rate - a.rate)[0];
            return (
              <div key={agent.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{agent.name}</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">{agent.email}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${agent.conversionRate > 0.3 ? 'text-green-600' : agent.conversionRate > 0.15 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {(agent.conversionRate * 100).toFixed(0)}%
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">conversion</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="p-2.5 rounded-lg bg-[var(--background)]">
                    <p className="text-xs text-[var(--muted-foreground)]">Leads handled</p>
                    <p className="font-semibold">{agent.totalLeadsHandled}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--background)]">
                    <p className="text-xs text-[var(--muted-foreground)]">Avg response</p>
                    <p className="font-semibold">{agent.avgResponseTimeMinutes ? `${agent.avgResponseTimeMinutes.toFixed(0)}min` : 'N/A'}</p>
                  </div>
                </div>
                {bestSource && (
                  <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                    Best source: <span className="text-[var(--foreground)] font-medium">{bestSource[0]}</span> ({(bestSource[1] as any).rate * 100 > 0 ? `${((bestSource[1] as any).rate * 100).toFixed(0)}%` : '0%'})
                  </div>
                )}
                {agent.strengths.length > 0 && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {agent.strengths.map((s: string, i: number) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">{s}</span>
                    ))}
                  </div>
                )}
                {agent.weaknesses.length > 0 && (
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {agent.weaknesses.map((w: string, i: number) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600">{w}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
