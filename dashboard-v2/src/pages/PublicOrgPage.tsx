import React, { useState, useEffect } from 'react';
import { fetchPublicProfileBySlug } from '../lib/data';
import { resolveMediaUrl } from '../lib/api';

const formatPrice = (p?: number) => {
  if (!p) return 'Price on request';
  if (p >= 10000000) return `₹${(p / 10000000).toFixed(2)} Cr`;
  if (p >= 100000) return `₹${(p / 100000).toFixed(2)} L`;
  return `₹${p.toLocaleString()}`;
};

const waLink = (whatsapp?: string) => whatsapp ? `https://wa.me/${whatsapp.replace(/[^\d]/g, '')}` : null;

export default function PublicOrgPage({ slug }: { slug: string }) {
  const [profile, setProfile] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchPublicProfileBySlug(slug).then(setProfile).catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) return <div className="min-h-screen flex items-center justify-center text-gray-500">Profile not found.</div>;
  if (!profile) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {profile.coverImageUrl && <img src={profile.coverImageUrl} alt="" className="w-full h-48 object-cover rounded-xl mb-6" />}
        <h1 className="text-3xl font-bold text-gray-900">{profile.companyName}</h1>
        {profile.tagline && <p className="text-lg text-gray-600 mt-1">{profile.tagline}</p>}
        <div className="flex gap-6 mt-4 text-sm text-gray-500">
          {profile.yearsExperience && <span>{profile.yearsExperience} years experience</span>}
          {profile.eventsExecuted && <span>{profile.eventsExecuted} events executed</span>}
          {profile.city && <span>{profile.city}</span>}
        </div>
        {profile.about && <p className="mt-6 text-gray-700 leading-relaxed">{profile.about}</p>}
        {(profile.servicesOffered || []).length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {profile.servicesOffered.map((s: string) => (
              <span key={s} className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">{s}</span>
            ))}
          </div>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          {profile.phone && <span>{profile.phone}</span>}
          {profile.email && <span>{profile.email}</span>}
          {profile.website && <a href={profile.website} className="text-blue-600 hover:underline">{profile.website}</a>}
          {waLink(profile.whatsapp) && (
            <a href={waLink(profile.whatsapp)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-white font-medium hover:bg-emerald-700 transition-colors">
              Message on WhatsApp
            </a>
          )}
        </div>

        {(profile.properties || []).length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {profile.properties.length} listing{profile.properties.length === 1 ? '' : 's'}
            </h2>
            <div className="space-y-4">
              {profile.properties.map((property: any) => (
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
        )}
      </div>
    </div>
  );
}
