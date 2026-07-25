import { useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import toast from "react-hot-toast";
import { X, Loader2, Check } from "lucide-react";

interface BookingWizardModalProps {
  costSheet: any;
  onClose: () => void;
  onDone: () => void;
}

export default function BookingWizardModal({ costSheet, onClose, onDone }: BookingWizardModalProps) {
  const [step, setStep] = useState<"hold" | "draft" | "form" | "done">("hold");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // step 3 form
  const [applicants, setApplicants] = useState([{ name: "", panMasked: "" }]);
  const [bookingAmountPaise, setBookingAmountPaise] = useState("");

  // Step 1: ensure hold exists
  const ensureHold = async () => {
    setSaving(true);
    setError(null);
    try {
      await api("/unit-holds", {
        method: "POST",
        body: JSON.stringify({ unitId: costSheet.unitId, leadId: costSheet.leadId }),
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      if (e.message?.includes("UNIT_NOT_AVAILABLE") || e.message?.includes("already has an active hold")) {
        // hold already exists or unit already held — fine, proceed
      } else {
        setError(e.message || "Failed to create hold");
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setStep("draft");
  };

  // Step 2: create draft booking
  const createDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      const booking = await api("/bookings/purchase", {
        method: "POST",
        body: JSON.stringify({ leadId: costSheet.leadId, unitId: costSheet.unitId, costSheetId: costSheet.id }),
        headers: { "Content-Type": "application/json" },
      });
      setBookingId(booking.id);
      setSaving(false);
      setStep("form");
    } catch (e: any) {
      setError(e.message || "Failed to create booking draft");
      setSaving(false);
    }
  };

  // Step 4: confirm booking
  const confirmBooking = async () => {
    if (!bookingId) return;
    if (!bookingAmountPaise || Number(bookingAmountPaise) <= 0) { toast.error("Enter a valid booking amount"); return; }
    const validApplicants = applicants.filter(a => a.name.trim());
    if (validApplicants.length === 0) { toast.error("At least one applicant name is required"); return; }

    setSaving(true);
    setError(null);
    try {
      await api(`/bookings/${bookingId}/confirm-purchase`, {
        method: "POST",
        body: JSON.stringify({
          applicants: validApplicants.map(a => ({ name: a.name, panMasked: a.panMasked || undefined })),
          bookingAmountPaise: Number(bookingAmountPaise),
        }),
        headers: { "Content-Type": "application/json" },
      });
      toast.success("Booking confirmed!");
      setStep("done");
    } catch (e: any) {
      setError(e.message || "Failed to confirm booking");
    }
    setSaving(false);
  };

  const addApplicant = () => setApplicants(prev => [...prev, { name: "", panMasked: "" }]);
  const updateApplicant = (i: number, field: string, value: string) => {
    setApplicants(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a));
  };
  const removeApplicant = (i: number) => {
    setApplicants(prev => prev.filter((_, idx) => idx !== i));
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--foreground)]">Booking Wizard</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--accent)]"><X size={18} /></button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-1 mb-6 text-xs">
          {["Hold", "Draft", "Details", "Done"].map((label, i) => {
            const current = ["hold", "draft", "form", "done"].indexOf(step);
            return (
              <div key={label} className="flex items-center gap-1">
                {i > 0 && <div className={`h-px w-6 ${i <= current ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`} />}
                <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium ${i < current ? "bg-green-500 text-white" : i === current ? "bg-[var(--primary)] text-white" : "bg-[var(--background)] text-[var(--muted-foreground)]"}`}>
                  {i < current ? <Check size={12} /> : i + 1}
                </span>
                <span className={`text-[10px] ${i <= current ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>{label}</span>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">{error}</div>
        )}

        {step === "hold" && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">Step 1: Ensure a unit hold exists for this lead.</p>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)]">Cancel</button>
              <button onClick={ensureHold} disabled={saving} className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1">
                {saving && <Loader2 size={14} className="animate-spin" />} Create hold & continue
              </button>
            </div>
          </div>
        )}

        {step === "draft" && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">Step 2: Create a draft purchase booking.</p>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)]">Cancel</button>
              <button onClick={createDraft} disabled={saving} className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1">
                {saving && <Loader2 size={14} className="animate-spin" />} Create draft
              </button>
            </div>
          </div>
        )}

        {step === "form" && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">Step 3: Enter applicant details and booking amount to confirm.</p>

            {/* Applicants */}
            <div>
              <label className="text-sm font-medium text-[var(--foreground)] block mb-1">Applicants</label>
              {applicants.map((a, i) => (
                <div key={i} className="flex gap-2 mb-2 items-start">
                  <div className="flex-1 space-y-1">
                    <input value={a.name} onChange={e => updateApplicant(i, "name", e.target.value)} placeholder="Full name" className="w-full h-8 rounded border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20" />
                    <input value={a.panMasked} onChange={e => updateApplicant(i, "panMasked", e.target.value)} placeholder="PAN (masked, e.g. ABCPX1234D)" maxLength={10} className="w-full h-8 rounded border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20" />
                  </div>
                  {applicants.length > 1 && (
                    <button onClick={() => removeApplicant(i)} className="mt-1 text-red-500 hover:text-red-700"><X size={16} /></button>
                  )}
                </div>
              ))}
              <button onClick={addApplicant} className="text-xs text-[var(--primary)] hover:underline">+ Add co-applicant</button>
            </div>

            {/* Booking amount */}
            <div>
              <label className="text-sm font-medium text-[var(--foreground)] block mb-1">Booking amount (paise)</label>
              <input type="number" value={bookingAmountPaise} onChange={e => setBookingAmountPaise(e.target.value)} placeholder="e.g. 5000000 for ₹50,000" className="w-full h-9 rounded border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20" />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)]">Cancel</button>
              <button onClick={confirmBooking} disabled={saving} className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1">
                {saving && <Loader2 size={14} className="animate-spin" />} Confirm booking
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 text-center py-6">
            <div className="mx-auto h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check size={24} className="text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">Booking has been confirmed successfully.</p>
            <button onClick={onDone} className="h-9 px-6 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90">
              Done
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
