const escape = (v: any) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(data: any[] | Record<string, any>): string {
  if (Array.isArray(data)) {
    if (!data.length) return '';
    const keys = Object.keys(data[0]);
    return [keys.join(','), ...data.map(row => keys.map(k => escape(row[k])).join(','))].join('\n');
  }
  return Object.entries(data).map(([k, v]) => `${escape(k)},${escape(v)}`).join('\n');
}

export function downloadCsv(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${name}.csv`; a.click();
  URL.revokeObjectURL(url);
}
