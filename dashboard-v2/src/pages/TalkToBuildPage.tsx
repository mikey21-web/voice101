import { useEffect, useRef, useState } from 'react';
import { Mic, Sparkles, Loader2, ArrowRight, ArrowLeft, Check, Bot, FileText, User, MessageCircle, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { transcribeNote, structurePrompt, draftAgent, DraftAgent } from '../lib/talkToBuild';

const LANGS = [
  { code: 'te-IN', label: 'తెలుగు' },
  { code: 'hi-IN', label: 'हिन्दी' },
  { code: 'ta-IN', label: 'தமிழ்' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ' },
  { code: 'ml-IN', label: 'മലയാളം' },
  { code: 'mr-IN', label: 'मराठी' },
  { code: 'en-IN', label: 'English' },
];

const BIZ = [
  { icon: '🏢', label: 'Real estate' },
  { icon: '📚', label: 'Coaching & tuition' },
  { icon: '🩺', label: 'Hospital & clinic' },
  { icon: '🚗', label: 'Car & bike dealership' },
  { icon: '🛋️', label: 'Interiors & construction' },
  { icon: '🧰', label: 'Local services' },
  { icon: '💍', label: 'Jewellery' },
];

const SWARA_QUESTIONS = [
  'Who should I call? Tell me about the people this employee will phone.',
  'What is the goal of the call — what should the employee get done?',
  'What should they ask to figure out if the person is a good fit?',
  'What should they do if someone says no, or is busy?',
  'Any rules — things to never say, prices never to quote, ways to behave?',
];

type Step = 'hire' | 'swara' | 'brief' | 'preview' | 'done';

export default function TalkToBuildPage() {
  const [step, setStep] = useState<Step>('hire');
  const [description, setDescription] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [language, setLanguage] = useState('te-IN');
  const [channel, setChannel] = useState('instant');
  const [enhance, setEnhance] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [structuring, setStructuring] = useState(false);
  const [brief, setBrief] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<DraftAgent | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [swaraIdx, setSwaraIdx] = useState(0);
  const [swaraAnswers, setSwaraAnswers] = useState<string[]>([]);
  const [swaraInput, setSwaraInput] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const swaraEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = sessionStorage.getItem('ttb_description');
    if (d) {
      setDescription(d);
      setLanguage(sessionStorage.getItem('ttb_language') || 'te-IN');
      setChannel(sessionStorage.getItem('ttb_mode') || 'instant');
      sessionStorage.removeItem('ttb_description');
      if (d.trim()) runStructureWith(d);
    }
  }, []);

  useEffect(() => { swaraEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [swaraAnswers, swaraIdx]);

  const runStructureWith = async (text: string) => {
    setStructuring(true);
    setStep('brief');
    try {
      const { structured } = await structurePrompt(text);
      setBrief(structured);
    } catch (e: any) {
      toast.error(e.message || 'Failed to structure the brief');
      setStep('hire');
    } finally {
      setStructuring(false);
    }
  };

  const startSwara = () => { setStep('swara'); setSwaraIdx(0); setSwaraAnswers([]); setSwaraInput(''); };

  const answerSwara = () => {
    const a = swaraInput.trim();
    if (!a) return;
    const answers = [...swaraAnswers, a];
    setSwaraAnswers(answers);
    setSwaraInput('');
    if (swaraIdx + 1 >= SWARA_QUESTIONS.length) {
      const biz = sessionStorage.getItem('ttb_biz') || '';
      const composed = `Business type: ${biz || 'not specified'}\n` + SWARA_QUESTIONS.map((q, i) => `Q: ${q}\nA: ${answers[i]}`).join('\n');
      runStructureWith(composed);
    } else {
      setSwaraIdx(swaraIdx + 1);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        await doTranscribe(blob);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch { toast.error('Microphone access denied'); }
  };

  const stopRecording = () => { recorderRef.current?.stop(); setRecording(false); };

  const onFilePicked = async (file: File | undefined) => { if (file) await doTranscribe(file); };

  const doTranscribe = async (blob: Blob) => {
    setTranscribing(true);
    try {
      const ext = blob.type.includes('wav') ? 'wav' : 'webm';
      const file = new File([blob], `note.${ext}`, { type: blob.type });
      const lang2 = language.slice(0, 2);
      const { transcript } = await transcribeNote(file, ['te', 'hi', 'en'].includes(lang2) ? lang2 : 'en');
      if (!transcript?.trim()) throw new Error('Empty transcript');
      setDescription((d) => (d.trim() ? `${d.trim()}\n${transcript}` : transcript));
      toast.success('Transcribed');
    } catch (e: any) { toast.error(e.message || 'Transcription failed'); }
    finally { setTranscribing(false); }
  };

  const runDraft = async () => {
    if (!brief.trim()) return toast.error('Brief is empty');
    setDrafting(true);
    try {
      const result = await draftAgent({ channel, description: brief, business_name: businessName || undefined, language });
      setDraft(result as DraftAgent);
      setStep('preview');
    } catch (e: any) { toast.error(e.message || 'Agent generation failed'); }
    finally { setDrafting(false); }
  };

  const createEmployee = async () => {
    if (!draft) return;
    setCreating(true);
    try {
      const result: any = await draftAgent({ channel, description: brief, business_name: businessName || undefined, language, create: true });
      setEmployeeId(result.employee.id);
      setStep('done');
    } catch (e: any) { toast.error(e.message || 'Could not save the employee'); }
    finally { setCreating(false); }
  };

  if (step === 'swara') {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <div className="rounded-2xl bg-gradient-to-br from-[#241a3e] to-[#1a1230] p-6 text-white">
          <p className="text-xs font-semibold tracking-widest text-violet-300">GUIDED SETUP WITH SWARA</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold"><Sparkles className="h-6 w-6 text-amber-300" /> Swara is building your employee</h1>
          <p className="mt-1 text-sm text-violet-200">She asks what you'd forget to type — answer in your own words, any language.</p>
        </div>
        <div className="space-y-3 rounded-xl border bg-white p-5 shadow-sm">
          {swaraAnswers.map((a, i) => (
            <div key={i} className="space-y-1">
              <p className="flex items-start gap-2 text-sm text-gray-500"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />{SWARA_QUESTIONS[i]}</p>
              <p className="ml-6 rounded-lg bg-violet-50 px-3 py-2 text-sm text-gray-800" dir="auto">{a}</p>
            </div>
          ))}
          {swaraIdx < SWARA_QUESTIONS.length && (
            <p className="flex items-start gap-2 text-sm font-medium text-gray-700">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />{SWARA_QUESTIONS[swaraIdx]}
              <span className="text-xs font-normal text-gray-400">({swaraIdx + 1}/{SWARA_QUESTIONS.length})</span>
            </p>
          )}
          <div ref={swaraEndRef} />
        </div>
        {swaraIdx < SWARA_QUESTIONS.length && (
          <div className="flex gap-2">
            <input value={swaraInput} onChange={(e) => setSwaraInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && answerSwara()}
              placeholder="Type your answer…" dir="auto"
              className="grow rounded-xl border px-4 py-3 text-sm focus:border-violet-400 focus:outline-none" />
            <button onClick={answerSwara} className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-700">
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}
        <button onClick={() => setStep('hire')} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-4 w-4" /> Back to options
        </button>
      </div>
    );
  }

  if (step === 'brief') {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4 text-violet-500" /> Structured brief</h2>
          <p className="mt-1 text-xs text-gray-500">Edit anything wrong — this brief is what your employee is built from.</p>
          {structuring ? (
            <div className="flex items-center gap-2 py-10 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Structuring your description…</div>
          ) : (
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={14} dir="auto"
              className="mt-3 w-full rounded-lg border px-3 py-2 text-sm leading-relaxed" />
          )}
          <div className="mt-3 flex justify-between">
            <button onClick={() => setStep('hire')} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /> Back</button>
            <button onClick={runDraft} disabled={drafting || structuring} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
              {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />} Build my employee
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'preview' && draft) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <div className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-medium"><Bot className="h-4 w-4 text-violet-500" /> Meet your AI employee</h2>
          <div className="rounded-lg bg-gray-50 p-4 text-sm">
            <p><span className="inline-flex items-center gap-1 font-medium"><User className="h-4 w-4" /> Name:</span> <span dir="auto" className="font-semibold">{draft.name}</span> <span className="text-gray-400">({draft.gender})</span></p>
            <p className="mt-1"><span className="font-medium">Role:</span> <span dir="auto">{draft.role}</span></p>
            <p className="mt-1"><span className="font-medium">Opens with:</span> "<span dir="auto">{draft.welcome_message}</span>"</p>
          </div>
          <div className="space-y-2">
            {draft.sections.map((s, i) => (
              <div key={s.key} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{i + 1}. {s.heading}</span>
                  <code className="text-xs text-gray-400">{s.key}</code>
                </div>
                <p className="mt-1 line-clamp-2 text-gray-600" dir="auto">{s.prompt}</p>
                {s.edges.length > 0 && <p className="mt-1 text-xs text-violet-500">{s.edges.map((e) => `→ ${e.to_key}`).join('  ·  ')}</p>}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {draft.variables.map((v) => (
              <span key={v.key} className={`rounded-full px-3 py-1 text-xs ${v.source === 'pre' ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {v.key} · {v.source}
              </span>
            ))}
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep('brief')} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /> Back</button>
            <button onClick={createEmployee} disabled={creating} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Create employee
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <div className="space-y-4 rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100"><Check className="h-7 w-7 text-emerald-600" /></div>
          <h2 className="text-lg font-semibold">Employee created</h2>
          <p className="text-sm text-gray-500">Saved as a draft. Open it to review the script, then publish to go live.</p>
          <div className="flex justify-center gap-3">
            <a href={`#/voice-employees/${employeeId}`} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">Open employee</a>
            <button onClick={() => { setStep('hire'); setDescription(''); setBrief(''); setDraft(null); setEmployeeId(null); }} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">Hire another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-gray-400">HIRE AN EMPLOYEE</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Tell us how the call should go.</h1>
        <p className="mt-1 text-sm text-gray-500">List it in your own words — first this, then that. We'll turn your steps into a natural call flow, set up the variables, and have your employee ready.</p>
      </div>

      <button onClick={startSwara} className="group flex w-full items-center gap-4 rounded-2xl bg-gradient-to-br from-[#241a3e] to-[#1a1230] p-5 text-left text-white shadow-sm transition hover:shadow-lg">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 shadow-[0_0_30px_rgba(139,92,246,0.5)]">
          <Mic className="h-6 w-6" />
        </span>
        <span className="grow">
          <span className="block text-xs font-semibold tracking-widest text-violet-300">GUIDED SETUP WITH SWARA <span className="ml-1 rounded bg-amber-400/20 px-1.5 py-0.5 text-amber-300">BEST RESULT</span></span>
          <span className="mt-0.5 block text-lg font-bold">Answer 5 questions, she builds them</span>
          <span className="mt-0.5 block text-sm text-violet-200">Swara asks what you'd forget to type — who calls, what they always ask, what to do when someone says no — and writes the whole script.</span>
        </span>
        <ArrowRight className="h-5 w-5 text-violet-300 transition group-hover:translate-x-1" />
      </button>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold tracking-widest text-gray-400">OR DESCRIBE IT YOURSELF</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
          <div className="flex flex-wrap gap-2">
            {[['instant', '⚡ Instant Lead Caller'], ['bulk', '📣 Bulk Caller']].map(([m, label]) => (
              <button key={m} onClick={() => setChannel(m)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${channel === m ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center justify-end gap-2 text-xs text-gray-500">
            <input type="checkbox" checked={enhance} onChange={(e) => setEnhance(e.target.checked)} className="accent-violet-600" />
            Telugu enhance · natural spoken style (off = raw prompting)
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-widest text-gray-400">PRIMARY</span>
          {LANGS.map((l) => (
            <button key={l.code} onClick={() => setLanguage(l.code)}
              className={`rounded-full px-3 py-1 text-sm transition ${language === l.code ? 'bg-amber-100 font-semibold text-amber-700 ring-1 ring-amber-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {l.label}
            </button>
          ))}
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="e.g. Call every new enquiry from my Instagram ad, ask what they need, and book a visit."
          className="mt-4 w-full rounded-xl border px-4 py-3 text-sm focus:border-violet-400 focus:outline-none"
          dir="auto"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={recording ? stopRecording : startRecording}
            className={`flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium ${recording ? 'border-red-300 bg-red-50 text-red-600' : 'text-gray-600 hover:bg-gray-50'}`}>
            {recording ? <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> : <Mic className="h-4 w-4" />}
            {recording ? 'Stop & transcribe' : 'Record a voice note'}
          </button>
          <label className="cursor-pointer rounded-full border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
            Upload audio
            <input type="file" accept="audio/*" hidden onChange={(e) => onFilePicked(e.target.files?.[0])} />
          </label>
          {transcribing && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          {BIZ.map((b) => (
            <button key={b.label} onClick={() => setBusinessName(businessName === b.label ? '' : b.label)}
              className={`rounded-full px-3 py-1.5 text-xs transition ${businessName === b.label ? 'bg-violet-100 text-violet-700 ring-1 ring-violet-300' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {b.icon} {b.label}
            </button>
          ))}
          <div className="grow" />
          <button onClick={() => runStructureWith(description)} disabled={structuring || !description.trim()}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">
            {structuring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Build my employee
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">Free to build · you only pay for the calls they make</p>
      </div>

      <div className="flex items-center gap-2 rounded-xl border bg-white p-4 text-xs text-gray-400 shadow-sm">
        <MessageCircle className="h-4 w-4 text-violet-400" />
        AI can get things wrong — test a call and read through your script before going live.
      </div>
    </div>
  );
}
