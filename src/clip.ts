import polygonClipping, { type Geom, type MultiPolygon } from 'polygon-clipping';

/**
 * polygon-clipping throws "Unable to pop() SweepEvent" on some numerically awkward input (nearly touching curves).
 * Rounding the coordinates a little gets past it, so a failed operation is retried on coarser grids before giving up.
 */
const snap = (g: unknown, q: number): unknown =>
  Array.isArray(g) ? (typeof g[0] === 'number' ? g.map((n: number) => Math.round(n / q) * q) : g.map((x) => snap(x, q))) : g;

type Op = (geom: Geom, ...more: Geom[]) => MultiPolygon;

export function robust(op: Op, [first, ...rest]: Geom[]): MultiPolygon {
  try {
    return op(first, ...rest);
  } catch (e) {
    for (const q of [0.01, 0.1, 1]) {
      try {
        return op(snap(first, q) as Geom, ...rest.map((g) => snap(g, q) as Geom));
      } catch {
        // try a coarser grid
      }
    }
    throw e;
  }
}

export const clip = {
  union: (a: Geom, ...r: Geom[]) => robust(polygonClipping.union, [a, ...r]),
  intersection: (a: Geom, ...r: Geom[]) => robust(polygonClipping.intersection, [a, ...r]),
  difference: (a: Geom, ...r: Geom[]) => robust(polygonClipping.difference, [a, ...r]),
  xor: (a: Geom, ...r: Geom[]) => robust(polygonClipping.xor, [a, ...r]),
};
