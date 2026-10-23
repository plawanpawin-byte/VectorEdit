import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import { rings } from './geometry';
import type { Pt, Shape } from './types';

export type BoolOp = 'union' | 'subtract' | 'intersect' | 'xor';

export interface BoolPiece {
  outer: Pt[];
  holes: Pt[][];
}

/** Shapes that can take part in a boolean operation (closed, non-text). */
export const canBoolean = (s: Shape) =>
  s.visible && !s.locked && s.kind !== 'text' && s.kind !== 'line' && (s.kind !== 'path' || s.closed);

const toPolygon = (s: Shape): Polygon => rings(s, 24).map((r) => r.map((p): [number, number] => [p.x, p.y]));

const toPts = (ring: [number, number][]): Pt[] => {
  const pts = ring.map(([x, y]) => ({ x, y, hx: 0, hy: 0 }));
  const a = pts[0];
  const b = pts[pts.length - 1];
  // polygon-clipping closes rings by repeating the first point
  if (pts.length > 1 && a.x === b.x && a.y === b.y) pts.pop();
  return pts;
};

/**
 * Combine shapes ordered bottom to top. For subtract, the bottom shape is the minuend
 * and everything above it is removed from it.
 */
export function booleanPieces(ordered: Shape[], op: BoolOp): BoolPiece[] {
  if (ordered.length < 2) return [];
  const [first, ...rest] = ordered.map(toPolygon);
  const result: MultiPolygon =
    op === 'union'
      ? polygonClipping.union(first, ...rest)
      : op === 'subtract'
        ? polygonClipping.difference(first, ...rest)
        : op === 'intersect'
          ? polygonClipping.intersection(first, ...rest)
          : polygonClipping.xor(first, ...rest);
  return result
    .map((poly) => ({ outer: toPts(poly[0]), holes: poly.slice(1).map(toPts) }))
    .filter((p) => p.outer.length >= 3);
}
