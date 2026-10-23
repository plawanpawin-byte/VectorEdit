import { bbox, toPath } from './geometry';
import type { Pt, Shape } from './types';

export interface XY {
  x: number;
  y: number;
}

export type Mapping = (p: XY) => XY;

type Cubic = [XY, XY, XY, XY];

const lerp = (u: XY, v: XY, t: number): XY => ({ x: u.x + (v.x - u.x) * t, y: u.y + (v.y - u.y) * t });

/** de Casteljau split at t. */
function split([p0, p1, p2, p3]: Cubic, t: number): [Cubic, Cubic] {
  const a = lerp(p0, p1, t), b = lerp(p1, p2, t), c = lerp(p2, p3, t);
  const d = lerp(a, b, t), e = lerp(b, c, t);
  const m = lerp(d, e, t);
  return [[p0, a, d, m], [m, e, c, p3]];
}

/** Split every Bézier segment into `n` pieces so a warp bends curves smoothly. */
export function subdividePts(pts: Pt[], closed: boolean, n = 4): Pt[] {
  if (pts.length < 2 || n < 2) return pts;
  const segs = closed ? pts.length : pts.length - 1;
  const result: Pt[] = pts.map((p) => ({ ...p }));
  const inserted: Pt[][] = pts.map(() => []);
  for (let i = 0; i < segs; i++) {
    const a = pts[i];
    const bi = (i + 1) % pts.length;
    const b = pts[bi];
    let rest: Cubic = [
      { x: a.x, y: a.y },
      { x: a.x + a.hx, y: a.y + a.hy },
      { x: b.x + (b.ix ?? -b.hx), y: b.y + (b.iy ?? -b.hy) },
      { x: b.x, y: b.y },
    ];
    const pieces: Cubic[] = [];
    for (let k = 0; k < n - 1; k++) {
      const [head, tail] = split(rest, 1 / (n - k));
      pieces.push(head);
      rest = tail;
    }
    pieces.push(rest);
    result[i].hx = pieces[0][1].x - pieces[0][0].x;
    result[i].hy = pieces[0][1].y - pieces[0][0].y;
    for (let k = 0; k < pieces.length - 1; k++) {
      const [, , c2, end] = pieces[k];
      const nc1 = pieces[k + 1][1];
      inserted[i].push({ x: end.x, y: end.y, ix: c2.x - end.x, iy: c2.y - end.y, hx: nc1.x - end.x, hy: nc1.y - end.y });
    }
    const last = pieces[n - 1];
    result[bi].ix = last[2].x - last[3].x;
    result[bi].iy = last[2].y - last[3].y;
  }
  return result.flatMap((p, i) => [p, ...inserted[i]]);
}

/** Apply a point mapping to a path-like shape (anchors and handle end points). */
export function warpShape(shape: Shape, map: Mapping, subdivide = 6): Shape {
  if (shape.kind === 'text' || shape.raster) return shape;
  const p = toPath(shape);
  if (p.kind !== 'path') return shape;
  const warpPts = (pts: Pt[], closed: boolean): Pt[] =>
    subdividePts(pts, closed, subdivide).map((pt) => {
      const a = map({ x: pt.x, y: pt.y });
      const o = map({ x: pt.x + pt.hx, y: pt.y + pt.hy });
      const i = map({ x: pt.x + (pt.ix ?? -pt.hx), y: pt.y + (pt.iy ?? -pt.hy) });
      return { x: a.x, y: a.y, hx: o.x - a.x, hy: o.y - a.y, ix: i.x - a.x, iy: i.y - a.y };
    });
  return {
    ...p,
    pts: warpPts(p.pts, p.closed),
    extra: (p.extra ?? []).map((c) => warpPts(c, true)),
  };
}

/** Projective map from the unit square to a quad (corners TL, TR, BR, BL). */
export function perspectiveMap(box: { x: number; y: number; w: number; h: number }, q: [XY, XY, XY, XY]): Mapping {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = Math.abs(den) < 1e-9 ? 0 : (dx3 * dy2 - dx2 * dy3) / den;
  const h = Math.abs(den) < 1e-9 ? 0 : (dx1 * dy3 - dx3 * dy1) / den;
  const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + h * p3.x, c = p0.x;
  const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + h * p3.y, f = p0.y;
  return (pt) => {
    const u = box.w ? (pt.x - box.x) / box.w : 0;
    const v = box.h ? (pt.y - box.y) / box.h : 0;
    const w = g * u + h * v + 1;
    return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w };
  };
}

const binom = (n: number, k: number) => {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
};

/** Bernstein basis of degree n-1 at t. */
const bernstein = (n: number, t: number) => Array.from({ length: n }, (_, i) => binom(n - 1, i) * t ** i * (1 - t) ** (n - 1 - i));

/** Envelope warp from an n×n control net (row-major) using a Bézier patch of degree n-1. */
export function envelopeMap(box: { x: number; y: number; w: number; h: number }, net: XY[], n = 3): Mapping {
  return (pt) => {
    const u = Math.max(0, Math.min(1, box.w ? (pt.x - box.x) / box.w : 0));
    const v = Math.max(0, Math.min(1, box.h ? (pt.y - box.y) / box.h : 0));
    const bu = bernstein(n, u), bv = bernstein(n, v);
    let x = 0, y = 0;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const wgt = bu[i] * bv[j];
        x += net[j * n + i].x * wgt;
        y += net[j * n + i].y * wgt;
      }
    return { x, y };
  };
}

/** Control net for the neutral (unwarped) envelope: evenly spaced points reproduce the identity map. */
export function neutralNet(box: { x: number; y: number; w: number; h: number }, n = 3): XY[] {
  const net: XY[] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) net.push({ x: box.x + (box.w * i) / (n - 1), y: box.y + (box.h * j) / (n - 1) });
  return net;
}

export const boxOfShapes = (shapes: Shape[]) => {
  const bs = shapes.map(bbox);
  const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
  const x2 = Math.max(...bs.map((b) => b.x + b.w)), y2 = Math.max(...bs.map((b) => b.y + b.h));
  return { x, y, w: x2 - x, h: y2 - y };
};
