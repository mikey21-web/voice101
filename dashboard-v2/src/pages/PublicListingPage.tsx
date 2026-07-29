import React, { useState, useEffect } from 'react';
import { fetchPublicListingBySlug } from '../lib/data';
import { resolveMediaUrl } from '../lib/api';

const formatPrice = (p?: number) => {
  if (!p) return 'Price on request';
  if (p >= 10000000) return `₹${(p / 10000000).toFixed(2)} Cr`;
  if (p >= 100000) return `₹${(p / 100000).toFixed(2)} L`;
  return `₹${p.toLocaleString()}`;
};

const waLink = (whatsapp?: string, title?: string) => whatsapp
  ? `https://wa.me/${whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(`Hi, I'm interested in ${title || 'this listing'}`)}`
  : null;

export default function PublicListingPage({ slug }: { slug: string }) {
  const [property, setProperty] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    fetchPublicListingBySlug(slug).then(setProperty).catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) return <div className="min-h-screen flex items-center justify-center text-gray-500">Listing not found.</div>;
  if (!property) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;

  const images = property.images || [];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {images.length > 0 && (
          <div className="mb-6">
            <img
              src={resolveMediaUrl(images[activeImage]?.url)}
              alt=""
              className="w-full h-80 object-cover rounded-xl"
            />
            {images.length > 1 && (
              <div className="flex gap-2 mt-2 overflow-x-auto">
                {images.map((img: any, i: number) => (
                  <img
                    key={img.id || i}
                    src={resolveMediaUrl(img.url)}
                    alt=""
                    onClick={() => setActiveImage(i)}
                    className={`w-20 h-16 object-cover rounded-lg cursor-pointer shrink-0 ${i === activeImage ? 'ring-2 ring-emerald-600' : 'opacity-70'}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <h1 className="text-2xl font-bold text-gray-900">{property.title}</h1>
        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
          {property.location && <span>{property.location}</span>}
          {property.bedrooms != null && <span>{property.bedrooms} BHK</span>}
          {property.areaSqft && <span>{property.areaSqft} {property.areaUnit || 'sqft'}</span>}
        </div>
        <div className="mt-4 text-2xl font-semibold text-emerald-700">{formatPrice(property.price)}</div>

        {waLink(property.whatsapp, property.title) && (
          <a
            href={waLink(property.whatsapp, property.title)!}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            Message on WhatsApp
          </a>
        )}

        {property.description && <p className="mt-6 text-gray-700 leading-relaxed whitespace-pre-line">{property.description}</p>}

        {(property.amenities || []).length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {property.amenities.map((a: string) => (
              <span key={a} className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">{a}</span>
            ))}
          </div>
        )}

        {property.brochureUrl && (
          <a
            href={resolveMediaUrl(property.brochureUrl)}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-block px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
          >
            Download brochure
          </a>
        )}
      </div>
    </div>
  );
}
