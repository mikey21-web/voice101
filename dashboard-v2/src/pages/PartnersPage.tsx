import React, { useState, useEffect } from 'react';
import { fetchPartners, createPartner } from '../lib/data';
import { Plus, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Drawer } from '../components/ui/drawer';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';

export default function PartnersPage() {
  const [partners, setPartners] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'VENDOR', company: '', category: '' });

  const refresh = () => fetchPartners(typeFilter ? { type: typeFilter } : {}).then(r => setPartners(r.data)).catch(() => {});
  useEffect(() => { refresh(); }, [typeFilter]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPartner(form);
      setShowCreate(false);
      setForm({ name: '', type: 'VENDOR', company: '', category: '' });
      refresh();
      toast.success('Partner added');
    } catch (err: any) { toast.error(err.message); }
  };

  const counts = {
    total: partners.length,
    vendors: partners.filter(p => p.type === 'VENDOR').length,
    suppliers: partners.filter(p => p.type === 'SUPPLIER').length,
    both: partners.filter(p => p.type === 'BOTH').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Partners</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Unified directory of every vendor and supplier. A single company can be both.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New partner
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[['Total partners', counts.total], ['Vendors', counts.vendors], ['Suppliers', counts.suppliers], ['Both roles', counts.both]].map(([label, val]) => (
          <div key={label as string} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
            <div className="text-lg font-semibold text-[var(--foreground)]">{val}</div>
          </div>
        ))}
      </div>

      <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="max-w-xs">
        <option value="">All types</option>
        <option value="VENDOR">Vendor</option>
        <option value="SUPPLIER">Supplier</option>
        <option value="BOTH">Both</option>
      </Select>

      <Drawer
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New partner"
        description="Add a vendor or supplier to your directory."
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" form="create-partner-form">Create partner</Button>
          </>
        }
      >
        <form id="create-partner-form" onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            <Select label="Type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="VENDOR">Vendor</option>
              <option value="SUPPLIER">Supplier</option>
              <option value="BOTH">Both (vendor + supplier)</option>
            </Select>
          </div>
          <Input label="Company" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
          <Input label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
        </form>
      </Drawer>

      {partners.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted-foreground)]">
          <Truck size={32} className="mx-auto mb-2 opacity-50" />
          No partners yet. Add your first vendor or supplier to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {partners.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div>
                <div className="font-medium text-[var(--foreground)]">{p.name}</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{p.company || '—'} {p.category ? `· ${p.category}` : ''}</div>
              </div>
              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)] text-[var(--foreground)]">{p.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
