import React, { useState, useEffect, useRef } from 'react';
import { apiUpload } from '../lib/api';
import {
  fetchMedia, deleteMedia, updateMedia, getMediaDownloadUrl,
  fetchMediaCollections, createMediaCollection, getMediaCollection, updateMediaCollection, deleteMediaCollection,
  addMediaToCollection, removeMediaFromCollection,
} from '../lib/data';
import {
  Upload, Trash2, Download, Image, FileText, Video, Music, Search, FolderPlus, Folder, Plus, X, Tag, ExternalLink, LayoutGrid, ChevronLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';
import { Dialog } from '../components/ui/dialog';

const typeIcons: Record<string, any> = { image: Image, video: Video, audio: Music, document: FileText };

export default function MediaPage() {
  const [data, setData] = useState<any>({ data: [], meta: {} });
  const [collections, setCollections] = useState<any[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [collectionDetail, setCollectionDetail] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<any>(null);
  const [showCollectionPicker, setShowCollectionPicker] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadMeta, setUploadMeta] = useState({ category: 'OTHER', tags: '', projectId: '', propertyId: '' });
  const [newCollection, setNewCollection] = useState({ name: '', description: '', projectId: '' });
  const [editMeta, setEditMeta] = useState({ tags: '', projectId: '', propertyId: '' });

  const refresh = () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (filterType) params.fileType = filterType;
    fetchMedia(params).then(setData).catch(() => {});
  };
  const refreshCollections = () => fetchMediaCollections().then(setCollections).catch(() => {});

  useEffect(() => { refresh(); refreshCollections(); }, []);
  useEffect(() => { refresh(); }, [search, filterType]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    if (uploadMeta.category) fd.append('category', uploadMeta.category);
    if (uploadMeta.tags) fd.append('tags', JSON.stringify(uploadMeta.tags.split(',').map(t => t.trim()).filter(Boolean)));
    if (uploadMeta.projectId) fd.append('projectId', uploadMeta.projectId);
    if (uploadMeta.propertyId) fd.append('propertyId', uploadMeta.propertyId);
    try {
      await apiUpload('/media/upload', fd);
      refresh();
      toast.success('Uploaded');
      setShowUploadModal(false);
      setUploadMeta({ category: 'OTHER', tags: '', projectId: '', propertyId: '' });
    } catch (e: any) { toast.error(e.message); }
    setUploading(false);
  };

  const getUrl = async (m: any) => {
    if (m.publicUrl) return m.publicUrl;
    try {
      const r = await getMediaDownloadUrl(m.id);
      return r.data?.url || r.url || '';
    } catch { return ''; }
  };

  const items = data.data || [];

  return (
    <div className="flex gap-6 h-[calc(100vh-6rem)] animate-fade-in">
      {/* Collections Sidebar */}
      <div className="w-64 shrink-0 flex flex-col bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--foreground)]">Collections</span>
          <button onClick={() => setShowCollectionModal(true)} className="w-7 h-7 rounded-lg hover:bg-[var(--accent)] flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <button
            onClick={() => { setActiveCollection(null); setCollectionDetail(null); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${!activeCollection ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-medium' : 'text-[var(--foreground)] hover:bg-[var(--accent)]'}`}
          >
            <LayoutGrid size={14} /> All Files
          </button>
          {collections.map((c: any) => (
            <div key={c.id} className="group">
              <button
                onClick={() => { setActiveCollection(c.id); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${activeCollection === c.id ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-medium' : 'text-[var(--foreground)] hover:bg-[var(--accent)]'}`}
              >
                <Folder size={14} className="shrink-0" />
                <span className="truncate flex-1">{c.name}</span>
                <span className="text-[10px] text-[var(--muted-foreground)]">{c._count?.items || 0}</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search files..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
            />
          </div>
          <select
            value={filterType} onChange={e => setFilterType(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
          >
            <option value="">All Types</option>
            <option value="jpg">JPEG</option>
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
            <option value="pdf">PDF</option>
            <option value="doc">DOC</option>
            <option value="xls">XLS</option>
          </select>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
          >
            <Upload size={16} /> Upload
          </button>
        </div>

        {/* Media Grid */}
        <div className="flex-1 overflow-y-auto">
          {activeCollection && collectionDetail ? (
            <CollectionView
              collection={collectionDetail}
              onBack={() => { setActiveCollection(null); setCollectionDetail(null); }}
              onRefresh={() => { getMediaCollection(activeCollection).then(setCollectionDetail); refresh(); }}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {items.length === 0 && (
                <div className="col-span-full text-center py-12 text-[var(--muted-foreground)]">No files uploaded yet</div>
              )}
              {items.map((m: any) => {
                const fileType = m.fileType?.split('/')[0] || m.mimeType?.split('/')[0] || 'document';
                const Icon = typeIcons[fileType] || FileText;
                return (
                  <div key={m.id} className="group rounded-xl border border-[var(--border)] bg-[var(--card)] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
                    <div
                      className="aspect-square bg-[var(--muted)] flex items-center justify-center overflow-hidden cursor-pointer relative"
                      onClick={async () => { const u = await getUrl(m); setPreview(u); setPreviewFile(m); }}
                    >
                      {isImageType(m) ? (
                        <MediaThumbnail media={m} />
                      ) : (
                        <Icon size={40} className="text-[var(--muted-foreground)]" />
                      )}
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                        <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">Preview</span>
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="text-xs font-medium text-[var(--foreground)] truncate mb-1" title={m.originalName}>
                        {m.originalName}
                      </div>
                      <div className="text-[10px] text-[var(--muted-foreground)] mb-2">
                        {m.mimeType?.split('/')[1]?.toUpperCase() || m.fileType?.toUpperCase()} · {(m.fileSize / 1024).toFixed(0)} KB
                      </div>
                      {m.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {m.tags.slice(0, 3).map((t: string) => (
                            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">{t}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={async () => { const u = await getUrl(m); setPreview(u); setPreviewFile(m); }} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-medium hover:bg-[var(--primary)]/20 transition-colors">
                          <ExternalLink size={12} /> View
                        </button>
                        <button onClick={() => setShowCollectionPicker(m.id)} className="p-1.5 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors" title="Add to collection">
                          <FolderPlus size={14} />
                        </button>
                        <button onClick={() => { setShowEditModal(m); setEditMeta({ tags: (m.tags || []).join(', '), projectId: m.projectId || '', propertyId: m.propertyId || '' }); }} className="p-1.5 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors" title="Edit tags/project">
                          <Tag size={14} />
                        </button>
                        <button
                          onClick={async () => { await deleteMedia(m.id); refresh(); toast.success('Deleted'); }}
                          className="p-1.5 rounded-md hover:bg-[var(--accent)] text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {preview && previewFile && createPortal(
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => { setPreview(null); setPreviewFile(null); }}>
          <div className="relative max-w-5xl max-h-[90vh] w-full bg-[var(--card)] rounded-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-[var(--foreground)] truncate">{previewFile.originalName}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">{previewFile.fileType?.toUpperCase()}</span>
              </div>
              <button onClick={() => { setPreview(null); setPreviewFile(null); }} className="w-7 h-7 rounded-lg hover:bg-[var(--accent)] flex items-center justify-center text-[var(--muted-foreground)]">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center bg-black/40 p-4 min-h-[300px] max-h-[60vh] overflow-auto">
              {isImageType(previewFile) ? (
                <img src={preview} alt={previewFile.originalName} className="max-w-full max-h-full object-contain rounded-lg" />
              ) : (
                <div className="flex flex-col items-center gap-3 text-[var(--muted-foreground)]">
                  <FileText size={64} />
                  <span className="text-sm">Preview not available for this file type</span>
                  <a href={preview} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[var(--primary)] hover:underline">
                    <Download size={14} /> Download to view
                  </a>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-[var(--border)] grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div><span className="text-[var(--muted-foreground)]">Name:</span> <span className="text-[var(--foreground)]">{previewFile.originalName}</span></div>
              <div><span className="text-[var(--muted-foreground)]">Type:</span> <span className="text-[var(--foreground)]">{previewFile.mimeType || previewFile.fileType}</span></div>
              <div><span className="text-[var(--muted-foreground)]">Size:</span> <span className="text-[var(--foreground)]">{(previewFile.fileSize / 1024).toFixed(0)} KB</span></div>
              <div><span className="text-[var(--muted-foreground)]">Uploaded:</span> <span className="text-[var(--foreground)]">{new Date(previewFile.createdAt).toLocaleDateString()}</span></div>
              {previewFile.tags?.length > 0 && (
                <div className="col-span-2"><span className="text-[var(--muted-foreground)]">Tags:</span> <span className="text-[var(--foreground)]">{previewFile.tags.join(', ')}</span></div>
              )}
              {previewFile.projectId && (
                <div className="col-span-2"><span className="text-[var(--muted-foreground)]">Project:</span> <span className="text-[var(--foreground)]">{previewFile.projectId}</span></div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-[var(--border)] flex gap-2">
              <button onClick={async () => { const r = await getMediaDownloadUrl(previewFile.id); window.open(r.data?.url || r.url, '_blank'); }} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
                <Download size={14} /> Download
              </button>
              <button onClick={() => setShowCollectionPicker(previewFile.id)} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">
                <FolderPlus size={14} />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <Dialog open onClose={() => setShowUploadModal(false)} title="Upload File" maxWidth="max-w-md">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[var(--foreground)] mb-1 block">Category</label>
              <select value={uploadMeta.category} onChange={e => setUploadMeta(p => ({ ...p, category: e.target.value }))} className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)]">
                <option value="OTHER">Other</option>
                <option value="BROCHURE">Brochure</option>
                <option value="CATALOG">Catalog</option>
                <option value="PROPOSAL">Proposal</option>
                <option value="CAMPAIGN_ASSET">Campaign Asset</option>
                <option value="LEAD_ATTACHMENT">Lead Attachment</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--foreground)] mb-1 block">Tags (comma separated)</label>
              <input value={uploadMeta.tags} onChange={e => setUploadMeta(p => ({ ...p, tags: e.target.value }))} placeholder="e.g. project-alpha, villa, interior" className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]" />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--foreground)] mb-1 block">Project ID (optional)</label>
              <input value={uploadMeta.projectId} onChange={e => setUploadMeta(p => ({ ...p, projectId: e.target.value }))} placeholder="Link to a project" className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex-1 h-10 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
              {uploading ? 'Uploading...' : 'Select & Upload'}
            </button>
          </div>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
        </Dialog>
      )}

      {/* Collection Picker */}
      {showCollectionPicker && (
        <Dialog open onClose={() => setShowCollectionPicker(null)} title="Add to Collection" maxWidth="max-w-xs">
          {collections.length === 0 && <p className="text-xs text-[var(--muted-foreground)]">No collections yet. Create one first.</p>}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {collections.map(c => (
              <button
                key={c.id}
                onClick={async () => { await addMediaToCollection(c.id, showCollectionPicker!); toast.success(`Added to ${c.name}`); setShowCollectionPicker(null); refresh(); }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors flex items-center gap-2"
              >
                <Folder size={14} className="text-[var(--muted-foreground)]" />
                {c.name}
              </button>
            ))}
            <button onClick={() => { setShowCollectionPicker(null); setShowCollectionModal(true); }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors flex items-center gap-2">
              <Plus size={14} /> New Collection
            </button>
          </div>
        </Dialog>
      )}

      {/* Create Collection Modal */}
      {showCollectionModal && (
        <Dialog
          open
          onClose={() => setShowCollectionModal(false)}
          title="New Collection"
          maxWidth="max-w-sm"
          footer={
            <>
              <button onClick={() => setShowCollectionModal(false)} className="flex-1 h-9 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">Cancel</button>
              <button
                onClick={async () => {
                  if (!newCollection.name.trim()) return toast.error('Name is required');
                  await createMediaCollection(newCollection);
                  toast.success('Collection created');
                  setShowCollectionModal(false);
                  setNewCollection({ name: '', description: '', projectId: '' });
                  refreshCollections();
                }}
                className="flex-1 h-9 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Create
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <input value={newCollection.name} onChange={e => setNewCollection(p => ({ ...p, name: e.target.value }))} placeholder="Collection name" className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]" />
            <input value={newCollection.description} onChange={e => setNewCollection(p => ({ ...p, description: e.target.value }))} placeholder="Description (optional)" className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]" />
          </div>
        </Dialog>
      )}

      {/* Edit Media Modal */}
      {showEditModal && (
        <Dialog
          open
          onClose={() => setShowEditModal(null)}
          title="Edit Media"
          description={showEditModal.originalName}
          maxWidth="max-w-sm"
          footer={
            <>
              <button onClick={() => setShowEditModal(null)} className="flex-1 h-9 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">Cancel</button>
              <button
                onClick={async () => {
                  await updateMedia(showEditModal.id, {
                    tags: editMeta.tags.split(',').map(t => t.trim()).filter(Boolean),
                    projectId: editMeta.projectId || null,
                    propertyId: editMeta.propertyId || null,
                  });
                  toast.success('Updated');
                  setShowEditModal(null);
                  refresh();
                }}
                className="flex-1 h-9 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Save
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[var(--foreground)] mb-1 block">Tags</label>
              <input value={editMeta.tags} onChange={e => setEditMeta(p => ({ ...p, tags: e.target.value }))} placeholder="comma separated" className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]" />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--foreground)] mb-1 block">Project ID</label>
              <input value={editMeta.projectId} onChange={e => setEditMeta(p => ({ ...p, projectId: e.target.value }))} placeholder="Link to project" className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]" />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function MediaThumbnail({ media }: { media: any }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let u = media.publicUrl || '';
      if (!u) {
        try {
          const r = await getMediaDownloadUrl(media.id);
          u = r.data?.url || r.url || '';
        } catch {}
      }
      if (!cancelled) { setUrl(u); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [media.id, media.publicUrl]);

  if (loading) return <div className="w-full h-full flex items-center justify-center"><div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>;
  if (!url) return <Image size={40} className="text-[var(--muted-foreground)]" />;
  return <img src={url} alt={media.originalName} className="w-full h-full object-cover" loading="lazy" />;
}

function CollectionView({ collection, onBack, onRefresh }: { collection: any; onBack: () => void; onRefresh: () => void }) {
  const items = collection.items || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-lg hover:bg-[var(--accent)] flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">{collection.name}</h2>
          {collection.description && <p className="text-xs text-[var(--muted-foreground)]">{collection.description}</p>}
        </div>
        <span className="text-xs text-[var(--muted-foreground)] ml-auto">{items.length} files</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {items.length === 0 && (
          <div className="col-span-full text-center py-12 text-[var(--muted-foreground)]">Collection is empty</div>
        )}
        {items.map((item: any) => {
          const m = item.media;
          if (!m) return null;
          const isImage = isImageType(m);
          const Icon = typeIcons[m.fileType?.split('/')[0] || 'document'] || FileText;
          return (
            <div key={item.id} className="group rounded-xl border border-[var(--border)] bg-[var(--card)] hover:shadow-lg transition-all duration-200 overflow-hidden">
              <div className="aspect-square bg-[var(--muted)] flex items-center justify-center overflow-hidden">
                {isImage ? <MediaThumbnail media={m} /> : <Icon size={40} className="text-[var(--muted-foreground)]" />}
              </div>
              <div className="p-3">
                <div className="text-xs font-medium text-[var(--foreground)] truncate">{m.originalName}</div>
                <div className="text-[10px] text-[var(--muted-foreground)] mt-1">{(m.fileSize / 1024).toFixed(0)} KB</div>
                <button
                  onClick={async () => { await removeMediaFromCollection(collection.id, m.id); toast.success('Removed'); onRefresh(); }}
                  className="mt-2 flex items-center gap-1 text-[10px] text-red-400 hover:text-red-600 transition-colors"
                >
                  <X size={10} /> Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function isImageType(m: any) {
  const ft = (m.fileType || m.mimeType || '').toLowerCase();
  return ft.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ft);
}