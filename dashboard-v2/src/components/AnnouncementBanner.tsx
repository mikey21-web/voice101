import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Wrench } from 'lucide-react';

interface Announcement {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  dismissable?: boolean;
}

/**
 * System-wide announcement banner. Shown at top of dashboard when there's a
 * system message (maintenance, new feature, etc).
 */
export function AnnouncementBanner({ announcements }: { announcements: Announcement[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = announcements.filter(a => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div role="region" aria-label="Announcements" className="space-y-2">
      {visible.map(a => {
        const styles = {
          info: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100',
          warning: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100',
          error: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100',
          success: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100',
        }[a.type];

        return (
          <div key={a.id} role="alert" className={`flex items-start justify-between px-4 py-3 border-l-4 rounded-r ${styles}`}>
            <span className="text-sm">{a.message}</span>
            {a.dismissable !== false && (
              <button
                onClick={() => setDismissed(prev => new Set(prev).add(a.id))}
                aria-label="Dismiss announcement"
                className="ml-4 text-current opacity-50 hover:opacity-100"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Maintenance mode: shows a full-screen blocking overlay when enabled.
 */
export function MaintenanceMode({ enabled, message = 'System maintenance in progress' }: { enabled: boolean; message?: string }) {
  if (!enabled) return null;
  return createPortal(
    <div role="alertdialog" aria-modal="true" className="fixed inset-0 bg-yellow-100 dark:bg-yellow-950/40 flex items-center justify-center z-50">
      <div className="max-w-md text-center p-8">
        <Wrench size={32} className="mx-auto mb-4 text-[var(--muted-foreground)]" />
        <h2 className="text-xl font-bold mb-2">{message}</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          We're making the system better. We'll be back shortly.
        </p>
      </div>
    </div>,
    document.body
  );
}
