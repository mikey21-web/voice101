import { useEffect, useState } from 'react';
import { Sparkles, Loader2, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

interface CatalogItem {
  key: string; name: string; role: string; business: string; hirePrice: number; tone: string;
  tags: string[]; description: string; languages: string[]; voice: string;
}

export default function VoiceStorePage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/voice-store/catalog').then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-gray-400">STORE / HIRE</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Hire a pre-built AI employee</h1>
        <p className="mt-1 text-sm text-gray-500">₹1,899/month each — includes 500 credits, active for 30 days.</p>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-gray-400"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Loading…</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div key={it.key} className="flex flex-col rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-start justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-lg font-bold text-white">
                  {it.name[0]?.toUpperCase()}
                </span>
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-600">{it.business}</span>
              </div>
              <h3 className="mt-3 flex items-center gap-2 text-lg font-bold text-gray-900"><User className="h-4 w-4 text-violet-500" /> {it.name}</h3>
              <p className="text-sm font-medium text-violet-600">{it.role}</p>
              <p className="mt-2 flex-1 text-sm text-gray-600">{it.description}</p>
              <p className="mt-2 text-xs text-gray-400">{it.tone}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {it.languages.map((l) => <span key={l} className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">{l}</span>)}
              </div>
              <p className="mt-2 text-[11px] text-gray-400">{it.voice}</p>
              <button
                onClick={() => {
                  sessionStorage.setItem('ttb_description', `Hire a ${it.role.toLowerCase()} for a ${it.business.toLowerCase()} business. ${it.description}`);
                  sessionStorage.setItem('ttb_language', 'te-IN');
                  sessionStorage.setItem('ttb_mode', 'instant');
                  sessionStorage.setItem('ttb_biz', it.business);
                  window.location.hash = '/talk-to-build';
                }}
                className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
                <Sparkles className="h-4 w-4" /> Hire for ₹{it.hirePrice}/mo
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
