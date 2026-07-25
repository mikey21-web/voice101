import { useState, useRef, useEffect } from "react";
import { api, apiUpload } from "../lib/api";
import { Upload, FileText, Download, CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

type ImportLog = {
  id: string;
  type: string;
  status: string;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  fileUrl: string | null;
  errors: { message: string }[] | null;
  createdAt: string;
};

type ColumnMap = { csvCol: string; field: string };

type Entity = "contact" | "lead" | "property" | "project" | "channelPartner";

const FIELD_OPTIONS: Record<Entity, { value: string; label: string }[]> = {
  contact: [
    { value: "name", label: "Name" },
    { value: "email", label: "Email" },
    { value: "phone", label: "Phone" },
    { value: "whatsapp", label: "WhatsApp" },
    { value: "company", label: "Company" },
  ],
  lead: [
    { value: "contactId", label: "Contact ID" },
    { value: "contactName", label: "Contact Name" },
    { value: "contactEmail", label: "Contact Email" },
    { value: "contactPhone", label: "Contact Phone" },
    { value: "source", label: "Source" },
    { value: "message", label: "Message" },
    { value: "interest", label: "Interest" },
    { value: "budget", label: "Budget" },
    { value: "urgency", label: "Urgency" },
  ],
  property: [
    { value: "title", label: "Title" },
    { value: "description", label: "Description" },
    { value: "propertyType", label: "Property Type" },
    { value: "status", label: "Status" },
    { value: "price", label: "Price" },
    { value: "bedrooms", label: "Bedrooms" },
    { value: "bathrooms", label: "Bathrooms" },
    { value: "areaSqft", label: "Area (sqft)" },
    { value: "location", label: "Location" },
    { value: "address", label: "Address" },
  ],
  project: [
    { value: "name", label: "Name" },
    { value: "description", label: "Description" },
    { value: "location", label: "Location" },
    { value: "address", label: "Address" },
    { value: "reraId", label: "RERA ID" },
    { value: "status", label: "Status" },
    { value: "possessionDate", label: "Possession Date" },
  ],
  channelPartner: [
    { value: "name", label: "Name" },
    { value: "email", label: "Email" },
    { value: "phone", label: "Phone" },
    { value: "company", label: "Company" },
    { value: "commissionRate", label: "Commission Rate (%)" },
  ],
};

const ENTITY_LABELS: Record<Entity, string> = {
  contact: "Contacts",
  lead: "Leads",
  property: "Properties",
  project: "Projects",
  channelPartner: "Agents",
};

function initialEntity(): Entity {
  const hash = window.location.hash.replace(/^#/, "");
  const query = hash.split("?")[1] || "";
  const entity = new URLSearchParams(query).get("entity");
  return entity && entity in FIELD_OPTIONS ? (entity as Entity) : "contact";
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 1) return { headers: [], rows: [] };
  const parse = (line: string) => {
    const r: string[] = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === "," && !q) { r.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    r.push(cur.trim());
    return r;
  };
  const headers = parse(lines[0]);
  const rows = lines.slice(1).map(parse).filter((r) => r.some((v) => v));
  return { headers, rows };
}

export default function ImportPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "map" | "done">("upload");
  const [entity, setEntity] = useState<Entity>(initialEntity);
  const [csvText, setCsvText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<ColumnMap[]>([]);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const dataRows = csvText ? parseCSV(csvText).rows : [];

  const refreshLogs = async () => {
    try {
      const r = await api("/import-export/logs");
      setLogs(r.data || r || []);
    } catch {}
  };

  useEffect(() => { refreshLogs(); }, []);

  const handleStartNew = () => { setStep("upload"); setLastResult(null); setCsvText(""); setHeaders([]); setPreview([]); setColumnMap([]); };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const { headers: h, rows } = parseCSV(text);
    if (h.length === 0) return toast.error("Empty or invalid CSV");
    setCsvText(text);
    setHeaders(h);
    setPreview(rows.slice(0, 5));
    const options = FIELD_OPTIONS[entity];
    setColumnMap(h.map((csvCol) => {
      const match = options.find((o) => o.value.toLowerCase() === csvCol.toLowerCase());
      return { csvCol, field: match?.value || "" };
    }));
    setStep("map");
  };

  const handleImport = async () => {
    const mappedHeaders = columnMap.filter((m) => m.field).map((m) => m.field);
    if (mappedHeaders.length === 0) return toast.error("Map at least one column");

    const lines = csvText.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
    const oldHeaders = parseCSV(csvText).headers;
    const colIndex = oldHeaders.map((h) => columnMap.find((m) => m.csvCol === h)?.field || "");

    const newLines = [mappedHeaders.join(",")];
    const dataRows = parseCSV(csvText).rows;
    for (const row of dataRows) {
      const mapped = colIndex.map((field, i) => (field ? row[i] || "" : ""));
      newLines.push(mapped.map((v) => `"${v.replace(/"/g, '""')}"`).join(","));
    }

    const newCsv = newLines.join("\n");
    const blob = new Blob([newCsv], { type: "text/csv" });
    const formData = new FormData();
    formData.append("file", blob, "import.csv");
    formData.append("entity", entity);

    setImporting(true);
    try {
      const { id } = await api("/import/start", {
        method: "POST",
        body: JSON.stringify({ totalRows: dataRows.length }),
      });
      const result = await apiUpload(`/import/${id}/process`, formData);
      setLastResult(result);
      setStep("done");
      refreshLogs();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  };

  const statusIcon = (s: string) => {
    if (s === "completed") return <CheckCircle size={14} className="text-green-500" />;
    if (s === "completed_with_errors") return <AlertTriangle size={14} className="text-amber-500" />;
    return <RefreshCw size={14} className="text-blue-500 animate-spin" />;
  };

  const fieldLabel = (v: string) => FIELD_OPTIONS[entity].find((o) => o.value === v)?.label || v;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Import Data</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Upload a CSV file to import contacts or leads</p>
        </div>
        <button onClick={handleStartNew} className="text-sm text-[var(--primary)] hover:underline">New Import</button>
      </div>

      {step === "upload" && (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <div className="flex justify-center mb-4"><div className="h-12 w-12 rounded-full bg-[var(--primary)]/10 flex items-center justify-center"><Upload size={20} className="text-[var(--primary)]" /></div></div>
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">Upload CSV File</h2>
          <p className="text-sm text-[var(--muted-foreground)] mb-4">Columns should include name, email, phone, company, etc.</p>
          <div className="flex items-center justify-center flex-wrap gap-3 mb-4">
            {(Object.keys(ENTITY_LABELS) as Entity[]).map((e) => (
              <label key={e} className="flex items-center gap-2 text-sm">
                <input type="radio" checked={entity === e} onChange={() => setEntity(e)} />
                {ENTITY_LABELS[e]}
              </label>
            ))}
          </div>
          <input ref={fileInput} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          <button onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
            <Upload size={16} /> Choose CSV File
          </button>
        </div>
      )}

      {step === "map" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">Preview ({preview.length} rows)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr>{headers.map((h) => <th key={h} className="text-left px-2 py-1 text-[var(--muted-foreground)] font-medium border-b border-[var(--border)]">{h}</th>)}</tr></thead>
                <tbody>{preview.map((row, i) => <tr key={i}>{row.map((v, j) => <td key={j} className="px-2 py-1 border-b border-[var(--border)] text-[var(--foreground)] truncate max-w-[200px]">{v}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">Column Mapping</h2>
            <div className="space-y-2">
              {columnMap.map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-[var(--muted-foreground)] w-32 truncate">{m.csvCol}</span>
                  <span className="text-[var(--muted-foreground)]">→</span>
                  <select value={m.field} onChange={(e) => { const n = [...columnMap]; n[i] = { ...n[i], field: e.target.value }; setColumnMap(n); }}
                    className="flex-1 h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20">
                    <option value="">Skip</option>
                    {FIELD_OPTIONS[entity].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {m.field && <span className="text-xs text-[var(--primary)]">{fieldLabel(m.field)}</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setStep("upload")} className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)]">Back</button>
            <button onClick={handleImport} disabled={importing} className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {importing ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
              {importing ? "Importing..." : `Import ${dataRows?.length || 0} ${entity}s`}
            </button>
          </div>
        </div>
      )}

      {step === "done" && lastResult && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
          {lastResult.failed === 0 ? (
            <div className="mb-4"><div className="h-12 w-12 mx-auto rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center"><CheckCircle size={20} className="text-green-600" /></div></div>
          ) : (
            <div className="mb-4"><div className="h-12 w-12 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center"><AlertTriangle size={20} className="text-amber-600" /></div></div>
          )}
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">Import Complete</h2>
          <p className="text-sm text-[var(--muted-foreground)] mb-4">
            {lastResult.processed} imported, {lastResult.failed} failed
          </p>
          {lastResult.errors?.length > 0 && (
            <div className="text-left max-h-32 overflow-y-auto bg-[var(--muted)] rounded-lg p-3 text-xs text-red-500 space-y-1">
              {lastResult.errors.map((e: string, i: number) => <div key={i}>{e}</div>)}
            </div>
          )}
          <button onClick={() => { setStep("upload"); setLastResult(null); }} className="mt-4 inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90">
            Import Another File
          </button>
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">Import History</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] text-center py-6">No imports yet</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                <div className="flex items-center gap-3">
                  {statusIcon(log.status)}
                  <div>
                    <span className="text-sm text-[var(--foreground)]">{log.type === "import" ? "Import" : "Export"}</span>
                    <span className="text-xs text-[var(--muted-foreground)] ml-2">{new Date(log.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {log.processedRows || 0} / {log.totalRows || 0} rows
                  {log.fileUrl && <a href={log.fileUrl} className="ml-2 text-[var(--primary)] hover:underline"><Download size={12} /></a>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
