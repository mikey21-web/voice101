import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Menu, Search, X, GraduationCap } from "lucide-react";
import { fetchLeads, fetchContacts, fetchNotifications, fetchUnreadNotificationCount, markNotificationRead, markAllNotificationsRead, type AppNotification } from "../../lib/data";
import { setPendingSearch } from "../../lib/pendingSearch";
import { startExplainFlow } from "../../lib/explainMode";
import { GUIDED_TOURS } from "../../lib/guidedTours";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [leadResults, setLeadResults] = useState<any[]>([]);
  const [contactResults, setContactResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    if (!query.trim()) { setLeadResults([]); setContactResults([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const [leads, contacts] = await Promise.all([
          fetchLeads(1, { search: query }).catch(() => ({ data: [] })),
          fetchContacts(1, query).catch(() => ({ data: [] })),
        ]);
        setLeadResults((leads.data || []).slice(0, 5));
        setContactResults(((contacts as any).data || contacts || []).slice(0, 5));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const goToLeads = (searchTerm: string) => {
    setPendingSearch("leads", searchTerm);
    window.location.hash = "/leads";
    setOpen(false);
    setQuery("");
  };

  const goToContacts = (searchTerm: string) => {
    setPendingSearch("contacts", searchTerm);
    window.location.hash = "/contacts";
    setOpen(false);
    setQuery("");
  };

  const hasResults = leadResults.length > 0 || contactResults.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-all duration-150 active:scale-95"
        title="Search"
      >
        <Search size={15} />
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg z-50 overflow-hidden sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            <Search size={14} className="text-[var(--muted-foreground)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search leads or contacts..."
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && <p className="px-3 py-3 text-xs text-[var(--muted-foreground)]">Searching...</p>}

            {!loading && query.trim() && !hasResults && (
              <p className="px-3 py-3 text-xs text-[var(--muted-foreground)]">No results for "{query}"</p>
            )}

            {!loading && leadResults.length > 0 && (
              <div className="py-1">
                <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold text-[var(--muted-foreground-light)] uppercase tracking-wider">Leads</p>
                {leadResults.map((lead) => (
                  <button
                    key={lead.id}
                    onClick={() => goToLeads(lead.contact?.email || lead.contact?.name || query)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--accent)] transition-colors"
                  >
                    <p className="truncate text-[var(--foreground)] font-medium">{lead.contact?.name || "Unnamed"}</p>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">{lead.contact?.email || lead.status}</p>
                  </button>
                ))}
              </div>
            )}

            {!loading && contactResults.length > 0 && (
              <div className="py-1">
                <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold text-[var(--muted-foreground-light)] uppercase tracking-wider">Contacts</p>
                {contactResults.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => goToContacts(contact.email || contact.name || query)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--accent)] transition-colors"
                  >
                    <p className="truncate text-[var(--foreground)] font-medium">{contact.name || "Unnamed"}</p>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">{contact.email}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GuidedToursMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const launch = (steps: typeof GUIDED_TOURS[number]["steps"]) => {
    startExplainFlow(steps);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-all duration-150 active:scale-95"
        title="Guided Tours"
      >
        <GraduationCap size={15} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg z-50 overflow-hidden">
          <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold text-[var(--muted-foreground-light)] uppercase tracking-wider">Guided Tours</p>
          <div className="py-1">
            {GUIDED_TOURS.map((tour) => (
              <button
                key={tour.id}
                onClick={() => launch(tour.steps)}
                className="w-full text-left px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
              >
                {tour.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    fetchUnreadNotificationCount().then(setUnreadCount).catch(() => {});
  }, []);

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 30000);
    return () => clearInterval(interval);
  }, [refreshCount]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        const data = await fetchNotifications();
        setItems(data);
      } catch {
        setItems([]);
      }
      setLoading(false);
    }
  };

  const handleItemClick = async (n: AppNotification) => {
    if (!n.read) {
      await markNotificationRead(n.id).catch(() => {});
      setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, read: true } : it)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (n.link) window.location.hash = n.link;
    setOpen(false);
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead().catch(() => {});
    setItems((prev) => prev.map((it) => ({ ...it, read: true })));
    setUnreadCount(0);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggle}
        className="rounded-md p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-all duration-150 active:scale-95 relative"
        title="Notifications"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--destructive)] ring-2 ring-[var(--background)]" />
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg z-50 overflow-hidden sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <p className="text-sm font-semibold text-[var(--foreground)]">Notifications</p>
            {items.some((i) => !i.read) && (
              <button onClick={handleMarkAllRead} className="text-xs text-[var(--primary)] hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && <p className="px-3 py-3 text-xs text-[var(--muted-foreground)]">Loading...</p>}
            {!loading && items.length === 0 && (
              <p className="px-3 py-6 text-xs text-center text-[var(--muted-foreground)]">You're all caught up</p>
            )}
            {!loading && items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`w-full text-left px-3 py-2.5 border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--accent)] ${!n.read ? "bg-[var(--primary-light)]" : ""}`}
              >
                <p className="break-words text-sm text-[var(--foreground)] font-medium">{n.title}</p>
                {n.body && <p className="mt-0.5 break-words text-xs text-[var(--muted-foreground)]">{n.body}</p>}
                <p className="text-[10px] text-[var(--muted-foreground-light)] mt-1">{timeAgo(n.createdAt)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Topbar({ onMenuToggle }: { onMenuToggle: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--background)] px-3 sm:gap-3 sm:px-4 lg:px-6">
      <button onClick={onMenuToggle} className="rounded-md p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors lg:hidden" title="Open navigation">
        <Menu size={17} />
      </button>

      <div className="min-w-0 flex-1" />

      <GlobalSearch />
      <GuidedToursMenu />
      <NotificationsBell />
    </header>
  );
}
