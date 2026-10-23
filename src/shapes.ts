import type { Pt, Shape } from './types';

/* A registry of parametric shapes. Each definition builds anchors inside a w x h box;
   the editor offsets them by the shape's (x, y). Adding a shape means adding one entry here. */

export interface ShapeParam {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  def: number;
}

export interface Built {
  pts: Pt[];
  extra?: Pt[][];
  closed: boolean;
}

export interface ShapeDef {
  id: string;
  name: string;
  /** true for open paths (stroked, not filled) */
  open?: boolean;
  params: ShapeParam[];
  build(w: number, h: number, p: Record<string, number>): Built;
}

type Params = Record<string, number>;
const TAU = Math.PI * 2;
const KAPPA = 0.5522847498;

/* ---------- path builder: explicit in/out handles, so corners stay sharp ---------- */

class PathBuilder {
  pts: Pt[] = [];
  moveTo(x: number, y: number) {
    this.pts.push({ x, y, hx: 0, hy: 0, ix: 0, iy: 0 });
    return this;
  }
  lineTo(x: number, y: number) {
    return this.moveTo(x, y);
  }
  curveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
    const last = this.pts[this.pts.length - 1];
    last.hx = c1x - last.x;
    last.hy = c1y - last.y;
    this.pts.push({ x, y, hx: 0, hy: 0, ix: c2x - x, iy: c2y - y });
    return this;
  }
  /** Quadratic curve with one control point. */
  quadTo(cx: number, cy: number, x: number, y: number) {
    const a = this.pts[this.pts.length - 1];
    return this.curveTo(a.x + (2 / 3) * (cx - a.x), a.y + (2 / 3) * (cy - a.y), x + (2 / 3) * (cx - x), y + (2 / 3) * (cy - y), x, y);
  }
  /** Elliptical arc from the current point (which must lie on it), angles in radians. */
  arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number) {
    const sweep = a1 - a0;
    const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9));
    const step = sweep / n;
    const k = (4 / 3) * Math.tan(step / 4);
    for (let i = 0; i < n; i++) {
      const s = a0 + i * step;
      const e = s + step;
      const x0 = cx + rx * Math.cos(s);
      const y0 = cy + ry * Math.sin(s);
      const x1 = cx + rx * Math.cos(e);
      const y1 = cy + ry * Math.sin(e);
      this.curveTo(x0 - k * rx * Math.sin(s), y0 + k * ry * Math.cos(s), x1 + k * rx * Math.sin(e), y1 - k * ry * Math.cos(e), x1, y1);
    }
    return this;
  }
  /** Close a ring whose last node coincides with the first: merge the two nodes. */
  closeMerge() {
    const first = this.pts[0];
    const last = this.pts[this.pts.length - 1];
    if (this.pts.length > 1 && Math.hypot(first.x - last.x, first.y - last.y) < 1e-6) {
      first.ix = last.ix;
      first.iy = last.iy;
      this.pts.pop();
    }
    return this.pts;
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const V = (x: number, y: number) => ({ x, y });

/** Closed polygon from vertices, with optional rounded corners (0..1 of half the shorter adjacent edge). */
export function polygonPath(verts: { x: number; y: number }[], corner = 0): Pt[] {
  const n = verts.length;
  if (corner <= 0.001) return verts.map((v) => ({ x: v.x, y: v.y, hx: 0, hy: 0, ix: 0, iy: 0 }));
  const b = new PathBuilder();
  const pt = (i: number) => verts[(i + n) % n];
  const near = (v: { x: number; y: number }, from: { x: number; y: number }, d: number) => {
    const len = Math.hypot(from.x - v.x, from.y - v.y) || 1;
    return V(v.x + ((from.x - v.x) / len) * d, v.y + ((from.y - v.y) / len) * d);
  };
  for (let i = 0; i < n; i++) {
    const v = pt(i);
    const prev = pt(i - 1);
    const next = pt(i + 1);
    const d = clamp(corner, 0, 1) * 0.5 * Math.min(Math.hypot(prev.x - v.x, prev.y - v.y), Math.hypot(next.x - v.x, next.y - v.y));
    const a = near(v, prev, d);
    const c = near(v, next, d);
    if (i === 0) b.moveTo(a.x, a.y);
    else b.lineTo(a.x, a.y);
    b.quadTo(v.x, v.y, c.x, c.y);
  }
  // join back to the first node: first node already holds the start of the first rounded corner
  const first = b.pts[0];
  const last = b.pts[b.pts.length - 1];
  b.lineTo(first.x, first.y);
  void last;
  return b.closeMerge();
}

const ngon = (w: number, h: number, n: number, rot = -Math.PI / 2) =>
  Array.from({ length: n }, (_, i) => V(w / 2 + (Math.cos(rot + (i * TAU) / n) * w) / 2, h / 2 + (Math.sin(rot + (i * TAU) / n) * h) / 2));

/* ---------- definitions ---------- */

const corner: ShapeParam = { key: 'corner', label: 'Corners', min: 0, max: 1, step: 0.01, def: 0 };

export const SHAPES: ShapeDef[] = [
  {
    id: 'triangle',
    name: 'Triangle',
    params: [{ key: 'position', label: 'Apex', min: 0, max: 1, step: 0.01, def: 0.5 }, corner],
    build: (w, h, p) => ({ closed: true, pts: polygonPath([V(w * p.position, 0), V(w, h), V(0, h)], p.corner) }),
  },
  {
    id: 'diamond',
    name: 'Diamond',
    params: [{ key: 'position', label: 'Waist', min: 0.1, max: 0.9, step: 0.01, def: 0.5 }, corner],
    build: (w, h, p) => ({ closed: true, pts: polygonPath([V(w / 2, 0), V(w, h * p.position), V(w / 2, h), V(0, h * p.position)], p.corner) }),
  },
  {
    id: 'trapezoid',
    name: 'Trapezoid',
    params: [
      { key: 'left', label: 'Left inset', min: 0, max: 0.49, step: 0.01, def: 0.2 },
      { key: 'right', label: 'Right inset', min: 0, max: 0.49, step: 0.01, def: 0.2 },
      corner,
    ],
    build: (w, h, p) => ({ closed: true, pts: polygonPath([V(w * p.left, 0), V(w * (1 - p.right), 0), V(w, h), V(0, h)], p.corner) }),
  },
  {
    id: 'parallelogram',
    name: 'Parallelogram',
    params: [{ key: 'skew', label: 'Skew', min: 0, max: 0.9, step: 0.01, def: 0.25 }, corner],
    build: (w, h, p) => ({ closed: true, pts: polygonPath([V(w * p.skew, 0), V(w, 0), V(w * (1 - p.skew), h), V(0, h)], p.corner) }),
  },
  {
    id: 'polygon',
    name: 'Polygon',
    params: [{ key: 'sides', label: 'Sides', min: 3, max: 60, step: 1, def: 6 }, corner],
    build: (w, h, p) => ({ closed: true, pts: polygonPath(ngon(w, h, Math.round(p.sides)), p.corner) }),
  },
  {
    id: 'star',
    name: 'Star',
    params: [
      { key: 'points', label: 'Points', min: 3, max: 60, step: 1, def: 5 },
      { key: 'inner', label: 'Inner radius', min: 0.05, max: 0.95, step: 0.01, def: 0.5 },
      corner,
      { key: 'curve', label: 'Curved edges', min: 0, max: 1, step: 0.01, def: 0 },
    ],
    build: (w, h, p) => {
      const n = Math.round(p.points);
      const verts = Array.from({ length: n * 2 }, (_, i) => {
        const k = i % 2 === 0 ? 1 : p.inner;
        const a = -Math.PI / 2 + (i * Math.PI) / n;
        return V(w / 2 + (Math.cos(a) * w * k) / 2, h / 2 + (Math.sin(a) * h * k) / 2);
      });
      if (p.curve > 0.01) {
        const b = new PathBuilder();
        const c = V(w / 2, h / 2);
        b.moveTo(verts[0].x, verts[0].y);
        for (let i = 1; i <= verts.length; i++) {
          const a = verts[i - 1];
          const e = verts[i % verts.length];
          const k = p.curve * 0.6;
          b.curveTo(a.x + (c.x - a.x) * k, a.y + (c.y - a.y) * k, e.x + (c.x - e.x) * k, e.y + (c.y - e.y) * k, e.x, e.y);
        }
        return { closed: true, pts: b.closeMerge() };
      }
      return { closed: true, pts: polygonPath(verts, p.corner) };
    },
  },
  {
    id: 'burst',
    name: 'Burst',
    params: [
      { key: 'points', label: 'Points', min: 6, max: 60, step: 1, def: 16 },
      { key: 'inner', label: 'Inner radius', min: 0.5, max: 0.98, step: 0.01, def: 0.84 },
    ],
    build: (w, h, p) => {
      const n = Math.round(p.points);
      const verts = Array.from({ length: n * 2 }, (_, i) => {
        const k = i % 2 === 0 ? 1 : p.inner;
        const a = -Math.PI / 2 + (i * Math.PI) / n;
        return V(w / 2 + (Math.cos(a) * w * k) / 2, h / 2 + (Math.sin(a) * h * k) / 2);
      });
      return { closed: true, pts: polygonPath(verts) };
    },
  },
  {
    id: 'cross',
    name: 'Cross',
    params: [{ key: 'thickness', label: 'Thickness', min: 0.1, max: 0.9, step: 0.01, def: 0.34 }, corner],
    build: (w, h, p) => {
      const a = (w * (1 - p.thickness)) / 2;
      const b = w - a;
      const c = (h * (1 - p.thickness)) / 2;
      const d = h - c;
      return { closed: true, pts: polygonPath([V(a, 0), V(b, 0), V(b, c), V(w, c), V(w, d), V(b, d), V(b, h), V(a, h), V(a, d), V(0, d), V(0, c), V(a, c)], p.corner) };
    },
  },
  {
    id: 'arrow',
    name: 'Arrow',
    params: [
      { key: 'head', label: 'Head length', min: 0.1, max: 0.9, step: 0.01, def: 0.4 },
      { key: 'thickness', label: 'Shaft', min: 0.1, max: 0.95, step: 0.01, def: 0.4 },
      { key: 'double', label: 'Double (0/1)', min: 0, max: 1, step: 1, def: 0 },
      corner,
    ],
    build: (w, h, p) => {
      const hl = w * p.head * (p.double ? 0.6 : 1);
      const t0 = (h * (1 - p.thickness)) / 2;
      const t1 = h - t0;
      const pts = p.double
        ? [V(0, h / 2), V(hl, 0), V(hl, t0), V(w - hl, t0), V(w - hl, 0), V(w, h / 2), V(w - hl, h), V(w - hl, t1), V(hl, t1), V(hl, h)]
        : [V(0, t0), V(w - hl, t0), V(w - hl, 0), V(w, h / 2), V(w - hl, h), V(w - hl, t1), V(0, t1)];
      return { closed: true, pts: polygonPath(pts, p.corner) };
    },
  },
  {
    id: 'chevron',
    name: 'Chevron',
    params: [{ key: 'depth', label: 'Depth', min: 0.05, max: 0.9, step: 0.01, def: 0.35 }, corner],
    build: (w, h, p) => ({ closed: true, pts: polygonPath([V(0, 0), V(w * (1 - p.depth), 0), V(w, h / 2), V(w * (1 - p.depth), h), V(0, h), V(w * p.depth, h / 2)], p.corner) }),
  },
  {
    id: 'lightning',
    name: 'Lightning bolt',
    params: [],
    build: (w, h) => ({ closed: true, pts: polygonPath([V(w * 0.58, 0), V(w * 0.12, h * 0.56), V(w * 0.46, h * 0.56), V(w * 0.36, h), V(w * 0.9, h * 0.38), V(w * 0.54, h * 0.38)]) }),
  },
  {
    id: 'heart',
    name: 'Heart',
    params: [{ key: 'spread', label: 'Spread', min: 0.2, max: 1, step: 0.01, def: 0.6 }],
    build: (w, h, p) => {
      const b = new PathBuilder();
      const s = p.spread;
      b.moveTo(w / 2, h);
      b.curveTo(w * 0.5 - w * 0.5 * s, h * 0.78, 0, h * 0.58, 0, h * 0.3);
      b.curveTo(0, h * 0.1, w * 0.18, 0, w * 0.3, 0);
      b.curveTo(w * 0.42, 0, w * 0.5, h * 0.1, w / 2, h * 0.24);
      b.curveTo(w * 0.5, h * 0.1, w * 0.58, 0, w * 0.7, 0);
      b.curveTo(w * 0.82, 0, w, h * 0.1, w, h * 0.3);
      b.curveTo(w, h * 0.58, w * 0.5 + w * 0.5 * s, h * 0.78, w / 2, h);
      return { closed: true, pts: b.closeMerge() };
    },
  },
  {
    id: 'teardrop',
    name: 'Teardrop',
    params: [{ key: 'tail', label: 'Tail', min: 0.3, max: 1, step: 0.01, def: 0.8 }],
    build: (w, h, p) => {
      const b = new PathBuilder();
      const r = Math.min(w, h * (1 - 0.35 * p.tail)) / 2;
      const cx = w / 2;
      const cy = h - r;
      b.moveTo(cx, 0);
      b.curveTo(cx + r * 0.25, h * 0.2, cx + r, cy - r * 0.8, cx + r, cy);
      b.arc(cx, cy, r, r, 0, Math.PI);
      b.curveTo(cx - r, cy - r * 0.8, cx - r * 0.25, h * 0.2, cx, 0);
      return { closed: true, pts: b.closeMerge() };
    },
  },
  {
    id: 'cloud',
    name: 'Cloud',
    params: [
      { key: 'bubbles', label: 'Bubbles', min: 4, max: 16, step: 1, def: 7 },
      { key: 'depth', label: 'Puffiness', min: 0.1, max: 0.9, step: 0.01, def: 0.5 },
    ],
    build: (w, h, p) => {
      const n = Math.round(p.bubbles);
      const rx = w * 0.4;
      const ry = h * 0.4;
      const cx = w / 2;
      const cy = h / 2;
      const b = new PathBuilder();
      const P = (i: number) => V(cx + rx * Math.cos((i * TAU) / n), cy + ry * Math.sin((i * TAU) / n));
      b.moveTo(P(0).x, P(0).y);
      for (let i = 1; i <= n; i++) {
        const a = P(i - 1);
        const e = P(i);
        const chord = Math.hypot(e.x - a.x, e.y - a.y) || 1;
        const sag = Math.max(0.5, chord * p.depth * 0.5); // how far the bubble bulges out
        const R = (chord * chord) / 4 / sag / 2 + sag / 2;
        const mid = V((a.x + e.x) / 2, (a.y + e.y) / 2);
        const out = V(mid.x - cx, mid.y - cy);
        const ol = Math.hypot(out.x, out.y) || 1;
        // circle through a and e, centre on the inside of the chord
        const centre = V(mid.x + (out.x / ol) * (sag - R), mid.y + (out.y / ol) * (sag - R));
        const a0 = Math.atan2(a.y - centre.y, a.x - centre.x);
        const half = sag > chord / 2 ? Math.PI - Math.asin(Math.min(1, chord / 2 / R)) : Math.asin(Math.min(1, chord / 2 / R));
        b.arc(centre.x, centre.y, R, R, a0, a0 + 2 * half);
      }
      return { closed: true, pts: b.closeMerge() };
    },
  },
  {
    id: 'cog',
    name: 'Cog',
    params: [
      { key: 'teeth', label: 'Teeth', min: 4, max: 40, step: 1, def: 10 },
      { key: 'tooth', label: 'Tooth size', min: 0.05, max: 0.5, step: 0.01, def: 0.18 },
      { key: 'body', label: 'Body radius', min: 0.4, max: 0.95, step: 0.01, def: 0.78 },
      { key: 'hole', label: 'Hole', min: 0, max: 0.6, step: 0.01, def: 0.3 },
    ],
    build: (w, h, p) => {
      const n = Math.round(p.teeth);
      const cx = w / 2;
      const cy = h / 2;
      const ro = 1;
      const rb = p.body;
      const half = Math.PI / n / 2;
      const flat = half * (1 - p.tooth);
      const verts: { x: number; y: number }[] = [];
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i * TAU) / n;
        for (const [da, r] of [[-half * 1.1, rb], [-flat * 0.8, ro], [flat * 0.8, ro], [half * 1.1, rb]] as const) {
          verts.push(V(cx + (Math.cos(a + da) * w * r) / 2, cy + (Math.sin(a + da) * h * r) / 2));
        }
      }
      const extra = p.hole > 0.02 ? [ellipseRing(cx, cy, (w * p.hole) / 2, (h * p.hole) / 2)] : [];
      return { closed: true, pts: polygonPath(verts), extra };
    },
  },
  {
    id: 'ring',
    name: 'Ring',
    params: [{ key: 'thickness', label: 'Thickness', min: 0.05, max: 0.95, step: 0.01, def: 0.3 }],
    build: (w, h, p) => ({
      closed: true,
      pts: ellipseRing(w / 2, h / 2, w / 2, h / 2),
      extra: [ellipseRing(w / 2, h / 2, (w / 2) * (1 - p.thickness), (h / 2) * (1 - p.thickness))],
    }),
  },
  {
    id: 'pie',
    name: 'Pie / arc',
    params: [
      { key: 'start', label: 'Start angle', min: -180, max: 180, step: 1, def: -90 },
      { key: 'sweep', label: 'Sweep', min: 1, max: 359, step: 1, def: 270 },
      { key: 'hole', label: 'Hole', min: 0, max: 0.95, step: 0.01, def: 0 },
    ],
    build: (w, h, p) => {
      const cx = w / 2;
      const cy = h / 2;
      const a0 = (p.start * Math.PI) / 180;
      const a1 = a0 + (p.sweep * Math.PI) / 180;
      const b = new PathBuilder();
      const rx = w / 2;
      const ry = h / 2;
      b.moveTo(cx + rx * Math.cos(a0), cy + ry * Math.sin(a0));
      b.arc(cx, cy, rx, ry, a0, a1);
      if (p.hole > 0.01) {
        const irx = rx * p.hole;
        const iry = ry * p.hole;
        b.lineTo(cx + irx * Math.cos(a1), cy + iry * Math.sin(a1));
        b.arc(cx, cy, irx, iry, a1, a0);
      } else {
        b.lineTo(cx, cy);
      }
      return { closed: true, pts: b.closeMerge() };
    },
  },
  {
    id: 'segment',
    name: 'Segment',
    params: [{ key: 'angle', label: 'Angle', min: 10, max: 350, step: 1, def: 140 }],
    build: (w, h, p) => {
      const cx = w / 2;
      const cy = h / 2;
      const half = ((p.angle * Math.PI) / 180) / 2;
      const a0 = Math.PI / 2 - half;
      const a1 = Math.PI / 2 + half;
      const b = new PathBuilder();
      b.moveTo(cx + (w / 2) * Math.cos(a0), cy + (h / 2) * Math.sin(a0));
      b.arc(cx, cy, w / 2, h / 2, a0, a1);
      return { closed: true, pts: b.closeMerge() };
    },
  },
  {
    id: 'crescent',
    name: 'Crescent',
    params: [{ key: 'thickness', label: 'Thickness', min: 0.1, max: 0.95, step: 0.01, def: 0.5 }],
    build: (w, h, p) => {
      const b = new PathBuilder();
      // outer edge: left half of the ellipse centred on the right edge, top tip to bottom tip
      b.moveTo(w, 0);
      b.arc(w, h / 2, w, h / 2, -Math.PI / 2, (-3 * Math.PI) / 2);
      const extreme = w * (1 - p.thickness); // x of the inner edge's deepest point
      const ctl = w + (extreme - w) / 0.75;
      b.curveTo(ctl, h, ctl, 0, w, 0);
      return { closed: true, pts: b.closeMerge() };
    },
  },
  {
    id: 'callout',
    name: 'Callout',
    params: [
      { key: 'tailX', label: 'Tail position', min: 0.05, max: 0.95, step: 0.01, def: 0.25 },
      { key: 'tailLen', label: 'Tail length', min: 0.05, max: 0.6, step: 0.01, def: 0.25 },
      { key: 'corner', label: 'Corners', min: 0, max: 1, step: 0.01, def: 0.3 },
    ],
    build: (w, h, p) => {
      const bodyH = h * (1 - p.tailLen);
      const tx = w * p.tailX;
      const half = Math.min(w * 0.08, 14);
      return { closed: true, pts: polygonPath([V(0, 0), V(w, 0), V(w, bodyH), V(tx + half * 2, bodyH), V(tx, h), V(tx, bodyH), V(0, bodyH)], p.corner) };
    },
  },
  {
    id: 'spiral',
    name: 'Spiral',
    open: true,
    params: [
      { key: 'turns', label: 'Turns', min: 0.5, max: 10, step: 0.1, def: 3 },
      { key: 'decay', label: 'Tightness', min: 0.05, max: 1, step: 0.01, def: 1 },
    ],
    build: (w, h, p) => {
      const steps = Math.max(12, Math.round(p.turns * 24));
      const pts: Pt[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const a = t * p.turns * TAU - Math.PI / 2;
        const r = Math.pow(t, p.decay);
        pts.push({ x: w / 2 + (Math.cos(a) * w * r) / 2, y: h / 2 + (Math.sin(a) * h * r) / 2, hx: 0, hy: 0 });
      }
      return { closed: false, pts };
    },
  },
];

function ellipseRing(cx: number, cy: number, rx: number, ry: number): Pt[] {
  return [
    { x: cx, y: cy - ry, hx: rx * KAPPA, hy: 0 },
    { x: cx + rx, y: cy, hx: 0, hy: ry * KAPPA },
    { x: cx, y: cy + ry, hx: -rx * KAPPA, hy: 0 },
    { x: cx - rx, y: cy, hx: 0, hy: -ry * KAPPA },
  ];
}

const BY_ID = new Map(SHAPES.map((d) => [d.id, d]));
export const shapeDef = (id: string) => BY_ID.get(id);

export function defaultParams(id: string): Params {
  return Object.fromEntries((shapeDef(id)?.params ?? []).map((q) => [q.key, q.def]));
}

const cache = new WeakMap<Shape, Built>();

/** Anchors of a parametric shape in document coordinates (cached per immutable shape object). */
export function buildShape(s: Shape): Built {
  const hit = cache.get(s);
  if (hit) return hit;
  const def = shapeDef(s.shapeId);
  const w = Math.max(0, s.w);
  const h = Math.max(0, s.h);
  const raw = def ? def.build(w, h, { ...defaultParams(s.shapeId), ...s.params }) : { pts: [], closed: true };
  const move = (p: Pt): Pt => ({ ...p, x: p.x + s.x, y: p.y + s.y });
  const built: Built = { closed: raw.closed, pts: raw.pts.map(move), extra: raw.extra?.map((r) => r.map(move)) };
  cache.set(s, built);
  return built;
}
