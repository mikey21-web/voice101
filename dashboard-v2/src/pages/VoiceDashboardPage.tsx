import { useEffect, useState } from 'react';
import { Mic, Sparkles, Plus, Megaphone, Wallet, Hash, Database, PhoneCall, UserPlus, ChevronRight, Zap, AlertCircle } from 'lucide-react';
import { fetchVoiceEmployees, VoiceEmployee } from '../lib/data';

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

export default function VoiceDashboardPage() {
  const nav = (path: string) => { window.location.hash = path; };
  const [employees, setEmployees] = useState<VoiceEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('instant');
  const [lang, setLang] = useState('te-IN');
  const [biz, setBiz] = useState<string | null>(null);
  const [description, setDescription] = useState('');

  useEffect(() => { fetchVoiceEmployees().then(setEmployees).catch(() => {}).finally(() => setLoading(false)); }, []);

  const build = () => {
    sessionStorage.setItem('ttb_description', description);
    sessionStorage.setItem('ttb_language', lang);
    sessionStorage.setItem('ttb_mode', mode);
    if (biz) sessionStorage.setItem('ttb_biz', biz);
    nav('/talk-to-build');
  };

  const quickActions = [
    { icon: UserPlus, tint: 'bg-violet-50 text-violet-600', label: 'New employee', sub: 'Add an AI teammate', to: '/talk-to-build' },
    { icon: Megaphone, tint: 'bg-orange-50 text-orange-600', label: 'New campaign', sub: 'Bulk-call a list', to: '/voice-campaigns' },
    { icon: Wallet, tint: 'bg-amber-50 text-amber-600', label: 'Add credits', sub: 'Top up balance', to: '/voice-billing' },
    { icon: Hash, tint: 'bg-sky-50 text-sky-600', label: 'Phone numbers', sub: 'Buy & route lines', to: '/voice-phone-numbers' },
    { icon: Database, tint: 'bg-emerald-50 text-emerald-600', label: 'View leads', sub: 'Results & follow-ups', to: '/voice-leads-results' },
    { icon: PhoneCall, tint: 'bg-fuchsia-50 text-fuchsia-600', label: 'Call log', sub: 'Every conversation', to: '/voice-call-logs' },
  ];

  const attention = employees.filter((e) => e.hasUnpublishedChanges || !e.isPublished);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#241a3e] via-[#2d2150] to-[#1a1230] p-6 text-white">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-violet-300">
            <Sparkles className="h-4 w-4" /> DESCRIBE THE JOB · WE BUILD THE EMPLOYEE
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            Build your AI employee <span className="rounded-md bg-amber-400/20 px-2 py-0.5 align-middle text-sm font-bold text-amber-300">FREE</span>
          </h1>
          <p className="mt-1 text-sm text-violet-200">Describe the job in a few sentences. You only pay for the calls they make.</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {[['instant', '⚡ Instant Lead Calling'], ['bulk', '📣 Bulk Calling']].map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${mode === m ? 'bg-white text-[#2d2150]' : 'bg-white/10 text-violet-100 hover:bg-white/20'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-widest text-violet-300">PRIMARY</span>
            {LANGS.map((l) => (
              <button key={l.code} onClick={() => setLang(l.code)}
                className={`rounded-full px-3 py-1 text-sm transition ${lang === l.code ? 'bg-amber-400 font-semibold text-[#2d2150]' : 'bg-white/10 text-violet-100 hover:bg-white/20'}`}>
                {l.label}
              </button>
            ))}
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="e.g. Call every new enquiry from my Instagram ad, ask what they need, and book a visit."
            className="mt-4 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-violet-300/60 focus:border-violet-400 focus:outline-none"
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-violet-100 hover:bg-white/10" title="Voice note">
              <Mic className="h-4 w-4" />
            </button>
            {BIZ.map((b) => (
              <button key={b.label} onClick={() => setBiz(b.label === biz ? null : b.label)}
                className={`rounded-full px-3 py-1.5 text-xs transition ${biz === b.label ? 'bg-violet-500 text-white' : 'bg-white/10 text-violet-100 hover:bg-white/20'}`}>
                {b.icon} {b.label}
              </button>
            ))}
            <div className="grow" />
            <button onClick={build} className="rounded-xl bg-amber-400 px-6 py-2.5 text-sm font-bold text-[#2d2150] hover:bg-amber-300">
              ✦ Build my employee
            </button>
          </div>
        </div>

        <button onClick={() => nav('/talk-to-employee')} className="group relative hidden overflow-hidden rounded-2xl bg-gradient-to-b from-[#171126] to-[#0d0918] p-6 text-center text-white lg:block">
          <span className="absolute right-4 top-4 rounded-full border border-amber-300/40 px-3 py-1 text-[10px] font-bold tracking-widest text-amber-300">✦ BEST RESULT</span>
          <div className="mx-auto mt-8 flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 shadow-[0_0_60px_rgba(139,92,246,0.5)] transition group-hover:scale-105">
            <Mic className="h-12 w-12 text-white" />
          </div>
          <p className="mt-6 text-xl font-bold">Talk to an employee</p>
          <p className="mt-1 text-sm text-violet-300">Same script, same voice — right in your browser</p>
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xs font-bold tracking-widest text-gray-400">QUICK ACTIONS</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((a) => (
              <button key={a.label} onClick={() => nav(a.to)}
                className="flex items-center gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-violet-300 hover:shadow">
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${a.tint}`}><a.icon className="h-5 w-5" /></span>
                <span>
                  <span className="block text-sm font-semibold text-gray-800">{a.label}</span>
                  <span className="block text-xs text-gray-400">{a.sub}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-widest text-gray-400">YOUR AI EMPLOYEES</h2>
            <button onClick={() => nav('/voice-employees')} className="flex items-center text-xs font-semibold text-violet-600 hover:underline">View all <ChevronRight className="h-3 w-3" /></button>
          </div>
          <div className="rounded-xl border bg-white shadow-sm">
            {loading ? (
              <p className="p-5 text-sm text-gray-400">Loading…</p>
            ) : employees.length === 0 ? (
              <button onClick={() => nav('/talk-to-build')} className="w-full p-5 text-left">
                <p className="text-sm font-semibold text-gray-700">Hire your first employee</p>
                <p className="text-xs text-gray-400">Free to build · ready in 5 minutes</p>
              </button>
            ) : (
              <>
                {employees.slice(0, 3).map((e) => (
                  <button key={e.id} onClick={() => nav(`/voice-employees/${e.id}`)}
                    className="flex w-full items-center gap-3 border-b p-4 text-left last:border-0 hover:bg-gray-50">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">{e.name?.[0]?.toUpperCase() || 'R'}</span>
                    <span className="grow">
                      <span className="block text-sm font-semibold text-gray-800">{e.name}</span>
                      <span className="block text-xs text-gray-400">{e.role}</span>
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.isPublished ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      {e.isPublished ? 'Ready' : 'Draft'}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </button>
                ))}
                <button onClick={() => nav('/talk-to-build')} className="flex w-full items-center justify-center gap-2 p-3 text-sm font-semibold text-violet-600 hover:bg-violet-50">
                  <Plus className="h-4 w-4" /> Add another employee
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {attention.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-bold tracking-widest text-gray-400">NEEDS YOUR ATTENTION</h2>
          <div className="space-y-2">
            {attention.map((e) => (
              <button key={e.id} onClick={() => nav(`/voice-employees/${e.id}`)}
                className="flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left hover:bg-amber-100">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <span className="grow text-sm text-amber-800">
                  <b>{e.name}</b> has unpublished changes — apply them to go live.
                </span>
                <ChevronRight className="h-4 w-4 text-amber-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl border bg-white p-4 text-xs text-gray-400 shadow-sm">
        <Zap className="h-4 w-4 text-violet-400" />
        AI can get things wrong — test a call and read through your script before going live.
      </div>
    </div>
  );
}
