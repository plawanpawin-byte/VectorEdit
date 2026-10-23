import { type MultiPolygon, type Polygon } from 'polygon-clipping';
import { clip } from './clip';
import { rings } from './geometry';
import type { Pt, Shape } from './types';

/* Pure path and arrangement operations behind the Object menu. */

const outH = (p: Pt) => ({ x: p.hx, y: p.hy });
const inH = (p: Pt) => ({ x: p.ix ?? -p.hx, y: p.iy ?? -p.hy });

/** Reverse the direction of a path; in and out handles swap roles. */
export function reversePts(pts: Pt[]): Pt[] {
  return [...pts].reverse().map((p) => {
    const i = inH(p);
    const o = outH(p);
    return { ...p, hx: i.x, hy: i.y, ix: o.x, iy: o.y };
  });
}

/**
 * Join two open paths into one. The nearest pair of end points is connected; end points closer than
 * `tol` merge into a single node, otherwise a straight segment bridges the gap.
 */
export function joinOpen(a: Pt[], b: Pt[], tol = 0.5): Pt[] {
  const ends = (p: Pt[]) => [p[0], p[p.length - 1]];
  const [a0, a1] = ends(a);
  const [b0, b1] = ends(b);
  const d = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y);
  const options = [
    { dist: d(a1, b0), a, b },
    { dist: d(a1, b1), a, b: reversePts(b) },
    { dist: d(a0, b0), a: reversePts(a), b },
    { dist: d(a0, b1), a: b, b: a },
  ];
  const best = options.reduce((m, o) => (o.dist < m.dist ? o : m));
  const left = best.a;
  const right = best.b;
  if (best.dist <= tol) {
    const tail = left[left.length - 1];
    const head = right[0];
    const merged: Pt = { x: (tail.x + head.x) / 2, y: (tail.y + head.y) / 2, hx: head.hx, hy: head.hy, ix: tail.ix ?? -tail.hx, iy: tail.iy ?? -tail.hy };
    return [...left.slice(0, -1), merged, ...right.slice(1)];
  }
  return [...left, ...right];
}

/** Re-fit handles so the path flows smoothly through its nodes (Catmull-Rom style). */
export function smoothPts(pts: Pt[], closed: boolean, tension = 1 / 6): Pt[] {
  const n = pts.length;
  if (n < 3) return pts;
  return pts.map((p, i) => {
    const prev = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const next = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const end = !closed && (i === 0 || i === n - 1);
    const hx = end ? 0 : (next.x - prev.x) * tension;
    const hy = end ? 0 : (next.y - prev.y) * tension;
    return { x: p.x, y: p.y, hx, hy };
  });
}

type MP = MultiPolygon;
const toPolygon = (s: Shape): Polygon => rings(s, 24).map((r) => r.map((p): [number, number] => [p.x, p.y]));

export interface Region {
  mp: MP;
  /** index in the ordered input of the top-most shape covering this region */
  owner: number;
}

/**
 * Split overlapping shapes (bottom to top) into every distinct overlapping region, like Affinity's Divide.
 * Each region keeps the owner that is visible there.
 */
export function divideRegions(ordered: Shape[]): Region[] {
  let regions: Region[] = [];
  ordered.forEach((s, i) => {
    const poly = toPolygon(s);
    const next: Region[] = [];
    for (const r of regions) {
      const inter = clip.intersection(r.mp, poly);
      const rest = clip.difference(r.mp, poly);
      if (inter.length) next.push({ mp: inter, owner: i });
      if (rest.length) next.push({ mp: rest, owner: r.owner });
    }
    const covered = regions.length ? clip.union(regions[0].mp, ...regions.slice(1).map((r) => r.mp)) : [];
    const fresh = covered.length ? clip.difference(poly, covered) : [poly];
    if (fresh.length) next.push({ mp: fresh as MP, owner: i });
    regions = next;
  });
  return regions;
}

const polyBox = (poly: Polygon) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly[0]) (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y));
  return { x0, y0, x1, y1 };
};

/**
 * The single area at (x, y) enclosed by overlapping shapes: where every shape under the point
 * overlaps, minus every other shape that cuts into that. Only the clicked area is computed, so it
 * stays fast however many shapes the page holds. `owner` is the top-most shape under the point.
 */
export function floodRegion(ordered: Shape[], x: number, y: number): Region | null {
  const polys = ordered.map(toPolygon);
  const under = polys.map((p, i) => (p.length && regionContains([p], x, y) ? i : -1)).filter((i) => i >= 0);
  if (!under.length) return null;
  let box = { x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity };
  for (const i of under) {
    const b = polyBox(polys[i]);
    box = { x0: Math.max(box.x0, b.x0), y0: Math.max(box.y0, b.y0), x1: Math.min(box.x1, b.x1), y1: Math.min(box.y1, b.y1) };
  }
  const near = polys.filter((p, i) => {
    if (under.includes(i) || !p.length) return false;
    const b = polyBox(p);
    return b.x0 <= box.x1 && b.x1 >= box.x0 && b.y0 <= box.y1 && b.y1 >= box.y0;
  });
  let mp: MP = polys[under[0]].length ? [polys[under[0]]] : [];
  try {
    for (const i of under.slice(1)) mp = clip.intersection(mp, polys[i]);
    if (near.length && mp.length) mp = clip.difference(mp, ...near);
  } catch {
    // the clipping library cannot split this particular geometry: nothing to fill here
    return null;
  }
  // the pieces can fall apart; the one under the click is the area
  const piece = mp.filter((poly) => regionContains([poly], x, y));
  return piece.length ? { mp: piece, owner: under[under.length - 1] } : null;
}

/** Copies of `shape` laid out with a constant offset, rotation and scale step. */
export function stepRepeat(shape: Shape, count: number, dx: number, dy: number): Shape[] {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, i) => ({ ...shape, x: shape.x + dx * (i + 1), y: shape.y + dy * (i + 1), pts: shape.pts.map((p) => ({ ...p, x: p.x + dx * (i + 1), y: p.y + dy * (i + 1) })), extra: shape.extra.map((r) => r.map((p) => ({ ...p, x: p.x + dx * (i + 1), y: p.y + dy * (i + 1) }))) }));
}

/** Douglas-Peucker simplification of a polyline. */
export function simplify(points: { x: number; y: number }[], tol: number): { x: number; y: number }[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const a = points[s], b = points[e];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let worst = -1, wi = -1;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs((b.x - a.x) * (a.y - points[i].y) - (a.x - points[i].x) * (b.y - a.y)) / len;
      if (d > worst) (worst = d), (wi = i);
    }
    if (worst > tol) {
      keep[wi] = 1;
      stack.push([s, wi], [wi, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * Trace the dark (or light) areas of an image into closed contours using marching squares.
 * `mask(x, y)` says whether a pixel is inside. Contours come back as pixel-space point rings.
 */
export function traceMask(w: number, h: number, mask: (x: number, y: number) => boolean): { x: number; y: number }[][] {
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask(x, y);
  // collect directed boundary edges around inside pixels, then chain them into rings
  const key = (x: number, y: number) => `${x},${y}`;
  const multi = new Map<string, [number, number][]>();
  const add = (x1: number, y1: number, x2: number, y2: number) => {
    const k = key(x1, y1);
    const list = multi.get(k) ?? [];
    list.push([x2, y2]);
    multi.set(k, list);
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x, y - 1)) add(x, y, x + 1, y);
      if (!inside(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!inside(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!inside(x - 1, y)) add(x, y + 1, x, y);
    }
  const out: { x: number; y: number }[][] = [];
  for (const [startKey] of multi) {
    while ((multi.get(startKey)?.length ?? 0) > 0) {
      const [sx, sy] = startKey.split(',').map(Number);
      const ring: { x: number; y: number }[] = [];
      let cx = sx, cy = sy;
      let dir: [number, number] | null = null;
      for (let guard = 0; guard < w * h * 4 + 8; guard++) {
        const list = multi.get(key(cx, cy));
        if (!list || !list.length) break;
        // prefer turning consistently so touching corners separate into distinct rings
        let idx = 0;
        if (list.length > 1 && dir) {
          const turn = (e: [number, number]) => {
            const ex = e[0] - cx, ey = e[1] - cy;
            return dir![0] * ey - dir![1] * ex;
          };
          idx = list.reduce((bi, e, i) => (turn(e) > turn(list[bi]) ? i : bi), 0);
        }
        const [nx, ny] = list.splice(idx, 1)[0];
        ring.push({ x: cx, y: cy });
        dir = [nx - cx, ny - cy];
        cx = nx;
        cy = ny;
        if (cx === sx && cy === sy) break;
      }
      if (ring.length >= 3) out.push(ring);
    }
  }
  return out;
}

const inRing = (ring: [number, number][], x: number, y: number) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** True when (x, y) lies inside a multipolygon (outer rings minus their holes). */
export function regionContains(mp: MultiPolygon, x: number, y: number): boolean {
  return mp.some((poly) => inRing(poly[0], x, y) && !poly.slice(1).some((h) => inRing(h, x, y)));
}

/** Union of several regions into one multipolygon. */
export function unionRegions(list: MultiPolygon[]): MultiPolygon {
  return list.length ? clip.union(list[0], ...list.slice(1)) : [];
}

/** SVG path data for a multipolygon (even-odd). */
export const multiPolygonD = (mp: MultiPolygon) =>
  mp.map((poly) => poly.map((ring) => 'M' + ring.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L') + 'Z').join('')).join('');
