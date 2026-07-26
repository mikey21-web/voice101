export const PAGE_MAP: Record<string, string> = {
  leads: '/leads', contacts: '/contacts', tickets: '/tickets',
  campaigns: '/campaigns', analytics: '/analytics', mikey: '/mikey',
  pipeline: '/pipeline', overview: '/', crm: '/crm', inbox: '/messages',
  'qr-codes': '/qr-codes', qr: '/qr-codes', qrcodes: '/qr-codes',
  settings: '/settings', events: '/events', bookings: '/bookings',
  conversions: '/conversions', reports: '/reports', tasks: '/tasks',
  properties: '/properties', shipments: '/shipments', flows: '/flows',
  invoices: '/invoices', quotations: '/quotations', contracts: '/contracts',
  team: '/team', timesheet: '/timesheet', inventory: '/inventory',
  'purchase-orders': '/purchase-orders', 'vendor-bookings': '/vendor-bookings',
  media: '/media', templates: '/templates',
  scoring: '/scoring', routing: '/routing', webhooks: '/webhooks',
  forms: '/forms', 'sync-logs': '/sync-logs', 'audit-logs': '/audit-logs',
  health: '/health', import: '/import', advanced: '/advanced',
};

export const PAGE_ALIASES: Record<string, string> = {
  'qr code': 'qr-codes', 'qr codes': 'qr-codes',
  settings: 'settings', 'setting': 'settings',
  integrations: 'integrations', events: 'events', event: 'events',
  campaign: 'campaigns', ticket: 'tickets', support: 'tickets',
  contact: 'contacts', task: 'tasks', team: 'team',
  reports: 'reports', report: 'reports',
  dashboard: 'overview', home: 'overview', inbox: 'inbox',
};

// Edit distance, capped: anything past `max` is "not a match" so we bail early.
function withinEditDistance(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      best = Math.min(best, row[j]);
    }
    if (best > max) return false;
    prev = row;
  }
  return prev[b.length] <= max;
}

// Several keys share a path ("qr", "qrcodes", "qr-codes"). Downstream consumers
// key pending filters by page name, so always hand back one canonical name.
export function canonical(page: string): string {
  const path = PAGE_MAP[page];
  return Object.keys(PAGE_MAP).find(k => PAGE_MAP[k] === path && '/' + k === path) || page;
}

// Match a transcript word against a known page name. Tolerates typos and
// mispronunciation ("campain", "analitycs") without the old character-overlap
// heuristic, which matched almost any word to some page and sent people to
// random screens.
export function fuzzyPageMatch(text: string): string | null {
  const names = Object.keys(PAGE_MAP);
  const words = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/).filter(Boolean);

  for (const w of words) {
    if (PAGE_MAP[w]) return w;
    const aliased = PAGE_ALIASES[w];
    if (aliased && PAGE_MAP[aliased]) return aliased;
  }
  // Two-word pages ("qr codes", "purchase orders") and their aliases.
  for (let i = 0; i < words.length - 1; i++) {
    const pair = `${words[i]} ${words[i + 1]}`;
    const hyphen = `${words[i]}-${words[i + 1]}`;
    if (PAGE_MAP[hyphen]) return hyphen;
    const aliased = PAGE_ALIASES[pair];
    if (aliased && PAGE_MAP[aliased]) return aliased;
  }
  // Typo tolerance: 1 edit for short names, 2 for longer ones.
  for (const w of words) {
    if (w.length < 4) continue;
    for (const name of names) {
      const flat = name.replace(/-/g, '');
      if (withinEditDistance(w, flat, flat.length > 6 ? 2 : 1)) return name;
    }
  }
  return null;
}

// The AI's navigate_ui tool call returns whatever page slug the model picked
// (e.g. "qr_codes", "qr codes", "QRCodes"), which doesn't always match a
// PAGE_MAP key exactly. A raw miss used to fall back to using that string as
// the URL hash directly — an unmatched route that silently left the page
// exactly where it was, while Mikey still reported success. Route every
// model-provided page through this before ever touching the hash.
export function resolvePage(raw: string): string {
  if (PAGE_MAP[raw]) return canonical(raw);
  const aliased = PAGE_ALIASES[raw];
  if (aliased && PAGE_MAP[aliased]) return canonical(aliased);
  const fuzzy = fuzzyPageMatch(raw);
  if (fuzzy) return canonical(fuzzy);
  return raw;
}
