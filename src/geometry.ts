import type { Box, Pt, Shape } from './types';

interface P2 {
  x: number;
  y: number;
}

/** Anchor list of a shape; polygons and stars are generated from their box and parameters. */
export function ptsOf(s: Shape): Pt[] {
  if (s.kind === 'polygon') return ngonPts(s, Math.max(3, Math.round(s.sides ?? 6)), null);
  if (s.kind === 'star') return ngonPts(s, Math.max(3, Math.round(s.sides ?? 5)), clamp01(s.inner ?? 0.5));
  return s.pts ?? [];
}

const clamp01 = (n: number) => Math.max(0.05, Math.min(0.95, n));
const isClosed = (s: Shape) => s.closed || s.kind === 'polygon' || s.kind === 'star';

function flattenRing(pts: Pt[], closed: boolean, steps: number): P2[] {
  const out: P2[] = [];
  const n = pts.length;
  if (!n) return out;
  out.push({ x: pts[0].x, y: pts[0].y });
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    if (!a.hx && !a.hy && !b.hx && !b.hy) {
      out.push({ x: b.x, y: b.y });
      continue;
    }
    const c1x = a.x + a.hx;
    const c1y = a.y + a.hy;
    const c2x = b.x - b.hx;
    const c2y = b.y - b.hy;
    for (let t = 1; t <= steps; t++) {
      const u = t / steps;
      const v = 1 - u;
      out.push({
        x: v * v * v * a.x + 3 * v * v * u * c1x + 3 * v * u * u * c2x + u * u * u * b.x,
        y: v * v * v * a.y + 3 * v * v * u * c1y + 3 * v * u * u * c2y + u * u * u * b.y,
      });
    }
  }
  return out;
}

export function flatten(s: Shape, steps = 14): P2[] {
  return flattenRing(ptsOf(s), isClosed(s), steps);
}

/** Flattened closed rings of a shape (outer contour first, then extras). */
export function rings(s: Shape, steps = 14): P2[][] {
  const t = toPath(s);
  const main = flattenRing(ptsOf(t), true, steps);
  const extra = (t.extra ?? []).map((r) => flattenRing(r, true, steps));
  return [main, ...extra].filter((r) => r.length >= 3);
}

export function textBox(s: Shape): Box {
  const lines = s.text.split('\n');
  const longest = Math.max(1, ...lines.map((l) => l.length));
  return { x: s.x, y: s.y, w: longest * s.fontSize * 0.56, h: lines.length * s.fontSize * 1.2 };
}

export function bbox(s: Shape): Box {
  if (s.kind === 'rect' || s.kind === 'ellipse' || s.kind === 'polygon' || s.kind === 'star') return { x: s.x, y: s.y, w: s.w, h: s.h };
  if (s.kind === 'text') return textBox(s);
  const pts = [...flatten(s), ...(s.extra ?? []).flatMap((r) => flattenRing(r, true, 14))];
  if (!pts.length) return { x: 0, y: 0, w: 0, h: 0 };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function translate(s: Shape, dx: number, dy: number): Shape {
  return {
    ...s,
    x: s.x + dx,
    y: s.y + dy,
    pts: s.pts.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
    extra: (s.extra ?? []).map((r) => r.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }))),
  };
}

export function scaleAbout(s: Shape, sx: number, sy: number, ox: number, oy: number): Shape {
  let x = ox + (s.x - ox) * sx;
  let y = oy + (s.y - oy) * sy;
  let w = s.w * sx;
  let h = s.h * sy;
  if (w < 0) {
    x += w;
    w = -w;
  }
  if (h < 0) {
    y += h;
    h = -h;
  }
  return {
    ...s,
    x,
    y,
    w,
    h,
    fontSize: s.kind === 'text' ? Math.max(1, s.fontSize * Math.abs(sy)) : s.fontSize,
    pts: s.pts.map((p) => scalePt(p, sx, sy, ox, oy)),
    extra: (s.extra ?? []).map((ring) => ring.map((p) => scalePt(p, sx, sy, ox, oy))),
  };
}

const scalePt = (p: Pt, sx: number, sy: number, ox: number, oy: number): Pt => ({
  x: ox + (p.x - ox) * sx,
  y: oy + (p.y - oy) * sy,
  hx: p.hx * sx,
  hy: p.hy * sy,
});

const r = (n: number) => Math.round(n * 100) / 100;

function ringD(pts: Pt[], closed: boolean): string {
  const n = pts.length;
  if (!n) return '';
  let d = `M${r(pts[0].x)} ${r(pts[0].y)}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    if (!a.hx && !a.hy && !b.hx && !b.hy) {
      d += `L${r(b.x)} ${r(b.y)}`;
    } else {
      d += `C${r(a.x + a.hx)} ${r(a.y + a.hy)} ${r(b.x - b.hx)} ${r(b.y - b.hy)} ${r(b.x)} ${r(b.y)}`;
    }
  }
  return closed ? d + 'Z' : d;
}

export function pathD(s: Shape): string {
  return ringD(ptsOf(s), isClosed(s)) + (s.extra ?? []).map((ring) => ringD(ring, true)).join('');
}

function distToSeg(px: number, py: number, a: P2, b: P2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

function inPolygon(px: number, py: number, poly: P2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export function hitTest(s: Shape, x: number, y: number, tol: number): boolean {
  if (!s.visible) return false;
  const half = (s.stroke ? s.strokeWidth : 0) / 2 + tol;
  if (s.kind === 'rect') {
    const inOuter = x >= s.x - half && x <= s.x + s.w + half && y >= s.y - half && y <= s.y + s.h + half;
    if (!inOuter) return false;
    if (s.fill || s.gradient) return true;
    return !(x > s.x + half && x < s.x + s.w - half && y > s.y + half && y < s.y + s.h - half);
  }
  if (s.kind === 'ellipse') {
    const rx = s.w / 2;
    const ry = s.h / 2;
    if (rx <= 0 || ry <= 0) return false;
    const nx = (x - (s.x + rx)) / (rx + half);
    const ny = (y - (s.y + ry)) / (ry + half);
    if (nx * nx + ny * ny > 1) return false;
    if (s.fill || s.gradient) return true;
    const ix = (x - (s.x + rx)) / Math.max(1, rx - half);
    const iy = (y - (s.y + ry)) / Math.max(1, ry - half);
    return ix * ix + iy * iy >= 1;
  }
  if (s.kind === 'text') {
    const b = textBox(s);
    return x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol;
  }
  const all = [flatten(s), ...(s.extra ?? []).map((ring) => flattenRing(ring, true, 14))];
  const closed = isClosed(s);
  if (closed && (s.fill || s.gradient)) {
    const hits = all.filter((ring) => inPolygon(x, y, ring)).length;
    if (hits % 2 === 1) return true;
  }
  for (const pts of all) {
    for (let i = 0; i < pts.length - 1; i++) {
      if (distToSeg(x, y, pts[i], pts[i + 1]) <= half) return true;
    }
    if (closed && pts.length > 1 && distToSeg(x, y, pts[pts.length - 1], pts[0]) <= half) return true;
  }
  return false;
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

const KAPPA = 0.5522847498;

/** Turn rectangles and ellipses into editable paths; other kinds are returned unchanged. */
export function toPath(s: Shape): Shape {
  if (s.kind === 'polygon' || s.kind === 'star') return { ...s, kind: 'path', closed: true, pts: ptsOf(s) };
  if (s.kind === 'rect') {
    const { x, y, w, h } = s;
    const pt = (px: number, py: number) => ({ x: px, y: py, hx: 0, hy: 0 });
    return { ...s, kind: 'path', closed: true, pts: [pt(x, y), pt(x + w, y), pt(x + w, y + h), pt(x, y + h)], radius: 0 };
  }
  if (s.kind === 'ellipse') {
    const rx = s.w / 2;
    const ry = s.h / 2;
    const cx = s.x + rx;
    const cy = s.y + ry;
    return {
      ...s,
      kind: 'path',
      closed: true,
      pts: [
        { x: cx, y: cy - ry, hx: rx * KAPPA, hy: 0 },
        { x: cx + rx, y: cy, hx: 0, hy: ry * KAPPA },
        { x: cx, y: cy + ry, hx: -rx * KAPPA, hy: 0 },
        { x: cx - rx, y: cy, hx: 0, hy: -ry * KAPPA },
      ],
    };
  }
  return s;
}

export function rotateShape(s: Shape, deg: number, cx: number, cy: number): Shape {
  if (s.kind === 'text') return s;
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const p = toPath(s);
  const rot = (q: Pt): Pt => ({
    x: cx + (q.x - cx) * cos - (q.y - cy) * sin,
    y: cy + (q.x - cx) * sin + (q.y - cy) * cos,
    hx: q.hx * cos - q.hy * sin,
    hy: q.hx * sin + q.hy * cos,
  });
  return { ...p, pts: p.pts.map(rot), extra: (p.extra ?? []).map((ring) => ring.map(rot)) };
}

/** Regular polygon or star inscribed in the box. */
export function ngonPts(b: Box, points: number, inner: number | null): Pt[] {
  const rx = b.w / 2;
  const ry = b.h / 2;
  const cx = b.x + rx;
  const cy = b.y + ry;
  const out: Pt[] = [];
  const n = inner === null ? points : points * 2;
  for (let i = 0; i < n; i++) {
    const k = inner === null ? 1 : i % 2 === 0 ? 1 : inner;
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    out.push({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k, hx: 0, hy: 0 });
  }
  return out;
}

function rdp(pts: { x: number; y: number }[], eps: number): { x: number; y: number }[] {
  if (pts.length < 3) return pts;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  let idx = 0;
  let max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i].x - dx * pts[i].y + b.x * a.y - b.y * a.x) / len;
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max <= eps) return [a, b];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
}

/** Simplify a freehand stroke and smooth it into Bezier anchors (Catmull-Rom). */
export function smoothStroke(raw: { x: number; y: number }[], eps: number) {
  const pts = rdp(raw, eps);
  return pts.map((p, i) => {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const end = i === 0 || i === pts.length - 1;
    return { x: p.x, y: p.y, hx: end ? 0 : (next.x - prev.x) / 6, hy: end ? 0 : (next.y - prev.y) / 6 };
  });
}
