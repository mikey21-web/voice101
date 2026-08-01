import React, { useState, useEffect, useRef } from 'react';
import { fetchVoiceKbDocuments, uploadVoiceKbDocument, deleteVoiceKbDocument, VoiceKbDocument } from '../lib/data';
import { BookOpen, Upload, Trash2, RefreshCw, FileText, CheckCircle, Clock, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

function statusBadge(status: string) {
  if (status === 'completed') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"><CheckCircle size={10} /> Ready</span>;
  if (status === 'pending' || status === 'processing') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"><Clock size={10} /> Processing</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"><XCircle size={10} /> Failed</span>;
}

export default function VoiceKnowledgeBasePage() {
  const [docs, setDocs] = useState<VoiceKbDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    fetchVoiceKbDocuments().then((r) => setDocs(r.documents || [])).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadVoiceKbDocument(file);
      toast.success(`${file.name} uploaded — the agent can now use it`);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (uuid: string) => {
    setDeletingId(uuid);
    try {
      await deleteVoiceKbDocument(uuid);
      toast.success('Document removed');
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return (
    <div className="space-y-6 animate-fade-in">
      <div className="h-8 w-48 rounded-lg bg-[var(--card)] animate-pulse" />
      <div className="h-64 rounded-lg bg-[var(--card)] border border-[var(--border)] animate-pulse" />
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Knowledge Base</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-2">Upload documents — price sheets, brochures, FAQs. The agent can reference these during calls.</p>
      </div>

      <div className="rounded-lg border border-[var(--border)] p-6">
        <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" accept=".pdf,.txt,.docx,.doc,.md,.csv" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full h-24 rounded-lg border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-2 text-sm text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors disabled:opacity-50"
        >
          {uploading ? <RefreshCw size={20} className="animate-spin" /> : <Upload size={20} />}
          {uploading ? 'Uploading...' : 'Click to upload a document'}
        </button>
      </div>

      <section className="border-t border-[var(--border)] pt-6">
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">Documents</h2>
        {docs.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)]">No documents uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.document_uuid} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} className="text-[var(--muted-foreground)] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{d.filename}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{d.total_chunks} chunk{d.total_chunks === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge(d.processing_status)}
                  <button
                    onClick={() => handleDelete(d.document_uuid)}
                    disabled={deletingId === d.document_uuid}
                    className="h-7 w-7 rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:text-rose-600 hover:border-rose-300 transition-colors flex items-center justify-center"
                  >
                    {deletingId === d.document_uuid ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
