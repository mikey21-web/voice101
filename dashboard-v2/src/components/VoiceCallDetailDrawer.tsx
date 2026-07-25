import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { VoiceCallRun } from '../lib/data';

export default function VoiceCallDetailDrawer({ run, onClose }: { run: VoiceCallRun; onClose: () => void }) {
  const vars = Object.entries(run.gatheredContext || {}).filter(([k]) => k !== 'answered_by');

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg h-full bg-[var(--card)] border-l border-[var(--border)] shadow-xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-[var(--border)] sticky top-0 bg-[var(--card)]">
          <div>
            <h2 className="text-base font-bold text-[var(--foreground)]">Call Details</h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{new Date(run.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
          </div>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-[var(--muted-foreground)] text-xs block">Lead</span><span className="font-medium text-[var(--foreground)]">{run.leadName || 'Unknown'}</span></div>
            <div><span className="text-[var(--muted-foreground)] text-xs block">Phone</span><span className="font-medium text-[var(--foreground)]">{run.calledNumber || '—'}</span></div>
            <div><span className="text-[var(--muted-foreground)] text-xs block">Outcome</span>
              <span className={`inline-flex mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${run.answered ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>{run.disposition}</span>
            </div>
            <div><span className="text-[var(--muted-foreground)] text-xs block">Duration</span><span className="font-medium text-[var(--foreground)]">{run.durationSeconds}s</span></div>
          </div>

          {run.recordingUrl && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--muted-foreground)] mb-2">Recording</h3>
              <audio controls src={run.recordingUrl} className="w-full h-9" />
            </div>
          )}

          {run.summary && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--muted-foreground)] mb-2">AI Summary</h3>
              <p className="text-sm text-[var(--foreground)] leading-relaxed">{run.summary}</p>
            </div>
          )}

          {vars.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--muted-foreground)] mb-2">Extracted Conversation Variables</h3>
              <div className="space-y-2">
                {vars.map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-[var(--border)] p-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">{key.replace(/_/g, ' ')}</p>
                    <p className="text-sm text-[var(--foreground)] mt-0.5">{String(value ?? '—')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-[var(--muted-foreground)] mb-2">Transcript</h3>
            {run.transcript ? (
              <div className="rounded-lg border border-[var(--border)] p-3 max-h-60 overflow-y-auto">
                <pre className="text-xs text-[var(--foreground)] leading-relaxed whitespace-pre-wrap font-mono">{run.transcript}</pre>
              </div>
            ) : run.transcriptUrl ? (
              <a href={run.transcriptUrl} target="_blank" rel="noreferrer" className="text-sm text-[var(--primary)] hover:underline">View full transcript ↗</a>
            ) : (
              <p className="text-xs text-[var(--muted-foreground)]">No transcript available</p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
