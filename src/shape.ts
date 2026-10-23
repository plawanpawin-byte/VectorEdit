import type { Shape, ShapeKind } from './types';

/** A shape with every field set; the single place that defines defaults. */
export function blankShape(id: string, kind: ShapeKind, p: Partial<Shape> = {}): Shape {
  return {
    id,
    kind,
    name: p.name ?? kind,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    radius: 0,
    sides: kind === 'star' ? 5 : 6,
    inner: 0.5,
    pts: [],
    extra: [],
    closed: false,
    text: '',
    fontSize: 24,
    fill: null,
    gradient: null,
    stroke: null,
    strokeWidth: 1,
    dash: 'solid',
    cap: 'round',
    join: 'round',
    opacity: 1,
    blend: 'normal',
    effects: [],
    group: null,
    visible: true,
    locked: false,
    ...p,
  };
}

const KINDS = new Set<ShapeKind>(['rect', 'ellipse', 'polygon', 'star', 'line', 'path', 'text']);

/** Fill in fields missing from documents saved by older versions; drops unusable entries. */
export function normalizeShape(raw: unknown): Shape | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Shape>;
  if (typeof r.id !== 'string' || !r.kind || !KINDS.has(r.kind)) return null;
  return blankShape(r.id, r.kind, r);
}
