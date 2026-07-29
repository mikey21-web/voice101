import { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Play, Square, Bot, ArrowRight, Sparkles, Workflow } from 'lucide-react';
import toast from 'react-hot-toast';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedWf, setGeneratedWf] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    fetchWorkflows().then(setWorkflows).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return toast.error('Describe what you want the workflow to do');
    setGenerating(true);
    setGeneratedWf(null);
    try {
      const wf = await generateWorkflow(prompt.trim());
      setGeneratedWf(wf);
      toast.success('Workflow generated!');
      refresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate workflow');
    }
    setGenerating(false);
  };

  const openInBuilder = (id: string) => {
    window.location.hash = `/flows?id=${id}`;
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this workflow?')) return;
    try { await deleteWorkflow(id); toast.success('Deleted'); refresh(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleToggle = async (wf: any) => {
    try { await updateWorkflow(wf.id, { active: !wf.active }); refresh(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Workflows</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Describe a workflow in English and AI builds it for you</p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-8 w-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
            <Bot size={16} className="text-[var(--primary)]" />
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]">Describe your workflow</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder='e.g. "When a new lead comes from the website, send them a WhatsApp welcome message and create a high-priority task to call them within 2 days"'
              className="w-full h-24 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 resize-none"
            />
            <div className="flex justify-between items-center">
              <p className="text-xs text-[var(--muted-foreground)]">AI will generate triggers, steps, and connections</p>
              <button
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
              >
                {generating ? (
                  <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Generating...</>
                ) : (
                  <><Sparkles size={16} /> Generate</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {generatedWf && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-4 animate-scale-in space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">{generatedWf.name}</span>
            </div>
            <button
              onClick={() => openInBuilder(generatedWf.id)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors"
            >
              <Workflow size={14} /> Open in Flow Builder <ArrowRight size={14} />
            </button>
          </div>
          {generatedWf.description && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">{generatedWf.description}</p>
          )}
          {generatedWf.versions?.[0]?.steps?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Steps</p>
              {generatedWf.versions[0].steps.map((s: any, i: number) => (
                <div key={s.id || i} className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                  <span className="h-5 w-5 rounded-full bg-emerald-200 dark:bg-emerald-800 flex items-center justify-center text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{i + 1}</span>
                  <span className="font-medium">{s.label || s.actionType}</span>
                  <ArrowRight size={10} className="text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-500">{s.actionType}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Steps</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Trigger</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Updated</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-[var(--muted-foreground)]">Loading...</td></tr>
              ) : workflows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-[var(--muted-foreground)]">No workflows yet. Describe one above and AI will build it.</td></tr>
              ) : (
                workflows.map((wf: any) => {
                  const v = wf.versions?.[0];
                  const steps = v?.steps || [];
                  const trigger = v?.triggers?.[0];
                  return (
                    <tr key={wf.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)]/50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium text-[var(--foreground)]">{wf.name}</span>
                          {wf.tags?.includes('generated') && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-[10px] text-purple-600 dark:text-purple-400">AI</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">{steps.length} steps</td>
                      <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] font-mono">{trigger?.type || '-'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggle(wf)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                            wf.active
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {wf.active ? <Play size={10} /> : <Square size={10} />}
                          {wf.active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">{wf.updatedAt ? new Date(wf.updatedAt).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openInBuilder(wf.id)} className="p-1.5 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]" title="Edit in Flow Builder">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(wf.id)} className="p-1.5 rounded-md hover:bg-[var(--accent)] text-red-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

async function fetchWorkflows() {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/workflows', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

async function generateWorkflow(prompt: string) {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/workflows/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err ? JSON.parse(err).message : 'Generation failed');
  }
  return res.json();
}

async function updateWorkflow(id: string, data: any) {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/workflows/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to update');
  return res.json();
}

async function deleteWorkflow(id: string) {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to delete');
}
