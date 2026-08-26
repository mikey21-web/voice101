import { X, AlertCircle, Loader2, Share2, PhoneCall, Bot, User, Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import type { VoiceCallRun } from '../lib/data';
import { fetchCallStruggles, fetchVoiceEngineCall, redialVoiceEngineCall, type CallStrugglesReport, type VoiceEngineCall } from '../lib/data';
import toast from 'react-hot-toast';

function transcriptToLines(transcript: any): Array<{ role: 'agent' | 'caller'; text: string }> {
  if (!transcript) return [];
  if (Array.isArray(transcript)) {
    return transcript
      .map((m: any) => {
        const role = m?.role === 'agent' ? 'agent' : m?.role === 'caller' || m?.role === 'user' ? 'caller' : null;
        const text = typeof m === 'string' ? m : m?.text || m?.content || '';
        if (role && text) return { role, text: String(text) };
        return null;
      })
      .filter(Boolean) as Array<{ role: 'agent' | 'caller'; text: string }>;
  }
  return [{ role: 'agent', text: typeof transcript === 'string' ? transcript : JSON.stringify(transcript) }];
}

export default function VoiceCallDetailDrawer({ run, onClose }: { run: VoiceCallRun; onClose: () => void }) {
  const [struggles, setStruggles] = useState<CallStrugglesReport | null>(null);
  const [detail, setDetail] = useState<VoiceEngineCall | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialing, setDialing] = useState(false);
  const vars = Object.entries(run.gatheredContext || {}).filter(([k]) => k !== 'answered_by');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchCallStruggles(String(run.id)).catch(() => null),
      fetchVoiceEngineCall(String(run.id)).catch(() => null),
    ]).then(([s, d]) => { setStruggles(s); setDetail(d); })
      .finally(() => setLoading(false));
  }, [run.id]);

  const insights = detail?.talkRatio || run.talkRatio || null;
  const sentiment = detail?.sentiment || run.sentiment || null;
  const nextStep = detail?.recommendedNextStep || run.recommendedNextStep || null;
  const recordingUrl = detail?.recordingUrl || run.recordingUrl;
  const transcriptLines = transcriptToLines(detail?.transcript ?? run.transcript);

  const sentimentColor = sentiment === 'positive' ? 'text-emerald-600 bg-emerald-50' : sentiment === 'negative' ? 'text-rose-600 bg-rose-50' : 'text-amber-600 bg-amber-50';

  const shareSummary = () => {
    const text = [
      `📞 Call with ${run.leadName || run.calledNumber || 'unknown'}`,
      run.disposition ? `Outcome: ${run.disposition}` : null,
      run.summary || detail?.summary ? `Summary: ${run.summary || detail?.summary}` : null,
      nextStep ? `Next step: ${nextStep}` : null,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(() => toast.success('Summary copied')).catch(() => toast.error('Could not copy'));
  };

  const callback = async () => {
    setDialing(true);
    try {
      await redialVoiceEngineCall(String(run.id));
      toast.success(`Calling ${run.calledNumber || run.leadName || 'lead'} back…`);
    } catch (e: any) { toast.error(e.message || 'Callback failed'); }
    finally { setDialing(false); }
  };

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

          <div className="flex gap-2">
            <button onClick={callback} disabled={dialing} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] text-white text-xs font-semibold py-2 hover:opacity-90 disabled:opacity-50">
              {dialing ? <Loader2 size={14} className="animate-spin" /> : <PhoneCall size={14} />} Call back
            </button>
            <button onClick={shareSummary} className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] text-xs font-semibold py-2 hover:bg-[var(--accent)]">
              <Share2 size={14} /> Share summary
            </button>
          </div>

          {recordingUrl && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--muted-foreground)] mb-2">Recording</h3>
              <audio controls src={recordingUrl} className="w-full h-9" />
            </div>
          )}

          {(run.summary || detail?.summary) && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--muted-foreground)] mb-2">AI Summary</h3>
              <p className="text-sm text-[var(--foreground)] leading-relaxed">{run.summary || detail?.summary}</p>
            </div>
          )}

          {(insights || sentiment || nextStep) && (
            <div className="rounded-lg border border-[var(--border)] p-3 space-y-3">
              <h3 className="text-xs font-semibold text-[var(--muted-foreground)]">AI Insights</h3>
              {insights && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">Talk ratio</p>
                  <div className="flex h-2.5 rounded-full overflow-hidden">
                    <div className="bg-[var(--primary)]" style={{ width: `${insights.agent}%` }} />
                    <div className="bg-violet-300" style={{ width: `${Math.max(0, 100 - insights.agent)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--muted-foreground)] mt-1">
                    <span className="flex items-center gap-1"><Bot size={10} /> Agent {insights.agent}%</span>
                    <span className="flex items-center gap-1"><User size={10} /> Caller {100 - insights.agent}%</span>
                  </div>
                </div>
              )}
              {sentiment && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Sentiment</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${sentimentColor}`}>{sentiment}</span>
                </div>
              )}
              {nextStep && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] mt-0.5">Next</span>
                  <p className="text-sm text-[var(--foreground)]">{nextStep}</p>
                </div>
              )}
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
            {transcriptLines.length > 0 ? (
              <div className="rounded-lg border border-[var(--border)] p-3 max-h-60 overflow-y-auto space-y-2">
                {transcriptLines.map((line, idx) => (
                  <div key={idx} className={`flex ${line.role === 'agent' ? 'justify-start' : 'justify-end'}`}>
                    <span className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs leading-relaxed ${line.role === 'agent' ? 'bg-[var(--primary)]/10 text-[var(--foreground)]' : 'bg-violet-100 dark:bg-violet-900/40 text-[var(--foreground)]'}`}>
                      {line.text}
                    </span>
                  </div>
                ))}
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
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && !struggles && !detail && (
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
