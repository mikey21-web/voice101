import React, { useState, useEffect } from 'react';
import { fetchPayroll, createSalaryRecord } from '../lib/data';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

function money(n: number | undefined) { return `₹${(n || 0).toLocaleString('en-IN')}`; }

export default function SalariesPage() {
  const [payroll, setPayroll] = useState<any>({ employees: [], records: [], totalMonthlyPayroll: 0, onPayroll: 0 });
  const [showAdvance, setShowAdvance] = useState(false);
  const [form, setForm] = useState({ userId: '', month: new Date().toISOString().slice(0, 7), amount: '', type: 'ADVANCE' });

  const refresh = () => fetchPayroll().then(setPayroll).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const addRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSalaryRecord({ ...form, amount: Number(form.amount) });
      setShowAdvance(false);
      setForm({ userId: '', month: new Date().toISOString().slice(0, 7), amount: '', type: 'ADVANCE' });
      refresh();
      toast.success('Payroll entry added');
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Salaries</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Payroll, advances, and payroll summaries.</p>
        </div>
        <button onClick={() => setShowAdvance(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90">
          <Plus size={16} /> Add entry
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[['Total monthly payroll', money(payroll.totalMonthlyPayroll)], ['On payroll', payroll.onPayroll], ['Payroll entries', payroll.records?.length || 0]].map(([label, val]) => (
          <div key={label as string} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
            <div className="text-lg font-semibold text-[var(--foreground)]">{val}</div>
          </div>
        ))}
      </div>

      {showAdvance && (
        <form onSubmit={addRecord} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} required
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]">
              <option value="">Employee</option>
              {payroll.employees.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]">
              <option value="ADVANCE">Advance</option>
              <option value="SALARY">Salary</option>
            </select>
            <input type="month" value={form.month} onChange={e => setForm({ ...form, month: e.target.value })}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" />
            <input type="number" placeholder="Amount" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90">Add entry</button>
            <button type="button" onClick={() => setShowAdvance(false)} className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)]">Cancel</button>
          </div>
        </form>
      )}

      {payroll.employees.length === 0 ? (
        <p className="text-center py-12 text-sm text-[var(--muted-foreground)]">No team members yet.</p>
      ) : (
        <div className="space-y-2">
          {payroll.employees.map((u: any) => (
            <div key={u.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
              <span className="text-[var(--foreground)]">{u.name}</span>
              <span className="text-[var(--muted-foreground)]">{money(u.monthlySalary)}/{u.salaryType || 'month'}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-[var(--foreground)] mb-2">Payroll entries</h2>
        {(payroll.records?.length || 0) === 0 ? (
          <p className="text-center py-8 text-sm text-[var(--muted-foreground)]">No salary or advance entries yet.</p>
        ) : (
          <div className="space-y-2">
            {payroll.records.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-sm">
                <div>
                  <span className="text-[var(--foreground)] font-medium">{r.user?.name || 'Unknown'}</span>
                  <span className="text-[var(--muted-foreground)] ml-2">{r.month}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.type === 'ADVANCE' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>{r.type}</span>
                  <span className="text-[var(--foreground)] font-medium">{money(r.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
