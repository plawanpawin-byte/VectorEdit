import type { Pt } from './types';

interface P2 {
  x: number;
  y: number;
}

export interface BrushOptions {
  size: number;
  profile: 'taper' | 'uniform' | 'calligraphic';
  /** fraction of the stroke length used to taper each end (taper profile) */
  taper: number;
}

/** Resample a polyline so consecutive points are about `spacing` apart. */
function resample(raw: P2[], spacing: number): P2[] {
  if (raw.length < 2) return raw.slice();
  const out: P2[] = [raw[0]];
  let carry = 0;
  for (let i = 1; i < raw.length; i++) {
    let a = out[out.length - 1];
    const b = raw[i];
    let d = Math.hypot(b.x - a.x, b.y - a.y);
    while (d + carry >= spacing) {
      const t = (spacing - carry) / d;
      a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      out.push(a);
      d = Math.hypot(b.x - a.x, b.y - a.y);
      carry = 0;
    }
    carry += d;
  }
  const last = raw[raw.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last.x - tail.x, last.y - tail.y) > spacing * 0.25) out.push(last);
  return out;
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Width of the stroke at parameter t (0..1) for a given direction. */
function widthAt(t: number, angle: number, o: BrushOptions): number {
  if (o.profile === 'uniform') return o.size;
  if (o.profile === 'calligraphic') {
    const nib = -Math.PI / 4;
    return o.size * (0.2 + 0.8 * Math.abs(Math.sin(angle - nib)));
  }
  const edge = Math.max(0.01, o.taper / 2);
  const ramp = Math.min(smoothstep(Math.min(1, t / edge)), smoothstep(Math.min(1, (1 - t) / edge)));
  return o.size * (0.08 + 0.92 * ramp);
}

/**
 * Turn a freehand stroke into the outline of a variable-width brush stroke.
 * Returns a closed polygon (straight segments, dense enough to look smooth).
 */
export function brushOutline(raw: P2[], o: BrushOptions): Pt[] {
  const spacing = Math.max(1.2, o.size / 5);
  const pts = resample(raw, spacing);
  if (pts.length < 2) return [];
  const n = pts.length;
  const left: P2[] = [];
  const right: P2[] = [];
  let prevW = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy, dx);
    let w = widthAt(i / (n - 1), angle, o);
    w = i === 0 ? w : prevW * 0.55 + w * 0.45; // smooth the width along the stroke
    prevW = w;
    const nx = -dy / len;
    const ny = dx / len;
    left.push({ x: pts[i].x + (nx * w) / 2, y: pts[i].y + (ny * w) / 2 });
    right.push({ x: pts[i].x - (nx * w) / 2, y: pts[i].y - (ny * w) / 2 });
  }
  const ring = [...left, ...right.reverse()];
  return ring.map((p) => ({ x: p.x, y: p.y, hx: 0, hy: 0, ix: 0, iy: 0 }));
}
