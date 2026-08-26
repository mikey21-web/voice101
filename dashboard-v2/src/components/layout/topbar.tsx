import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Menu, Search, X } from "lucide-react";
import { fetchNotifications, fetchUnreadNotificationCount, markNotificationRead, markAllNotificationsRead, type AppNotification } from "../../lib/data";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const QUICK_PAGES = [
  { label: "Dashboard", path: "/voice-dashboard" },
  { label: "My Employees", path: "/voice-employees" },
  { label: "Hire with AI", path: "/talk-to-build" },
  { label: "Instant Leads", path: "/voice-instant-leads" },
  { label: "Bulk Campaigns", path: "/voice-campaigns" },
  { label: "Call Logs", path: "/voice-call-logs" },
  { label: "Billing", path: "/voice-billing" },
];

function PageSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
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

  const results = QUICK_PAGES.filter((p) => p.label.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-all duration-150 active:scale-95"
        title="Go to page (⌘K)"
      >
        <Search size={15} />
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg z-50 overflow-hidden sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-64">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            <Search size={14} className="text-[var(--muted-foreground)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && results.length) { window.location.hash = results[0].path; setOpen(false); setQuery(""); } }}
              placeholder="Jump to a page..."
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {results.length === 0 && <p className="px-3 py-3 text-xs text-[var(--muted-foreground)]">No matching pages</p>}
            {results.map((p) => (
              <button
                key={p.path}
                onClick={() => { window.location.hash = p.path; setOpen(false); setQuery(""); }}
                className="w-full text-left px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
              >
                {p.label}
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

      <PageSearch />
      <NotificationsBell />
    </header>
  );
}
