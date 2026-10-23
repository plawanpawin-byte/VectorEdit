import type { Shape } from '../types';
import { luma, rgbToHsl, type Buf } from './pixels';
import { combineMasks, selectionFor, setSelection } from './selection';
import { workingCanvas } from './layer';

export type RangeKind = 'shadows' | 'midtones' | 'highlights' | 'reds' | 'greens' | 'blues' | 'transparent' | 'opaque';

export const RANGE_LABELS: Record<RangeKind, string> = {
  shadows: 'Shadows',
  midtones: 'Midtones',
  highlights: 'Highlights',
  reds: 'Reds',
  greens: 'Greens',
  blues: 'Blues',
  transparent: 'Transparent',
  opaque: 'Opaque',
};

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** Soft 0..255 mask of the pixels belonging to a tonal or colour range. */
export function rangeMask(b: Buf, kind: RangeKind): Uint8Array {
  const out = new Uint8Array(b.width * b.height);
  for (let p = 0, i = 0; p < out.length; p++, i += 4) {
    const r = b.data[i], g = b.data[i + 1], bl = b.data[i + 2], a = b.data[i + 3];
    const y = luma(r, g, bl) / 255;
    let k = 0;
    switch (kind) {
      case 'shadows': k = 1 - smooth((y - 0.2) / 0.3); break;
      case 'highlights': k = smooth((y - 0.5) / 0.3); break;
      case 'midtones': k = Math.max(0, 1 - Math.abs(y - 0.5) / 0.3); break;
      case 'transparent': k = 1 - a / 255; break;
      case 'opaque': k = a / 255; break;
      default: {
        const [h, s] = rgbToHsl(r, g, bl);
        const centre = kind === 'reds' ? 0 : kind === 'greens' ? 120 : 240;
        const d = Math.abs(((h - centre + 540) % 360) - 180);
        k = Math.max(0, 1 - d / 60) * Math.min(1, s * 3) * (a / 255);
      }
    }
    out[p] = Math.round(Math.min(1, Math.max(0, k)) * 255);
  }
  return out;
}

/** Select a range on the layer, replacing or adding to the current selection. */
export async function selectRange(layer: Shape, kind: RangeKind, mode: 'replace' | 'add' | 'subtract' | 'intersect' = 'replace') {
  const canvas = await workingCanvas(layer);
  const img = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  const mask = rangeMask(img, kind);
  setSelection(layer, combineMasks(selectionFor(layer)?.mask ?? null, mask, mode));
}

/** Turn the selection into a band of `px` pixels along its edge. */
export function outlineSelection(layer: Shape, px: number) {
  const cur = selectionFor(layer);
  if (!cur) return;
  const w = cur.w, h = cur.h;
  const out = new Uint8Array(cur.mask.length);
  const r = Math.max(1, Math.round(px));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const here = cur.mask[y * w + x] > 127;
      let edge = false;
      for (let dy = -r; dy <= r && !edge; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx, ny = y + dy;
          const there = nx >= 0 && ny >= 0 && nx < w && ny < h ? cur.mask[ny * w + nx] > 127 : false;
          if (there !== here) { edge = true; break; }
        }
      out[y * w + x] = edge ? 255 : 0;
    }
  setSelection(layer, out);
}
