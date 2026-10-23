/* Colour scopes: histogram, waveform and vectorscope computed from RGBA pixel data. DOM-free. */

export interface Pixels {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export interface Histogram {
  r: Uint32Array;
  g: Uint32Array;
  b: Uint32Array;
  y: Uint32Array;
  max: number;
}

export function histogram(img: Pixels): Histogram {
  const h: Histogram = { r: new Uint32Array(256), g: new Uint32Array(256), b: new Uint32Array(256), y: new Uint32Array(256), max: 1 };
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 8) continue;
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    h.r[r]++;
    h.g[g]++;
    h.b[b]++;
    h.y[Math.round(luma(r, g, b))]++;
  }
  // ignore the extreme bins when scaling so a pure white page does not flatten the rest
  for (const ch of [h.r, h.g, h.b, h.y]) for (let i = 1; i < 255; i++) h.max = Math.max(h.max, ch[i]);
  return h;
}

/** Brightness of each image column: `cols` columns by 256 levels, counts as a fraction of the pixels in the column. */
export function waveform(img: Pixels, cols = 128): Float32Array {
  const out = new Float32Array(cols * 256);
  const perCol = Math.max(1, Math.floor(img.width / cols));
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if (img.data[i + 3] < 8) continue;
      const c = Math.min(cols - 1, Math.floor(x / perCol));
      out[c * 256 + Math.round(luma(img.data[i], img.data[i + 1], img.data[i + 2]))] += 1 / (img.height * perCol);
    }
  return out;
}

/** Chroma distribution on a size×size grid (U horizontal, V vertical, centre = neutral). */
export function vectorscope(img: Pixels, size = 96): Float32Array {
  const out = new Float32Array(size * size);
  const step = Math.max(1, Math.floor((img.width * img.height) / 40000));
  for (let p = 0; p < img.width * img.height; p += step) {
    const i = p * 4;
    if (img.data[i + 3] < 8) continue;
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    const u = (-0.1687 * r - 0.3313 * g + 0.5 * b) / 128; // -1..1
    const v = (0.5 * r - 0.4187 * g - 0.0813 * b) / 128;
    const x = Math.min(size - 1, Math.max(0, Math.round((u * 0.5 + 0.5) * (size - 1))));
    const y = Math.min(size - 1, Math.max(0, Math.round((-v * 0.5 + 0.5) * (size - 1))));
    out[y * size + x]++;
  }
  return out;
}
