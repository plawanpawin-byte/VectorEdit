import type { Shape, ShapeKind } from './types';
import { defaultParams } from './shapes';

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
    shapeId: '',
    params: {},
    pts: [],
    extra: [],
    closed: false,
    text: '',
    fontSize: 24,
    fontFamily: 'Georgia',
    fontWeight: 400,
    italic: false,
    underline: false,
    align: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
    frameW: 0,
    pathId: null,
    src: '',
    fit: 'fill',
    frame: false,
    raster: false,
    rw: 0,
    rh: 0,
    fill: null,
    gradient: null,
    pattern: null,
    fade: null,
    adjust: null,
    stroke: null,
    strokeWidth: 1,
    strokeAlign: 'center',
    arrowStart: '',
    arrowEnd: '',
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

const KINDS = new Set<string>(['rect', 'ellipse', 'shape', 'line', 'path', 'text', 'polygon', 'star']);

/** Fill in fields missing from documents saved by older versions; drops unusable entries. */
export function normalizeShape(raw: unknown): Shape | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Shape> & { sides?: number; inner?: number; kind?: string };
  const legacy = r.kind as string | undefined;
  if (typeof r.id !== 'string' || !r.kind || !KINDS.has(r.kind)) return null;
  // documents from before the shape registry stored polygons and stars as their own kinds
  if (legacy === 'polygon') return blankShape(r.id, 'shape', { ...r, kind: 'shape', shapeId: 'polygon', params: { ...defaultParams('polygon'), sides: r.sides ?? 6 } });
  if (legacy === 'star') return blankShape(r.id, 'shape', { ...r, kind: 'shape', shapeId: 'star', params: { ...defaultParams('star'), points: r.sides ?? 5, inner: r.inner ?? 0.5 } });
  const adj = r.adjust as Shape['adjust'] | undefined;
  const adjust = adj && typeof adj === 'object' && typeof adj.type === 'string' ? { type: adj.type, a: Number(adj.a) || 0, b: Number(adj.b) || 0 } : null;
  return blankShape(r.id, r.kind as ShapeKind, { ...r, adjust });
}
