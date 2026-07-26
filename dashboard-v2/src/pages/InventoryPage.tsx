import React, { useState, useEffect } from 'react';
import { fetchInventoryItems, fetchInventoryStats, createInventoryItem, fetchInventoryLocations } from '../lib/data';
import { Plus, Box } from 'lucide-react';
import toast from 'react-hot-toast';
import { Drawer } from '../components/ui/drawer';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';

const CATEGORIES = ['audio', 'catering', 'decoration', 'furniture', 'lighting', 'mandap', 'other', 'shamiana', 'tents', 'visual'];

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ totalItems: 0, lowStock: 0, outOfStock: 0, totalValue: 0 });
  const [locations, setLocations] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'other', sku: '', quantity: '', minStock: '', unit: '', locationId: '' });

  const refresh = () => { fetchInventoryItems().then(r => setItems(r.data)).catch(() => {}); fetchInventoryStats().then(setStats).catch(() => {}); };
  useEffect(() => { refresh(); fetchInventoryLocations().then(setLocations).catch(() => {}); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createInventoryItem({ ...form, quantity: Number(form.quantity) || 0, minStock: Number(form.minStock) || 0, locationId: form.locationId || undefined });
      setShowCreate(false);
      setForm({ name: '', category: 'other', sku: '', quantity: '', minStock: '', unit: '', locationId: '' });
      refresh();
      toast.success('Item added');
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Inventory items</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Your asset catalogue — quantities, minimums, and supplier details.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Add Item
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[['Total items', stats.totalItems], ['Low stock', stats.lowStock], ['Out of stock', stats.outOfStock], ['Total value', `₹${(stats.totalValue || 0).toLocaleString('en-IN')}`]].map(([label, val]) => (
          <div key={label as string} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
            <div className="text-lg font-semibold text-[var(--foreground)]">{val}</div>
          </div>
        ))}
      </div>

      <Drawer
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New inventory item"
        description="Add an item to your inventory catalogue."
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" form="create-item-form">Create item</Button>
          </>
        }
      >
        <form id="create-item-form" onSubmit={create} className="space-y-4">
          <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input label="SKU" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Quantity" type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
            <Input label="Min stock" type="number" value={form.minStock} onChange={e => setForm({ ...form, minStock: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Unit" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
            <Select label="Location" value={form.locationId} onChange={e => setForm({ ...form, locationId: e.target.value })}>
              <option value="">No location</option>
              {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </div>
        </form>
      </Drawer>

      {items.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted-foreground)]">
          <Box size={32} className="mx-auto mb-2 opacity-50" />
          No inventory yet. Add your first item to track stock levels.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((i: any) => (
            <div key={i.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div>
                <div className="font-medium text-[var(--foreground)]">{i.name}</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{i.category} · SKU {i.sku || '—'}</div>
              </div>
              <span className={`text-sm font-medium ${i.quantity <= i.minStock ? 'text-red-600' : 'text-[var(--foreground)]'}`}>{i.quantity} {i.unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
