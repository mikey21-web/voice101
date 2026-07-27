import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Plus, Search, Edit2, Trash2, Building2, MapPin, BedDouble, Bath, Maximize, IndianRupee, ToggleLeft, ToggleRight, X, Image as ImageIcon, FileText, Upload, LayoutGrid, Layers, ExternalLink } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { api, apiUpload, resolveMediaUrl } from "../lib/api";
import toast from "react-hot-toast";
import { Dialog } from "../components/ui/dialog";

const statusColors: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  SOLD: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  UNDER_OFFER: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  ON_HOLD: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  RENTED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const typeLabels: Record<string, string> = {
  APARTMENT: "Apartment", VILLA: "Villa", PLOT: "Plot", COMMERCIAL: "Commercial",
  PENTHOUSE: "Penthouse", DUPLEX: "Duplex", STUDIO: "Studio",
};

const statusOptions = Object.keys(statusColors);
const typeOptions = Object.entries(typeLabels);

export default function PropertiesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ propertyType: "", status: "", bedrooms: "" });
  const [groupByArea, setGroupByArea] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({
    title: "", description: "", propertyType: "APARTMENT", price: "", bedrooms: "", bathrooms: "",
    areaSqft: "", location: "", address: "", features: "", amenities: "", reraId: "", status: "AVAILABLE",
  });
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingBrochure, setPendingBrochure] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const brochureInputRef = useRef<HTMLInputElement>(null);

  const webverseProperties = [
    {
      id: "vezraa-apartments", title: "Vezraa Apartments", propertyType: "APARTMENT", status: "AVAILABLE",
      price: 75000000, bedrooms: 4, bathrooms: 4, areaSqft: 3090,
      location: "Mokila, Hyderabad", description: "3D interactive tour of Vezraa Apartments",
      images: [{ url: "https://realestate.deploysafe.in/vezraa-apartments/assets/gallery/entrance%20gate.webp" }],
      brochureUrl: null, featured: true, webverse: "../vezraa-apartments/index.html",
    },
    {
      id: "vezraa-villas", title: "Vezraa Villas", propertyType: "VILLA", status: "AVAILABLE",
      price: 120000000, bedrooms: 4, bathrooms: 5, areaSqft: 4500,
      location: "Coming Soon", description: "3D interactive tour of Vezraa Villas",
      images: [{ url: "https://realestate.deploysafe.in/vezraa-villas/assets/frontview/11.0_north.webp" }],
      brochureUrl: null, featured: true, webverse: "../vezraa-villas/index.html",
    },
  ];

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: groupByArea ? "1" : String(page), limit: groupByArea ? "200" : "20" });
      if (search) params.set("location", search);
      if (filters.propertyType) params.set("propertyType", filters.propertyType);
      if (filters.status) params.set("status", filters.status);
      if (filters.bedrooms) params.set("bedrooms", filters.bedrooms);
      const res = await api(`/properties?${params}`);
      const apiProperties = res.data || [];
      setProperties([...webverseProperties, ...apiProperties]);
      setTotal((res.meta?.total || 0) + 2);
    } catch { toast.error("Failed to load properties"); }
    finally { setLoading(false); }
  }, [page, search, filters, groupByArea]);

  const areaCollections = useMemo(() => {
    if (!groupByArea) return [];
    const groups = new Map<string, any[]>();
    for (const p of properties) {
      const area = (p.location || "").trim() || "Unspecified area";
      if (!groups.has(area)) groups.set(area, []);
      groups.get(area)!.push(p);
    }
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [groupByArea, properties]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const handleSave = async () => {
    try {
      const payload: any = {
        title: form.title,
        propertyType: form.propertyType || undefined,
        price: form.price ? Number(form.price) : undefined,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
        areaSqft: form.areaSqft ? Number(form.areaSqft) : undefined,
        location: form.location || undefined,
        address: form.address || undefined,
        description: form.description || undefined,
        features: form.features ? form.features.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
        amenities: form.amenities ? form.amenities.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
        reraId: form.reraId || undefined,
        status: form.status || "AVAILABLE",
      };
      const headers = { "Content-Type": "application/json" };
      let propertyId = editing?.id;
      if (editing) {
        await api(`/properties/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload), headers });
        toast.success("Property updated");
      } else {
        const created = await api("/properties", { method: "POST", body: JSON.stringify(payload), headers });
        propertyId = created.id;
        toast.success("Property created");
      }

      if (propertyId && (pendingImages.length > 0 || pendingBrochure)) {
        setUploadingMedia(true);
        try {
          if (pendingImages.length > 0) {
            const fd = new FormData();
            pendingImages.forEach(f => fd.append("images", f));
            await apiUpload(`/properties/${propertyId}/images`, fd);
          }
          if (pendingBrochure) {
            const fd = new FormData();
            fd.append("brochure", pendingBrochure);
            await apiUpload(`/properties/${propertyId}/brochure`, fd);
          }
        } catch {
          toast.error("Property saved, but media upload failed");
        } finally {
          setUploadingMedia(false);
        }
      }

      setShowForm(false);
      setEditing(null);
      resetForm();
      fetchProperties();
    } catch { toast.error("Failed to save property"); }
  };

  const removeExistingImage = async (imageId: string) => {
    if (!editing) return;
    try {
      await api(`/properties/${editing.id}/images/${imageId}`, { method: "DELETE" });
      setEditing((prev: any) => ({ ...prev, images: prev.images.filter((img: any) => img.id !== imageId) }));
      toast.success("Image removed");
    } catch { toast.error("Failed to remove image"); }
  };

  const removeExistingBrochure = async () => {
    if (!editing) return;
    try {
      await api(`/properties/${editing.id}/brochure`, { method: "DELETE" });
      setEditing((prev: any) => ({ ...prev, brochureUrl: null }));
      toast.success("Brochure removed");
    } catch { toast.error("Failed to remove brochure"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this property?")) return;
    try {
      await api(`/properties/${id}`, { method: "DELETE" });
      toast.success("Property deleted");
      fetchProperties();
    } catch { toast.error("Failed to delete"); }
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    try {
      await api(`/properties/${id}`, { method: "PATCH", body: JSON.stringify({ featured: !current }), headers: { "Content-Type": "application/json" } });
      fetchProperties();
    } catch { toast.error("Failed to update"); }
  };

  const editProperty = (p: any) => {
    setForm({
      title: p.title || "",
      description: p.description || "",
      propertyType: p.propertyType || "APARTMENT",
      price: p.price?.toString() || "",
      bedrooms: p.bedrooms?.toString() || "",
      bathrooms: p.bathrooms?.toString() || "",
      areaSqft: p.areaSqft?.toString() || "",
      location: p.location || "",
      address: p.address || "",
      features: (p.features || []).join(", "),
      amenities: (p.amenities || []).join(", "),
      reraId: p.reraId || "",
      status: p.status || "AVAILABLE",
    });
    setEditing(p);
    setShowForm(true);
  };

  const resetForm = () => {
    setForm({
      title: "", description: "", propertyType: "APARTMENT", price: "", bedrooms: "", bathrooms: "",
      areaSqft: "", location: "", address: "", features: "", amenities: "", reraId: "", status: "AVAILABLE",
    });
    setPendingImages([]);
    setPendingBrochure(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    resetForm();
  };

  const formatPrice = (p: number) => {
    if (!p) return "-";
    if (p >= 10000000) return `\u20B9${(p / 10000000).toFixed(2)} Cr`;
    if (p >= 100000) return `\u20B9${(p / 100000).toFixed(2)} L`;
    return `\u20B9${p.toLocaleString()}`;
  };

  const renderCard = (p: any) => (
    <div
      key={p.id}
      onClick={() => { if (p.webverse) { window.open(p.webverse, "_blank"); } else { window.location.hash = `/properties/${p.id}`; } }}
      className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden group cursor-pointer hover:border-[var(--primary)]/40 transition-colors"
    >
      <div className="relative h-44 bg-[var(--muted)]">
        {p.images?.[0] ? (
          <img src={resolveMediaUrl(p.images[0].url)} alt={p.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <ExternalLink className="h-10 w-10 text-[var(--muted-foreground-light)]" />
          </div>
        )}
        <span className={`absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[p.status] || ""}`}>
          {p.status?.replace("_", " ")}
        </span>
        {!p.webverse && (
        <button
          onClick={(e) => { e.stopPropagation(); toggleFeatured(p.id, p.featured); }}
          title={p.featured ? "Featured" : "Mark as featured"}
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm"
        >
          {p.featured ? <ToggleRight className="h-4 w-4 text-[var(--primary)]" /> : <ToggleLeft className="h-4 w-4 text-[var(--muted-foreground)]" />}
        </button>
        )}
        {p.webverse && (
        <span className="absolute top-3 right-3 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
          3D Tour
        </span>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors truncate">
            {p.title}
          </span>
          <Badge variant="outline" className="shrink-0">{typeLabels[p.propertyType] || p.propertyType}</Badge>
        </div>

        {p.location && (
          <div className="mt-1 flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{p.location}</span>
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
          {p.bedrooms != null && <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {p.bedrooms} Bed</span>}
          {p.bathrooms != null && <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {p.bathrooms} Bath</span>}
          {p.areaSqft != null && <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" /> {p.areaSqft} sqft</span>}
        </div>

        <div className="mt-2 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> {p.images?.length ?? 0} photo{(p.images?.length ?? 0) === 1 ? "" : "s"}</span>
          <span className={`flex items-center gap-1 ${p.brochureUrl ? "" : "opacity-50"}`}><FileText className="h-3.5 w-3.5" /> {p.brochureUrl ? "Brochure ready" : "No brochure"}</span>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-base font-bold text-[var(--foreground)]">{formatPrice(p.price)}</span>
          {!p.webverse && (
          <div className="flex gap-1">
            <button onClick={(e) => { e.stopPropagation(); editProperty(p); }} className="p-1.5 hover:bg-[var(--accent)] rounded-lg"><Edit2 className="h-4 w-4" /></button>
            <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"><Trash2 className="h-4 w-4" /></button>
          </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Properties</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {total} listings{groupByArea ? ` across ${areaCollections.length} area${areaCollections.length === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            <button
              onClick={() => { setGroupByArea(false); setPage(1); }}
              title="Flat list"
              className={`p-2 ${!groupByArea ? "bg-[var(--accent)]" : ""}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setGroupByArea(true)}
              title="Preview as area collections (what Mikey can send)"
              className={`p-2 ${groupByArea ? "bg-[var(--accent)]" : ""}`}
            >
              <Layers className="h-4 w-4" />
            </button>
          </div>
          <a
            href="#/import?entity=property"
            className="inline-flex items-center h-9 px-4 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          >
            Import
          </a>
          <Button onClick={() => { resetForm(); setEditing(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Property
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input placeholder="Search by location..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <select value={filters.propertyType} onChange={e => { setFilters(f => ({ ...f, propertyType: e.target.value })); setPage(1); }} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm">
          <option value="">All Types</option>
          {typeOptions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm">
          <option value="">All Status</option>
          {statusOptions.map(k => <option key={k} value={k}>{k.replace("_", " ")}</option>)}
        </select>
        <select value={filters.bedrooms} onChange={e => { setFilters(f => ({ ...f, bedrooms: e.target.value })); setPage(1); }} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm">
          <option value="">All BHK</option>
          {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} BHK</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--muted-foreground)]">Loading...</div>
      ) : properties.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted-foreground)]">No properties found</div>
      ) : groupByArea ? (
        <div className="space-y-8">
          {areaCollections.map(([area, items]) => (
            <div key={area}>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-[var(--primary)]" />
                <h2 className="font-semibold text-[var(--foreground)]">{area}</h2>
                <Badge variant="outline">{items.length} listing{items.length === 1 ? "" : "s"}</Badge>
                <span className="text-xs text-[var(--muted-foreground)]">
                  This is what Mikey sends when a lead asks about {area}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.map((p: any) => renderCard(p))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {properties.map((p: any) => renderCard(p))}
        </div>
      )}

      {!groupByArea && total > 20 && (
        <div className="flex justify-center gap-2 items-center">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-[var(--muted-foreground)]">Page {page} of {Math.ceil(total / 20)}</span>
          <Button variant="outline" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      {showForm && (
        <Dialog
          open
          onClose={closeForm}
          title={editing ? "Edit Property" : "Add Property"}
          maxWidth="max-w-2xl"
          footer={
            <>
              <Button variant="outline" onClick={closeForm}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.title || uploadingMedia}>
                {uploadingMedia ? "Uploading..." : editing ? "Update" : "Create"}
              </Button>
            </>
          }
        >
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1">Title *</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. 3BHK Premium Apartment" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Type</label>
                <select value={form.propertyType} onChange={e => setForm(f => ({ ...f, propertyType: e.target.value }))} className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm">
                  {typeOptions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm">
                  {statusOptions.map(k => <option key={k} value={k}>{k.replace("_", " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1"><IndianRupee className="h-3 w-3 inline" /> Price</label>
                <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="In INR" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1"><BedDouble className="h-3 w-3 inline" /> Bedrooms</label>
                <Input type="number" value={form.bedrooms} onChange={e => setForm(f => ({ ...f, bedrooms: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1"><Bath className="h-3 w-3 inline" /> Bathrooms</label>
                <Input type="number" value={form.bathrooms} onChange={e => setForm(f => ({ ...f, bathrooms: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1"><Maximize className="h-3 w-3 inline" /> Area (sqft)</label>
                <Input type="number" value={form.areaSqft} onChange={e => setForm(f => ({ ...f, areaSqft: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1"><MapPin className="h-3 w-3 inline" /> Location</label>
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. HSR Layout, Bangalore" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1">Address</label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1">Features (comma separated)</label>
                <Input value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))} placeholder="Gated community, Power backup, Car parking" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1">Amenities (comma separated)</label>
                <Input value={form.amenities} onChange={e => setForm(f => ({ ...f, amenities: e.target.value }))} placeholder="Swimming pool, Gym, Clubhouse" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1">RERA ID</label>
                <Input value={form.reraId} onChange={e => setForm(f => ({ ...f, reraId: e.target.value }))} placeholder="PRM/KA/RERA/1251/446/AG/171104/001715" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 min-h-[80px] text-sm" placeholder="Property description..." />
              </div>

              <div className="col-span-2 space-y-3 pt-2 border-t border-[var(--border)]">
                <div>
                  <label className="text-sm font-medium block mb-1.5"><ImageIcon className="h-3.5 w-3.5 inline mr-1" /> Photos</label>
                  {editing?.images?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {editing.images.map((img: any) => (
                        <div key={img.id} className="relative group">
                          <img src={resolveMediaUrl(img.url)} alt="" className="h-16 w-16 rounded object-cover border border-[var(--border)]" />
                          <button type="button" onClick={() => removeExistingImage(img.id)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {pendingImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {pendingImages.map((f, i) => (
                        <div key={i} className="relative group">
                          <img src={URL.createObjectURL(f)} alt="" className="h-16 w-16 rounded object-cover border border-[var(--border)]" />
                          <button type="button" onClick={() => setPendingImages(prev => prev.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e => setPendingImages(prev => [...prev, ...Array.from(e.target.files || [])])} />
                  <Button type="button" variant="outline" onClick={() => imageInputRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" /> Add photos
                  </Button>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1.5"><FileText className="h-3.5 w-3.5 inline mr-1" /> Brochure (PDF)</label>
                  {editing?.brochureUrl && !pendingBrochure && (
                    <div className="flex items-center gap-2 mb-2 text-sm">
                      <a href={editing.brochureUrl} target="_blank" rel="noreferrer" className="text-[var(--primary)] hover:underline">View current brochure</a>
                      <button type="button" onClick={removeExistingBrochure} className="text-red-500 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                  {pendingBrochure && (
                    <div className="flex items-center gap-2 mb-2 text-sm">
                      <span className="text-[var(--muted-foreground)]">{pendingBrochure.name}</span>
                      <button type="button" onClick={() => setPendingBrochure(null)} className="text-red-500 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                  <input ref={brochureInputRef} type="file" accept="application/pdf" className="hidden"
                    onChange={e => setPendingBrochure(e.target.files?.[0] || null)} />
                  <Button type="button" variant="outline" onClick={() => brochureInputRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" /> {editing?.brochureUrl ? "Replace brochure" : "Add brochure"}
                  </Button>
                </div>
              </div>
            </div>
        </Dialog>
      )}
    </div>
  );
}
