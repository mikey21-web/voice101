import { useState, useEffect } from "react";
import {
  ArrowLeft, MapPin, BedDouble, Bath, Maximize,
  FileText, Building2, Loader2, ShieldCheck, Phone, Mail, TrendingUp, TrendingDown, Link2, Check,
} from "lucide-react";
import { api, resolveMediaUrl } from "../lib/api";
import { Badge } from "../components/ui/badge";
import toast from "react-hot-toast";

function getPropertyId() {
  const hash = window.location.hash.replace("#", "");
  return hash.split("/")[2] || "";
}

const statusColors: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-800",
  SOLD: "bg-red-100 text-red-800",
  UNDER_OFFER: "bg-yellow-100 text-yellow-800",
  ON_HOLD: "bg-orange-100 text-orange-800",
  RENTED: "bg-blue-100 text-blue-800",
  DRAFT: "bg-gray-100 text-gray-800",
};

const typeLabels: Record<string, string> = {
  APARTMENT: "Apartment", VILLA: "Villa", PLOT: "Plot", COMMERCIAL: "Commercial",
  PENTHOUSE: "Penthouse", DUPLEX: "Duplex", STUDIO: "Studio",
};

const formatPrice = (p: number) => {
  if (!p) return "-";
  if (p >= 10000000) return `₹${(p / 10000000).toFixed(2)} Cr`;
  if (p >= 100000) return `₹${(p / 100000).toFixed(2)} L`;
  return `₹${p.toLocaleString()}`;
};

export default function PropertyDetailPage() {
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [agent, setAgent] = useState<any>(null);
  const [similar, setSimilar] = useState<any[]>([]);
  const [marketAvgPerSqft, setMarketAvgPerSqft] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const copyShareLink = async () => {
    try {
      const { url } = await api(`/properties/${property.id}/public-link`);
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      toast.success("Listing link copied");
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate link");
    }
  };

  useEffect(() => {
    const id = getPropertyId();
    if (!id) return;
    setLoading(true);
    setAgent(null);
    setSimilar([]);
    setMarketAvgPerSqft(null);

    api(`/properties/${id}`)
      .then(async (p: any) => {
        setProperty(p);
        setActiveImage(0);

        const agentId = p.metadata?.assignedAgentId;
        if (agentId) {
          api(`/channel-partners/${agentId}`).then(setAgent).catch(() => {});
        }

        // Real data only: pull other listings to find same-type comps and
        // compute an actual market average, not a fabricated trend.
        api(`/properties?propertyType=${p.propertyType}&limit=50`).then((res: any) => {
          const others = (res.data || []).filter((o: any) => o.id !== p.id);
          setSimilar(others.slice(0, 3));

          const withPrice = (res.data || []).filter((o: any) => o.price && o.areaSqft);
          if (withPrice.length > 1) {
            const avg = withPrice.reduce((sum: number, o: any) => sum + o.price / o.areaSqft, 0) / withPrice.length;
            setMarketAvgPerSqft(avg);
          }
        }).catch(() => {});
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="p-6 text-center text-[var(--muted-foreground)]">
        Property not found.
        <a href="#/properties" className="block mt-2 text-[var(--primary)] hover:underline">Back to Properties</a>
      </div>
    );
  }

  const images = property.images || [];

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in max-w-5xl">
      <a href="#/properties" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Properties
      </a>

      {/* Gallery */}
      <div className="rounded-xl overflow-hidden border border-[var(--border)]">
        <div className="h-80 bg-[var(--muted)]">
          {images.length > 0 ? (
            <img src={resolveMediaUrl(images[activeImage]?.url)} alt={property.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Building2 className="h-16 w-16 text-[var(--muted-foreground-light)]" />
            </div>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 p-3 bg-[var(--card)] overflow-x-auto">
            {images.map((img: any, i: number) => (
              <button
                key={img.id}
                onClick={() => setActiveImage(i)}
                className={`h-16 w-16 shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${i === activeImage ? "border-[var(--primary)]" : "border-transparent"}`}
              >
                <img src={resolveMediaUrl(img.url)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline">{typeLabels[property.propertyType] || property.propertyType}</Badge>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[property.status] || ""}`}>
              {property.status?.replace("_", " ")}
            </span>
            {property.featured && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--primary-light)] text-[var(--primary)]">
                Featured
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{property.title}</h1>
          {property.location && (
            <div className="mt-1 flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
              <MapPin className="h-4 w-4" /> {property.address || property.location}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-2xl font-bold text-[var(--foreground)]">{formatPrice(property.price)}</div>
          {property.reraId && (
            <div className="mt-1 flex items-center gap-1 text-xs text-[var(--muted-foreground)] justify-end">
              <ShieldCheck className="h-3.5 w-3.5" /> RERA: {property.reraId}
            </div>
          )}
        </div>
      </div>

      {/* Specs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-center">
          <BedDouble className="h-5 w-5 mx-auto text-[var(--primary)]" />
          <div className="mt-1.5 text-lg font-bold text-[var(--foreground)]">{property.bedrooms ?? "-"}</div>
          <div className="text-xs text-[var(--muted-foreground)]">Bedrooms</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-center">
          <Bath className="h-5 w-5 mx-auto text-[var(--primary)]" />
          <div className="mt-1.5 text-lg font-bold text-[var(--foreground)]">{property.bathrooms ?? "-"}</div>
          <div className="text-xs text-[var(--muted-foreground)]">Bathrooms</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-center">
          <Maximize className="h-5 w-5 mx-auto text-[var(--primary)]" />
          <div className="mt-1.5 text-lg font-bold text-[var(--foreground)]">{property.areaSqft ?? "-"}</div>
          <div className="text-xs text-[var(--muted-foreground)]">Sqft</div>
        </div>
      </div>

      {/* Description */}
      {property.description && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="font-semibold text-sm text-[var(--foreground)] mb-2">Description</h3>
          <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-line">{property.description}</p>
        </div>
      )}

      {/* Features & amenities */}
      {(property.features?.length > 0 || property.amenities?.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {property.features?.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h3 className="font-semibold text-sm text-[var(--foreground)] mb-2">Features</h3>
              <div className="flex flex-wrap gap-1.5">
                {property.features.map((f: string) => (
                  <span key={f} className="text-xs px-2 py-1 rounded-full bg-[var(--muted)] text-[var(--foreground)]">{f}</span>
                ))}
              </div>
            </div>
          )}
          {property.amenities?.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h3 className="font-semibold text-sm text-[var(--foreground)] mb-2">Amenities</h3>
              <div className="flex flex-wrap gap-1.5">
                {property.amenities.map((a: string) => (
                  <span key={a} className="text-xs px-2 py-1 rounded-full bg-[var(--muted)] text-[var(--foreground)]">{a}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {property.brochureUrl && (
          <a
            href={property.brochureUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          >
            <FileText className="h-4 w-4" /> View Brochure
          </a>
        )}
        <button
          onClick={copyShareLink}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
        >
          {linkCopied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          {linkCopied ? "Copied" : "Copy Shareable Link"}
        </button>
      </div>

      {/* Listed by */}
      {agent && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="font-semibold text-sm text-[var(--foreground)] mb-3">Listed By</h3>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <a href={`#/channel-partners/${agent.id}`} className="flex items-center gap-3 group min-w-0">
              <div className="h-12 w-12 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center font-bold shrink-0 overflow-hidden">
                {agent.metadata?.photoUrl ? (
                  <img src={resolveMediaUrl(agent.metadata.photoUrl)} alt="" className="h-full w-full object-cover" />
                ) : (
                  agent.name?.[0]?.toUpperCase() || "?"
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors truncate">{agent.name}</p>
                <p className="text-xs text-[var(--muted-foreground)] truncate">{agent.company || "Independent Agent"}</p>
              </div>
            </a>
            <div className="flex gap-2 shrink-0">
              {agent.phone && (
                <a href={`tel:${agent.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">
                  <Phone className="h-3.5 w-3.5" /> Call
                </a>
              )}
              {agent.email && (
                <a href={`mailto:${agent.email}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">
                  <Mail className="h-3.5 w-3.5" /> Email
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Price analytics — real derived numbers, not a fabricated trend chart */}
      {property.price && property.areaSqft && marketAvgPerSqft && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="font-semibold text-sm text-[var(--foreground)] mb-3">Price Analytics</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-[var(--muted)] px-4 py-3">
              <p className="text-[10px] text-[var(--muted-foreground)] uppercase">This Listing</p>
              <p className="text-lg font-bold text-[var(--foreground)] mt-0.5">₹{Math.round(property.price / property.areaSqft).toLocaleString()}<span className="text-xs font-normal text-[var(--muted-foreground)]">/sqft</span></p>
            </div>
            <div className="rounded-lg bg-[var(--muted)] px-4 py-3">
              <p className="text-[10px] text-[var(--muted-foreground)] uppercase">{typeLabels[property.propertyType] || property.propertyType} Avg.</p>
              <p className="text-lg font-bold text-[var(--foreground)] mt-0.5">₹{Math.round(marketAvgPerSqft).toLocaleString()}<span className="text-xs font-normal text-[var(--muted-foreground)]">/sqft</span></p>
            </div>
          </div>
          {(() => {
            const thisPerSqft = property.price / property.areaSqft;
            const diffPct = ((thisPerSqft - marketAvgPerSqft) / marketAvgPerSqft) * 100;
            const isAbove = diffPct > 2;
            const isBelow = diffPct < -2;
            if (!isAbove && !isBelow) return null;
            return (
              <div className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${isAbove ? "text-amber-600" : "text-emerald-600"}`}>
                {isAbove ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {Math.abs(diffPct).toFixed(0)}% {isAbove ? "above" : "below"} average for this property type
              </div>
            );
          })()}
        </div>
      )}

      {/* Similar properties — real listings of the same type, not filler */}
      {similar.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm text-[var(--foreground)] mb-3">Similar Properties</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {similar.map((p: any) => (
              <a
                key={p.id}
                href={`#/properties/${p.id}`}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden hover:border-[var(--primary)]/40 transition-colors block"
              >
                <div className="h-28 bg-[var(--muted)]">
                  {p.images?.[0] ? (
                    <img src={resolveMediaUrl(p.images[0].url)} alt={p.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-[var(--muted-foreground-light)]" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-[var(--foreground)] truncate">{p.title}</p>
                  <p className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">{p.location}</p>
                  <p className="text-sm font-bold text-[var(--foreground)] mt-1.5">{formatPrice(p.price)}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
