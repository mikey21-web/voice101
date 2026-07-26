import React, { useState, useEffect } from 'react';
import {
  fetchTransactions, createTransaction, fetchInvoices, createInvoice,
  fetchTaxReport, fetchEventProfitability,
} from '../lib/data';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Drawer } from '../components/ui/drawer';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';

const SUB_TABS = ['Transactions', 'Invoices', 'Receivables', 'Event Analytics', 'Tax', 'Reports'];

function money(n: number | undefined) { return `₹${(n || 0).toLocaleString('en-IN')}`; }

export default function AccountingPage() {
  const [tab, setTab] = useState('Transactions');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [tax, setTax] = useState<any>(null);
  const [eventProfit, setEventProfit] = useState<any[]>([]);
  const [showAddTxn, setShowAddTxn] = useState(false);
  const [txnForm, setTxnForm] = useState({ description: '', type: 'INCOME', amount: '', category: '', status: 'PENDING' });
  const [overview, setOverview] = useState<{ receivables: number; taxNetPayable: number; monthIncome: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [sentInvoices, taxReport, allTxns] = await Promise.all([fetchInvoices({ status: 'SENT' }), fetchTaxReport(), fetchTransactions()]);
        const receivables = sentInvoices.data.reduce((s: number, i: any) => s + (i.grandTotal || 0), 0);
        const now = new Date();
        const monthIncome = allTxns.data
          .filter((t: any) => t.type === 'INCOME' && t.status !== 'PENDING' && new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear())
          .reduce((s: number, t: any) => s + t.amount, 0);
        setOverview({ receivables, taxNetPayable: taxReport.netPayable || 0, monthIncome });
      } catch { /* overview is non-critical */ }
    })();
  }, []);

  const load = async (t: string) => {
    setTab(t);
    try {
      if (t === 'Transactions') setTransactions((await fetchTransactions()).data);
      else if (t === 'Invoices') setInvoices((await fetchInvoices()).data);
      else if (t === 'Receivables') setInvoices((await fetchInvoices({ status: 'SENT' })).data);
      else if (t === 'Event Analytics') setEventProfit(await fetchEventProfitability());
      else if (t === 'Tax') setTax(await fetchTaxReport());
    } catch (err: any) { toast.error(err.message); }
  };
  useEffect(() => { load('Transactions'); }, []);

  const addTxn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTransaction({ ...txnForm, amount: Number(txnForm.amount) });
      setShowAddTxn(false);
      setTxnForm({ description: '', type: 'INCOME', amount: '', category: '', status: 'PENDING' });
      load('Transactions');
      toast.success('Transaction added');
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Accounting & Finance</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Manage finances, invoices, and tax totals.</p>
        </div>
        <Button onClick={() => setShowAddTxn(true)}>
          <Plus size={16} /> Add transaction
        </Button>
      </div>

      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Outstanding receivables</div>
            <div className="text-xl font-bold text-[var(--foreground)] mt-1">{money(overview.receivables)}</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Income confirmed this month</div>
            <div className="text-xl font-bold text-emerald-600 mt-1">{money(overview.monthIncome)}</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Net GST payable</div>
            <div className="text-xl font-bold text-[var(--foreground)] mt-1">{money(overview.taxNetPayable)}</div>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-[var(--border)]">
        {SUB_TABS.map(t => (
          <button key={t} onClick={() => load(t)}
            className={`px-3 py-2 text-sm border-b-2 transition-colors ${tab === t ? 'border-[var(--primary)] text-[var(--foreground)] font-medium' : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>
            {t}
          </button>
        ))}
      </div>

      <Drawer
        open={showAddTxn}
        onClose={() => setShowAddTxn(false)}
        title="Add transaction"
        description="Log income or expense."
        footer={
          <>
            <Button variant="outline" onClick={() => setShowAddTxn(false)}>Cancel</Button>
            <Button type="submit" form="add-txn-form">Add transaction</Button>
          </>
        }
      >
        <form id="add-txn-form" onSubmit={addTxn} className="space-y-4">
          <Input label="Description" value={txnForm.description} onChange={e => setTxnForm({ ...txnForm, description: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={txnForm.type} onChange={e => setTxnForm({ ...txnForm, type: e.target.value })}>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </Select>
            <Input label="Amount" type="number" value={txnForm.amount} onChange={e => setTxnForm({ ...txnForm, amount: e.target.value })} required />
          </div>
          <Input label="Category" placeholder="e.g. Vendor payment, Booking advance" value={txnForm.category} onChange={e => setTxnForm({ ...txnForm, category: e.target.value })} />
          <Select label="Status" value={txnForm.status} onChange={e => setTxnForm({ ...txnForm, status: e.target.value })}>
            <option value="PENDING">Pending</option>
            <option value="RECEIVED">Received</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
          </Select>
        </form>
      </Drawer>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        {tab === 'Transactions' && (
          transactions.length === 0 ? <p className="text-center py-10 text-sm text-[var(--muted-foreground)]">No transactions yet. Add records to keep your finances current.</p> : (
            <ul className="space-y-2">{transactions.map((t: any) => (
              <li key={t.id} className="flex justify-between text-sm border-b border-[var(--border)] pb-2">
                <span className="text-[var(--foreground)]">{t.description}</span>
                <span className={t.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'}>{t.type === 'INCOME' ? '+' : '-'}{money(t.amount)}</span>
              </li>
            ))}</ul>
          )
        )}

        {(tab === 'Invoices' || tab === 'Receivables') && (
          invoices.length === 0 ? <p className="text-center py-10 text-sm text-[var(--muted-foreground)]">No invoices yet. Create your first invoice to get paid.</p> : (
            <ul className="space-y-2">{invoices.map((i: any) => (
              <li key={i.id} className="flex justify-between text-sm border-b border-[var(--border)] pb-2">
                <span className="text-[var(--foreground)]">{i.invoiceNumber} — {i.contact?.name || 'No customer'}</span>
                <span className="text-[var(--muted-foreground)]">{money(i.grandTotal)} · {i.status}</span>
              </li>
            ))}</ul>
          )
        )}

        {tab === 'Event Analytics' && (
          eventProfit.length === 0 ? <p className="text-center py-10 text-sm text-[var(--muted-foreground)]">No events with financial activity.</p> : (
            <ul className="space-y-2">{eventProfit.map((e: any) => (
              <li key={e.eventId} className="flex justify-between text-sm border-b border-[var(--border)] pb-2">
                <a href={`#/events/${e.eventId}`} className="text-[var(--primary)] hover:underline">{e.eventId}</a>
                <span className="text-[var(--muted-foreground)]">Income {money(e.income)} · Expenses {money(e.expenses)} · Profit {money(e.profit)}</span>
              </li>
            ))}</ul>
          )
        )}

        {tab === 'Tax' && tax && (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-[var(--border)] p-3">
              <div className="text-xs text-[var(--muted-foreground)]">Tax collected</div>
              <div className="text-lg font-semibold text-emerald-600">{money(tax.taxCollected)}</div>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-3">
              <div className="text-xs text-[var(--muted-foreground)]">Tax paid</div>
              <div className="text-lg font-semibold text-red-600">{money(tax.taxPaid)}</div>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-3">
              <div className="text-xs text-[var(--muted-foreground)]">Net payable</div>
              <div className="text-lg font-semibold text-[var(--foreground)]">{money(tax.netPayable)}</div>
            </div>
          </div>
        )}

        {tab === 'Reports' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {['Profit & Loss', 'Cash Flow', 'Balance Sheet', 'Tax Reports', 'Vendor Payments', 'Event Profitability'].map(r => (
              <a key={r} href="#/finance-reports" className="rounded-lg border border-[var(--border)] p-4 text-center text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">{r}</a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
