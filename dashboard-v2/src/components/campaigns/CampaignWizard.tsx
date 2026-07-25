import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Info,
  Target,
  Image,
  Calendar,
  Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createCampaign } from '../../lib/data';

const STEPS = [
  { label: 'Basic Info', icon: Info },
  { label: 'Channels & Budget', icon: Target },
  { label: 'Targeting', icon: Target },
  { label: 'Creatives', icon: Image },
  { label: 'Schedule & UTM', icon: Calendar },
  { label: 'Review', icon: Eye },
];

const CAMPAIGN_TYPES = [
  { value: 'multi-channel', label: 'Multi-Channel' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google', label: 'Google' },
  { value: 'social', label: 'Social Media' },
];

const CHANNEL_OPTIONS = ['Facebook', 'Google', 'Email', 'SMS', 'WhatsApp', 'Direct Mail'];

const PROPERTY_TYPES = ['Apartment', 'Villa', 'Plot', 'Commercial', 'Penthouse', 'Studio'];

const BUYER_TYPES = ['Buyer', 'Seller', 'Renter', 'All'];

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED'];

interface CampaignWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface FormState {
  name: string;
  description: string;
  campaignType: string;
  priority: string;
  channels: string[];
  totalBudget: string;
  dailyBudget: string;
  currency: string;
  propertyTypes: string[];
  budgetMin: string;
  budgetMax: string;
  locations: string[];
  locationInput: string;
  buyerType: string;
  creatives: { name: string; headline: string; body: string; cta: string; imageUrl: string }[];
  startDate: string;
  endDate: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
}

const INITIAL_FORM: FormState = {
  name: '',
  description: '',
  campaignType: 'multi-channel',
  priority: '3',
  channels: [],
  totalBudget: '',
  dailyBudget: '',
  currency: 'INR',
  propertyTypes: [],
  budgetMin: '',
  budgetMax: '',
  locations: [],
  locationInput: '',
  buyerType: 'All',
  creatives: [{ name: '', headline: '', body: '', cta: '', imageUrl: '' }],
  startDate: '',
  endDate: '',
  utmSource: '',
  utmMedium: '',
  utmCampaign: '',
  utmTerm: '',
  utmContent: '',
};

export default function CampaignWizard({ open, onClose, onComplete }: CampaignWizardProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const update = (field: keyof FormState, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  const addLocation = () => {
    const loc = form.locationInput.trim();
    if (loc && !form.locations.includes(loc)) {
      update('locations', [...form.locations, loc]);
      update('locationInput', '');
    }
  };

  const removeLocation = (loc: string) => {
    update('locations', form.locations.filter((l) => l !== loc));
  };

  const toggleChannel = (ch: string) => {
    const chLower = ch.toLowerCase().replace(/\s+/g, '-');
    if (form.channels.includes(chLower)) {
      update('channels', form.channels.filter((c) => c !== chLower));
    } else {
      update('channels', [...form.channels, chLower]);
    }
  };

  const togglePropertyType = (pt: string) => {
    if (form.propertyTypes.includes(pt)) {
      update('propertyTypes', form.propertyTypes.filter((p) => p !== pt));
    } else {
      update('propertyTypes', [...form.propertyTypes, pt]);
    }
  };

  const updateCreative = (index: number, field: string, value: string) => {
    const newCreatives = [...form.creatives];
    (newCreatives[index] as any)[field] = value;
    update('creatives', newCreatives);
  };

  const addCreative = () => {
    update('creatives', [...form.creatives, { name: '', headline: '', body: '', cta: '', imageUrl: '' }]);
  };

  const removeCreative = (index: number) => {
    if (form.creatives.length > 1) {
      update('creatives', form.creatives.filter((_, i) => i !== index));
    }
  };

  const canNext = (): boolean => {
    switch (step) {
      case 0: return form.name.trim().length > 0;
      case 1: return form.channels.length > 0;
      case 2: return true;
      case 3: return true;
      case 4: return true;
      default: return true;
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        campaignType: form.campaignType,
        status: 'draft',
        priority: Number(form.priority),
        channels: form.channels,
        totalBudget: form.totalBudget ? Number(form.totalBudget) : undefined,
        dailyBudget: form.dailyBudget ? Number(form.dailyBudget) : undefined,
        currency: form.currency,
        propertyTypes: form.propertyTypes,
        budgetMin: form.budgetMin ? Number(form.budgetMin) : undefined,
        budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
        locations: form.locations,
        buyerType: form.buyerType,
        creatives: form.creatives.filter((c) => c.name || c.headline),
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        utmSource: form.utmSource || undefined,
        utmMedium: form.utmMedium || undefined,
        utmCampaign: form.utmCampaign || undefined,
        utmTerm: form.utmTerm || undefined,
        utmContent: form.utmContent || undefined,
      };
      await createCampaign(payload);
      toast.success('Campaign created successfully');
      setForm(INITIAL_FORM);
      setStep(0);
      onComplete();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--foreground)]">Campaign Name *</label>
              <input
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Enter campaign name"
                className="mt-1.5 w-full h-10 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--foreground)]">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Describe the campaign objective"
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3.5 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[var(--foreground)]">Campaign Type</label>
                <select
                  value={form.campaignType}
                  onChange={(e) => update('campaignType', e.target.value)}
                  className="mt-1.5 w-full h-10 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                >
                  {CAMPAIGN_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--foreground)]">Priority (1-5)</label>
                <select
                  value={form.priority}
                  onChange={(e) => update('priority', e.target.value)}
                  className="mt-1.5 w-full h-10 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={String(n)}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--foreground)]">Channels *</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {CHANNEL_OPTIONS.map((ch) => {
                  const active = form.channels.includes(ch.toLowerCase().replace(/\s+/g, '-'));
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleChannel(ch)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                        active
                          ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                          : 'border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/30'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          active ? 'bg-[var(--primary)] border-[var(--primary)]' : 'border-[var(--border)]'
                        }`}
                      >
                        {active && <Check size={10} className="text-white" />}
                      </div>
                      {ch}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[var(--foreground)]">Total Budget</label>
                <input
                  type="number"
                  value={form.totalBudget}
                  onChange={(e) => update('totalBudget', e.target.value)}
                  placeholder="e.g. 50000"
                  className="mt-1.5 w-full h-10 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--foreground)]">Daily Budget</label>
                <input
                  type="number"
                  value={form.dailyBudget}
                  onChange={(e) => update('dailyBudget', e.target.value)}
                  placeholder="e.g. 2000"
                  className="mt-1.5 w-full h-10 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--foreground)]">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => update('currency', e.target.value)}
                className="mt-1.5 w-full h-10 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--foreground)]">Property Types</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PROPERTY_TYPES.map((pt) => {
                  const active = form.propertyTypes.includes(pt);
                  return (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => togglePropertyType(pt)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        active
                          ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                          : 'border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/30'
                      }`}
                    >
                      {pt}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[var(--foreground)]">Min Budget</label>
                <input
                  type="number"
                  value={form.budgetMin}
                  onChange={(e) => update('budgetMin', e.target.value)}
                  placeholder="Min budget"
                  className="mt-1.5 w-full h-10 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--foreground)]">Max Budget</label>
                <input
                  type="number"
                  value={form.budgetMax}
                  onChange={(e) => update('budgetMax', e.target.value)}
                  placeholder="Max budget"
                  className="mt-1.5 w-full h-10 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--foreground)]">Locations</label>
              <div className="mt-1.5 flex gap-2">
                <input
                  value={form.locationInput}
                  onChange={(e) => update('locationInput', e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLocation(); } }}
                  placeholder="Type a location and press Enter"
                  className="flex-1 h-10 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                />
                <button
                  type="button"
                  onClick={addLocation}
                  className="h-10 px-3 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90"
                >
                  Add
                </button>
              </div>
              {form.locations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.locations.map((loc) => (
                    <span
                      key={loc}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)] text-[var(--foreground)]"
                    >
                      {loc}
                      <button onClick={() => removeLocation(loc)} className="hover:text-red-500">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--foreground)]">Buyer Type</label>
              <select
                value={form.buyerType}
                onChange={(e) => update('buyerType', e.target.value)}
                className="mt-1.5 w-full h-10 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
              >
                {BUYER_TYPES.map((bt) => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </select>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--foreground)]">Ad Creatives</label>
              <button
                type="button"
                onClick={addCreative}
                className="text-xs font-medium text-[var(--primary)] hover:underline"
              >
                + Add Another
              </button>
            </div>

            {form.creatives.map((creative, i) => (
              <div key={i} className="rounded-lg border border-[var(--border)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--muted-foreground)]">Creative #{i + 1}</span>
                  {form.creatives.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCreative(i)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-[var(--muted-foreground)]">Creative Name</label>
                    <input
                      value={creative.name}
                      onChange={(e) => updateCreative(i, 'name', e.target.value)}
                      placeholder="Creative name"
                      className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-[var(--muted-foreground)]">CTA</label>
                    <input
                      value={creative.cta}
                      onChange={(e) => updateCreative(i, 'cta', e.target.value)}
                      placeholder="e.g. Book Now"
                      className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--muted-foreground)]">Headline</label>
                  <input
                    value={creative.headline}
                    onChange={(e) => updateCreative(i, 'headline', e.target.value)}
                    placeholder="Headline text"
                    className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--muted-foreground)]">Body Text</label>
                  <textarea
                    value={creative.body}
                    onChange={(e) => updateCreative(i, 'body', e.target.value)}
                    placeholder="Ad body text"
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 resize-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--muted-foreground)]">Image URL</label>
                  <input
                    value={creative.imageUrl}
                    onChange={(e) => updateCreative(i, 'imageUrl', e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                  />
                </div>
              </div>
            ))}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[var(--foreground)]">Start Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => update('startDate', e.target.value)}
                  className="mt-1.5 w-full h-10 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--foreground)]">End Date</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => update('endDate', e.target.value)}
                  className="mt-1.5 w-full h-10 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border)]">
              <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">UTM Parameters</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-[var(--muted-foreground)]">UTM Source</label>
                  <input
                    value={form.utmSource}
                    onChange={(e) => update('utmSource', e.target.value)}
                    placeholder="e.g. facebook"
                    className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--muted-foreground)]">UTM Medium</label>
                  <input
                    value={form.utmMedium}
                    onChange={(e) => update('utmMedium', e.target.value)}
                    placeholder="e.g. cpc"
                    className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--muted-foreground)]">UTM Campaign</label>
                  <input
                    value={form.utmCampaign}
                    onChange={(e) => update('utmCampaign', e.target.value)}
                    placeholder="Campaign name"
                    className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--muted-foreground)]">UTM Term</label>
                  <input
                    value={form.utmTerm}
                    onChange={(e) => update('utmTerm', e.target.value)}
                    placeholder="e.g. retargeting"
                    className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--muted-foreground)]">UTM Content</label>
                  <input
                    value={form.utmContent}
                    onChange={(e) => update('utmContent', e.target.value)}
                    placeholder="e.g. hero-banner"
                    className="mt-1 w-full h-9 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-[var(--foreground)]">Review Campaign</h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-[0.06em] font-semibold">Name</div>
                <div className="text-sm font-medium text-[var(--foreground)] mt-1">{form.name}</div>
              </div>
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-[0.06em] font-semibold">Type</div>
                <div className="text-sm font-medium text-[var(--foreground)] mt-1">{form.campaignType}</div>
              </div>
            </div>

            {form.description && (
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-[0.06em] font-semibold">Description</div>
                <div className="text-sm text-[var(--foreground)] mt-1">{form.description}</div>
              </div>
            )}

            <div className="rounded-lg border border-[var(--border)] p-3">
              <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-[0.06em] font-semibold">Channels</div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {form.channels.map((ch) => (
                  <span key={ch} className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)] text-[var(--foreground)] capitalize">
                    {ch}
                  </span>
                ))}
              </div>
            </div>

            {(form.totalBudget || form.dailyBudget) && (
              <div className="grid grid-cols-2 gap-4">
                {form.totalBudget && (
                  <div className="rounded-lg border border-[var(--border)] p-3">
                    <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-[0.06em] font-semibold">Total Budget</div>
                    <div className="text-sm font-medium text-[var(--foreground)] mt-1">
                      {form.currency} {Number(form.totalBudget).toLocaleString()}
                    </div>
                  </div>
                )}
                {form.dailyBudget && (
                  <div className="rounded-lg border border-[var(--border)] p-3">
                    <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-[0.06em] font-semibold">Daily Budget</div>
                    <div className="text-sm font-medium text-[var(--foreground)] mt-1">
                      {form.currency} {Number(form.dailyBudget).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {form.propertyTypes.length > 0 && (
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-[0.06em] font-semibold">Property Types</div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {form.propertyTypes.map((pt) => (
                    <span key={pt} className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)] text-[var(--foreground)]">{pt}</span>
                  ))}
                </div>
              </div>
            )}

            {form.locations.length > 0 && (
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-[0.06em] font-semibold">Locations</div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {form.locations.map((loc) => (
                    <span key={loc} className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)] text-[var(--foreground)]">{loc}</span>
                  ))}
                </div>
              </div>
            )}

            {(form.startDate || form.endDate) && (
              <div className="grid grid-cols-2 gap-4">
                {form.startDate && (
                  <div className="rounded-lg border border-[var(--border)] p-3">
                    <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-[0.06em] font-semibold">Start Date</div>
                    <div className="text-sm font-medium text-[var(--foreground)] mt-1">{form.startDate}</div>
                  </div>
                )}
                {form.endDate && (
                  <div className="rounded-lg border border-[var(--border)] p-3">
                    <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-[0.06em] font-semibold">End Date</div>
                    <div className="text-sm font-medium text-[var(--foreground)] mt-1">{form.endDate}</div>
                  </div>
                )}
              </div>
            )}

            {form.creatives.some((c) => c.name) && (
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-[0.06em] font-semibold">Creatives</div>
                <div className="mt-1 space-y-1">
                  {form.creatives.filter((c) => c.name).map((c, i) => (
                    <div key={i} className="text-xs text-[var(--foreground)]">• {c.name}{c.headline ? `: ${c.headline}` : ''}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
        className="w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-lg)] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--border)] shrink-0">
          <div>
            <h2 id="wizard-title" className="text-lg font-bold text-[var(--foreground)]">New Campaign</h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
              Step {step + 1} of {STEPS.length} — {STEPS[step].label}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-1 px-6 py-3 bg-[var(--background)]/50 border-b border-[var(--border)] shrink-0 overflow-x-auto">
          {STEPS.map((s, i) => {
            const isActive = i === step;
            const isDone = i < step;
            const Icon = s.icon;
            return (
              <button
                key={i}
                onClick={() => { if (i < step || canNext()) setStep(i); }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                    : isDone
                    ? 'text-[var(--muted-foreground)]'
                    : 'text-[var(--muted-foreground)]/50'
                }`}
              >
                {isDone ? (
                  <Check size={12} className="text-emerald-500" />
                ) : (
                  <Icon size={12} />
                )}
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] shrink-0">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={15} /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => { if (canNext()) setStep(step + 1); }}
              disabled={!canNext()}
              className="inline-flex items-center gap-1.5 h-9 px-5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              Next <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 h-9 px-5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {submitting ? 'Creating...' : 'Create Campaign'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
