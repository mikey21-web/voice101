import React, { useState, useEffect } from 'react';
import { fetchVendorBookings, createVendorBooking, updateVendorBooking, fetchPartners, fetchEvents } from '../lib/data';
import { Plus, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';
import { Drawer } from '../components/ui/drawer';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';

function money(n: number | undefined) { return `₹${(n || 0).toLocaleString('en-IN')}`; }
const STATUSES = ['DRAFT', 'SENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export default function VendorBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ partnerId: '', eventId: '', title: '', agreedFee: '', advanceAmount: '' });

  const refresh = () => fetchVendorBookings(statusFilter ? { status: statusFilter } : {}).then(r => setBookings(r.data)).catch(() => {});
  useEffect(() => { refresh(); }, [statusFilter]);
  useEffect(() => {
    fetchPartners().then(r => setPartners(r.data || [])).catch(() => {});
    fetchEvents(1).then(r => setEvents(r.data || [])).catch(() => {});
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createVendorBooking({ ...form, agreedFee: Number(form.agreedFee) || 0, advanceAmount: Number(form.advanceAmount) || 0 });
      setShowCreate(false);
      setForm({ partnerId: '', eventId: '', title: '', agreedFee: '', advanceAmount: '' });
      refresh();
      toast.success('Vendor booking created');
    } catch (err: any) { toast.error(err.message); }
  };

  const advance = async (id: string, current: string) => {
    const idx = STATUSES.indexOf(current);
    const next = STATUSES[Math.min(idx + 1, STATUSES.length - 2)];
    try { await updateVendorBooking(id, { status: next }); refresh(); } catch (err: any) { toast.error(err.message); }
  };

  const counts = {
    total: bookings.length,
    confirmed: bookings.filter(b => b.status === 'CONFIRMED').length,
    awaiting: bookings.filter(b => b.status === 'SENT').length,
    committed: bookings.reduce((s, b) => s + (b.agreedFee || 0), 0),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Vendor Bookings</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Booking orders sent to your event vendors.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Booking
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[['Total bookings', counts.total], ['Confirmed', counts.confirmed], ['Awaiting confirmation', counts.awaiting], ['Total committed', money(counts.committed)]].map(([label, val]) => (
          <div key={label as string} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
            <div className="text-lg font-semibold text-[var(--foreground)]">{val}</div>
          </div>
        ))}
      </div>

      <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="max-w-xs">
        <option value="">All</option>
        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
      </Select>

      <Drawer
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New vendor booking"
        description="Document a booking order sent to a vendor."
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" form="create-booking-form">Create booking</Button>
          </>
        }
      >
        <form id="create-booking-form" onSubmit={create} className="space-y-4">
          <Select label="Vendor" value={form.partnerId} onChange={e => setForm({ ...form, partnerId: e.target.value })} required>
            <option value="">Select vendor</option>
            {partners.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select label="Link to event" value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })} required>
            <option value="">Select event</option>
            {events.map((ev: any) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
          </Select>
          <Input label="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Agreed fee" type="number" value={form.agreedFee} onChange={e => setForm({ ...form, agreedFee: e.target.value })} />
            <Input label="Advance amount" type="number" value={form.advanceAmount} onChange={e => setForm({ ...form, advanceAmount: e.target.value })} />
          </div>
        </form>
      </Drawer>

      {bookings.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted-foreground)]">
          <ClipboardList size={32} className="mx-auto mb-2 opacity-50" />
          No vendor booking orders yet. Create booking orders to document your vendor commitments.
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((b: any) => (
            <div key={b.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div>
                <div className="font-medium text-[var(--foreground)]">{b.title} — {b.partner?.name}</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{money(b.agreedFee)} · Advance {money(b.advanceAmount)}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)] text-[var(--foreground)]">{b.status}</span>
                {b.status !== 'COMPLETED' && b.status !== 'CANCELLED' && <button onClick={() => advance(b.id, b.status)} className="text-xs text-[var(--primary)] hover:underline">Advance</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
