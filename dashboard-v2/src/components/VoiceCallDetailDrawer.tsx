import { X, AlertCircle, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import type { VoiceCallRun } from '../lib/data';
import { fetchCallStruggles, type CallStrugglesReport } from '../lib/data';

export default function VoiceCallDetailDrawer({ run, onClose }: { run: VoiceCallRun; onClose: () => void }) {
  const [struggles, setStruggles] = useState<CallStrugglesReport | null>(null);
  const [loading, setLoading] = useState(false);
  const vars = Object.entries(run.gatheredContext || {}).filter(([k]) => k !== 'answered_by');

  useEffect(() => {
    setLoading(true);
    fetchCallStruggles(String(run.id))
      .then(setStruggles)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [run.id]);

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

          {struggles && struggles.teachable.length > 0 && (
            <div>
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-xs font-semibold text-[var(--muted-foreground)]">Where Agent Struggled</h3>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400">
                  <AlertCircle size={10} />{struggles.teachable.length}
                </span>
              </div>
              <div className="space-y-2">
                {struggles.teachable.map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/10 p-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-rose-700 dark:text-rose-400 font-medium">{item.issue} (Turn {item.turn})</p>
                    <p className="text-xs text-[var(--foreground)] mt-1">{item.detail}</p>
                    {item.excerpt && <p className="text-[10px] text-[var(--muted-foreground)] mt-1 italic font-mono">"{item.excerpt.slice(0, 60)}{item.excerpt.length > 60 ? '…' : ''}"</p>}
                    <button
                      onClick={() => {
                        const issue = item.detail;
                        const correction = prompt('How should the agent respond instead?');
                        if (correction) {
                          // POST to create training example
                          fetch('/api/voice-training', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                            body: JSON.stringify({ employeeId: run.leadId, callId: run.id, issue, correction, context: item.excerpt }),
                          }).then(() => alert('Training example saved!')).catch(e => alert(`Error: ${e.message}`));
                        }
                      }}
                      className="text-[10px] mt-2 px-2 py-1 rounded bg-rose-200 dark:bg-rose-900/40 text-rose-900 dark:text-rose-300 hover:bg-rose-300 dark:hover:bg-rose-800 font-medium transition-colors"
                    >
                      Teach Agent
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && !struggles && (
            <div className="flex items-center justify-center gap-2 p-4 text-xs text-[var(--muted-foreground)]">
              <Loader2 size={14} className="animate-spin" />Analyzing call quality...
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
