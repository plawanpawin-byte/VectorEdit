/* Pure pixel helpers shared by filters, adjustments and selections. They work on any object shaped
   like ImageData, so they run in the browser and in unit tests alike. */

export interface Buf {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export const clamp = (v: number, lo = 0, hi = 255) => (v < lo ? lo : v > hi ? hi : v);

export function newBuf(width: number, height: number): Buf {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function copyBuf(b: Buf): Buf {
  return { width: b.width, height: b.height, data: new Uint8ClampedArray(b.data) };
}

export const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/* ---------- colour spaces ---------- */

/** r,g,b in 0..255 -> h 0..360, s 0..1, l 0..1 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

const hue2rgb = (p: number, q: number, t: number) => {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
};

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = (((h % 360) + 360) % 360) / 360;
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
}

/* ---------- blur ---------- */

/** One horizontal-or-vertical running-mean pass over the selected channels. */
function boxPass(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, r: number, horizontal: boolean, channels: number[]) {
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const stride = horizontal ? 4 : w * 4;
  const lineStride = horizontal ? w * 4 : 4;
  const win = 2 * r + 1;
  for (let line = 0; line < lines; line++) {
    for (const ch of channels) {
      const base = line * lineStride + ch;
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += src[base + Math.min(len - 1, Math.max(0, i)) * stride];
      for (let i = 0; i < len; i++) {
        dst[base + i * stride] = sum / win;
        const add = Math.min(len - 1, i + r + 1);
        const sub = Math.max(0, i - r);
        sum += src[base + add * stride] - src[base + sub * stride];
      }
    }
  }
}

/** Box blur with independent horizontal and vertical radii (pixels). Alpha is blurred too unless excluded. */
export function boxBlur(b: Buf, rx: number, ry: number, channels = [0, 1, 2, 3]) {
  rx = Math.round(rx);
  ry = Math.round(ry);
  if (rx < 1 && ry < 1) return;
  const tmp = new Uint8ClampedArray(b.data);
  if (rx >= 1) boxPass(b.data, tmp, b.width, b.height, rx, true, channels);
  else tmp.set(b.data);
  if (ry >= 1) boxPass(tmp, b.data, b.width, b.height, ry, false, channels);
  else b.data.set(tmp);
}

/** Gaussian blur approximated by three box passes. */
export function gaussianBlur(b: Buf, radius: number, channels = [0, 1, 2, 3]) {
  if (radius < 0.5) return;
  const sigma = radius / 2;
  const boxR = Math.max(1, Math.round((Math.sqrt((12 * sigma * sigma) / 3 + 1) - 1) / 2));
  for (let i = 0; i < 3; i++) boxBlur(b, boxR, boxR, channels);
}

/** Bilinear sample of a channel. */
export function sample(b: Buf, x: number, y: number, ch: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const get = (px: number, py: number) => b.data[(Math.min(b.height - 1, Math.max(0, py)) * b.width + Math.min(b.width - 1, Math.max(0, px))) * 4 + ch];
  return (get(x0, y0) * (1 - fx) + get(x0 + 1, y0) * fx) * (1 - fy) + (get(x0, y0 + 1) * (1 - fx) + get(x0 + 1, y0 + 1) * fx) * fy;
}

/* ---------- flood fill / selection ---------- */

/**
 * Mask (0 or 255 per pixel) of pixels similar to the seed pixel. With `contiguous` it grows from the
 * seed through neighbours (scanline fill); otherwise every similar pixel in the image qualifies.
 */
export function floodMask(b: Buf, sx: number, sy: number, tolerance: number, contiguous: boolean): Uint8Array {
  const { width: w, height: h, data } = b;
  const mask = new Uint8Array(w * h);
  sx = Math.floor(sx);
  sy = Math.floor(sy);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return mask;
  const si = (sy * w + sx) * 4;
  const tr = data[si];
  const tg = data[si + 1];
  const tb = data[si + 2];
  const ta = data[si + 3];
  const tol2 = tolerance * tolerance * 4; // tolerance is a per-channel difference
  const similar = (i: number) => {
    const dr = data[i] - tr;
    const dg = data[i + 1] - tg;
    const db = data[i + 2] - tb;
    const da = data[i + 3] - ta;
    return dr * dr + dg * dg + db * db + da * da <= tol2;
  };
  if (!contiguous) {
    for (let p = 0; p < w * h; p++) if (similar(p * 4)) mask[p] = 255;
    return mask;
  }
  const stack: number[] = [sx, sy];
  while (stack.length) {
    const y = stack.pop()!;
    let x = stack.pop()!;
    while (x >= 0 && !mask[y * w + x] && similar((y * w + x) * 4)) x--;
    x++;
    let up = false;
    let down = false;
    while (x < w && !mask[y * w + x] && similar((y * w + x) * 4)) {
      mask[y * w + x] = 255;
      if (y > 0) {
        const ok = !mask[(y - 1) * w + x] && similar(((y - 1) * w + x) * 4);
        if (ok && !up) stack.push(x, y - 1);
        up = ok;
      }
      if (y < h - 1) {
        const ok = !mask[(y + 1) * w + x] && similar(((y + 1) * w + x) * 4);
        if (ok && !down) stack.push(x, y + 1);
        down = ok;
      }
      x++;
    }
  }
  return mask;
}

/** Grow (positive) or shrink (negative) a 0..255 mask by `r` pixels using a square structuring element. */
export function morphMask(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const grow = r > 0;
  r = Math.abs(Math.round(r));
  if (!r) return mask;
  const pass = (src: Uint8Array, horizontal: boolean) => {
    const dst = new Uint8Array(src.length);
    const len = horizontal ? w : h;
    const lines = horizontal ? h : w;
    for (let line = 0; line < lines; line++) {
      for (let i = 0; i < len; i++) {
        let v = grow ? 0 : 255;
        for (let k = -r; k <= r; k++) {
          const j = Math.min(len - 1, Math.max(0, i + k));
          const val = src[horizontal ? line * w + j : j * w + line];
          v = grow ? Math.max(v, val) : Math.min(v, val);
        }
        dst[horizontal ? line * w + i : i * w + line] = v;
      }
    }
    return dst;
  };
  return pass(pass(mask, true), false);
}
