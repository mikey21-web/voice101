import React, { useState, useEffect, useMemo } from 'react';
import { fetchEventCalendar } from '../lib/data';

function monthRange(year: number, month: number) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(new Date());
  const [items, setItems] = useState<{ events: any[]; tasks: any[] }>({ events: [], tasks: [] });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    const { from, to } = monthRange(cursor.getFullYear(), cursor.getMonth());
    fetchEventCalendar(from, to).then(setItems).catch(() => {});
  }, [cursor]);

  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const e of items.events) { const d = (e.date || '').slice(0, 10); (map[d] ||= []).push({ ...e, kind: 'event' }); }
    for (const t of items.tasks) { const d = (t.date || '').slice(0, 10); (map[d] ||= []).push({ ...t, kind: 'task' }); }
    return map;
  }, [items]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const dayKey = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Calendar</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">All your events and tasks in one place</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="h-9 w-9 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)]">‹</button>
          <span className="text-sm font-medium text-[var(--foreground)] w-32 text-center">{cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="h-9 w-9 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)]">›</button>
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="grid grid-cols-7 gap-px rounded-xl border border-[var(--border)] bg-[var(--border)] overflow-hidden min-w-[560px] sm:min-w-0">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} className="bg-[var(--card)] p-2 text-center text-xs font-medium text-[var(--muted-foreground)]">{d}</div>
        ))}
        {cells.map((d, i) => {
          const key = d ? dayKey(d) : '';
          const dayItems = d ? (byDay[key] || []) : [];
          return (
            <div key={i} onClick={() => d && setSelectedDay(key)}
              className={`bg-[var(--card)] min-h-[80px] p-2 text-xs cursor-pointer ${selectedDay === key ? 'ring-2 ring-inset ring-[var(--primary)]' : ''}`}>
              {d && <div className="font-medium text-[var(--foreground)]">{d}</div>}
              {dayItems.slice(0, 3).map((it: any) => (
                <div key={it.id} className={`mt-1 truncate rounded px-1 py-0.5 ${it.kind === 'event' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                  {it.title}
                </div>
              ))}
            </div>
          );
        })}
        </div>
      </div>

      {selectedDay && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-2">{selectedDay}</h2>
          {(byDay[selectedDay] || []).length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">Nothing scheduled.</p>
          ) : (
            <ul className="space-y-1">
              {(byDay[selectedDay] || []).map((it: any) => (
                <li key={it.id} className="text-sm text-[var(--foreground)]">{it.kind === 'event' ? '📅' : '✅'} {it.title}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
