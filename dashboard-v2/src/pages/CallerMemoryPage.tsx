import { useEffect, useState } from 'react';
import { Brain, Trash2, ChevronRight, Search, RefreshCw } from 'lucide-react';
import { fetchVoiceCallers, clearVoiceCallerFacts, VoiceCaller } from '../lib/data';
import toast from 'react-hot-toast';

export default function CallerMemoryPage() {
  const [callers, setCallers] = useState<VoiceCaller[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<VoiceCaller | null>(null);
  const [clearing, setClearing] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchVoiceCallers().then(setCallers).catch(() => toast.error('Failed to load callers')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleClear = async (caller: VoiceCaller) => {
    if (!confirm(`Clear memory for ${caller.phoneNumber}? This cannot be undone.`)) return;
    setClearing(caller.phoneNumber);
    try {
      await clearVoiceCallerFacts(caller.phoneNumber);
      toast.success('Memory cleared');
      load();
      if (selected?.phoneNumber === caller.phoneNumber) setSelected(null);
    } catch { toast.error('Failed to clear'); }
    finally { setClearing(null); }
  };

  const filtered = callers.filter((c) =>
    c.phoneNumber.includes(search) ||
    JSON.stringify(c.facts).toLowerCase().includes(search.toLowerCase())
  );

  const factCount = (c: VoiceCaller) => Object.keys(c.facts || {}).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Caller Memory</h1>
          <p className="mt-1 text-sm text-gray-500">Facts your AI employees remember about each caller across calls.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by phone or fact…"
          className="w-full rounded-xl border bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm focus:border-violet-400 focus:outline-none" />
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center">
          <Brain className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-500">{search ? 'No matches' : 'No caller memory yet'}</p>
          <p className="mt-1 text-xs text-gray-400">Memory is built automatically as employees talk to callers.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            {filtered.map((c) => (
              <button key={c.phoneNumber} onClick={() => setSelected(c)}
                className={`flex w-full items-center gap-3 border-b p-4 text-left transition last:border-0 hover:bg-gray-50 ${selected?.phoneNumber === c.phoneNumber ? 'bg-violet-50' : ''}`}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                  <Brain className="h-5 w-5" />
                </span>
                <span className="grow min-w-0">
                  <span className="block text-sm font-semibold text-gray-800">{c.phoneNumber}</span>
                  <span className="block truncate text-xs text-gray-400">
                    {factCount(c) === 0 ? 'No facts stored' : `${factCount(c)} fact${factCount(c) !== 1 ? 's' : ''} · updated ${new Date(c.updatedAt).toLocaleDateString()}`}
                  </span>
                </span>
                {factCount(c) > 0 && <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">{factCount(c)}</span>}
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </button>
            ))}
          </div>

          {selected ? (
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-800">{selected.phoneNumber}</p>
                  <p className="text-xs text-gray-400">Updated {new Date(selected.updatedAt).toLocaleString()}</p>
                </div>
                <button onClick={() => handleClear(selected)} disabled={!!clearing}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                  <Trash2 className="h-3.5 w-3.5" />
                  {clearing === selected.phoneNumber ? 'Clearing…' : 'Clear memory'}
                </button>
              </div>
              {factCount(selected) === 0 ? (
                <p className="text-sm text-gray-400">No facts stored for this caller yet.</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(selected.facts).map(([key, val]) => (
                    <div key={key} className="rounded-lg bg-gray-50 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{key.replace(/_/g, ' ')}</p>
                      <p className="mt-0.5 text-sm text-gray-700">{String(val)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-dashed bg-gray-50 p-8 text-sm text-gray-400">
              Select a caller to view their memory
            </div>
          )}
        </div>
      )}
    </div>
  );
}
