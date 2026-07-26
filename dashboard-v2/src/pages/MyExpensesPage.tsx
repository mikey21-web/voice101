import { useState, useEffect } from 'react';
import { Plus, X, Wallet, TrendingUp, MapPin, Percent, Building2, Scale, MoreHorizontal, Search, Loader2, Download, Paperclip } from 'lucide-react';
import toast from 'react-hot-toast';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { api, apiUpload, resolveMediaUrl } from '../lib/api';

const EXPENSE_CATEGORIES = [
  'Marketing & Ads',
  'Travel & Transport',
  'Brokerage Commission',
  'Office Expenses',
  'Site Visit Costs',
  'Legal & Stamp Duty',
  'Employee Salaries',
  'Utilities',
  'Printing & Stationery',
  'Miscellaneous',
] as const;

const CATEGORY_ICONS: Record<string, any> = {
  'Marketing & Ads': TrendingUp,
  'Travel & Transport': MapPin,
  'Brokerage Commission': Percent,
  'Office Expenses': Building2,
  'Site Visit Costs': MapPin,
  'Legal & Stamp Duty': Scale,
  'Miscellaneous': MoreHorizontal,
};

function money(n: number | undefined) { return `₹${(n || 0).toLocaleString('en-IN')}`; }

export default function MyExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [form, setForm] = useState({ description: '', amount: '', category: 'Miscellaneous', date: '' });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await api('/client-finance/transactions?type=EXPENSE');
      const list = Array.isArray(res) ? res : res.data || [];
      setExpenses(list);
    } catch { setExpenses([]); }
    setLoading(false);
  };

  useEffect(() => { fetchExpenses(); }, []);

  const createExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let receiptMediaId: string | undefined;
      if (receiptFile) {
        setUploadingReceipt(true);
        const fd = new FormData();
        fd.append('file', receiptFile);
        fd.append('category', 'EXPENSE_RECEIPT');
        try { receiptMediaId = (await apiUpload('/media/upload', fd)).id; }
        catch { toast.error('Receipt upload failed — expense saved without it'); }
        setUploadingReceipt(false);
      }
      await api('/client-finance/transactions', {
        method: 'POST',
        body: JSON.stringify({
          description: form.description,
          amount: Number(form.amount),
          type: 'EXPENSE',
          category: form.category,
          date: form.date || undefined,
          status: 'PAID',
          receiptMediaId,
        }),
      });
      setShowForm(false);
      setForm({ description: '', amount: '', category: 'Miscellaneous', date: '' });
      setReceiptFile(null);
      fetchExpenses();
      toast.success('Expense added');
    } catch (err: any) { toast.error(err.message); }
  };

  const filtered = expenses.filter(e => {
    if (search && !e.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter && e.category !== categoryFilter) return false;
    return true;
  });

  const totalByCategory = EXPENSE_CATEGORIES.map(cat => ({
    category: cat,
    total: expenses.filter(e => e.category === cat).reduce((s, e) => s + (e.amount || 0), 0),
    count: expenses.filter(e => e.category === cat).length,
  })).filter(c => c.count > 0);

  const grandTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const thisMonth = expenses.filter(e => {
    const d = e.date || e.createdAt;
    if (!d) return false;
    const dt = new Date(d);
    const now = new Date();
    return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
  });
  const monthTotal = thisMonth.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">My Expenses</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Track office, travel, marketing, and brokerage expenses.</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={16} /> Add Expense
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Wallet size={16} /> Total Expenses
          </div>
          <div className="text-xl font-bold text-[var(--foreground)] mt-1">{money(grandTotal)}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Wallet size={16} /> This Month
          </div>
          <div className="text-xl font-bold text-[var(--foreground)] mt-1">{money(monthTotal)}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <TrendingUp size={16} /> Categories
          </div>
          <div className="text-xl font-bold text-[var(--foreground)] mt-1">{totalByCategory.length}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Download size={16} /> Total Entries
          </div>
          <div className="text-xl font-bold text-[var(--foreground)] mt-1">{expenses.length}</div>
        </div>
      </div>

      {totalByCategory.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">By Category</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {totalByCategory.map(c => {
              const Icon = CATEGORY_ICONS[c.category] || MoreHorizontal;
              return (
                <div key={c.category} className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-2 text-sm">
                  <Icon size={14} className="text-[var(--primary)] shrink-0" />
                  <span className="text-[var(--foreground)] truncate">{c.category}</span>
                  <span className="ml-auto text-[var(--foreground)] font-medium">{money(c.total)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={createExpense} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--foreground)]">New Expense</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required placeholder="e.g. Facebook ads for Whitefield project" />
            <Input label="Amount (₹)" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
            <Select label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input label="Date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1 text-[var(--foreground)]">Receipt (optional)</label>
            <input type="file" accept="image/*,application/pdf" onChange={e => setReceiptFile(e.target.files?.[0] || null)}
              className="text-sm text-[var(--foreground)]" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={uploadingReceipt}>{uploadingReceipt ? 'Uploading receipt…' : 'Add Expense'}</Button>
            <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)]" />
        </div>
        <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 size={24} className="animate-spin text-[var(--muted-foreground)]" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-10 text-sm text-[var(--muted-foreground)]">No expenses yet. Track your first expense to see it here.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {filtered.map((e: any) => {
              const Icon = CATEGORY_ICONS[e.category] || MoreHorizontal;
              const d = e.date || e.createdAt;
              return (
                <li key={e.id} className="flex items-center justify-between p-4 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center shrink-0">
                      <Icon size={14} className="text-[var(--primary)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-[var(--foreground)] truncate">{e.description}</div>
                      <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-1">
                        {e.category}{d ? ` · ${new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                        {e.receiptMedia && (
                          <a href={resolveMediaUrl(e.receiptMedia.publicUrl)} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-0.5 text-[var(--primary)] hover:underline ml-1">
                            <Paperclip size={11} /> Receipt
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-red-600 font-medium shrink-0 ml-3">-{money(e.amount)}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
