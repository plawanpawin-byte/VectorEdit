import { inCtl, outCtl } from './geometry';
import type { Pt } from './types';

interface P2 {
  x: number;
  y: number;
}

const lerp = (a: P2, b: P2, t: number): P2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const segCount = (pts: Pt[], closed: boolean) => (closed ? pts.length : pts.length - 1);

function segPoint(a: Pt, b: Pt, t: number): P2 {
  const c1 = outCtl(a);
  const c2 = inCtl(b);
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
  };
}

export interface Nearest {
  seg: number;
  t: number;
  dist: number;
  pt: P2;
}

/** Closest point on a path to p, found by sampling every segment. */
export function nearestOnPath(pts: Pt[], closed: boolean, p: P2, samples = 32): Nearest | null {
  const n = segCount(pts, closed);
  if (n < 1) return null;
  let best: Nearest | null = null;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    let prevT = 0;
    let prev = segPoint(a, b, 0);
    for (let k = 1; k <= samples; k++) {
      const t = k / samples;
      const cur = segPoint(a, b, t);
      // project p onto the little chord prev -> cur
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const len = dx * dx + dy * dy;
      const u = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - prev.x) * dx + (p.y - prev.y) * dy) / len));
      const q = { x: prev.x + dx * u, y: prev.y + dy * u };
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (!best || d < best.dist) best = { seg: i, t: prevT + (t - prevT) * u, dist: d, pt: q };
      prev = cur;
      prevT = t;
    }
  }
  return best;
}

/** Insert a node on segment `seg` at parameter t, keeping the curve's shape (de Casteljau). */
export function insertNode(pts: Pt[], closed: boolean, seg: number, t: number): Pt[] {
  const next = pts.map((q) => ({ ...q }));
  const ai = seg;
  const bi = (seg + 1) % next.length;
  const a = next[ai];
  const b = next[bi];
  const aIn = inCtl(a);
  const bOut = outCtl(b);
  const c1 = outCtl(a);
  const c2 = inCtl(b);
  const p01 = lerp(a, c1, t);
  const p12 = lerp(c1, c2, t);
  const p23 = lerp(c2, b, t);
  const p012 = lerp(p01, p12, t);
  const p123 = lerp(p12, p23, t);
  const m = lerp(p012, p123, t);
  // keep the neighbours' other handle exactly as it was, then give the shared handle its new value
  a.ix = aIn.x - a.x;
  a.iy = aIn.y - a.y;
  a.hx = p01.x - a.x;
  a.hy = p01.y - a.y;
  b.hx = bOut.x - b.x;
  b.hy = bOut.y - b.y;
  b.ix = p23.x - b.x;
  b.iy = p23.y - b.y;
  const node: Pt = { x: m.x, y: m.y, hx: p123.x - m.x, hy: p123.y - m.y, ix: p012.x - m.x, iy: p012.y - m.y };
  next.splice(ai + 1, 0, node);
  void closed;
  return next;
}

/** Remove nodes by index; returns null if too few remain for a path. */
export function deleteNodes(pts: Pt[], remove: number[]): Pt[] | null {
  const drop = new Set(remove);
  const out = pts.filter((_, i) => !drop.has(i)).map((q) => ({ ...q }));
  return out.length >= 2 ? out : null;
}

const hasHandle = (p: Pt) => !!(p.hx || p.hy || p.ix || p.iy);

/** Corner tool: turn a smooth node sharp, or a sharp node smooth. */
export function toggleNode(pts: Pt[], closed: boolean, i: number): Pt[] {
  const next = pts.map((q) => ({ ...q }));
  const p = next[i];
  if (hasHandle(p)) {
    p.hx = p.hy = 0;
    p.ix = p.iy = 0;
    return next;
  }
  const prev = next[closed ? (i - 1 + next.length) % next.length : Math.max(0, i - 1)];
  const nxt = next[closed ? (i + 1) % next.length : Math.min(next.length - 1, i + 1)];
  p.hx = (nxt.x - prev.x) / 6;
  p.hy = (nxt.y - prev.y) / 6;
  delete p.ix;
  delete p.iy;
  return next;
}

/** Set a node's handle symmetrically (drag with the corner tool). */
export function setSmoothHandle(pts: Pt[], i: number, hx: number, hy: number): Pt[] {
  const next = pts.map((q) => ({ ...q }));
  next[i].hx = hx;
  next[i].hy = hy;
  delete next[i].ix;
  delete next[i].iy;
  return next;
}

/**
 * Split a path at (seg, t). An open path becomes two open paths. A closed path becomes one open
 * path that starts and ends at the cut. Returns the resulting point lists.
 */
export function splitPath(pts: Pt[], closed: boolean, seg: number, t: number): Pt[][] {
  const withNode = insertNode(pts, closed, seg, t);
  const k = seg + 1; // index of the new node
  const clone = (p: Pt): Pt => ({ ...p });
  if (!closed) {
    const first = withNode.slice(0, k + 1).map(clone);
    const second = withNode.slice(k).map(clone);
    // the cut ends carry no handle towards the removed side
    first[first.length - 1].hx = first[first.length - 1].hy = 0;
    second[0].ix = second[0].iy = 0;
    return [first, second].filter((r) => r.length >= 2);
  }
  const rotated = [...withNode.slice(k), ...withNode.slice(0, k)].map(clone);
  const end = clone(rotated[0]);
  rotated[0].ix = rotated[0].iy = 0;
  end.hx = end.hy = 0;
  return [[...rotated, end]];
}
