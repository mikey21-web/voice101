import React, { useState, useEffect } from 'react';
import { fetchInventoryLocations, createInventoryLocation } from '../lib/data';
import { Plus, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LocationsPage() {
  const [locations, setLocations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'Warehouse', description: '' });

  const refresh = () => fetchInventoryLocations().then(setLocations).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createInventoryLocation(form);
      setShowCreate(false);
      setForm({ name: '', type: 'Warehouse', description: '' });
      refresh();
      toast.success('Location created');
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Locations</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Warehouses, zones, aisles, vehicles and event sites that hold your stock.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90">
          <Plus size={16} /> New
        </button>
      </div>

      {showCreate && (
        <form onSubmit={create} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" />
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]">
              <option value="Warehouse">Warehouse</option>
              <option value="Zone">Zone</option>
              <option value="Vehicle">Vehicle</option>
              <option value="EventSite">Event site</option>
            </select>
            <input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90">Create location</button>
            <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)]">Cancel</button>
          </div>
        </form>
      )}

      {locations.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted-foreground)]">
          <MapPin size={32} className="mx-auto mb-2 opacity-50" />
          No locations yet. Create your first warehouse to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1 space-y-2">
            {locations.map((l: any) => (
              <button key={l.id} onClick={() => setSelected(l)}
                className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${selected?.id === l.id ? 'border-[var(--primary)] bg-[var(--accent)]' : 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)]'}`}>
                <div className="font-medium text-[var(--foreground)]">{l.name}</div>
                <div className="text-xs text-[var(--muted-foreground)]">{l.type}</div>
              </button>
            ))}
          </div>
          <div className="sm:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            {selected ? (
              <div>
                <h3 className="font-medium text-[var(--foreground)]">{selected.name}</h3>
                <p className="text-sm text-[var(--muted-foreground)] mt-1">{selected.description || 'No description'}</p>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">Select a location to see stock and actions.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
