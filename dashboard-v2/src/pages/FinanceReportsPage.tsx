import React, { useState } from 'react';
import { fetchProfitAndLoss, fetchCashFlow, fetchBalanceSheet, fetchTaxReport, fetchVendorPaymentsReport, fetchEventProfitability } from '../lib/data';
import { TrendingUp, Waves, Scale, Percent, Truck, PieChart } from 'lucide-react';
import toast from 'react-hot-toast';

function toCsv(obj: any): string {
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '';
    const keys = Object.keys(obj[0]);
    return [keys.join(','), ...obj.map((row: any) => keys.map(k => row[k]).join(','))].join('\n');
  }
  return Object.entries(obj).map(([k, v]) => `${k},${v}`).join('\n');
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${name}.csv`; a.click();
  URL.revokeObjectURL(url);
}

const REPORTS = [
  { label: 'Profit & Loss', fetch: fetchProfitAndLoss, icon: TrendingUp, description: 'Income vs. expenses and net profit' },
  { label: 'Cash Flow', fetch: fetchCashFlow, icon: Waves, description: 'Money in and out over time' },
  { label: 'Balance Sheet', fetch: fetchBalanceSheet, icon: Scale, description: 'Assets, liabilities, and equity' },
  { label: 'Tax Reports', fetch: fetchTaxReport, icon: Percent, description: 'GST collected, paid, and net payable' },
  { label: 'Vendor Payments', fetch: fetchVendorPaymentsReport, icon: Truck, description: 'Amounts owed and paid to vendors' },
  { label: 'Event Profitability', fetch: fetchEventProfitability, icon: PieChart, description: 'Income, expenses, and margin per event' },
];

export default function FinanceReportsPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Record<string, Date>>({});

  const run = async (label: string, fn: () => Promise<any>) => {
    setLoading(label);
    try {
      const data = await fn();
      download(label.toLowerCase().replace(/\s+/g, '-'), toCsv(data));
      setLastRun(prev => ({ ...prev, [label]: new Date() }));
      toast.success(`${label} downloaded`);
    } catch (err: any) { toast.error(err.message); }
    setLoading(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Financial Reports</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">Click a report to download it as CSV</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {REPORTS.map(r => (
          <button key={r.label} onClick={() => run(r.label, r.fetch)} disabled={loading === r.label}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 flex flex-col items-center gap-2 text-center hover:shadow-sm transition-shadow disabled:opacity-50">
            <r.icon size={24} className="text-[var(--primary)]" />
            <span className="text-sm font-medium text-[var(--foreground)]">{loading === r.label ? 'Loading…' : r.label}</span>
            <span className="text-xs text-[var(--muted-foreground)]">{r.description}</span>
            {lastRun[r.label] && (
              <span className="text-[10px] text-[var(--muted-foreground)]">Last downloaded {lastRun[r.label].toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
