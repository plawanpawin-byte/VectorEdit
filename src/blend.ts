import { bbox, toPath } from './geometry';
import type { Shape } from './types';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Parse #rgb / #rrggbb(aa); returns null for anything else (gradients, names). */
function parseHex(c: string | null): [number, number, number] | null {
  if (!c) return null;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})([0-9a-f]{2})?$/i.exec(c);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function lerpColour(a: string | null, b: string | null, t: number): string | null {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return t < 0.5 ? a : b;
  const [r, g, bl] = ca.map((v, i) => Math.round(lerp(v, cb[i], t)));
  return '#' + [r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Intermediate shapes between `a` and `b` (exclusive of both). Geometry blends node by node when both are paths
 * with the same node count, parameter by parameter when both are the same parametric shape, and by bounding
 * box otherwise. Fill, stroke, stroke width and opacity always blend.
 */
export function blendShapes(a: Shape, b: Shape, steps: number): Shape[] {
  const n = Math.max(0, Math.floor(steps));
  const out: Shape[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const base: Shape = {
      ...a,
      fill: lerpColour(a.fill, b.fill, t),
      stroke: lerpColour(a.stroke, b.stroke, t),
      strokeWidth: lerp(a.strokeWidth, b.strokeWidth, t),
      opacity: lerp(a.opacity, b.opacity, t),
      group: null,
      locked: false,
      name: `${a.name} blend ${i}`,
    };
    const pa = a.kind === 'path' ? a : null;
    const pb = b.kind === 'path' ? b : null;
    if (pa && pb && pa.pts.length === pb.pts.length && pa.pts.length > 1) {
      out.push({ ...base, pts: pa.pts.map((p, k) => ({ x: lerp(p.x, pb.pts[k].x, t), y: lerp(p.y, pb.pts[k].y, t), hx: lerp(p.hx, pb.pts[k].hx, t), hy: lerp(p.hy, pb.pts[k].hy, t) })) });
      continue;
    }
    const ba = bbox(a);
    const bb = bbox(b);
    const box = { x: lerp(ba.x, bb.x, t), y: lerp(ba.y, bb.y, t), w: lerp(ba.w, bb.w, t), h: lerp(ba.h, bb.h, t) };
    if (a.kind === 'shape' && b.kind === 'shape' && a.shapeId === b.shapeId) {
      const params = { ...a.params };
      for (const k of Object.keys(b.params)) if (typeof a.params[k] === 'number') params[k] = lerp(a.params[k], b.params[k], t);
      out.push({ ...base, ...box, params });
    } else if (a.kind === 'rect' || a.kind === 'ellipse' || a.kind === 'shape') {
      out.push({ ...base, ...box, radius: a.kind === 'rect' && b.kind === 'rect' ? lerp(a.radius, b.radius, t) : a.radius });
    } else {
      // paths and lines of different complexity: scale/move a's outline into the interpolated box
      const p = toPath(a);
      const sx = ba.w ? box.w / ba.w : 1;
      const sy = ba.h ? box.h / ba.h : 1;
      const map = (q: { x: number; y: number; hx: number; hy: number }) => ({ ...q, x: box.x + (q.x - ba.x) * sx, y: box.y + (q.y - ba.y) * sy, hx: q.hx * sx, hy: q.hy * sy });
      out.push({ ...base, kind: p.kind, pts: p.pts.map(map), extra: (p.extra ?? []).map((r) => r.map(map)) });
    }
  }
  return out;
}
