import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

/**
 * Cmd+K command palette. Opens with Ctrl+K / Cmd+K.
 * Navigate with arrow keys, select with Enter.
 */
export function CommandPalette({ commands }: { commands: Command[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  const filtered = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));
  const navigable = filtered.slice(0, 10);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, navigable.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && navigable[selectedIdx]) { navigable[selectedIdx].action(); setOpen(false); }
  }, [navigable, selectedIdx]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg bg-[var(--background)] border rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKey}
      >
        <div className="p-3 border-b">
          <input
            autoFocus
            type="text"
            placeholder="Type a command..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-transparent outline-none text-sm"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1" role="listbox">
          {navigable.map((cmd, idx) => (
            <button
              key={cmd.id}
              role="option"
              aria-selected={idx === selectedIdx}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${idx === selectedIdx ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'hover:bg-[var(--muted)]'}`}
              onClick={() => { cmd.action(); setOpen(false); }}
              onMouseEnter={() => setSelectedIdx(idx)}
            >
              <span>{cmd.label}</span>
              {cmd.shortcut && <span className="text-xs text-[var(--muted-foreground)]">{cmd.shortcut}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
