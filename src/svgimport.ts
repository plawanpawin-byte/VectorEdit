import { blankShape } from './shape';
import type { Pt, Shape } from './types';

/* A small, forgiving SVG importer: shapes, paths (all commands incl. arcs), groups, transforms and basic styles.
   Gradients, filters, <use>, text and images are skipped. DOM-free so it runs anywhere. */

interface XNode {
  tag: string;
  attrs: Record<string, string>;
  children: XNode[];
}

/** Minimal XML reader: elements and attributes only (comments, CDATA, doctype and text are ignored). */
export function parseXml(src: string): XNode | null {
  const root: XNode = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\?[\s\S]*?\?>|<\/\s*([\w:.-]+)\s*>|<\s*([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[1]) {
      if (stack.length > 1 && stack[stack.length - 1].tag === m[1].replace(/^.*:/, '')) stack.pop();
    } else if (m[2]) {
      const attrs: Record<string, string> = {};
      for (const a of m[3].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = (a[2] ?? a[3]).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      const node: XNode = { tag: m[2].replace(/^.*:/, ''), attrs, children: [] };
      stack[stack.length - 1].children.push(node);
      if (!m[4]) stack.push(node);
    }
  }
  return root.children.find((c) => c.tag === 'svg') ?? null;
}

type Mat = [number, number, number, number, number, number]; // a b c d e f
const I: Mat = [1, 0, 0, 1, 0, 0];
const mul = (p: Mat, q: Mat): Mat => [p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1], p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3], p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5]];
const apply = (m: Mat, x: number, y: number) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
const applyVec = (m: Mat, x: number, y: number) => ({ x: m[0] * x + m[2] * y, y: m[1] * x + m[3] * y });

export function parseTransform(s: string | undefined): Mat {
  let m = I;
  for (const t of (s ?? '').matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const n = t[2].split(/[\s,]+/).filter(Boolean).map(Number);
    const rad = (d: number) => (d * Math.PI) / 180;
    let o: Mat = I;
    switch (t[1]) {
      case 'translate': o = [1, 0, 0, 1, n[0] ?? 0, n[1] ?? 0]; break;
      case 'scale': o = [n[0] ?? 1, 0, 0, n[1] ?? n[0] ?? 1, 0, 0]; break;
      case 'rotate': {
        const c = Math.cos(rad(n[0] ?? 0)), sn = Math.sin(rad(n[0] ?? 0));
        o = [c, sn, -sn, c, 0, 0];
        if (n.length >= 3) o = mul(mul([1, 0, 0, 1, n[1], n[2]], o), [1, 0, 0, 1, -n[1], -n[2]]);
        break;
      }
      case 'skewX': o = [1, 0, Math.tan(rad(n[0] ?? 0)), 1, 0, 0]; break;
      case 'skewY': o = [1, Math.tan(rad(n[0] ?? 0)), 0, 1, 0, 0]; break;
      case 'matrix': if (n.length === 6) o = n as Mat; break;
    }
    m = mul(m, o);
  }
  return m;
}

interface SubPath {
  pts: Pt[];
  closed: boolean;
}

/** Convert an SVG elliptical arc to cubic segments: returns [c1, c2, end] triples. */
function arcToCubics(x1: number, y1: number, rx: number, ry: number, phi: number, large: boolean, sweep: boolean, x2: number, y2: number): [number, number, number, number, number, number][] {
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [[x1, y1, x2, y2, x2, y2]];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) (rx *= Math.sqrt(lam)), (ry *= Math.sqrt(lam));
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dth > 0) dth -= Math.PI * 2;
  if (sweep && dth < 0) dth += Math.PI * 2;
  const n = Math.max(1, Math.ceil(Math.abs(dth) / (Math.PI / 2) - 1e-9));
  const step = dth / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const out: [number, number, number, number, number, number][] = [];
  const pt = (a: number) => ({ x: cx + rx * Math.cos(a) * cp - ry * Math.sin(a) * sp, y: cy + rx * Math.cos(a) * sp + ry * Math.sin(a) * cp });
  const dv = (a: number) => ({ x: -rx * Math.sin(a) * cp - ry * Math.cos(a) * sp, y: -rx * Math.sin(a) * sp + ry * Math.cos(a) * cp });
  for (let i = 0; i < n; i++) {
    const a0 = th1 + i * step, a1 = a0 + step;
    const p0 = pt(a0), p1 = pt(a1), d0 = dv(a0), d1 = dv(a1);
    out.push([p0.x + k * d0.x, p0.y + k * d0.y, p1.x - k * d1.x, p1.y - k * d1.y, i === n - 1 ? x2 : p1.x, i === n - 1 ? y2 : p1.y]);
  }
  return out;
}

/** Parse path data into sub-paths of anchors with Bézier handles. */
export function parsePathData(d: string): SubPath[] {
  const tokens = [...d.matchAll(/([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g)].map((m) => m[1] ?? Number(m[2]));
  const subs: SubPath[] = [];
  let cur: SubPath | null = null;
  let cx = 0, cy = 0, sx = 0, sy = 0;
  let cmd = '';
  type XY = { x: number; y: number };
  let lastC2: XY | null = null as XY | null;
  let lastQ: XY | null = null as XY | null;
  let i = 0;
  const num = () => Number(tokens[i++]);
  const flag = () => {
    const v = tokens[i++];
    return Number(v) !== 0;
  };
  const anchor = (x: number, y: number): Pt => ({ x, y, hx: 0, hy: 0 });
  const start = (x: number, y: number) => {
    cur = { pts: [anchor(x, y)], closed: false };
    subs.push(cur);
    (cx = x), (cy = y), (sx = x), (sy = y);
  };
  const lineTo = (x: number, y: number) => {
    if (!cur) start(cx, cy);
    cur!.pts.push(anchor(x, y));
    (cx = x), (cy = y);
  };
  const cubic = (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => {
    if (!cur) start(cx, cy);
    const last = cur!.pts[cur!.pts.length - 1];
    last.hx = x1 - last.x;
    last.hy = y1 - last.y;
    cur!.pts.push({ x, y, hx: 0, hy: 0, ix: x2 - x, iy: y2 - y });
    (cx = x), (cy = y);
    lastC2 = { x: x2, y: y2 };
  };
  while (i < tokens.length) {
    if (typeof tokens[i] === 'string') cmd = tokens[i++] as string;
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? cx : 0, oy = rel ? cy : 0;
    const up = cmd.toUpperCase();
    const prevC2: XY | null = lastC2, prevQ: XY | null = lastQ;
    lastC2 = null;
    lastQ = null;
    switch (up) {
      case 'M': {
        const x = num() + ox, y = num() + oy;
        start(x, y);
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L': lineTo(num() + ox, num() + oy); break;
      case 'H': lineTo(num() + ox, cy); break;
      case 'V': lineTo(cx, num() + oy); break;
      case 'C': { const a = [num() + ox, num() + oy, num() + ox, num() + oy, num() + ox, num() + oy]; cubic(a[0], a[1], a[2], a[3], a[4], a[5]); break; }
      case 'S': {
        const x2 = num() + ox, y2 = num() + oy, x = num() + ox, y = num() + oy;
        cubic(prevC2 ? 2 * cx - prevC2.x : cx, prevC2 ? 2 * cy - prevC2.y : cy, x2, y2, x, y);
        break;
      }
      case 'Q': {
        const qx = num() + ox, qy = num() + oy, x = num() + ox, y = num() + oy;
        cubic(cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy), x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), x, y);
        lastQ = { x: qx, y: qy };
        break;
      }
      case 'T': {
        const x = num() + ox, y = num() + oy;
        const qx = prevQ ? 2 * cx - prevQ.x : cx, qy = prevQ ? 2 * cy - prevQ.y : cy;
        cubic(cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy), x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), x, y);
        lastQ = { x: qx, y: qy };
        break;
      }
      case 'A': {
        const rx = num(), ry = num(), rot = num(), large = flag(), sweep = flag(), x = num() + ox, y = num() + oy;
        if (!cur) start(cx, cy);
        for (const [a, b, c2, d2, e, f] of arcToCubics(cx, cy, rx, ry, (rot * Math.PI) / 180, large, sweep, x, y)) cubic(a, b, c2, d2, e, f);
        break;
      }
      case 'Z':
        if (cur) {
          const c = cur as SubPath;
          c.closed = true;
          // a closing line that returns to the first point makes the duplicate last anchor redundant
          const f = c.pts[0], l = c.pts[c.pts.length - 1];
          if (c.pts.length > 1 && Math.hypot(f.x - l.x, f.y - l.y) < 1e-6) {
            f.ix = l.ix;
            f.iy = l.iy;
            c.pts.pop();
          }
        }
        (cx = sx), (cy = sy);
        cur = null;
        break;
      default:
        i++; // unknown token: skip it
    }
  }
  return subs.filter((s) => s.pts.length > 0);
}

const NAMED_NONE = new Set(['none', 'transparent']);

interface Style {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  opacity: number;
}

function styleOf(n: XNode, parent: Style): Style {
  const css: Record<string, string> = {};
  for (const decl of (n.attrs.style ?? '').split(';')) {
    const [k, v] = decl.split(':');
    if (k && v) css[k.trim()] = v.trim();
  }
  const get = (k: string) => css[k] ?? n.attrs[k];
  const colour = (v: string | undefined, fallback: string | null) => {
    if (v === undefined) return fallback;
    if (NAMED_NONE.has(v.toLowerCase())) return null;
    if (v === 'currentColor') return '#000000';
    if (v.startsWith('url(')) return fallback ?? '#808080'; // gradients/patterns are not imported
    return v;
  };
  const sw = get('stroke-width');
  const op = get('opacity');
  return {
    fill: colour(get('fill'), parent.fill),
    stroke: colour(get('stroke'), parent.stroke),
    strokeWidth: sw !== undefined && !isNaN(parseFloat(sw)) ? parseFloat(sw) : parent.strokeWidth,
    opacity: parent.opacity * (op !== undefined && !isNaN(parseFloat(op)) ? parseFloat(op) : 1),
  };
}

export interface ImportResult {
  shapes: Shape[];
  /** canvas size the document asks for, when it says */
  width: number;
  height: number;
  skipped: string[];
}

let counter = 0;
const nid = () => `imp${Date.now().toString(36)}${++counter}`;

/** Import SVG markup into shapes positioned relative to the SVG's own viewBox origin. */
export function importSvg(source: string): ImportResult | null {
  const svg = parseXml(source);
  if (!svg) return null;
  const vb = (svg.attrs.viewBox ?? '').split(/[\s,]+/).map(Number);
  const wAttr = parseFloat(svg.attrs.width ?? ''), hAttr = parseFloat(svg.attrs.height ?? '');
  const hasVb = vb.length === 4 && vb.every((v) => !isNaN(v)) && vb[2] > 0 && vb[3] > 0;
  const width = hasVb ? vb[2] : isNaN(wAttr) ? 800 : wAttr;
  const height = hasVb ? vb[3] : isNaN(hAttr) ? 600 : hAttr;
  const shapes: Shape[] = [];
  const skipped = new Set<string>();
  const root: Mat = hasVb ? [1, 0, 0, 1, -vb[0], -vb[1]] : I;

  const mk = (name: string, st: Style, m: Mat, group: string | null, sub: SubPath[], extra: Partial<Shape> = {}) => {
    const mapPt = (p: Pt): Pt => {
      const a = apply(m, p.x, p.y);
      const o = applyVec(m, p.hx, p.hy);
      const out: Pt = { x: a.x, y: a.y, hx: o.x, hy: o.y };
      if (p.ix !== undefined && p.iy !== undefined) {
        const i = applyVec(m, p.ix, p.iy);
        out.ix = i.x;
        out.iy = i.y;
      }
      return out;
    };
    const closedSubs = sub.filter((s) => s.closed);
    const openSubs = sub.filter((s) => !s.closed);
    const base = { fill: st.fill, stroke: st.stroke, strokeWidth: st.strokeWidth, opacity: Math.max(0, Math.min(1, st.opacity)), group, ...extra };
    if (closedSubs.length) {
      const [first, ...rest] = closedSubs;
      shapes.push(blankShape(nid(), 'path', { name, ...base, closed: true, pts: first.pts.map(mapPt), extra: rest.map((r) => r.pts.map(mapPt)) }));
    }
    for (const s of openSubs) shapes.push(blankShape(nid(), 'path', { name, ...base, fill: null, closed: false, pts: s.pts.map(mapPt) }));
  };

  const rect = (x: number, y: number, w: number, h: number, rx: number, ry: number): SubPath => {
    const r = Math.min(Math.max(rx, 0), w / 2), s = Math.min(Math.max(ry || rx, 0), h / 2);
    if (r <= 0 || s <= 0) return { closed: true, pts: [x, y, x + w, y, x + w, y + h, x, y + h].reduce<Pt[]>((a, _v, i, arr) => (i % 2 ? a : [...a, { x: arr[i], y: arr[i + 1], hx: 0, hy: 0 }]), []) };
    const d = `M${x + r} ${y}H${x + w - r}A${r} ${s} 0 0 1 ${x + w} ${y + s}V${y + h - s}A${r} ${s} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${s} 0 0 1 ${x} ${y + h - s}V${y + s}A${r} ${s} 0 0 1 ${x + r} ${y}Z`;
    return parsePathData(d)[0];
  };

  const walk = (n: XNode, parentStyle: Style, parentM: Mat, group: string | null) => {
    const num = (k: string, def = 0) => {
      const v = parseFloat(n.attrs[k] ?? '');
      return isNaN(v) ? def : v;
    };
    if (n.attrs.display === 'none' || n.attrs.visibility === 'hidden') return;
    const m = mul(parentM, parseTransform(n.attrs.transform));
    const st = styleOf(n, parentStyle);
    const name = n.attrs.id ?? n.tag;
    switch (n.tag) {
      case 'g':
      case 'svg': {
        const gid = n.tag === 'g' && n.children.length > 1 ? `g${nid()}` : group;
        const inner = gid && group && gid !== group ? `${group}/${gid}` : gid;
        for (const c of n.children) walk(c, st, m, inner);
        break;
      }
      case 'rect': mk(name, st, m, group, [rect(num('x'), num('y'), num('width'), num('height'), num('rx'), num('ry'))]); break;
      case 'circle': {
        const r = num('r');
        mk(name, st, m, group, parsePathData(`M${num('cx') - r} ${num('cy')}A${r} ${r} 0 1 0 ${num('cx') + r} ${num('cy')}A${r} ${r} 0 1 0 ${num('cx') - r} ${num('cy')}Z`));
        break;
      }
      case 'ellipse': {
        const rx = num('rx'), ry = num('ry'), cx = num('cx'), cy = num('cy');
        mk(name, st, m, group, parsePathData(`M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`));
        break;
      }
      case 'line': mk(name, { ...st, fill: null }, m, group, parsePathData(`M${num('x1')} ${num('y1')}L${num('x2')} ${num('y2')}`)); break;
      case 'polyline':
      case 'polygon': {
        const p = (n.attrs.points ?? '').split(/[\s,]+/).filter(Boolean).map(Number);
        if (p.length >= 4) mk(name, st, m, group, parsePathData(`M${p[0]} ${p[1]}` + p.slice(2).reduce((a, v, i) => a + (i % 2 ? ` ${v}` : `L${v}`), '') + (n.tag === 'polygon' ? 'Z' : '')));
        break;
      }
      case 'path': if (n.attrs.d) mk(name, st, m, group, parsePathData(n.attrs.d)); break;
      case 'defs': case 'title': case 'desc': case 'metadata': case 'style': case 'linearGradient': case 'radialGradient': case 'clipPath': case 'mask': case 'symbol': break;
      default: skipped.add(n.tag);
    }
  };

  const baseStyle: Style = { fill: '#000000', stroke: null, strokeWidth: 1, opacity: 1 };
  walk(svg, baseStyle, root, null);
  return { shapes, width, height, skipped: [...skipped] };
}
