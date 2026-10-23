import { useEffect, useRef } from 'react';

const SIZE = 168;
const RING = 15;
const R_OUT = SIZE / 2 - 1;
const R_IN = R_OUT - RING;
const R_TRI = R_IN - 4;

const rad = (deg: number) => ((deg - 90) * Math.PI) / 180; // 0° is straight up, clockwise

const hsvToRgb = (h: number, s: number, v: number): [number, number, number] => {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5) * 255, f(3) * 255, f(1) * 255];
};

/** Triangle corner positions for a hue: pure colour, white, black (the triangle turns with the hue). */
export function triangle(hue: number, cx = SIZE / 2, cy = SIZE / 2) {
  const at = (deg: number) => ({ x: cx + Math.cos(rad(deg)) * R_TRI, y: cy + Math.sin(rad(deg)) * R_TRI });
  return { c: at(hue), w: at(hue + 120), k: at(hue + 240) };
}

/** Saturation and value (0..1) for a point inside the triangle, clamped to it. */
export function pickInTriangle(hue: number, x: number, y: number): { s: number; v: number } {
  const { c, w, k } = triangle(hue);
  const d = (w.y - k.y) * (c.x - k.x) + (k.x - w.x) * (c.y - k.y);
  let a = ((w.y - k.y) * (x - k.x) + (k.x - w.x) * (y - k.y)) / d; // weight of the pure colour
  let b = ((k.y - c.y) * (x - k.x) + (c.x - k.x) * (y - k.y)) / d; // weight of white
  a = Math.max(0, a);
  b = Math.max(0, b);
  const sum = a + b;
  if (sum > 1) (a /= sum), (b /= sum);
  const v = a + b; // 1 - weight of black
  return { v, s: v > 1e-6 ? a / v : 0 };
}

export function ColorWheel({ hue, s, v, onChange }: { hue: number; s: number; v: number; onChange: (h: number, s: number, v: number) => void }) {
  const tri = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<'ring' | 'tri' | null>(null);

  useEffect(() => {
    const cv = tri.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const img = ctx.createImageData(SIZE, SIZE);
    const { c, w, k } = triangle(hue);
    const [pr, pg, pb] = hsvToRgb(hue, 1, 1);
    const d = (w.y - k.y) * (c.x - k.x) + (k.x - w.x) * (c.y - k.y);
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const a = ((w.y - k.y) * (x - k.x) + (k.x - w.x) * (y - k.y)) / d;
        const b = ((k.y - c.y) * (x - k.x) + (c.x - k.x) * (y - k.y)) / d;
        const cc = 1 - a - b;
        const e = Math.min(a, b, cc);
        if (e < -0.012) continue;
        const i = (y * SIZE + x) * 4;
        const al = e < 0 ? 1 + e / 0.012 : 1; // soft edge
        img.data[i] = a * pr + b * 255;
        img.data[i + 1] = a * pg + b * 255;
        img.data[i + 2] = a * pb + b * 255;
        img.data[i + 3] = al * 255;
      }
    ctx.putImageData(img, 0, 0);
  }, [hue]);

  const local = (e: React.PointerEvent) => {
    const r = root.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
  };
  const apply = (e: React.PointerEvent) => {
    const p = local(e);
    if (drag.current === 'ring') {
      const a = (Math.atan2(p.y - SIZE / 2, p.x - SIZE / 2) * 180) / Math.PI + 90;
      onChange(((a % 360) + 360) % 360, s, v);
    } else if (drag.current === 'tri') {
      const q = pickInTriangle(hue, p.x, p.y);
      onChange(hue, q.s, q.v);
    }
  };

  const { c, w, k } = triangle(hue);
  const cx = s * v * c.x + (1 - s) * v * w.x + (1 - v) * k.x;
  const cy = s * v * c.y + (1 - s) * v * w.y + (1 - v) * k.y;
  const hx = SIZE / 2 + Math.cos(rad(hue)) * (R_IN + RING / 2);
  const hy = SIZE / 2 + Math.sin(rad(hue)) * (R_IN + RING / 2);

  return (
    <div
      ref={root}
      className="wheel"
      style={{ width: SIZE, height: SIZE }}
      onPointerDown={(e) => {
        const p = local(e);
        const dist = Math.hypot(p.x - SIZE / 2, p.y - SIZE / 2);
        drag.current = dist >= R_IN - 2 ? 'ring' : 'tri';
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        apply(e);
      }}
      onPointerMove={(e) => drag.current && apply(e)}
      onPointerUp={() => (drag.current = null)}
    >
      <div className="wheel-ring" style={{ width: SIZE, height: SIZE }} />
      <canvas ref={tri} width={SIZE} height={SIZE} />
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} pointerEvents="none">
        <circle cx={hx} cy={hy} r={6} fill="none" stroke="#fff" strokeWidth={2} />
        <circle cx={hx} cy={hy} r={7.5} fill="none" stroke="#000" strokeOpacity=".5" />
        <circle cx={cx} cy={cy} r={5.5} fill="none" stroke="#fff" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={7} fill="none" stroke="#000" strokeOpacity=".5" />
      </svg>
    </div>
  );
}
