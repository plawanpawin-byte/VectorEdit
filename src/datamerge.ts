/** Data merge: CSV parsing and `{{Field}}` substitution. */

export type Row = Record<string, string>;

/** RFC 4180-style CSV with quoted fields, escaped quotes and CRLF/LF/CR line breaks. Auto-detects `,` `;` or tab. */
export function parseCsv(text: string): { fields: string[]; rows: Row[] } {
  const src = text.replace(/^﻿/, '');
  const first = src.split(/\r\n|\n|\r/, 1)[0] ?? '';
  const delim = [',', ';', '\t'].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const table: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) (row.push(cell), (cell = ''));
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      table.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) (row.push(cell), table.push(row));
  const cleaned = table.filter((r) => r.some((c) => c.trim() !== ''));
  if (!cleaned.length) return { fields: [], rows: [] };
  const fields = cleaned[0].map((f) => f.trim());
  const rows = cleaned.slice(1).map((r) => Object.fromEntries(fields.map((f, i) => [f, r[i] ?? ''])));
  return { fields, rows };
}

/** Replace `{{Field}}` (case-insensitive, spaces tolerated) with the row's value; unknown fields stay as they are. */
export function fill(text: string, row: Row): string {
  const lower = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (m, name: string) => (lower.has(name.toLowerCase()) ? lower.get(name.toLowerCase())! : m));
}

/** Field names used by `{{…}}` placeholders in the given strings. */
export function placeholders(texts: string[]): string[] {
  const found = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) found.add(m[1]);
  return [...found];
}
