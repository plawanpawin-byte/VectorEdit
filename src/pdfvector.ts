import { extraOf, isClosed, ptsOf, toPath } from './geometry';
import type { PdfVectorPage } from './pdf';
import type { Artboard, Pt, Shape } from './types';

const PT = 0.75;
const NAMED: Record<string, string> = { black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', gray: '#808080', grey: '#808080', orange: '#ffa500', purple: '#800080' };

/** Parse #rgb / #rrggbb / a few names into 0..1 components; null when the colour cannot be expressed. */
export function rgb(c: string | null): [number, number, number] | null {
  if (!c) return null;
  const v = NAMED[c.toLowerCase()] ?? c;
  const m = /^#([0-9a-f]{6}|[0-9a-f]{3})([0-9a-f]{2})?$/i.exec(v);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

const n = (v: number) => (Math.round(v * 1000) / 1000).toString();

/** Why a shape cannot be written as plain vector operators (null = it can). */
export function unsupported(s: Shape): string | null {
  if (!s.visible) return null;
  if (s.adjust) return 'adjustment layer';
  if (s.kind === 'text') return 'text';
  if (s.raster || s.src || s.frame) return 'image';
  if (s.gradient || s.mesh || s.pattern || s.fade) return 'gradient or pattern fill';
  if (s.effects?.some((e) => e.enabled)) return 'effects';
  if (s.blend && s.blend !== 'normal') return 'blend mode';
  if (s.clip) return 'clipping mask';
  if (s.fill && !rgb(s.fill)) return 'colour';
  if (s.stroke && !rgb(s.stroke)) return 'colour';
  if ((s.arrowStart || s.arrowEnd) && s.stroke) return 'arrowheads';
  if (s.stroke && s.strokeAlign && s.strokeAlign !== 'center') return 'stroke alignment';
  return null;
}

function ring(pts: Pt[], closed: boolean, tx: (x: number, y: number) => [number, number]): string {
  if (!pts.length) return '';
  const [x0, y0] = tx(pts[0].x, pts[0].y);
  let out = `${n(x0)} ${n(y0)} m\n`;
  const seg = (a: Pt, b: Pt) => {
    const c1 = tx(a.x + a.hx, a.y + a.hy);
    const c2 = tx(b.x + (b.ix ?? -b.hx), b.y + (b.iy ?? -b.hy));
    const e = tx(b.x, b.y);
    return a.hx === 0 && a.hy === 0 && (b.ix ?? -b.hx) === 0 && (b.iy ?? -b.hy) === 0 ? `${n(e[0])} ${n(e[1])} l\n` : `${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(e[0])} ${n(e[1])} c\n`;
  };
  for (let i = 0; i < pts.length - 1; i++) out += seg(pts[i], pts[i + 1]);
  if (closed && pts.length > 1) out += seg(pts[pts.length - 1], pts[0]) + 'h\n';
  return out;
}

/**
 * A vector PDF page for the artboard, or null (with the reason) when something on it needs rasterising.
 * Strokes, fills, opacity, dashes, caps and joins are kept as real vector operators.
 */
export function vectorPage(shapes: Shape[], board: Artboard): { page: PdfVectorPage } | { reason: string } {
  const visible = shapes.filter((s) => s.visible && s.x + s.w >= board.x && s.x <= board.x + board.w && s.y + s.h >= board.y && s.y <= board.y + board.h);
  for (const s of visible) {
    const why = unsupported(s);
    if (why) return { reason: `“${s.name}” uses ${why}` };
  }
  const tx = (x: number, y: number): [number, number] => [(x - board.x) * PT, (board.h - (y - board.y)) * PT];
  const alphas: number[] = [];
  let content = `1 1 1 rg 0 0 ${n(board.w * PT)} ${n(board.h * PT)} re f\n`;
  for (const s of visible) {
    const path = toPath(s);
    const main = ptsOf(path);
    if (!main.length) continue;
    const fill = rgb(s.fill);
    const stroke = s.stroke && s.strokeWidth > 0 ? rgb(s.stroke) : null;
    if (!fill && !stroke) continue;
    const closed = isClosed(path);
    const alpha = Math.max(0, Math.min(1, s.opacity));
    content += 'q\n';
    if (alpha < 1) {
      let k = alphas.indexOf(alpha);
      if (k < 0) k = alphas.push(alpha) - 1;
      content += `/GS${k} gs\n`;
    }
    if (fill && closed) content += `${rgb(s.fill)!.map(n).join(' ')} rg\n`;
    if (stroke) {
      content += `${stroke.map(n).join(' ')} RG ${n(s.strokeWidth * PT)} w ${s.cap === 'butt' ? 0 : s.cap === 'square' ? 2 : 1} J ${s.join === 'miter' ? 0 : s.join === 'bevel' ? 2 : 1} j\n`;
      const sw = s.strokeWidth * PT;
      if (s.dash === 'dash') content += `[${n(sw * 4)} ${n(sw * 3)}] 0 d\n`;
      else if (s.dash === 'dot') content += `[0 ${n(sw * 2)}] 0 d\n`;
    }
    content += ring(main, closed, tx);
    for (const r of extraOf(path)) content += ring(r, true, tx);
    const hasHoles = extraOf(path).length > 0;
    const doFill = !!fill && closed;
    content += doFill && stroke ? (hasHoles ? 'B*' : 'B') : doFill ? (hasHoles ? 'f*' : 'f') : stroke ? 'S' : 'n';
    content += '\nQ\n';
  }
  return { page: { width: board.w, height: board.h, content, alphas } };
}
