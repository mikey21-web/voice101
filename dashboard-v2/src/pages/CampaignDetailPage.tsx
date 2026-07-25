import React, { useState, useEffect } from 'react';
import {
  fetchCampaign, updateCampaign, startCampaign, pauseCampaign,
  completeCampaign, archiveCampaign, deleteCampaign, fetchCampaignPerformance, fetchCampaignTimeline,
  duplicateCampaign,
} from '../lib/data';
import {
  ArrowLeft, Edit2, Play, Pause, CheckCircle, Archive, Copy, Save, X, Loader2, Trash2, AlertTriangle,
  Megaphone, Users, TrendingUp, DollarSign, Target, Calendar, Clock, MapPin, Hash,
} from 'lucide-react';
import toast from 'react-hot-toast';
import CampaignPerformanceCards from '../components/campaigns/CampaignPerformanceCards';
import CampaignTargetingPanel from '../components/campaigns/CampaignTargetingPanel';
import CampaignCreativesGrid from '../components/campaigns/CampaignCreativesGrid';
import CampaignTimeline from '../components/campaigns/CampaignTimeline';
import CampaignLeadChart from '../components/campaigns/CampaignLeadChart';
import CampaignSourceBreakdown from '../components/campaigns/CampaignSourceBreakdown';
import CampaignBudgetBar from '../components/campaigns/CampaignBudgetBar';
import { Dialog } from '../components/ui/dialog';

function getCampaignId() {
  const hash = window.location.hash.replace('#', '');
  return hash.split('/')[2] || '';
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  archived: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_ACTIONS: { label: string; action: string; icon: React.ElementType; showFor: string[] }[] = [
  { label: 'Start', action: 'start', icon: Play, showFor: ['draft', 'paused'] },
  { label: 'Pause', action: 'pause', icon: Pause, showFor: ['active'] },
  { label: 'Complete', action: 'complete', icon: CheckCircle, showFor: ['active', 'paused'] },
  { label: 'Archive', action: 'archive', icon: Archive, showFor: ['draft', 'active', 'paused', 'completed'] },
];

const DETAIL_TABS = ['Overview', 'Audience', 'Creatives', 'Timeline', 'Settings'];

function formatCurrency(amount: number | null | undefined, currency = '₹'): string {
  if (amount == null) return '—';
  return `${currency}${amount.toLocaleString('en-IN')}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-[var(--muted)] animate-pulse" />
        <div className="h-6 bg-[var(--muted)] rounded animate-pulse w-48" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-2">
            <div className="h-3 bg-[var(--muted)] rounded animate-pulse w-2/3" />
            <div className="h-6 bg-[var(--muted)] rounded animate-pulse w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CampaignDetailPage() {
  const id = getCampaignId();
  const [campaign, setCampaign] = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [tab, setTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchCampaign(id).then(setCampaign),
      fetchCampaignPerformance(id).then(setPerformance).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [id]);

  const loadTimeline = async () => {
    try {
      const data = await fetchCampaignTimeline(id);
      setTimeline(data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (tab === 'Timeline') loadTimeline();
  }, [tab]);

  const status = campaign?.status || (campaign?.active ? 'active' : 'draft');
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  const channels = campaign?.channels || [];
  const leadCount = campaign?.leadCount ?? campaign?._count?.leads ?? 0;

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      switch (action) {
        case 'start':
          await startCampaign(id);
          toast.success('Campaign started');
          break;
        case 'pause':
          await pauseCampaign(id);
          toast.success('Campaign paused');
          break;
        case 'complete':
          await completeCampaign(id);
          toast.success('Campaign completed');
          break;
        case 'archive':
          await archiveCampaign(id);
          toast.success('Campaign archived');
          break;
        case 'duplicate':
          await duplicateCampaign(id);
          toast.success('Campaign duplicated');
          break;
      }
      const updated = await fetchCampaign(id);
      setCampaign(updated);
    } catch (e: any) {
      toast.error(e.message || `Failed to ${action} campaign`);
    } finally {
      setActionLoading(null);
    }
  };

  const startEditing = () => {
    setEditForm({
      name: campaign.name || '',
      description: campaign.description || '',
      campaignType: campaign.campaignType || '',
      priority: campaign.priority || 'medium',
      channels: campaign.channels || [],
      totalBudget: campaign.totalBudget || '',
      dailyBudget: campaign.dailyBudget || '',
      currency: campaign.currency || 'INR',
      startDate: campaign.startDate ? campaign.startDate.slice(0, 10) : '',
      endDate: campaign.endDate ? campaign.endDate.slice(0, 10) : '',
      utmSource: campaign.utmSource || '',
      utmMedium: campaign.utmMedium || '',
      utmCampaign: campaign.utmCampaign || '',
      utmTerm: campaign.utmTerm || '',
      utmContent: campaign.utmContent || '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = { ...editForm };
      if (payload.totalBudget) payload.totalBudget = Number(payload.totalBudget);
      else delete payload.totalBudget;
      if (payload.dailyBudget) payload.dailyBudget = Number(payload.dailyBudget);
      else delete payload.dailyBudget;
      await updateCampaign(id, payload);
      toast.success('Campaign updated');
      setEditing(false);
      const updated = await fetchCampaign(id);
      setCampaign(updated);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update campaign');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCampaign(id);
      toast.success('Campaign deleted');
      window.location.hash = '/campaigns';
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete campaign');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) return <DetailSkeleton />;
  if (!campaign) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-[var(--muted-foreground)]">
        Campaign not found.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back + header */}
      <div>
        <a
          href="#/campaigns"
          className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft size={14} /> Back to Campaigns
        </a>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--primary)]/20 to-[var(--accent)] flex items-center justify-center shrink-0">
              <Megaphone size={18} className="text-[var(--primary)]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--foreground)] truncate">{campaign.name}</h1>
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>
                  {statusLabel}
                </span>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Created {formatDate(campaign.createdAt)}
                {campaign.campaignType && ` · ${campaign.campaignType.replace(/-/g, ' ')}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_ACTIONS.filter((a) => a.showFor.includes(status)).map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.action}
                  onClick={() => handleAction(action.action)}
                  disabled={actionLoading === action.action}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50 transition-colors"
                >
                  {actionLoading === action.action ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Icon size={13} />
                  )}
                  {action.label}
                </button>
              );
            })}
            <button
              onClick={() => handleAction('duplicate')}
              disabled={actionLoading === 'duplicate'}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50 transition-colors"
            >
              <Copy size={13} /> Duplicate
            </button>
            <button
              onClick={startEditing}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--primary)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <Edit2 size={13} /> Edit
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)] overflow-x-auto">
        {DETAIL_TABS.map((t) => (
          <button
            key={t}
            role="tab"
            onClick={() => setTab(t)}
            className={`px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
              tab === t
                ? 'border-[var(--primary)] text-[var(--foreground)] font-medium'
                : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'Overview' && (
        <div className="space-y-6">
          <CampaignPerformanceCards data={performance || {}} loading={false} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily lead chart */}
            <CampaignLeadChart
              data={performance?.dailyLeads || []}
              loading={false}
            />

            {/* Source breakdown */}
            <CampaignSourceBreakdown
              data={performance?.sourceBreakdown || []}
              loading={false}
            />
          </div>

          {/* Channel performance */}
          {channels.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Channel Performance</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {channels.map((ch: string) => {
                  const chData = performance?.channelBreakdown?.[ch] || {};
                  return (
                    <div key={ch} className="rounded-lg border border-[var(--border)] p-3">
                      <div className="text-xs font-semibold text-[var(--foreground)] capitalize mb-2">{ch}</div>
                      <div className="space-y-1.5 text-xs text-[var(--muted-foreground)]">
                        <div className="flex justify-between">
                          <span>Leads</span>
                          <span className="font-medium text-[var(--foreground)]">{chData.leads || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Conversions</span>
                          <span className="font-medium text-[var(--foreground)]">{chData.conversions || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Spend</span>
                          <span className="font-medium text-[var(--foreground)]">{formatCurrency(chData.spend)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent timeline */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Recent Timeline</h3>
              <button
                onClick={() => setTab('Timeline')}
                className="text-xs font-medium text-[var(--primary)] hover:underline"
              >
                View All
              </button>
            </div>
            <CampaignTimeline entries={timeline.slice(0, 5)} />
          </div>
        </div>
      )}

      {/* ── Audience Tab ── */}
      {tab === 'Audience' && (
        <div className="space-y-6">
          <CampaignTargetingPanel data={campaign} />

          {/* Lead segment breakdown */}
          {performance?.segmentBreakdown && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Lead Segment Breakdown</h3>
              <div className="space-y-3">
                {Object.entries(performance.segmentBreakdown).map(([segment, count]: any) => {
                  const total = Object.values(performance.segmentBreakdown).reduce((a: any, b: any) => a + b, 0) as number;
                  const pct = total > 0 ? ((count as number) / total) * 100 : 0;
                  const colors: Record<string, string> = {
                    HOT: 'bg-red-500', WARM: 'bg-amber-500', COLD: 'bg-blue-500',
                    UNQUALIFIED: 'bg-gray-400', EXISTING_CUSTOMER: 'bg-emerald-500', RECONNECT: 'bg-purple-500',
                  };
                  return (
                    <div key={segment}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-[var(--foreground)] capitalize">{segment.replace(/_/g, ' ')}</span>
                        <span className="text-[var(--muted-foreground)]">{count} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${colors[segment] || 'bg-gray-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Score distribution */}
          {performance?.scoreDistribution && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Score Distribution</h3>
              <div className="space-y-3">
                {Object.entries(performance.scoreDistribution).map(([range, count]: any) => {
                  const total = Object.values(performance.scoreDistribution).reduce((a: any, b: any) => a + b, 0) as number;
                  const pct = total > 0 ? ((count as number) / total) * 100 : 0;
                  return (
                    <div key={range}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-[var(--foreground)]">{range}</span>
                        <span className="text-[var(--muted-foreground)]">{count} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--primary)] transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Creatives Tab ── */}
      {tab === 'Creatives' && (
        <CampaignCreativesGrid
          creatives={campaign.creatives || []}
          onEdit={(c) => toast.success(`Editing "${c.name}" — feature coming soon`)}
        />
      )}

      {/* ── Timeline Tab ── */}
      {tab === 'Timeline' && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <CampaignTimeline entries={timeline} />
        </div>
      )}

      {/* ── Settings Tab ── */}
      {tab === 'Settings' && (
        <div className="space-y-6">
          {editing ? (
            /* Edit form */
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Edit Campaign</h3>
              <div className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-[var(--foreground)]">Name</label>
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--foreground)]">Campaign Type</label>
                    <select
                      value={editForm.campaignType}
                      onChange={(e) => setEditForm({ ...editForm, campaignType: e.target.value })}
                      className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                    >
                      <option value="multi-channel">Multi-Channel</option>
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="facebook">Facebook</option>
                      <option value="google">Google</option>
                      <option value="social">Social Media</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-[var(--foreground)]">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-[var(--foreground)]">Priority</label>
                    <select
                      value={editForm.priority}
                      onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                      className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--foreground)]">Currency</label>
                    <select
                      value={editForm.currency}
                      onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                      className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                    >
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-[var(--foreground)]">Total Budget</label>
                    <input
                      type="number"
                      value={editForm.totalBudget}
                      onChange={(e) => setEditForm({ ...editForm, totalBudget: e.target.value })}
                      className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--foreground)]">Daily Budget</label>
                    <input
                      type="number"
                      value={editForm.dailyBudget}
                      onChange={(e) => setEditForm({ ...editForm, dailyBudget: e.target.value })}
                      className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-[var(--foreground)]">Start Date</label>
                    <input
                      type="date"
                      value={editForm.startDate}
                      onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                      className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--foreground)]">End Date</label>
                    <input
                      type="date"
                      value={editForm.endDate}
                      onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                      className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--border)]">
                  <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">UTM Parameters</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-[var(--muted-foreground)]">UTM Source</label>
                      <input
                        value={editForm.utmSource}
                        onChange={(e) => setEditForm({ ...editForm, utmSource: e.target.value })}
                        className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-[var(--muted-foreground)]">UTM Medium</label>
                      <input
                        value={editForm.utmMedium}
                        onChange={(e) => setEditForm({ ...editForm, utmMedium: e.target.value })}
                        className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-[var(--muted-foreground)]">UTM Campaign</label>
                      <input
                        value={editForm.utmCampaign}
                        onChange={(e) => setEditForm({ ...editForm, utmCampaign: e.target.value })}
                        className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-[var(--muted-foreground)]">UTM Term</label>
                      <input
                        value={editForm.utmTerm}
                        onChange={(e) => setEditForm({ ...editForm, utmTerm: e.target.value })}
                        className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-[var(--muted-foreground)]">UTM Content</label>
                      <input
                        value={editForm.utmContent}
                        onChange={(e) => setEditForm({ ...editForm, utmContent: e.target.value })}
                        className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
                  >
                    <X size={14} /> Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Budget summary card */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Budget & Schedule</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {campaign.totalBudget > 0 && (
                      <CampaignBudgetBar
                        spent={campaign.spent || 0}
                        total={campaign.totalBudget}
                        currency={campaign.currency || '₹'}
                      />
                    )}
                    {campaign.dailyBudget > 0 && (
                      <div className="text-xs">
                        <span className="text-[var(--muted-foreground)]">Daily Budget: </span>
                        <span className="font-medium text-[var(--foreground)]">{formatCurrency(campaign.dailyBudget, campaign.currency)}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                      <Calendar size={14} />
                      <span>Start: <span className="font-medium text-[var(--foreground)]">{formatDate(campaign.startDate)}</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                      <Calendar size={14} />
                      <span>End: <span className="font-medium text-[var(--foreground)]">{formatDate(campaign.endDate)}</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                      <Clock size={14} />
                      <span>Created: <span className="font-medium text-[var(--foreground)]">{formatDate(campaign.createdAt)}</span></span>
                    </div>
                    {campaign.updatedAt && (
                      <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                        <Clock size={14} />
                        <span>Updated: <span className="font-medium text-[var(--foreground)]">{formatDate(campaign.updatedAt)}</span></span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Campaign info */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Campaign Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <InfoField icon={Hash} label="Campaign Type" value={campaign.campaignType || '—'} />
                  <InfoField icon={Target} label="Priority" value={campaign.priority ? campaign.priority.charAt(0).toUpperCase() + campaign.priority.slice(1) : '—'} />
                  <InfoField icon={Users} label="Total Leads" value={String(leadCount)} />
                  <InfoField icon={TrendingUp} label="Conversion Rate" value={campaign.conversionRate != null ? `${campaign.conversionRate}%` : '—'} />
                  <InfoField icon={DollarSign} label="Total Budget" value={formatCurrency(campaign.totalBudget, campaign.currency)} />
                  <InfoField icon={DollarSign} label="Daily Budget" value={formatCurrency(campaign.dailyBudget, campaign.currency)} />
                  <InfoField icon={MapPin} label="Locations" value={campaign.locations?.join(', ') || '—'} />
                  <InfoField icon={Users} label="Buyer Type" value={campaign.buyerType || '—'} />
                  <InfoField icon={Target} label="Property Types" value={campaign.propertyTypes?.join(', ') || '—'} />
                </div>
              </div>

              {/* Channels display */}
              {channels.length > 0 && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                  <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Channels</h3>
                  <div className="flex flex-wrap gap-2">
                    {channels.map((ch: string) => (
                      <span
                        key={ch}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--foreground)] bg-[var(--background)] capitalize"
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* UTM Parameters */}
              {(campaign.utmSource || campaign.utmMedium || campaign.utmCampaign) && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                  <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">UTM Parameters</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    {campaign.utmSource && <div><span className="text-[var(--muted-foreground)]">Source: </span><span className="font-medium text-[var(--foreground)]">{campaign.utmSource}</span></div>}
                    {campaign.utmMedium && <div><span className="text-[var(--muted-foreground)]">Medium: </span><span className="font-medium text-[var(--foreground)]">{campaign.utmMedium}</span></div>}
                    {campaign.utmCampaign && <div><span className="text-[var(--muted-foreground)]">Campaign: </span><span className="font-medium text-[var(--foreground)]">{campaign.utmCampaign}</span></div>}
                    {campaign.utmTerm && <div><span className="text-[var(--muted-foreground)]">Term: </span><span className="font-medium text-[var(--foreground)]">{campaign.utmTerm}</span></div>}
                    {campaign.utmContent && <div><span className="text-[var(--muted-foreground)]">Content: </span><span className="font-medium text-[var(--foreground)]">{campaign.utmContent}</span></div>}
                  </div>
                </div>
              )}

              {/* Delete */}
              <div className="rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 p-5">
                <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">Danger Zone</h3>
                <p className="text-xs text-red-600/70 dark:text-red-400/70 mb-3">
                  Once deleted, this campaign and its associated data cannot be recovered.
                </p>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-red-300 dark:border-red-800 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  <Trash2 size={13} /> Delete Campaign
                </button>
              </div>

              {/* Delete Confirmation Modal */}
              <Dialog
                open={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Delete Campaign"
                description="This action cannot be undone."
                maxWidth="max-w-md"
                footer={
                  <>
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      disabled={deleting}
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      {deleting ? 'Deleting...' : 'Delete Campaign'}
                    </button>
                  </>
                }
              >
                <p className="text-sm text-[var(--foreground)] mb-2">
                  Are you sure you want to delete <strong>{campaign.name}</strong>?
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  All leads, creatives, and performance data associated with this campaign will be permanently removed.
                </p>
              </Dialog>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function InfoField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="text-[var(--muted-foreground)] mt-0.5 shrink-0" />
      <div>
        <div className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-[0.06em]">{label}</div>
        <div className="text-sm font-medium text-[var(--foreground)] mt-0.5 break-words">{value || '—'}</div>
      </div>
    </div>
  );
}
