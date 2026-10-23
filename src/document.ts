import type { Artboard, Guide, Shape, Slice, Snapshot } from './types';
import { normalizeShape } from './shape';

/** The saved form of a document (.vedit and autosave). Version 1 had a single `artboard`. */
export interface DocFile {
  app: 'vectoredit';
  version: 2;
  artboards: Artboard[];
  guides: Guide[];
  slices: Slice[];
  snapshots: Snapshot[];
  shapes: Shape[];
}

export interface ParsedDoc {
  shapes: unknown[];
  artboards: Artboard[];
  guides: Guide[];
  slices: Slice[];
  snapshots: Snapshot[];
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function normalizeBoards(raw: unknown): Artboard[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .map((a, i) => ({ id: typeof a.id === 'string' ? a.id : `a${i + 1}`, name: typeof a.name === 'string' ? a.name : `Page ${i + 1}`, x: num(a.x, 0), y: num(a.y, 0), w: Math.max(1, num(a.w, 800)), h: Math.max(1, num(a.h, 600)) }));
}

const normalizeGuides = (raw: unknown): Guide[] =>
  Array.isArray(raw)
    ? raw.filter((g) => g && (g.axis === 'h' || g.axis === 'v') && typeof g.pos === 'number').map((g, i) => ({ id: typeof g.id === 'string' ? g.id : `g${i}`, axis: g.axis, pos: g.pos }))
    : [];

const normalizeSlices = (raw: unknown): Slice[] =>
  Array.isArray(raw)
    ? raw
        .filter((s) => s && typeof s === 'object' && typeof s.x === 'number' && typeof s.y === 'number')
        .map((s, i) => ({
          id: typeof s.id === 'string' ? s.id : `sl${i}`,
          name: typeof s.name === 'string' ? s.name : `Slice ${i + 1}`,
          x: s.x,
          y: s.y,
          w: Math.max(1, num(s.w, 100)),
          h: Math.max(1, num(s.h, 100)),
          format: s.format === 'jpg' || s.format === 'svg' ? s.format : 'png',
          scale: Math.max(0.1, Math.min(8, num(s.scale, 1))),
        }))
    : [];

export function serializeDoc(d: { shapes: Shape[]; artboards: Artboard[]; guides: Guide[]; slices: Slice[]; snapshots: Snapshot[] }): string {
  const file: DocFile = { app: 'vectoredit', version: 2, artboards: d.artboards, guides: d.guides, slices: d.slices, snapshots: d.snapshots, shapes: d.shapes };
  return JSON.stringify(file);
}

/** Parse and validate a saved document; throws on anything that is not a VectorEdit document. */
export function parseDoc(text: string): ParsedDoc {
  const doc = JSON.parse(text) as Record<string, unknown> | null;
  if (!doc || doc.app !== 'vectoredit' || !Array.isArray(doc.shapes)) throw new Error('Not a VectorEdit document');
  let artboards = normalizeBoards(doc.artboards);
  if (!artboards.length) {
    const a = doc.artboard as { w?: number; h?: number } | undefined; // version 1
    artboards = [{ id: 'a1', name: 'Page 1', x: 0, y: 0, w: Math.max(1, num(a?.w, 800)), h: Math.max(1, num(a?.h, 600)) }];
  }
  const snapshots = Array.isArray(doc.snapshots)
    ? (doc.snapshots as Snapshot[])
        .filter((s) => s && Array.isArray(s.shapes))
        .map((s) => ({ ...s, shapes: s.shapes.map(normalizeShape).filter((x): x is Shape => x !== null), artboards: normalizeBoards(s.artboards).length ? normalizeBoards(s.artboards) : artboards, guides: normalizeGuides(s.guides), slices: normalizeSlices(s.slices) }))
    : [];
  return { shapes: doc.shapes, artboards, guides: normalizeGuides(doc.guides), slices: normalizeSlices(doc.slices), snapshots };
}
