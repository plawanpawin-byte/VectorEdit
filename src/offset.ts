import ClipperLib from 'clipper-lib';
import { rings } from './geometry';
import type { Pt, Shape } from './types';

interface P2 {
  x: number;
  y: number;
}

const SCALE = 1000; // Clipper works on integers

export type JoinStyle = 'round' | 'miter' | 'bevel';
export type CapStyle = 'butt' | 'round' | 'square';

const toClip = (r: P2[]) => r.map((p) => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) }));
const fromClip = (paths: { X: number; Y: number }[][]): P2[][] => paths.map((p) => p.map((q) => ({ x: q.X / SCALE, y: q.Y / SCALE })));
const toPts = (r: P2[]): Pt[] => r.map((p) => ({ x: p.x, y: p.y, hx: 0, hy: 0, ix: 0, iy: 0 }));
const joinOf = (j: JoinStyle) => (j === 'round' ? ClipperLib.JoinType.jtRound : j === 'miter' ? ClipperLib.JoinType.jtMiter : ClipperLib.JoinType.jtSquare);

function run(paths: P2[][], delta: number, join: JoinStyle, end: number): P2[][] {
  const co = new ClipperLib.ClipperOffset(join === 'miter' ? 4 : 2, 0.25 * SCALE);
  co.AddPaths(paths.map(toClip), joinOf(join), end);
  const out: { X: number; Y: number }[][] = [];
  co.Execute(out, delta * SCALE);
  return fromClip(out);
}

export interface Contour {
  outer: Pt[];
  holes: Pt[][];
}

/** Group Clipper output into outlines with their holes (orientation tells them apart). */
function group(paths: P2[][]): Contour[] {
  const area = (r: P2[]) => r.reduce((a, p, i) => a + (p.x * r[(i + 1) % r.length].y - r[(i + 1) % r.length].x * p.y), 0) / 2;
  let outers = paths.filter((p) => area(p) > 0).sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
  let holes = paths.filter((p) => area(p) < 0);
  if (!outers.length && holes.length) {
    // some Clipper modes return every outline clockwise: treat them all as outlines
    outers = holes.map((h) => [...h].reverse());
    holes = [];
  }
  const out: Contour[] = outers.map((o) => ({ outer: toPts(o), holes: [] }));
  for (const h of holes) {
    const probe = h[0];
    // a hole belongs to the smallest outline that contains one of its points
    const inside = (o: P2[]) => {
      let c = false;
      for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
        if (o[i].y > probe.y !== o[j].y > probe.y && probe.x < ((o[j].x - o[i].x) * (probe.y - o[i].y)) / (o[j].y - o[i].y) + o[i].x) c = !c;
      }
      return c;
    };
    const host = [...outers].reverse().findIndex(inside);
    const target = host < 0 ? 0 : outers.length - 1 - host;
    if (out[target]) out[target].holes.push(toPts(h));
  }
  return out;
}

/** Grow (positive) or shrink (negative) a closed shape. Holes move the opposite way automatically. */
export function offsetShape(s: Shape, distance: number, join: JoinStyle = 'round'): Contour[] {
  const rs = rings(s, 24);
  if (!rs.length) return [];
  // Clipper wants outlines counter-clockwise (positive area) and holes clockwise
  const area = (r: P2[]) => r.reduce((a, p, i) => a + (p.x * r[(i + 1) % r.length].y - r[(i + 1) % r.length].x * p.y), 0) / 2;
  const oriented = rs.map((r, i) => ((area(r) > 0) === (i === 0) ? r : [...r].reverse()));
  return group(run(oriented, distance, join, ClipperLib.EndType.etClosedPolygon));
}

/** The area covered by a shape's stroke, as filled outlines. */
export function strokeOutline(s: Shape): Contour[] {
  const w = Math.max(0.1, s.strokeWidth);
  const closed = s.closed || s.kind === 'rect' || s.kind === 'ellipse' || s.kind === 'shape';
  const rs = rings(s, 24, true);
  if (!rs.length) return [];
  if (closed) {
    return group(run(rs, w / 2, s.join ?? 'round', ClipperLib.EndType.etClosedLine));
  }
  const end = s.cap === 'butt' ? ClipperLib.EndType.etOpenButt : s.cap === 'square' ? ClipperLib.EndType.etOpenSquare : ClipperLib.EndType.etOpenRound;
  return group(run(rs, w / 2, s.join ?? 'round', end));
}
