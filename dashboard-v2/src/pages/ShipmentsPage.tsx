import { useState, useEffect, useCallback } from "react";
import { Search, Truck, MapPin, Weight, Calendar, IndianRupee, RefreshCw, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { api } from "../lib/api";
import toast from "react-hot-toast";

const statusColors: Record<string, string> = {
  QUOTE_REQUESTED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  QUOTE_SENT: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  BOOKED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  PICKED_UP: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  IN_TRANSIT: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  OUT_FOR_DELIVERY: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  DELIVERED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  EXCEPTION: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
};

const statusOptions = Object.keys(statusColors);

const typeLabels: Record<string, string> = {
  FTL: "FTL", LTL: "LTL", AIR_FREIGHT: "Air Freight", SEA_FREIGHT: "Sea Freight",
  EXPRESS: "Express", COURIER: "Courier",
};

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await api(`/shipments?${params}`);
      setShipments(res.data || []);
      setTotal(res.meta?.total || 0);
    } catch { toast.error("Failed to load shipments"); }
    finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  const formatPrice = (p: number) => {
    if (!p) return "-";
    if (p >= 10000000) return `\u20B9${(p / 10000000).toFixed(2)}Cr`;
    if (p >= 100000) return `\u20B9${(p / 100000).toFixed(2)}L`;
    return `\u20B9${p.toLocaleString()}`;
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Shipments</h1>
          <p className="text-sm text-[var(--muted-foreground)]">{total} shipments</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input placeholder="Search origin, destination, tracking..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm">
          <option value="">All Status</option>
          {statusOptions.map(k => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={() => fetchShipments()}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-[var(--muted-foreground)]">Loading...</div>
        ) : shipments.length === 0 ? (
          <div className="text-center py-12 text-[var(--muted-foreground)]">No shipments found</div>
        ) : shipments.map((s: any) => (
          <div key={s.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="h-4 w-4 text-[var(--muted-foreground)]" />
                  <span className="font-semibold text-sm text-[var(--foreground)]">{s.title || `Shipment #${s.trackingNumber?.slice(-6)}`}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[s.status] || ""}`}>
                    {s.status?.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-[var(--muted-foreground)] mb-0.5"><MapPin className="h-3 w-3 inline mr-1" />Route</p>
                    <p className="text-[var(--foreground)] font-medium">{s.origin} <ChevronRight className="h-3 w-3 inline mx-1" /> {s.destination}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted-foreground)] mb-0.5"><Weight className="h-3 w-3 inline mr-1" />Cargo</p>
                    <p className="text-[var(--foreground)]">{s.weight ? `${s.weight} kg` : "-"} {s.shipmentType ? `(${typeLabels[s.shipmentType] || s.shipmentType})` : ""}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted-foreground)] mb-0.5"><IndianRupee className="h-3 w-3 inline mr-1" />Quote</p>
                    <p className="text-[var(--foreground)] font-mono">{s.quotedPrice ? formatPrice(s.quotedPrice) : "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted-foreground)] mb-0.5"><Calendar className="h-3 w-3 inline mr-1" />Pickup</p>
                    <p className="text-[var(--foreground)]">{s.pickupDate ? new Date(s.pickupDate).toLocaleDateString() : "TBD"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-2 text-xs text-[var(--muted-foreground)]">
                  {s.carrierName && <span>Carrier: {s.carrierName}</span>}
                  {s.trackingNumber && <span className="font-mono">Track: {s.trackingNumber}</span>}
                  {s.lead?.contact?.name && <span>Shipper: {s.lead.contact.name}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {total > 20 && (
        <div className="flex justify-center gap-2 items-center">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-[var(--muted-foreground)]">Page {page} of {Math.ceil(total / 20)}</span>
          <Button variant="outline" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
