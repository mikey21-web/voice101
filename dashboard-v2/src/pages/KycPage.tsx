import { useState, useEffect, useCallback, useRef } from "react";
import { api, apiUpload } from "../lib/api";
import toast from "react-hot-toast";
import { Plus, Upload, Check, X, FileText } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Dialog } from "../components/ui/dialog";

const DOC_TYPES = [
  "PAN", "AADHAAR_OFFLINE_XML", "ADDRESS_PROOF", "PHOTO", "SALARY_PROOF",
  "BANK_STATEMENT", "LOAN_SANCTION_LETTER", "BOOKING_FORM", "ALLOTMENT_LETTER",
  "AGREEMENT_DRAFT", "SIGNED_AGREEMENT", "NOC", "POSSESSION_LETTER", "OTHER",
];

const statusVariant: Record<string, "default" | "success" | "secondary" | "destructive" | "warning"> = {
  NOT_REQUESTED: "secondary",
  REQUESTED: "warning",
  UPLOADED: "default",
  PROCESSING: "default",
  VERIFIED: "success",
  REJECTED: "destructive",
  EXPIRED: "destructive",
  WAIVED: "secondary",
};

export default function KycPage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [showRequest, setShowRequest] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = statusFilter ? `?status=${statusFilter}` : "";
      const res = await api(`/kyc/documents${q}`);
      setDocs(res.data || res);
    } catch (e: any) {
      setError(e.message || "Failed to load documents");
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const upload = async (docId: string, file: File) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const media = await apiUpload("/media/upload", fd);
      await api(`/kyc/documents/${docId}/upload`, { method: "POST", body: JSON.stringify({ mediaFileId: media.id, source: "staff_upload" }) });
      toast.success("Document uploaded");
      load();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    }
  };

  const verify = async (id: string) => {
    try {
      await api(`/kyc/documents/${id}/verify`, { method: "POST" });
      toast.success("Document verified");
      load();
    } catch (e: any) {
      toast.error(e.message || "Verification failed");
    }
  };

  const reject = async (id: string) => {
    const reason = window.prompt("Reason for rejection?");
    if (!reason) return;
    try {
      await api(`/kyc/documents/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
      toast.success("Document rejected");
      load();
    } catch (e: any) {
      toast.error(e.message || "Rejection failed");
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">KYC &amp; Documents</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">{docs.length} documents</p>
        </div>
        <button
          onClick={() => setShowRequest(true)}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus size={16} /> Request document
        </button>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]"
        >
          <option value="">All statuses</option>
          {["NOT_REQUESTED", "REQUESTED", "UPLOADED", "VERIFIED", "REJECTED", "WAIVED"].map(s => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>File</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={6} className="text-center text-[var(--muted-foreground)] py-8">
              <div className="flex flex-col items-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
                <span>Loading documents...</span>
              </div>
            </TableCell></TableRow>
          ) : error ? (
            <TableRow><TableCell colSpan={6} className="text-center py-8">
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm text-red-500">{error}</span>
                <button onClick={load} className="text-xs text-[var(--primary)] hover:underline">Try again</button>
              </div>
            </TableCell></TableRow>
          ) : docs.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center text-[var(--muted-foreground)] py-8">
              No documents requested yet.
            </TableCell></TableRow>
          ) : (
            docs.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-medium text-[var(--foreground)] flex items-center gap-1">
                  <FileText size={14} className="text-[var(--muted-foreground)]" /> {d.type.replace(/_/g, " ")}
                </TableCell>
                <TableCell className="text-xs text-[var(--muted-foreground)]">{d.leadId}</TableCell>
                <TableCell><Badge variant={statusVariant[d.status] || "secondary"}>{d.status.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell>
                  {d.mediaFile?.signedUrl ? (
                    <a href={d.mediaFile.signedUrl} target="_blank" rel="noreferrer" className="text-xs text-[var(--primary)] hover:underline">
                      {d.mediaFile.fileName}
                    </a>
                  ) : <span className="text-xs text-[var(--muted-foreground)]">—</span>}
                </TableCell>
                <TableCell className="text-xs text-[var(--muted-foreground)]">{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex gap-1 items-center">
                    <input
                      ref={el => { fileInputs.current[d.id] = el; }}
                      type="file"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) upload(d.id, f); }}
                    />
                    {(d.status === "REQUESTED" || d.status === "REJECTED") && (
                      <button onClick={() => fileInputs.current[d.id]?.click()} className="text-xs px-2 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--accent)] inline-flex items-center gap-1">
                        <Upload size={12} /> Upload
                      </button>
                    )}
                    {(d.status === "UPLOADED" || d.status === "PROCESSING") && (
                      <>
                        <button onClick={() => verify(d.id)} className="text-xs px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 inline-flex items-center gap-1"><Check size={12} /> Verify</button>
                        <button onClick={() => reject(d.id)} className="text-xs px-2 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200 inline-flex items-center gap-1"><X size={12} /> Reject</button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {showRequest && <RequestDocumentModal onClose={() => setShowRequest(false)} onDone={() => { setShowRequest(false); load(); }} />}
    </div>
  );
}

function RequestDocumentModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [leadId, setLeadId] = useState("");
  const [type, setType] = useState(DOC_TYPES[0]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!leadId) { toast.error("Lead ID is required"); return; }
    setSaving(true);
    try {
      await api("/kyc/documents", { method: "POST", body: JSON.stringify({ leadId, type }) });
      toast.success("Document requested");
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Failed to request document");
    }
    setSaving(false);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Request a document"
      maxWidth="max-w-md"
      footer={
        <>
          <button onClick={onClose} className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)]">Cancel</button>
          <button onClick={submit} disabled={saving} className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? "Requesting..." : "Request"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <input placeholder="Lead ID" value={leadId} onChange={e => setLeadId(e.target.value)} className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" />
        <select value={type} onChange={e => setType(e.target.value)} className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]">
          {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
      </div>
    </Dialog>
  );
}
