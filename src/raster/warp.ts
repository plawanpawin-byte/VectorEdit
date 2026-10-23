import type { Mapping } from '../warp';
import { type Buf, sample } from './pixels';

export interface LayerGeometry {
  x: number;
  y: number;
  w: number;
  h: number;
  rw: number;
  rh: number;
}

/**
 * Resample a pixel layer through a warp. `inverse` maps a document point after the warp back to where it came
 * from before the warp (both in document units). Areas the source does not cover become transparent.
 */
export function warpBuf(src: Buf, g: LayerGeometry, inverse: Mapping): Buf {
  const out: Buf = { width: src.width, height: src.height, data: new Uint8ClampedArray(src.data.length) };
  const sx = g.w / g.rw;
  const sy = g.h / g.rh;
  for (let py = 0; py < out.height; py++)
    for (let px = 0; px < out.width; px++) {
      const from = inverse({ x: g.x + (px + 0.5) * sx, y: g.y + (py + 0.5) * sy });
      const u = (from.x - g.x) / sx - 0.5;
      const v = (from.y - g.y) / sy - 0.5;
      if (u < -0.5 || v < -0.5 || u > src.width - 0.5 || v > src.height - 0.5) continue;
      const i = (py * out.width + px) * 4;
      for (let c = 0; c < 4; c++) out.data[i + c] = sample(src, u, v, c);
    }
  return out;
}
