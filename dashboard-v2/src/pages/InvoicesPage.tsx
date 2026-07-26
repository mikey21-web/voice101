import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fetchInvoices, createInvoice, updateInvoice, fetchContacts, fetchProperties, fetchProjects, getInvoicePdf, sendInvoice } from '../lib/data';
import { Plus, FileText, Download, Send, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

function money(n: number | undefined) { return `₹${(n || 0).toLocaleString('en-IN')}`; }

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  SENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PAID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

type LineItem = { description: string; unit: string; qty: string; unitPrice: string; gstPercent: string; notes: string };
const emptyLine = (): LineItem => ({ description: '', unit: '', qty: '1', unitPrice: '', gstPercent: '', notes: '' });

function lineTotal(li: LineItem) { return (Number(li.qty) || 0) * (Number(li.unitPrice) || 0); }
function lineGst(li: LineItem) { return lineTotal(li) * ((Number(li.gstPercent) || 0) / 100); }

function InvoiceBuilder({ contacts, properties, projects, onClose, onCreated }: {
  contacts: any[]; properties: any[]; projects: any[]; onClose: () => void; onCreated: () => void;
}) {
  const [contactId, setContactId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  const contact = contacts.find(c => c.id === contactId);
  const property = properties.find(p => p.id === propertyId);
  const project = projects.find(p => p.id === projectId);
  const subtotal = lines.reduce((s, li) => s + lineTotal(li), 0);
  const gstTotal = lines.reduce((s, li) => s + lineGst(li), 0);
  const grandTotal = subtotal + gstTotal;

  const updateLine = (i: number, patch: Partial<LineItem>) => setLines(ls => ls.map((li, idx) => idx === i ? { ...li, ...patch } : li));
  const addLine = () => setLines(ls => [...ls, emptyLine()]);
  const removeLine = (i: number) => setLines(ls => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls);

  const save = async () => {
    const validLines = lines.filter(li => li.description.trim());
    if (!validLines.length) { toast.error('Add at least one line item'); return; }
    setSaving(true);
    try {
      await createInvoice({
        contactId: contactId || undefined,
        propertyId: propertyId || undefined,
        projectId: projectId || undefined,
        invoiceNumber: invoiceNumber || undefined,
        dueDate: dueDate || undefined,
        notes: notes || undefined,
        status,
        lineItems: validLines.map(li => ({
          description: li.description, unit: li.unit || undefined, qty: Number(li.qty) || 1,
          unitPrice: Number(li.unitPrice) || 0, gstPercent: li.gstPercent ? Number(li.gstPercent) : undefined,
          notes: li.notes || undefined,
        })),
      });
      toast.success('Invoice created');
      onCreated();
      onClose();
    } catch (err: any) { toast.error(err.message || 'Could not create invoice'); }
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
            <h1 className="text-xl font-bold text-[var(--foreground)]">New invoice</h1>
            <p className="text-sm text-[var(--muted-foreground)]">Link it to a property or project so the buyer sees exactly what they're paying for.</p>
          </div>
        </div>
        <button onClick={save} disabled={saving} className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save invoice'}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Invoice #</label>
                <input placeholder="Auto-generated" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className={field} />
              </div>
              <div>
                <label className={label}>Due date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={field} />
              </div>
            </div>
            <div>
              <label className={label}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className={field}>
                {Object.keys(STATUS_STYLES).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className={label}>Invoice items</span>
              <button onClick={addLine} className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"><Plus size={13} /> Add line</button>
            </div>
            {lines.map((li, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start border-t border-[var(--border)] pt-3 first:border-t-0 first:pt-0">
                <input placeholder="Description" value={li.description} onChange={e => updateLine(i, { description: e.target.value })}
                  className={`${field} col-span-12 sm:col-span-4`} />
                <input placeholder="Unit (e.g. sqft)" value={li.unit} onChange={e => updateLine(i, { unit: e.target.value })}
                  className={`${field} col-span-6 sm:col-span-2`} />
                <input type="number" placeholder="Qty" value={li.qty} onChange={e => updateLine(i, { qty: e.target.value })}
                  className={`${field} col-span-6 sm:col-span-1`} />
                <input type="number" placeholder="Rate" value={li.unitPrice} onChange={e => updateLine(i, { unitPrice: e.target.value })}
                  className={`${field} col-span-6 sm:col-span-2`} />
                <input type="number" placeholder="GST %" value={li.gstPercent} onChange={e => updateLine(i, { gstPercent: e.target.value })}
                  className={`${field} col-span-4 sm:col-span-2`} />
                <button onClick={() => removeLine(i)} className="col-span-2 sm:col-span-1 h-9 flex items-center justify-center text-[var(--muted-foreground)] hover:text-red-500">
                  <Trash2 size={15} />
                </button>
                <input placeholder="Notes (visible on the invoice)" value={li.notes} onChange={e => updateLine(i, { notes: e.target.value })}
                  className={`${field} col-span-12`} />
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <label className={label}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Payment instructions, bank details, etc."
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-[var(--foreground)]" />
          </div>
        </div>

        <div className="overflow-y-auto border-l border-[var(--border)] bg-[var(--muted)] p-6">
          <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-[var(--card)] p-6 shadow-sm max-w-xl mx-auto">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-bold text-[var(--foreground)]">Invoice</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-1">Invoice #: {invoiceNumber || 'Draft'}</div>
                <div className="text-xs text-[var(--muted-foreground)]">Status: {status}</div>
                <div className="text-xs text-[var(--muted-foreground)]">Due date: {dueDate || '—'}</div>
              </div>
              <div className="text-xl font-bold tracking-tight text-[var(--primary)]">INVOICE</div>
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
                {(property?.address || project?.location) && (
                  <div className="text-xs text-[var(--muted-foreground)]">{property?.address || project?.location}</div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <div className="text-xs font-semibold text-[var(--primary)] uppercase mb-2">Invoice items</div>
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-[var(--muted-foreground)] uppercase border-b border-[var(--border)] pb-1">
                <div className="col-span-6">Description</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-2 text-right">Rate</div>
                <div className="col-span-2 text-right">Amount</div>
              </div>
              {lines.map((li, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 text-sm py-1.5 border-b border-[var(--border)]">
                  <div className="col-span-6 text-[var(--foreground)]">{li.description || 'Invoice item'}{li.unit ? ` (${li.unit})` : ''}</div>
                  <div className="col-span-2 text-right text-[var(--foreground)]">{li.qty || 1}</div>
                  <div className="col-span-2 text-right text-[var(--foreground)]">{money(Number(li.unitPrice))}</div>
                  <div className="col-span-2 text-right text-[var(--foreground)]">{money(lineTotal(li))}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-1 text-sm ml-auto max-w-[220px]">
              <div className="flex justify-between text-[var(--muted-foreground)]"><span>Subtotal</span><span>{money(subtotal)}</span></div>
              <div className="flex justify-between text-[var(--muted-foreground)]"><span>GST total</span><span>{money(gstTotal)}</span></div>
              <div className="flex justify-between font-bold text-[var(--foreground)] text-base pt-1 border-t border-[var(--border)]"><span>Grand total</span><span>{money(grandTotal)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  const refresh = () => fetchInvoices().then(r => setInvoices(r.data)).catch(() => {});
  useEffect(() => {
    refresh();
    fetchContacts(1).then(r => setContacts(r.data || [])).catch(() => {});
    fetchProperties().then(r => setProperties(r.data || [])).catch(() => {});
    fetchProjects().then(r => setProjects(r.data || [])).catch(() => {});
  }, []);

  const markPaid = async (id: string) => {
    try { await updateInvoice(id, { status: 'PAID' }); refresh(); toast.success('Marked as paid'); }
    catch (err: any) { toast.error(err.message); }
  };

  const [busyId, setBusyId] = useState<string | null>(null);

  const downloadPdf = async (id: string) => {
    setBusyId(id);
    try {
      const { publicUrl } = await getInvoicePdf(id);
      window.open(publicUrl, '_blank');
    } catch (err: any) { toast.error(err.message || 'Could not generate PDF'); }
    finally { setBusyId(null); }
  };

  const send = async (id: string) => {
    setBusyId(id);
    try {
      const res = await sendInvoice(id, { channels: ['email', 'whatsapp'] });
      if (res.delivered) {
        const ok = Object.entries(res.results).filter(([, r]) => r.success).map(([c]) => c);
        const failed = Object.entries(res.results).filter(([, r]) => !r.success).map(([c, r]) => `${c}: ${r.error}`);
        toast.success(`Sent via ${ok.join(', ')}`);
        if (failed.length) toast.error(failed.join('  •  '));
        refresh();
      } else {
        const errs = Object.entries(res.results).map(([c, r]) => `${c}: ${r.error}`).join('  •  ');
        toast.error(`Nothing sent — ${errs}`);
      }
    } catch (err: any) { toast.error(err.message || 'Send failed'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Invoices</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Invoice value, receivables, and actual income are tracked separately — an invoice only becomes income when marked paid.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90">
          <Plus size={16} /> Create invoice
        </button>
      </div>

      {showCreate && (
        <InvoiceBuilder contacts={contacts} properties={properties} projects={projects} onClose={() => setShowCreate(false)} onCreated={refresh} />
      )}

      {invoices.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted-foreground)]">
          <FileText size={32} className="mx-auto mb-2 opacity-50" />
          No invoices yet. Create your first invoice to get paid.
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((i: any) => (
            <div key={i.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div>
                <div className="font-medium text-[var(--foreground)]">{i.invoiceNumber} — {i.contact?.name || 'No customer linked'}</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {money(i.grandTotal)}
                  {(i.property?.title || i.project?.name) && <span> · {i.property?.title || i.project?.name}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[i.status] || STATUS_STYLES.DRAFT}`}>{i.status}</span>
                <button onClick={() => downloadPdf(i.id)} disabled={busyId === i.id} title="Download PDF"
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-lg border border-[var(--border)] text-xs text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-50">
                  <Download size={13} /> PDF
                </button>
                <button onClick={() => send(i.id)} disabled={busyId === i.id} title="Send to client via WhatsApp + email"
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50">
                  <Send size={13} /> {busyId === i.id ? 'Sending…' : 'Send'}
                </button>
                {i.status !== 'PAID' && <button onClick={() => markPaid(i.id)} className="text-xs text-[var(--primary)] hover:underline">Mark paid</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
