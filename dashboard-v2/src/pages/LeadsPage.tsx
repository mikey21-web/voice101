import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fetchLeads, getLeadTimeline } from '../lib/data';
import { consumePendingFilter, PENDING_FILTER_APPLIED_EVENT } from '../lib/pendingSearch';
import { startExplainFlow } from '../lib/explainMode';
import { useApp } from '../context/AppContext';
import { Search, RefreshCw, Phone, Mail, Calendar, Users, Play, Sparkles, X, Plus, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { api } from '../lib/api';
import { toCsv, downloadCsv } from '../lib/csv';
import toast from 'react-hot-toast';
import type { Lead } from '../lib/types';
import CustomFieldsSection from '../components/CustomFieldsSection';
import LeadPaymentMilestones from '../components/LeadPaymentMilestones';
import PreVisitBrief from '../components/PreVisitBrief';
import { Dialog } from '../components/ui/dialog';
import { Button } from '../components/ui/button';

const statusStyles: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CONTACTED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ENGAGED: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  QUALIFYING: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  QUALIFIED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  CONVERTED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  LOST: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  COLD: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  SPAM: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

const segmentStyles: Record<string, string> = {
  HOT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  WARM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  COLD: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  UNQUALIFIED: 'bg-gray-100 text-gray-400 dark:bg-gray-800',
};

const ALL_SOURCES = ['CAMPAIGN','QR_CODE','FORM','CHATBOT','MOBILE_APP','WHATSAPP','SOCIAL_MEDIA','PHONE_CALL','MANUAL','REFERRAL','INDIAMART','NINETY_NINE_ACRES','JUSTDIAL','MAGICBRICKS','HOUSING_COM','TRADEINDIA','TELEGRAM'];

const SLA_DONE_STATUSES = new Set(['CONVERTED', 'LOST', 'SPAM']);

/** A first-response SLA clock (spec: "Add SLA clock display on each lead") — untouched-since-creation for NEW leads, otherwise time since last update. */
function SlaClock({ lead }: { lead: any }) {
  if (SLA_DONE_STATUSES.has(lead.status)) return null;
  const anchor = new Date(lead.status === 'NEW' ? lead.createdAt : lead.updatedAt || lead.createdAt);
  const minutes = Math.floor((Date.now() - anchor.getTime()) / 60000);
  const isHot = lead.segment === 'HOT';
  const thresholdMin = isHot ? 120 : 15;
  const overdueMin = thresholdMin * 4;

  let variant = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (minutes >= overdueMin) variant = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  else if (minutes >= thresholdMin) variant = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';

  const label = minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${Math.floor(minutes / 1440)}d`;
  const title = lead.status === 'NEW' ? `Untouched for ${label} since the lead arrived` : `${label} since last update`;

  return (
    <span title={title} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${variant}`}>
      <Calendar size={10} /> {label}
    </span>
  );
}

export default function LeadsPage() {
  const { niche } = useApp();
  const [data, setData] = useState<Lead[]>([]);
  const [meta, setMeta] = useState<any>({ total: 0, page: 1, limit: 20 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [briefLeadId, setBriefLeadId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [voiceSummary, setVoiceSummary] = useState<string | null>(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const [addLeadForm, setAddLeadForm] = useState({ name: '', phone: '', email: '', source: 'MANUAL', interest: '', budget: '', message: '' });
  const [addingLead, setAddingLead] = useState(false);
  const [savingLead, setSavingLead] = useState<string | null>(null);
  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  const refresh = useCallback(async (page?: number) => {
    const targetPage = page ?? meta.page;
    setLoading(true);
    try {
      const filters: Record<string, string> = { search, status: statusFilter, segment: segmentFilter, source: sourceFilter, sortBy, sortOrder };
      const r = await fetchLeads(targetPage, filters);
      setData(r.data);
      setMeta(r.meta);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load leads');
    }
    setLoading(false);
  }, [search, statusFilter, segmentFilter, sourceFilter, sortBy, sortOrder]);

  const submitAddLead = async () => {
    if (!addLeadForm.name.trim()) return toast.error('Name is required');
    if (!addLeadForm.phone.trim() && !addLeadForm.email.trim()) return toast.error('Phone or email is required');
    setAddingLead(true);
    try {
      await api('/leads/manual', {
        method: 'POST',
        body: JSON.stringify({
          name: addLeadForm.name.trim(),
          phone: addLeadForm.phone.trim() || undefined,
          email: addLeadForm.email.trim() || undefined,
          source: addLeadForm.source,
          interest: addLeadForm.interest.trim() || undefined,
          budget: addLeadForm.budget.trim() || undefined,
          message: addLeadForm.message.trim() || undefined,
        }),
      });
      toast.success('Lead added');
      setShowAddLead(false);
      setAddLeadForm({ name: '', phone: '', email: '', source: 'MANUAL', interest: '', budget: '', message: '' });
      refresh(1);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add lead');
    } finally {
      setAddingLead(false);
    }
  };

  const applyHashFilters = () => {
    const hash = window.location.hash.split('?');
    if (hash.length < 2) return;
    const params = new URLSearchParams(hash[1]);
    const status = params.get('status') || '';
    const segment = params.get('segment') || '';
    const source = params.get('source') || '';
    const searchVal = params.get('search') || '';
    if (status || segment || source || searchVal) {
      setStatusFilter(status);
      setSegmentFilter(segment);
      setSourceFilter(source);
      setSearch(searchVal);
    }
  };

  const applyPendingFilter = () => {
    const pending = consumePendingFilter('leads');
    if (!pending) return;
    setSearch(pending.filters?.search || '');
    setStatusFilter(pending.filters?.status || '');
    setSegmentFilter(pending.filters?.segment || '');
    setHighlightId(pending.highlightId || null);
    setZoom(pending.zoom || null);
    setVoiceSummary(pending.summary || null);
  };

  const hashHasFilters = window.location.hash.includes('?');

  const clearHashFilters = () => {
    const base = window.location.hash.split('?')[0];
    window.location.hash = base;
    setStatusFilter('');
    setSegmentFilter('');
    setSourceFilter('');
    setSearch('');
  };

  useEffect(() => {
    applyHashFilters();
    applyPendingFilter();
    const onApplied = (e: Event) => {
      if ((e as CustomEvent<string>).detail === 'leads') applyPendingFilter();
    };
    const onHash = () => {
      if (window.location.hash.includes('?')) applyHashFilters();
    };
    window.addEventListener(PENDING_FILTER_APPLIED_EVENT, onApplied);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener(PENDING_FILTER_APPLIED_EVENT, onApplied);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  useEffect(() => { refresh(1); }, [search, statusFilter, segmentFilter, sourceFilter, sortBy, sortOrder]);

  useEffect(() => {
    if (!highlightId || !highlightRef.current) return;
    highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setHighlightId(null), 3000);
    return () => clearTimeout(t);
  }, [highlightId, data]);

  const handleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    setTimelineLoading(true);
    try { setTimeline(await getLeadTimeline(id)); }
    catch (e: any) { toast.error('Failed to load timeline'); }
    setTimelineLoading(false);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const updateLeadField = async (leadId: string, field: string, value: any) => {
    setSavingLead(leadId);
    try {
      await api(`/leads/${leadId}`, { method: 'PATCH', body: JSON.stringify({ [field]: value }) });
      setData(prev => prev.map(l => l.id === leadId ? { ...l, [field]: value } as Lead : l));
      toast.success(`${field} updated`);
    } catch (err: any) {
      toast.error(err.message || `Failed to update ${field}`);
    }
    setSavingLead(null);
  };

  const saveDealValue = async (leadId: string, raw: string) => {
    const value = raw.trim() === '' ? null : Number(raw);
    if (value !== null && !Number.isFinite(value)) return;
    try {
      await api(`/leads/${leadId}`, { method: 'PATCH', body: JSON.stringify({ dealValue: value }) });
      setData(prev => prev.map(l => l.id === leadId ? { ...l, dealValue: value } as Lead : l));
      toast.success('Deal value saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save deal value');
    }
  };

  const playTimeline = () => {
    if (!timeline.length) return;
    const ordered = [...timeline].reverse();
    startExplainFlow(ordered.map((t: any) => ({
      page: 'leads',
      highlightId: expandedId,
      narration: t.description ? `${t.title}: ${t.description}` : t.title,
    })));
  };

  const handleCall = async (leadId: string) => {
    const toastId = toast.loading('Initiating call...');
    try {
      const res = await api('/telephony/call', { method: 'POST', body: JSON.stringify({ leadId }) });
      if (res.success) {
        toast.success('Call initiated!', { id: toastId });
      } else {
        toast.error(res.error || 'Call failed', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate call', { id: toastId });
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ArrowUpDown size={11} className="opacity-30" />;
    return sortOrder === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />;
  };

  const totalPages = Math.ceil(meta.total / meta.limit) || 1;
  const label = niche?.labels?.lead?.toLowerCase() || 'lead';
  const labelPlural = niche?.labels?.leads || 'Leads';

  const renderStatusDropdown = (lead: Lead) => (
    <select
      value={lead.status}
      onClick={e => e.stopPropagation()}
      onChange={e => updateLeadField(lead.id, 'status', e.target.value)}
      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer ${statusStyles[lead.status] || ''}`}
    >
      {['NEW','CONTACTED','ENGAGED','QUALIFYING','QUALIFIED','CONVERTED','LOST','COLD','SPAM'].map(s => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );

  const renderSegmentDropdown = (lead: Lead) => (
    <select
      value={lead.segment}
      onClick={e => e.stopPropagation()}
      onChange={e => updateLeadField(lead.id, 'segment', e.target.value)}
      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer ${segmentStyles[lead.segment] || ''}`}
    >
      {['HOT','WARM','COLD','UNQUALIFIED'].map(s => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">{labelPlural}</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{meta.total} total {labelPlural.toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="#/import?entity=lead"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          >
            Import
          </a>
          <button
            onClick={() => downloadCsv(labelPlural.toLowerCase(), toCsv(data.map(l => ({
              name: l.contact?.name, phone: l.contact?.phone, email: l.contact?.email,
              status: l.status, segment: l.segment, source: l.source, score: l.score,
              interest: l.interest, budget: l.budget, dealValue: l.dealValue,
              assignedAgent: l.assignedAgent?.name, createdAt: l.createdAt,
            }))))}
            disabled={!data.length}
            title={data.length ? `Export ${data.length} loaded ${labelPlural.toLowerCase()} on this page as CSV` : 'No rows to export'}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={15} /> Export
          </button>
          <button
            onClick={() => setShowAddLead(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> Add {label.charAt(0).toUpperCase() + label.slice(1)}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            placeholder={`Search ${labelPlural.toLowerCase()}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 focus:border-[var(--ring)] transition-all"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20">
          <option value="">All Status</option>
          {['NEW','CONTACTED','ENGAGED','QUALIFYING','QUALIFIED','CONVERTED','LOST','COLD','SPAM'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={segmentFilter} onChange={e => setSegmentFilter(e.target.value)}
          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20">
          <option value="">All Segments</option>
          {['HOT','WARM','COLD','UNQUALIFIED'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20">
          <option value="">All Sources</option>
          {ALL_SOURCES.map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <button onClick={() => refresh()}
          className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-all">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
        {hashHasFilters && (
          <button onClick={clearHashFilters}
            className="h-9 px-3 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/20 transition-all inline-flex items-center gap-1.5">
            <X size={13} /> Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="hidden sm:block rounded-lg border border-[var(--border)] bg-[var(--card)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Agent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Segment</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--border)]">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-[var(--muted)] rounded animate-pulse w-20" /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] py-16 text-center text-[var(--muted-foreground)]">
          <div className="flex flex-col items-center gap-2">
            <Users size={28} className="text-[var(--muted-foreground)]/40" />
            <p className="text-sm">No {labelPlural.toLowerCase()} found</p>
          </div>
        </div>
      ) : (
        <>
          {voiceSummary && (
            <div className="mb-4 rounded-xl bg-[var(--primary-light)] border border-[var(--primary)]/30 p-4 flex items-center gap-3 animate-fade-in">
              <Sparkles size={18} className="text-[var(--primary)]" />
              <p className="text-sm font-semibold text-[var(--primary)]">{voiceSummary}</p>
              <button onClick={() => setVoiceSummary(null)} className="ml-auto text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <X size={14} />
              </button>
            </div>
          )}
          <div className={`hidden sm:block rounded-lg border border-[var(--border)] bg-[var(--card)] ${zoom === 'data' ? 'ring-2 ring-[var(--primary)] shadow-lg shadow-[var(--primary)]/20 scale-[1.01] transition-all duration-500' : ''}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Contact</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Agent</th>
                    <th onClick={() => handleSort('status')} className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider cursor-pointer hover:text-[var(--foreground)] select-none">
                      <span className="inline-flex items-center gap-1">Status <SortIcon field="status" /></span>
                    </th>
                    <th onClick={() => handleSort('segment')} className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider cursor-pointer hover:text-[var(--foreground)] select-none">
                      <span className="inline-flex items-center gap-1">Segment <SortIcon field="segment" /></span>
                    </th>
                    <th onClick={() => handleSort('score')} className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider cursor-pointer hover:text-[var(--foreground)] select-none">
                      <span className="inline-flex items-center gap-1">Score <SortIcon field="score" /></span>
                    </th>
                    <th onClick={() => handleSort('createdAt')} className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider cursor-pointer hover:text-[var(--foreground)] select-none">
                      <span className="inline-flex items-center gap-1">Created <SortIcon field="createdAt" /></span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(l => (
                    <React.Fragment key={l.id}>
                      <motion.tr
                        ref={highlightId === l.id ? highlightRef : undefined}
                        onClick={() => handleExpand(l.id)}
                        animate={highlightId === l.id ? { backgroundColor: ['rgba(193,85,44,0.18)', 'rgba(193,85,44,0)', 'rgba(193,85,44,0.18)', 'rgba(193,85,44,0)'] } : undefined}
                        transition={highlightId === l.id ? { duration: 2.4, times: [0, 0.33, 0.66, 1] } : undefined}
                        className="border-b border-[var(--border)] hover:bg-[var(--muted)]/50 cursor-pointer transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-[var(--foreground)]">{l.contact?.name || 'Unknown'}</div>
                          <div className="text-xs text-[var(--muted-foreground)]">{l.contact?.phone || l.contact?.email || ''}</div>
                          {(l.segment === 'HOT' || l.segment === 'WARM') && (
                            <span className="inline-flex mt-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Potential Client</span>
                          )}
                        </td>
                        <td className="px-4 py-3"><span className="text-xs text-[var(--muted-foreground)]">{l.source?.replace(/_/g, ' ')}</span></td>
                        <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">{l.assignedAgent?.name || <span className="italic">Unassigned</span>}</td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>{renderStatusDropdown(l)}</td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>{renderSegmentDropdown(l)}</td>
                        <td className="px-4 py-3"><span className="font-mono text-sm font-semibold text-[var(--foreground)]">{l.score}</span></td>
                        <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                          <div className="flex flex-col gap-1">
                            <span>{new Date(l.createdAt).toLocaleDateString()}</span>
                            <SlaClock lead={l} />
                          </div>
                        </td>
                      </motion.tr>
                      {expandedId === l.id && (
                        <tr key={`${l.id}-exp`}>
                          <td colSpan={7} className="px-4 py-4 bg-[var(--muted)] border-b border-[var(--border)]">
                            <div className="flex justify-end mb-2 gap-2">
                              {timeline.length > 0 && (
                                <button onClick={(e) => { e.stopPropagation(); playTimeline(); }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--accent)] transition-all">
                                  <Play size={12} /> Play Timeline
                                </button>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); setBriefLeadId(l.id); }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
                                <Sparkles size={12} /> Pre-Visit Brief
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div>
                                <h4 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">Details</h4>
                                <div className="space-y-2.5 text-sm">
                                  <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                                    <Phone size={14} className="text-[var(--primary)]" />
                                    <span>{l.contact?.phone || '-'}</span>
                                    {l.contact?.phone && (
                                      <button onClick={(e) => { e.stopPropagation(); handleCall(l.id); }}
                                        className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity cursor-pointer">
                                        <Phone size={11} /> Call
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[var(--muted-foreground)]"><Mail size={14} className="text-[var(--primary)]" /><span>{l.contact?.email || '-'}</span></div>
                                  {l.interest && <div><span className="text-[var(--foreground)] font-medium">Interest:</span> <span className="text-[var(--muted-foreground)]">{l.interest}</span></div>}
                                  {l.budget && <div><span className="text-[var(--foreground)] font-medium">Budget:</span> <span className="text-[var(--muted-foreground)]">{l.budget}</span></div>}
                                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                    <span className="text-[var(--foreground)] font-medium">Deal Value:</span>
                                    <input type="number" defaultValue={l.dealValue ?? ''} placeholder="Not set"
                                      onBlur={e => saveDealValue(l.id, e.target.value)}
                                      className="w-28 h-7 rounded border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20" />
                                  </div>
                                  <div onClick={e => e.stopPropagation()}>
                                    <span className="text-[var(--foreground)] font-medium">Status:</span> {renderStatusDropdown(l)}
                                  </div>
                                  <div onClick={e => e.stopPropagation()}>
                                    <span className="text-[var(--foreground)] font-medium">Segment:</span> {renderSegmentDropdown(l)}
                                  </div>
                                  {l.assignedAgent && <div><span className="text-[var(--foreground)] font-medium">Agent:</span> <span className="text-[var(--muted-foreground)]">{l.assignedAgent.name}</span></div>}
                                  {l.message && <div><span className="text-[var(--foreground)] font-medium">Message:</span> <span className="text-[var(--muted-foreground)]">{l.message}</span></div>}
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Timeline</h4>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {timelineLoading && <p className="text-sm text-[var(--muted-foreground)]">Loading...</p>}
                                  {!timelineLoading && timeline.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No activity yet</p>}
                                  {!timelineLoading && timeline.slice(0, 10).map((t: any) => (
                                    <div key={t.id} className="flex items-start gap-2.5 text-sm">
                                      <Calendar size={14} className="text-[var(--primary)] mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-[var(--foreground)]">{t.title}</p>
                                        <p className="text-xs text-[var(--muted-foreground)]">{new Date(t.createdAt).toLocaleString()}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-4">
                                <div>
                                  <h4 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">Builder Workbench</h4>
                                  <div className="flex flex-wrap gap-1.5" onClick={e => e.stopPropagation()}>
                                    <a href="#/site-visits" onClick={() => navigator.clipboard?.writeText(l.id)}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]"
                                      title="Copies this lead's ID — paste it into Schedule visit">
                                      <Calendar size={11} /> Schedule visit
                                    </a>
                                    <a href="#/cost-sheets" onClick={() => navigator.clipboard?.writeText(l.id)}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]"
                                      title="Copies this lead's ID — paste it into New cost sheet">
                                      Cost sheet
                                    </a>
                                    <a href="#/kyc" onClick={() => navigator.clipboard?.writeText(l.id)}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]"
                                      title="Copies this lead's ID — paste it into Request document">
                                      Request KYC doc
                                    </a>
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">Custom Fields</h4>
                                  <CustomFieldsSection target="LEAD" targetId={l.id} />
                                  <a href={`#/create-event?leadId=${l.id}&contactId=${l.contact?.id || ''}`} onClick={e => e.stopPropagation()}
                                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)] hover:underline">
                                    <Calendar size={12} /> Create event from this lead
                                  </a>
                                </div>
                                <LeadPaymentMilestones leadId={l.id} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="block sm:hidden space-y-3">
            {data.map(l => (
              <div
                key={l.id}
                onClick={() => handleExpand(l.id)}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 cursor-pointer active:bg-[var(--muted)]/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[var(--foreground)]">{l.contact?.name || 'Unknown'}</div>
                    <div className="text-xs text-[var(--muted-foreground)] truncate">{l.contact?.phone || l.contact?.email || ''}</div>
                    {(l.segment === 'HOT' || l.segment === 'WARM') && (
                      <span className="inline-flex mt-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Potential Client</span>
                    )}
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ml-2 ${segmentStyles[l.segment] || ''}`}>{l.segment}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-[var(--muted-foreground)]">{l.source?.replace(/_/g, ' ')}</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[l.status] || ''}`}>{l.status}</span>
                  {l.assignedAgent && <span className="text-[var(--muted-foreground)]">· {l.assignedAgent.name}</span>}
                  <span className="ml-auto font-mono font-semibold text-[var(--foreground)]">Score: {l.score}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] mt-1.5">
                  <span>{new Date(l.createdAt).toLocaleDateString()}</span>
                  <SlaClock lead={l} />
                </div>

                {expandedId === l.id && (
                  <div className="mt-3 pt-3 border-t border-[var(--border)]">
                    <div className="flex gap-2 mb-3">
                      {l.contact?.phone && (
                        <button onClick={(e) => { e.stopPropagation(); handleCall(l.id); }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
                          <Phone size={11} /> Call
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setBriefLeadId(l.id); }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90">
                        <Sparkles size={11} /> Brief
                      </button>
                    </div>
                    <div className="space-y-2.5 text-sm">
                      <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                        <Phone size={14} className="text-[var(--primary)]" /><span>{l.contact?.phone || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                        <Mail size={14} className="text-[var(--primary)]" /><span>{l.contact?.email || '-'}</span>
                      </div>
                      <div onClick={e => e.stopPropagation()}>
                        <span className="text-[var(--foreground)] font-medium">Status:</span> {renderStatusDropdown(l)}
                      </div>
                      <div onClick={e => e.stopPropagation()}>
                        <span className="text-[var(--foreground)] font-medium">Segment:</span> {renderSegmentDropdown(l)}
                      </div>
                      {l.assignedAgent && <div><span className="text-[var(--foreground)] font-medium">Agent:</span> <span className="text-[var(--muted-foreground)]">{l.assignedAgent.name}</span></div>}
                      {l.interest && <div><span className="text-[var(--foreground)] font-medium">Interest:</span> <span className="text-[var(--muted-foreground)]">{l.interest}</span></div>}
                      {l.budget && <div><span className="text-[var(--foreground)] font-medium">Budget:</span> <span className="text-[var(--muted-foreground)]">{l.budget}</span></div>}
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <span className="text-[var(--foreground)] font-medium">Deal Value:</span>
                        <input type="number" defaultValue={l.dealValue ?? ''} placeholder="Not set"
                          onBlur={e => saveDealValue(l.id, e.target.value)}
                          className="w-28 h-7 rounded border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)]" />
                      </div>
                      {l.message && <div><span className="text-[var(--foreground)] font-medium">Message:</span> <span className="text-[var(--muted-foreground)]">{l.message}</span></div>}
                    </div>
                    <div className="mt-3 pt-3 border-t border-[var(--border)]">
                      <CustomFieldsSection target="LEAD" targetId={l.id} />
                      <a href={`#/create-event?leadId=${l.id}&contactId=${l.contact?.id || ''}`} onClick={e => e.stopPropagation()}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)] hover:underline">
                        <Calendar size={12} /> Create event from this lead
                      </a>
                    </div>
                    <div className="mt-3 pt-3 border-t border-[var(--border)]">
                      <LeadPaymentMilestones leadId={l.id} />
                    </div>
                    <div className="mt-3 pt-3 border-t border-[var(--border)]">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Timeline</h4>
                        {timeline.length > 0 && (
                          <button onClick={(e) => { e.stopPropagation(); playTimeline(); }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--primary)] hover:underline">
                            <Play size={10} /> Play
                          </button>
                        )}
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {timelineLoading && <p className="text-sm text-[var(--muted-foreground)]">Loading...</p>}
                        {!timelineLoading && timeline.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No activity yet</p>}
                        {!timelineLoading && timeline.slice(0, 10).map((t: any) => (
                          <div key={t.id} className="flex items-start gap-2 text-sm">
                            <Calendar size={14} className="text-[var(--primary)] mt-0.5 shrink-0" />
                            <div>
                              <p className="text-[var(--foreground)]">{t.title}</p>
                              <p className="text-xs text-[var(--muted-foreground)]">{new Date(t.createdAt).toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">
              Page {meta.page} of {totalPages} ({meta.total} total)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => refresh(meta.page - 1)}
                disabled={meta.page <= 1}
                className="h-8 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] disabled:opacity-30 hover:bg-[var(--accent)] transition-all inline-flex items-center gap-1 text-xs"
              >
                <ChevronLeft size={13} /> Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const start = Math.max(1, Math.min(meta.page - 2, totalPages - 4));
                const pg = start + i;
                if (pg > totalPages) return null;
                return (
                  <button key={pg} onClick={() => refresh(pg)}
                    className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-medium transition-all ${
                      pg === meta.page
                        ? 'bg-[var(--primary)] text-white'
                        : 'border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--accent)]'
                    }`}>
                    {pg}
                  </button>
                );
              })}
              <button
                onClick={() => refresh(meta.page + 1)}
                disabled={meta.page >= totalPages}
                className="h-8 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] disabled:opacity-30 hover:bg-[var(--accent)] transition-all inline-flex items-center gap-1 text-xs"
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </>
      )}
      {briefLeadId && <PreVisitBrief leadId={briefLeadId} onClose={() => setBriefLeadId(null)} />}

      <Dialog
        open={showAddLead}
        onClose={() => setShowAddLead(false)}
        title="Add Lead"
        description="For leads that came from outside Mikey — a walk-in, a referral, a call you took yourself."
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowAddLead(false)}>Cancel</Button>
            <Button onClick={submitAddLead} loading={addingLead}>Add Lead</Button>
          </>
        }
      >
        <input
          value={addLeadForm.name} onChange={e => setAddLeadForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Full name" autoFocus
          className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            value={addLeadForm.phone} onChange={e => setAddLeadForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="Phone"
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
          />
          <input
            value={addLeadForm.email} onChange={e => setAddLeadForm(f => ({ ...f, email: e.target.value }))}
            placeholder="Email"
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
          />
        </div>
        <select
          value={addLeadForm.source} onChange={e => setAddLeadForm(f => ({ ...f, source: e.target.value }))}
          className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
        >
          <option value="MANUAL">Manual entry</option>
          <option value="REFERRAL">Referral</option>
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={addLeadForm.interest} onChange={e => setAddLeadForm(f => ({ ...f, interest: e.target.value }))}
            placeholder="Interest (e.g. 3BHK)"
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
          />
          <input
            value={addLeadForm.budget} onChange={e => setAddLeadForm(f => ({ ...f, budget: e.target.value }))}
            placeholder="Budget"
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
          />
        </div>
        <textarea
          value={addLeadForm.message} onChange={e => setAddLeadForm(f => ({ ...f, message: e.target.value }))}
          placeholder="Notes (optional)" rows={2}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 resize-none"
        />
      </Dialog>
    </div>
  );
}
