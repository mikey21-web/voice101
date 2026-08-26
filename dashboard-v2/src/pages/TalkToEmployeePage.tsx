import { useEffect, useState } from 'react';
import { Mic, Phone, Sparkles, Loader2, X, ExternalLink } from 'lucide-react';
import { fetchVoiceEmployees, VoiceEmployee, testCallVoiceEmployee } from '../lib/data';
import toast from 'react-hot-toast';

export default function TalkToEmployeePage() {
  const [employees, setEmployees] = useState<VoiceEmployee[]>([]);
  const [selected, setSelected] = useState<VoiceEmployee | null>(null);
  const [phone, setPhone] = useState('');
  const [calling, setCalling] = useState(false);
  const [webCallUrl, setWebCallUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchVoiceEmployees().then((list) => {
      setEmployees(list);
      if (list.length) setSelected(list[0]);
    }).catch(() => {});
  }, []);

  const doPhoneCall = async () => {
    if (!selected) return;
    if (!phone.trim() || !/^\+?\d{8,15}$/.test(phone.replace(/\s/g, ''))) return toast.error('Enter a valid phone number');
    if (!selected.isPublished) return toast.error('Publish the employee first');
    setCalling(true);
    try {
      await testCallVoiceEmployee(selected.id, phone.trim());
      toast.success(`Calling ${phone} as ${selected.name}`);
    } catch (e: any) { toast.error(e.message || 'Call failed'); }
    finally { setCalling(false); }
  };

  if (!employees.length) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-gray-400">No employees yet</p>
          <a href="#/talk-to-build" className="mt-2 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white">Hire your first</a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-0">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f0a1e] via-[#1a1030] to-[#0d0918] p-8 text-white">
        <div className="absolute right-6 top-6 flex items-center gap-2 text-xs">
          <span className="rounded-full bg-amber-400/20 px-3 py-1 font-semibold tracking-widest text-amber-300">BEST RESULT</span>
        </div>

        <div className="mb-6 flex items-center gap-2">
          <span className="text-xs font-semibold tracking-widest text-violet-300">WHO</span>
          <div className="flex gap-2">
            {employees.slice(0, 4).map((e) => (
              <button key={e.id} onClick={() => setSelected(e)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${selected?.id === e.id ? 'border-violet-400 bg-violet-600 text-white' : 'border-white/15 bg-white/5 text-violet-200 hover:bg-white/10'}`}>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 text-xs font-bold">{e.name[0]}</span>
                {e.name} {!e.isPublished && <span className="rounded bg-amber-400/20 px-1.5 text-[10px] text-amber-300">NOT HIRED</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center py-8 text-center">
          <div className="relative flex h-40 w-40 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 opacity-30 blur-xl" />
            <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 shadow-[0_0_50px_rgba(139,92,246,0.6)]">
              <span className="text-4xl font-bold tracking-tighter">OUT</span>
            </div>
          </div>
          <p className="mt-3 text-[10px] font-bold tracking-[0.3em] text-amber-300/60">OUTPERO</p>
          <h1 className="mt-3 text-3xl font-bold">Talk to {selected?.name}</h1>
          <p className="mt-1 max-w-md text-sm text-violet-300">A real call on your credits — same script, same voice, narrowed to phone-line audio just like a live one.</p>
          <p className="mt-1 text-xs text-violet-400/70">₹7/min from your balance · {selected?.isPublished ? 'ready' : 'publish to enable calls'}</p>

          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              onClick={() => {
                if (!selected?.isPublished) return toast.error('Publish this employee first');
                if (selected.dograhWorkflowId) {
                  setWebCallUrl(`http://localhost:3010/workflow/${selected.dograhWorkflowId}/run`);
                } else {
                  toast.error('No published workflow on this employee');
                }
              }}
              className="flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-bold text-[#1a1030] shadow-lg transition hover:bg-gray-50 disabled:opacity-50"
              disabled={!selected?.isPublished}>
              <Mic className="h-4 w-4" />
              Start talking
            </button>
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-violet-400" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9xxxxxxxxx"
                className="w-40 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-white placeholder:text-violet-300/50 focus:border-violet-400 focus:outline-none" />
              <button onClick={doPhoneCall} disabled={calling} className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50">
                {calling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Or call my actual phone'}
              </button>
            </div>
            <p className="text-xs text-violet-400/60">Browser call runs in the engine — grant microphone access when prompted.</p>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
            <span className="rounded-full bg-white/10 px-3 py-1 text-violet-200">{selected?.mode || 'instant'}</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-violet-200">{selected?.voiceId || 'S36'} · {selected?.language}</span>
            <span className={`rounded-full px-3 py-1 ${selected?.isPublished ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-400/20 text-amber-300'}`}>
              {selected?.isPublished ? 'Ready' : 'Not hired yet'}
            </span>
            {selected?.hasUnpublishedChanges && <span className="rounded-full bg-amber-400/20 px-3 py-1 text-amber-300">Draft has unpublished edits</span>}
          </div>

          {selected && (
            <a href={`#/voice-employees/${selected.id}`}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-violet-200 hover:bg-white/10">
              Open {selected.name}'s page →
            </a>
          )}
        </div>
      </div>

      {webCallUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setWebCallUrl(null)}>
          <div className="relative flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[#0d0918]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-sm font-semibold text-white">🔊 Talk to {selected?.name}</p>
              <div className="flex items-center gap-2">
                <a href={webCallUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20">
                  <ExternalLink className="mr-1 inline h-3 w-3" />Open full screen
                </a>
                <button onClick={() => setWebCallUrl(null)} className="rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <iframe src={webCallUrl} className="flex-1 border-0" allow="camera; microphone; autoplay; display-capture" title="Browser call" />
          </div>
        </div>
      )}
    </div>
  );
}
