import { type MultiPolygon, type Polygon } from 'polygon-clipping';
import { clip } from './clip';
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
      ? clip.union(first, ...rest)
      : op === 'subtract'
        ? clip.difference(first, ...rest)
        : op === 'intersect'
          ? clip.intersection(first, ...rest)
          : clip.xor(first, ...rest);
  return result
    .map((poly) => ({ outer: toPts(poly[0]), holes: poly.slice(1).map(toPts) }))
    .filter((p) => p.outer.length >= 3);
}

/**
 * Cut a closed shape along the segment a-b by subtracting a hair-thin strip. Returns the pieces,
 * or null when the line does not separate the shape.
 */
export function cutPieces(s: Shape, a: { x: number; y: number }, b: { x: number; y: number }, width: number): BoolPiece[] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const nx = (-dy / len) * (width / 2);
  const ny = (dx / len) * (width / 2);
  const cutter: Polygon = [[[a.x + nx, a.y + ny], [b.x + nx, b.y + ny], [b.x - nx, b.y - ny], [a.x - nx, a.y - ny]]];
  const result = clip.difference(toPolygon(s), cutter);
  const pieces = result.map((poly) => ({ outer: toPts(poly[0]), holes: poly.slice(1).map(toPts) })).filter((p) => p.outer.length >= 3);
  return pieces.length >= 2 ? pieces : null;
}
