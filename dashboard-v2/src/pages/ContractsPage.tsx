import React, { useState, useEffect } from 'react';
import { fetchContracts, createContract, updateContract, fetchQuotations, fetchContacts } from '../lib/data';
import { Plus, FileText, CheckCircle2, PenLine } from 'lucide-react';
import toast from 'react-hot-toast';

function money(n: number | undefined) { return `₹${(n || 0).toLocaleString('en-IN')}`; }

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  SENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  SIGNED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ quotationId: '', contactId: '', amount: '', notes: '' });
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () => fetchContracts().then(r => setContracts(r.data)).catch(() => {});
  useEffect(() => {
    refresh();
    fetchQuotations().then(r => setQuotations(r.data || [])).catch(() => {});
    fetchContacts(1).then(r => setContacts(r.data || [])).catch(() => {});
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createContract({
        quotationId: form.quotationId || undefined,
        contactId: form.contactId || undefined,
        amount: form.amount ? Number(form.amount) : undefined,
        notes: form.notes || undefined,
      });
      setShowCreate(false);
      setForm({ quotationId: '', contactId: '', amount: '', notes: '' });
      refresh();
      toast.success('Contract created');
    } catch (err: any) { toast.error(err.message); }
  };

  const accept = async (id: string) => {
    setBusyId(id);
    try { await updateContract(id, { acceptedAt: new Date().toISOString() }); refresh(); toast.success('Marked accepted by client'); }
    catch (err: any) { toast.error(err.message); }
    finally { setBusyId(null); }
  };

  const sign = async (id: string) => {
    setBusyId(id);
    try { await updateContract(id, { status: 'SIGNED' }); refresh(); toast.success('Contract signed'); }
    catch (err: any) { toast.error(err.message); }
    finally { setBusyId(null); }
  };

  const field = 'h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Contracts</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Convert accepted quotes into contracts, or create one directly. Invoices are generated separately.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90">
          <Plus size={16} /> New contract
        </button>
      </div>

      {showCreate && (
        <form onSubmit={create} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={form.quotationId} onChange={e => setForm({ ...form, quotationId: e.target.value })} className={field}>
              <option value="">No linked quotation</option>
              {quotations.map((q: any) => <option key={q.id} value={q.id}>{q.quoteNumber} — {q.property?.title || q.project?.name || q.contact?.name || 'Unlinked'}</option>)}
            </select>
            <select value={form.contactId} onChange={e => setForm({ ...form, contactId: e.target.value })} className={field}>
              <option value="">Customer (auto from quotation if linked)</option>
              {contacts.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="number" placeholder="Amount (optional if linked to quotation)" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={field} />
            <input placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={field} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90">Create contract</button>
            <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)]">Cancel</button>
          </div>
        </form>
      )}

      {contracts.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted-foreground)]">
          <FileText size={32} className="mx-auto mb-2 opacity-50" />
          No contracts yet.
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div>
                <div className="font-medium text-[var(--foreground)]">
                  {c.contractNumber} — {c.contact?.name || 'No customer linked'}
                </div>
                <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {money(c.amount)}
                  {(c.quotation?.property?.title || c.quotation?.project?.name) && <span> · {c.quotation.property?.title || c.quotation.project?.name}</span>}
                  {c.acceptedAt && <span> · Accepted by client</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[c.status] || STATUS_STYLES.DRAFT}`}>{c.status}</span>
                {!c.acceptedAt && (
                  <button onClick={() => accept(c.id)} disabled={busyId === c.id}
                    className="inline-flex items-center gap-1 h-7 px-2 rounded-lg border border-[var(--border)] text-xs text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-50">
                    <CheckCircle2 size={13} /> Mark accepted
                  </button>
                )}
                {c.status !== 'SIGNED' && c.status !== 'CANCELLED' && (
                  <button onClick={() => sign(c.id)} disabled={busyId === c.id}
                    className="inline-flex items-center gap-1 h-7 px-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50">
                    <PenLine size={13} /> Mark signed
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
