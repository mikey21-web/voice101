import React, { useState, useEffect } from 'react';
import { fetchPublicCollection } from '../lib/data';
import { resolveMediaUrl } from '../lib/api';

const formatPrice = (p?: number) => {
  if (!p) return 'Price on request';
  if (p >= 10000000) return `₹${(p / 10000000).toFixed(2)} Cr`;
  if (p >= 100000) return `₹${(p / 100000).toFixed(2)} L`;
  return `₹${p.toLocaleString()}`;
};

export default function PublicCollectionPage({ slugs }: { slugs: string[] }) {
  const [properties, setProperties] = useState<any[] | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchPublicCollection(slugs).then(setProperties).catch(() => setNotFound(true));
  }, [slugs.join(',')]);

  if (notFound) return <div className="min-h-screen flex items-center justify-center text-gray-500">Collection not found.</div>;
  if (!properties) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-xl font-bold text-gray-900 mb-1">{properties.length} propert{properties.length === 1 ? 'y' : 'ies'} for you</h1>
        <p className="text-sm text-gray-500 mb-6">Tap any listing to see full details, photos and brochure.</p>

        <div className="space-y-4">
          {properties.map((property: any) => (
            <a
              key={property.id}
              href={`#/listing/${property.slug}`}
              className="flex gap-4 rounded-xl border border-gray-200 p-3 hover:border-emerald-600 transition-colors"
            >
              {property.images?.[0]?.url ? (
                <img src={resolveMediaUrl(property.images[0].url)} alt="" className="w-28 h-24 object-cover rounded-lg shrink-0" />
              ) : (
                <div className="w-28 h-24 rounded-lg bg-gray-100 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 truncate">{property.title}</div>
                <div className="text-sm text-gray-500">
                  {property.location}{property.bedrooms != null ? ` · ${property.bedrooms} BHK` : ''}
                </div>
                <div className="mt-1 font-semibold text-emerald-700">{formatPrice(property.price)}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
