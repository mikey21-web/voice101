import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fetchQuotations, createQuotation, fetchContacts, fetchProperties, fetchProjects } from '../lib/data';
import { Plus, FileText, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

function money(n: number | undefined) { return `₹${(n || 0).toLocaleString('en-IN')}`; }
function sectionTotal(q: any) { return (q.sections || []).reduce((s: number, sec: any) => s + (sec.lineItems || []).reduce((ss: number, li: any) => ss + li.total, 0), 0); }

type Line = { description: string; qty: string; unitPrice: string };
type Section = { title: string; lines: Line[] };
const emptyLine = (): Line => ({ description: '', qty: '1', unitPrice: '' });
const emptySection = (): Section => ({ title: 'Items', lines: [emptyLine()] });

function lineTotal(li: Line) { return (Number(li.qty) || 0) * (Number(li.unitPrice) || 0); }

function QuotationBuilder({ contacts, properties, projects, onClose, onCreated }: {
  contacts: any[]; properties: any[]; projects: any[]; onClose: () => void; onCreated: () => void;
}) {
  const [contactId, setContactId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [termsAndPaymentSchedule, setTerms] = useState('');
  const [sections, setSections] = useState<Section[]>([emptySection()]);
  const [saving, setSaving] = useState(false);

  const contact = contacts.find(c => c.id === contactId);
  const property = properties.find(p => p.id === propertyId);
  const project = projects.find(p => p.id === projectId);
  const grandTotal = sections.reduce((s, sec) => s + sec.lines.reduce((ss, li) => ss + lineTotal(li), 0), 0);

  const updateSection = (i: number, patch: Partial<Section>) => setSections(ss => ss.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const updateLine = (si: number, li: number, patch: Partial<Line>) =>
    setSections(ss => ss.map((s, idx) => idx === si ? { ...s, lines: s.lines.map((l, lidx) => lidx === li ? { ...l, ...patch } : l) } : s));
  const addSection = () => setSections(ss => [...ss, emptySection()]);
  const removeSection = (i: number) => setSections(ss => ss.length > 1 ? ss.filter((_, idx) => idx !== i) : ss);
  const addLine = (si: number) => setSections(ss => ss.map((s, idx) => idx === si ? { ...s, lines: [...s.lines, emptyLine()] } : s));
  const removeLine = (si: number, li: number) => setSections(ss => ss.map((s, idx) => idx === si ? { ...s, lines: s.lines.length > 1 ? s.lines.filter((_, lidx) => lidx !== li) : s.lines } : s));

  const save = async () => {
    const validSections = sections.map(s => ({ ...s, lines: s.lines.filter(l => l.description.trim()) })).filter(s => s.lines.length);
    if (!validSections.length) { toast.error('Add at least one line item'); return; }
    setSaving(true);
    try {
      await createQuotation({
        contactId: contactId || undefined,
        propertyId: propertyId || undefined,
        projectId: projectId || undefined,
        validUntil: validUntil || undefined,
        termsAndPaymentSchedule: termsAndPaymentSchedule || undefined,
        sections: validSections.map(s => ({
          title: s.title,
          lineItems: s.lines.map(l => ({ description: l.description, qty: Number(l.qty) || 1, unitPrice: Number(l.unitPrice) || 0 })),
        })),
      });
      toast.success('Quotation created');
      onCreated();
      onClose();
    } catch (err: any) { toast.error(err.message || 'Could not create quotation'); }
    finally { setSaving(false); }
  };

  const field = 'h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]';
  const label = 'text-xs font-medium tracking-wide text-[var(--muted-foreground)] uppercase';

  // Portaled to document.body: the page wrapper's animate-fade-in animation
  // uses `forwards` fill-mode, which locks in a transform after it ends and
  // creates a new containing block — that clips `position: fixed` overlays
  // rendered inside it instead of covering the real viewport (same bug the
  // Drawer component works around).
  return createPortal(
    <div className="fixed inset-0 z-50 bg-[var(--background)] flex flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><X size={22} /></button>
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">New quotation</h1>
            <p className="text-sm text-[var(--muted-foreground)]">Build a client-ready quote for a unit or a project.</p>
          </div>
        </div>
        <button onClick={save} disabled={saving} className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save quotation'}
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        <div className="overflow-y-auto p-6 space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
            <div>
              <label className={label}>Customer</label>
              <select value={contactId} onChange={e => setContactId(e.target.value)} className={field}>
                <option value="">Not selected</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Property (unit)</label>
                <select value={propertyId} onChange={e => setPropertyId(e.target.value)} className={field}>
                  <option value="">Not linked</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Project</label>
                <select value={projectId} onChange={e => setProjectId(e.target.value)} className={field}>
                  <option value="">Not linked</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={label}>Valid until</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={field} />
            </div>
          </div>

          {sections.map((sec, si) => (
            <div key={si} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <input value={sec.title} onChange={e => updateSection(si, { title: e.target.value })} placeholder="Section title"
                  className={`${field} flex-1 font-medium`} />
                <button onClick={() => addLine(si)} className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline whitespace-nowrap"><Plus size={13} /> Add line</button>
                <button onClick={() => removeSection(si)} className="text-[var(--muted-foreground)] hover:text-red-500"><Trash2 size={15} /></button>
              </div>
              {sec.lines.map((li, lidx) => (
                <div key={lidx} className="grid grid-cols-12 gap-2 border-t border-[var(--border)] pt-2 first:border-t-0 first:pt-0">
                  <input placeholder="Description" value={li.description} onChange={e => updateLine(si, lidx, { description: e.target.value })}
                    className={`${field} col-span-6`} />
                  <input type="number" placeholder="Qty" value={li.qty} onChange={e => updateLine(si, lidx, { qty: e.target.value })}
                    className={`${field} col-span-2`} />
                  <input type="number" placeholder="Unit price" value={li.unitPrice} onChange={e => updateLine(si, lidx, { unitPrice: e.target.value })}
                    className={`${field} col-span-3`} />
                  <button onClick={() => removeLine(si, lidx)} className="col-span-1 h-9 flex items-center justify-center text-[var(--muted-foreground)] hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ))}
          <button onClick={addSection} className="inline-flex items-center gap-1 text-sm text-[var(--primary)] hover:underline"><Plus size={14} /> Add section</button>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <label className={label}>Terms & payment schedule</label>
            <textarea value={termsAndPaymentSchedule} onChange={e => setTerms(e.target.value)} rows={3}
              placeholder="e.g. 10% booking, 40% on agreement, 50% on possession"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-[var(--foreground)]" />
          </div>
        </div>

        <div className="overflow-y-auto border-l border-[var(--border)] bg-[var(--muted)] p-6">
          <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-[var(--card)] p-6 shadow-sm max-w-xl mx-auto">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-bold text-[var(--foreground)]">Quotation</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-1">Valid until: {validUntil || '—'}</div>
              </div>
              <div className="text-xl font-bold tracking-tight text-[var(--primary)]">QUOTE</div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
              <div>
                <div className="text-xs font-semibold text-[var(--primary)] uppercase">Prepared for</div>
                <div className="font-medium text-[var(--foreground)] mt-1">{contact?.name || 'Customer not selected'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--primary)] uppercase">Property / project</div>
                <div className="font-medium text-[var(--foreground)] mt-1">
                  {property ? property.title : project ? project.name : 'Not linked'}
                </div>
              </div>
            </div>

            {sections.map((sec, si) => (
              <div key={si} className="mt-6">
                <div className="text-xs font-semibold text-[var(--primary)] uppercase mb-2">{sec.title || 'Items'}</div>
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-[var(--muted-foreground)] uppercase border-b border-[var(--border)] pb-1">
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Rate</div>
                  <div className="col-span-2 text-right">Amount</div>
                </div>
                {sec.lines.map((li, lidx) => (
                  <div key={lidx} className="grid grid-cols-12 gap-2 text-sm py-1.5 border-b border-[var(--border)]">
                    <div className="col-span-6 text-[var(--foreground)]">{li.description || 'Item'}</div>
                    <div className="col-span-2 text-right text-[var(--foreground)]">{li.qty || 1}</div>
                    <div className="col-span-2 text-right text-[var(--foreground)]">{money(Number(li.unitPrice))}</div>
                    <div className="col-span-2 text-right text-[var(--foreground)]">{money(lineTotal(li))}</div>
                  </div>
                ))}
              </div>
            ))}

            <div className="mt-4 flex justify-between font-bold text-[var(--foreground)] text-base pt-2 border-t border-[var(--border)]">
              <span>Grand total</span><span>{money(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  const refresh = () => fetchQuotations().then(r => setQuotations(r.data)).catch(() => {});
  useEffect(() => {
    refresh();
    fetchContacts(1).then(r => setContacts(r.data || [])).catch(() => {});
    fetchProperties().then(r => setProperties(r.data || [])).catch(() => {});
    fetchProjects().then(r => setProjects(r.data || [])).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Quotations</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Build client-ready quotes from sections and line items.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90">
          <Plus size={16} /> New quotation
        </button>
      </div>

      {showCreate && (
        <QuotationBuilder contacts={contacts} properties={properties} projects={projects} onClose={() => setShowCreate(false)} onCreated={refresh} />
      )}

      {quotations.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted-foreground)]">
          <FileText size={32} className="mx-auto mb-2 opacity-50" />
          No quotations yet.
        </div>
      ) : (
        <div className="space-y-2">
          {quotations.map((q: any) => (
            <div key={q.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div>
                <div className="font-medium text-[var(--foreground)]">{q.quoteNumber} — {q.contact?.name || 'Not selected'}</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {money(sectionTotal(q))}
                  {(q.property?.title || q.project?.name) && <span> · {q.property?.title || q.project?.name}</span>}
                </div>
              </div>
              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)] text-[var(--foreground)]">{q.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
