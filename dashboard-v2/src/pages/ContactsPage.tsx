import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fetchContacts } from '../lib/data';
import { consumePendingFilter, PENDING_FILTER_APPLIED_EVENT } from '../lib/pendingSearch';
import { Search, Users, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Contact } from '../lib/types';

export default function ContactsPage() {
  const [data, setData] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<any>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  const applyPendingFilter = () => {
    const pending = consumePendingFilter('contacts');
    if (!pending) return;
    const searchValue = pending.filters?.search || '';
    setSearch(searchValue);
    setDebounced(searchValue);
    setHighlightId(pending.highlightId || null);
  };

  useEffect(() => {
    applyPendingFilter();
    const onApplied = (e: Event) => {
      if ((e as CustomEvent<string>).detail === 'contacts') applyPendingFilter();
    };
    window.addEventListener(PENDING_FILTER_APPLIED_EVENT, onApplied);
    return () => window.removeEventListener(PENDING_FILTER_APPLIED_EVENT, onApplied);
  }, []);

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const r: any = await fetchContacts(p, q);
      setData(r.data || []);
      setMeta(r.meta || { total: 0, page: p, limit: 20, totalPages: 1 });
    } catch (e: any) {
      toast.error(e.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, debounced); }, [page, debounced, load]);

  useEffect(() => {
    if (!highlightId || !highlightRef.current) return;
    highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setHighlightId(null), 3000);
    return () => clearTimeout(t);
  }, [highlightId, data]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Contacts</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">{data.length} contacts</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              placeholder="Search contacts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 transition-colors"
            />
          </div>
          <a
            href="#/import?entity=contact"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors whitespace-nowrap"
          >
            Import
          </a>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8">
          <div className="flex items-center justify-center gap-3 text-[var(--muted-foreground)]">
            <Loader2 size={20} className="animate-spin" />
            <p className="text-sm">Loading contacts...</p>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="block rounded-xl border border-[var(--border)] bg-[var(--card)] py-16 text-center text-[var(--muted-foreground)]">
          <Users size={28} className="mx-auto mb-2 text-[var(--muted-foreground)]/40" />
          <p className="text-sm">No contacts found</p>
        </div>
      ) : (
        <>
          <div className="hidden sm:block rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(c => (
                    <motion.tr
                      key={c.id}
                      ref={highlightId === c.id ? highlightRef : undefined}
                      animate={highlightId === c.id ? { backgroundColor: ['rgba(99,102,241,0.25)', 'rgba(99,102,241,0)', 'rgba(99,102,241,0.25)', 'rgba(99,102,241,0)'] } : undefined}
                      transition={highlightId === c.id ? { duration: 2.4, times: [0, 0.33, 0.66, 1] } : undefined}
                      className="border-b border-[var(--border)] hover:bg-[var(--muted)]/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
                            <span className="text-xs font-medium text-[var(--primary)]">
                              {(c.name || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-[var(--foreground)]">{c.name || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">{c.email || '-'}</td>
                      <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">{c.phone || '-'}</td>
                      <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">{c.company || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-sm text-[var(--foreground)]">{c._count?.leads || 0}</span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="block sm:hidden space-y-3">
            {data.map(c => (
              <div key={c.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-full bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-medium text-[var(--primary)]">
                        {(c.name || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-[var(--foreground)] truncate">{c.name || '-'}</div>
                      <div className="text-xs text-[var(--muted-foreground)] truncate">{c.email || '-'}</div>
                    </div>
                  </div>
                  <span className="font-semibold text-sm text-[var(--foreground)] shrink-0 ml-2">{c._count?.leads || 0} leads</span>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                    <span className="w-16 text-xs font-medium text-[var(--foreground)]">Email</span>
                    <span className="truncate">{c.email || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                    <span className="w-16 text-xs font-medium text-[var(--foreground)]">Phone</span>
                    <span>{c.phone || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                    <span className="w-16 text-xs font-medium text-[var(--foreground)]">Company</span>
                    <span className="truncate">{c.company || '-'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>

      )}

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-[var(--muted-foreground)]">
            Page {meta.page} of {meta.totalPages} ({meta.total} total)
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-8 px-3 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-40 disabled:pointer-events-none transition-colors inline-flex items-center gap-1"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                  p === page
                    ? 'bg-[var(--primary)] text-white'
                    : 'border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages}
              className="h-8 px-3 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-40 disabled:pointer-events-none transition-colors inline-flex items-center gap-1"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
