import { useState, useEffect } from "react";
import { api } from "../lib/api";
import toast from "react-hot-toast";
import { Plus, Search, Edit3, Eye, FileText } from "lucide-react";
import { Dialog } from "../components/ui/dialog";

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [viewing, setViewing] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await api(`/knowledge-articles?${params}`);
      setArticles(res.data || res);
    } catch { /* mock */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Knowledge Base</h1>
        <button onClick={() => { setEditing(null); setShowEditor(true); }} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 transition-colors">
          <Plus size={16} /> New Article
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles..." className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-9 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {articles.filter(a => !search || a.title?.toLowerCase().includes(search.toLowerCase()) || a.tags?.some((t: string) => t.toLowerCase().includes(search.toLowerCase()))).map(article => (
          <div key={article.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-[var(--primary)]" />
                <h3 className="text-sm font-semibold text-[var(--foreground)] line-clamp-1">{article.title}</h3>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setViewing(article)} className="rounded p-1 hover:bg-[var(--accent)] text-[var(--muted-foreground)]" title="View">
                  <Eye size={14} />
                </button>
                <button onClick={() => { setEditing(article); setShowEditor(true); }} className="rounded p-1 hover:bg-[var(--accent)] text-[var(--muted-foreground)]" title="Edit">
                  <Edit3 size={14} />
                </button>
              </div>
            </div>
            {article.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {article.tags.map((tag: string) => (
                  <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">{tag}</span>
                ))}
              </div>
            )}
            <p className="text-xs text-[var(--muted-foreground)] line-clamp-2 mb-2">{article.body?.slice(0, 120)}...</p>
            <div className="flex items-center justify-between text-[10px] text-[var(--muted-foreground)]">
              <span>{article.author?.name || "Unknown"}</span>
              <span>{new Date(article.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      {viewing && <ArticleViewModal article={viewing} onClose={() => setViewing(null)} />}
      {showEditor && <ArticleEditorModal article={editing} onClose={() => setShowEditor(false)} onSaved={() => { setShowEditor(false); load(); }} />}
    </div>
  );
}

function ArticleViewModal({ article, onClose }: { article: any; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} title={article.title} maxWidth="max-w-2xl">
      {article.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3 -mt-2">
          {article.tags.map((tag: string) => (
            <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">{tag}</span>
          ))}
        </div>
      )}
      <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: article.body }} />
      <div className="mt-4 text-xs text-[var(--muted-foreground)]">
        By {article.author?.name || "Unknown"} &middot; {new Date(article.createdAt).toLocaleString()}
      </div>
    </Dialog>
  );
}

function ArticleEditorModal({ article, onClose, onSaved }: { article: any | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: article?.title || "", slug: article?.slug || "", body: article?.body || "", published: article?.published ?? false });
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(article?.tags || []);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) { toast.error("Title and body required"); return; }
    setSaving(true);
    try {
      const payload = { ...form, slug: form.slug || form.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""), tags };
      if (article) {
        await api(`/knowledge-articles/${article.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Article updated");
      } else {
        await api("/knowledge-articles", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Article created");
      }
      onSaved();
    } catch (err: any) { toast.error(err.message || "Failed to save"); }
    setSaving(false);
  };

  return (
    <Dialog open onClose={onClose} title={article ? "Edit Article" : "New Article"} maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title" required className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
          <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="Slug (auto-generated)" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
          <div className="flex items-center gap-2">
            <input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Add tag..." onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (tagInput.trim() && !tags.includes(tagInput.trim())) { setTags([...tags, tagInput.trim()]); setTagInput(""); } } }} className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
            <button type="button" onClick={() => { if (tagInput.trim() && !tags.includes(tagInput.trim())) { setTags([...tags, tagInput.trim()]); setTagInput(""); } }} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent)]">Add</button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag, i) => (
                <span key={tag} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-[var(--muted)] text-[var(--foreground)]">
                  {tag}
                  <button type="button" onClick={() => setTags(tags.filter((_, j) => j !== i))} className="hover:text-red-500">&times;</button>
                </span>
              ))}
            </div>
          )}
          <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Article body (HTML supported)" rows={10} required className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 font-mono" />
          <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
            <input type="checkbox" checked={form.published} onChange={e => setForm(f => ({ ...f, published: e.target.checked }))} className="rounded border-[var(--border)]" /> Published
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors">{saving ? "Saving..." : article ? "Update" : "Create"}</button>
          </div>
        </form>
    </Dialog>
  );
}
