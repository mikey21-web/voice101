import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { Sparkles, Send, Check, Edit3, X, Clock, Target, MessageSquare, DollarSign, TrendingUp, Users, BarChart3, ChevronDown, ChevronUp, Play, Save, Image, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface AICampaignDraft {
  id: string;
  name: string;
  description: string;
  campaignType: string;
  targeting: any;
  channels: any[];
  message?: string;
  schedule?: { start: string; end: string };
  totalBudget: number;
  offer?: string;
  landingUrl?: string;
  conversionGoal?: string;
  predictedROI?: string;
  imagePrompt?: string;
  imageUrl?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  creatives?: any[];
}

export default function AICampaignManager() {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [drafts, setDrafts] = useState<AICampaignDraft[]>([]);
  const [savedDrafts, setSavedDrafts] = useState<AICampaignDraft[]>([]);
  const [currentDraft, setCurrentDraft] = useState<AICampaignDraft | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editableMessage, setEditableMessage] = useState('');
  const [editableName, setEditableName] = useState('');
  const [editableOffer, setEditableOffer] = useState('');
  const [editableBudget, setEditableBudget] = useState(0);
  const [editableLandingUrl, setEditableLandingUrl] = useState('');
  const [editableConversionGoal, setEditableConversionGoal] = useState('');
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'generate' | 'drafts'>('generate');
  const [imageResult, setImageResult] = useState<{ image?: string; prompt?: string; message?: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const refresh = async () => {
    try {
      const res = await api('/ai/campaigns');
      const list = Array.isArray(res) ? res : [];
      if (currentDraft) {
        const updated = list.find((d: any) => d.id === currentDraft.id);
        if (updated) setCurrentDraft(updated);
      }
      setSavedDrafts(list);
    } catch { }
  };

  useEffect(() => { refresh(); }, []);

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setImageResult(null);
    try {
      const draft = await api('/ai/campaigns/generate', { method: 'POST', body: JSON.stringify({ prompt: prompt.trim() }) }) as AICampaignDraft;
      setCurrentDraft(draft);
      setEditableMessage(draft.message || '');
      setEditableName(draft.name || '');
      setEditableOffer(draft.offer || '');
      setEditableBudget(draft.totalBudget || 0);
      setEditableLandingUrl(draft.landingUrl || '');
      setEditableConversionGoal(draft.conversionGoal || '');
      setShowEditor(true);
      setPrompt('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate campaign');
    }
    setGenerating(false);
  };

  const generateImage = async () => {
    if (!currentDraft?.imagePrompt) return;
    setGeneratingImage(true);
    setImageResult(null);
    try {
      const result = await api('/ai/campaigns/generate-image', { method: 'POST', body: JSON.stringify({ prompt: currentDraft.imagePrompt }) });
      setImageResult(result);
      if (result.image) {
        toast.success('Image generated!');
      } else {
        toast(result.message || 'Could not generate image');
      }
    } catch (e: any) {
      toast.error(e.message || 'Image generation failed');
    }
    setGeneratingImage(false);
  };

  const saveDraft = async () => {
    if (!currentDraft) return;
    setSaving(true);
    try {
      const payload = {
        ...currentDraft,
        name: editableName,
        message: editableMessage,
        offer: editableOffer,
        totalBudget: editableBudget,
        landingUrl: editableLandingUrl,
        conversionGoal: editableConversionGoal,
        creatives: imageResult?.image ? [{ type: 'image', imageUrl: imageResult.image }] : (currentDraft.creatives || []),
        tags: ['ai-generated'],
      };
      if (currentDraft.id?.startsWith('camp_')) {
        const saved = await api('/ai/campaigns', { method: 'POST', body: JSON.stringify(payload) });
        setCurrentDraft(saved);
        toast.success('Draft saved!');
      } else {
        const saved = await api(`/ai/campaigns/${currentDraft.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setCurrentDraft(saved);
        toast.success('Draft updated!');
      }
      refresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    }
    setSaving(false);
  };

  const launchCampaign = async () => {
    if (!currentDraft) return;
    setLaunching(true);
    try {
      if (!currentDraft.id?.startsWith('camp_')) {
        await saveDraft();
      }
      const draftId = currentDraft.id?.startsWith('camp_') ? null : currentDraft.id;
      if (!draftId) {
        await saveDraft();
        await launchCampaign();
        return;
      }
      await api(`/ai/campaigns/${draftId}/launch`, { method: 'POST' });
      toast.success('Campaign launched!');
      setShowEditor(false);
      setCurrentDraft(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to launch');
    }
    setLaunching(false);
  };

  const editDraft = (draft: AICampaignDraft) => {
    setCurrentDraft(draft);
    setEditableMessage(draft.description || '');
    setEditableName(draft.name || '');
    setEditableOffer(draft.offer || '');
    setEditableBudget(draft.totalBudget || 0);
    setEditableLandingUrl(draft.landingUrl || '');
    setEditableConversionGoal(draft.conversionGoal || '');
    setImageResult(null);
    setShowEditor(true);
    setActiveTab('generate');
  };

  const regenerate = () => {
    if (currentDraft) {
      setPrompt(currentDraft.description || currentDraft.name || '');
      setShowEditor(false);
      setCurrentDraft(null);
      setImageResult(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const campaignTypes: Record<string, string> = {
    whatsapp_broadcast: 'WhatsApp Broadcast',
    festive_offer: 'Festive Offer',
    new_launch: 'New Launch',
    site_visit_invite: 'Site Visit Invite',
    referral: 'Referral Program',
    re_engagement: 'Re-engagement',
    payment_reminder: 'Payment Reminder',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-1.5 mb-0.5">
          <Sparkles size={13} className="text-amber-500" />
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">AI Powered</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">AI Campaign Manager</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Generate real estate marketing campaigns with AI images</p>
          </div>
          <div className="flex items-center gap-2">
            {savedDrafts.length > 0 && (
              <button onClick={() => { setActiveTab(activeTab === 'drafts' ? 'generate' : 'drafts'); setShowEditor(false); }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'drafts' ? 'bg-[var(--primary)] text-white' : 'border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>
                <BarChart3 size={14} />
                Saved ({savedDrafts.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'generate' && (
        <>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)]">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generate(); } }}
                  placeholder="Describe your campaign... e.g. 'Diwali offer for hot leads in Bangalore with 25% discount on 2BHK apartments'"
                  className="w-full min-h-[60px] max-h-[120px] rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 resize-none"
                  rows={2}
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    'New launch 2BHK in Whitefield WhatsApp broadcast',
                    'Diwali festive offer for hot leads Bangalore',
                    'Re-engage cold leads who haven\'t replied in 30 days',
                    'Site visit invite for qualified leads this weekend',
                  ].map(ep => (
                    <button key={ep} onClick={() => setPrompt(ep)}
                      className="px-2 py-1 rounded-md bg-[var(--muted)] border border-[var(--border)] text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--primary)]/30 transition-colors">
                      {ep.length > 40 ? ep.slice(0, 40) + '...' : ep}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={generate} disabled={generating || !prompt.trim()}
                className="self-start h-9 px-5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2 shrink-0">
                {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>

          {showEditor && currentDraft && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-[var(--shadow-sm)] animate-scale-in">
              <div className="border-b border-[var(--border)] px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-amber-500" />
                  <span className="text-sm font-semibold text-[var(--foreground)]">Campaign</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {campaignTypes[currentDraft.campaignType] || currentDraft.campaignType || 'Draft'}
                  </span>
                </div>
                <button onClick={() => { setShowEditor(false); setCurrentDraft(null); setImageResult(null); }}
                  className="p-1 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors">
                  <X size={15} />
                </button>
              </div>

              <div className="p-5 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1 block">Campaign Name</label>
                    <input value={editableName} onChange={e => setEditableName(e.target.value)}
                      className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20" />
                  </div>
                  <div className="text-right shrink-0">
                    <label className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1 block">Predicted ROI</label>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{currentDraft.predictedROI || '—'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-[var(--muted)] border border-[var(--border)] p-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)] mb-1"><Target size={12} /> Target</div>
                    <div className="text-sm font-semibold text-[var(--foreground)]">
                      {currentDraft.targeting?.segments?.join(', ') || 'All'}
                    </div>
                    <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                      {currentDraft.targeting?.locations?.slice(0, 2).join(', ') || ''}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[var(--muted)] border border-[var(--border)] p-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)] mb-1"><MessageSquare size={12} /> Channels</div>
                    <div className="text-sm font-semibold text-[var(--foreground)]">
                      {currentDraft.channels?.map((c: any) => c.type).join(' + ') || 'WHATSAPP'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[var(--muted)] border border-[var(--border)] p-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)] mb-1"><DollarSign size={12} /> Budget</div>
                    <input value={editableBudget} onChange={e => setEditableBudget(Number(e.target.value))}
                      className="w-full text-sm font-semibold text-[var(--foreground)] bg-transparent border-b border-[var(--border)] focus:outline-none"
                      type="number" min={0} step={100} />
                  </div>
                  <div className="rounded-lg bg-[var(--muted)] border border-[var(--border)] p-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)] mb-1"><Clock size={12} /> Goal</div>
                    <select value={editableConversionGoal} onChange={e => setEditableConversionGoal(e.target.value)}
                      className="w-full text-sm font-semibold text-[var(--foreground)] bg-transparent border-b border-[var(--border)] focus:outline-none">
                      <option value="">Select goal</option>
                      <option value="site_visit">Site Visit</option>
                      <option value="booking">Booking</option>
                      <option value="brochure_download">Brochure Download</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1 block">Offer</label>
                    <input value={editableOffer} onChange={e => setEditableOffer(e.target.value)}
                      className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1 block">Landing URL</label>
                    <input value={editableLandingUrl} onChange={e => setEditableLandingUrl(e.target.value)}
                      className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Message</label>
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]"><Edit3 size={10} /> Editable</div>
                  </div>
                  <textarea value={editableMessage} onChange={e => setEditableMessage(e.target.value)}
                    className="w-full min-h-[120px] rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 resize-y"
                    rows={5} />
                </div>

                {currentDraft.imagePrompt && (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider flex items-center gap-1">
                        <Image size={12} /> Campaign Image
                      </label>
                      <button onClick={generateImage} disabled={generatingImage}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--primary)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-all">
                        {generatingImage ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        {generatingImage ? 'Generating...' : 'Generate Image'}
                      </button>
                    </div>
                    {imageResult?.image ? (
                      <div className="rounded-lg overflow-hidden border border-[var(--border)]">
                        <img src={imageResult.image} alt="Campaign creative" className="w-full max-h-64 object-cover" />
                      </div>
                    ) : imageResult?.prompt ? (
                      <div className="text-xs text-[var(--muted-foreground)]">
                        <p className="font-medium mb-1">Image prompt:</p>
                        <p className="italic">{imageResult.prompt}</p>
                        {!imageResult.image && imageResult.message && (
                          <p className="mt-2 text-amber-600">{imageResult.message}</p>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--muted-foreground)] italic">
                        Click "Generate Image" to create an AI-powered campaign creative
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                  <button onClick={regenerate}
                    className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1.5">
                    <RefreshCw size={14} /> New Prompt
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={saveDraft} disabled={saving}
                      className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1.5 disabled:opacity-40">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {saving ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button onClick={launchCampaign} disabled={launching}
                      className="h-9 px-5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-40">
                      {launching ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                      {launching ? 'Launching...' : 'Launch Campaign'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'drafts' && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted-foreground)]">Your saved AI campaigns. Click to edit or launch.</p>
          {savedDrafts.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
              <Save size={32} className="text-[var(--muted-foreground)] mx-auto mb-3 opacity-30" />
              <p className="text-[var(--muted-foreground)]">No saved drafts yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedDrafts.map(draft => (
                <div key={draft.id} onClick={() => editDraft(draft)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">{draft.name}</h3>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                      draft.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      draft.status === 'draft' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-gray-100 text-gray-600'
                    }`}>{draft.status}</span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] line-clamp-2 mb-3">{draft.description?.slice(0, 120)}</p>
                  <div className="flex items-center gap-3 text-[10px] text-[var(--muted-foreground)]">
                    <span className="flex items-center gap-1"><Target size={11} /> {draft.targeting?.segments?.join(', ') || 'All'}</span>
                    <span className="flex items-center gap-1"><MessageSquare size={11} /> {draft.channels?.map((c: any) => c.type).join('/') || '—'}</span>
                    <span className="flex items-center gap-1"><DollarSign size={11} /> ₹{draft.totalBudget?.toLocaleString() || '0'}</span>
                  </div>
                  {draft.creatives?.[0]?.imageUrl && (
                    <div className="mt-2 rounded-md overflow-hidden h-20">
                      <img src={draft.creatives[0].imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
