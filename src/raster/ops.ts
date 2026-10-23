import { type Buf, boxBlur, clamp, copyBuf, gaussianBlur, hslToRgb, luma, rgbToHsl, sample } from './pixels';

/* Filters and adjustments. Each operation edits a buffer in place from a record of numeric parameters,
   so the dialog, the tests and any future macro share one definition. */

export interface OpParam {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  def: number;
}

export interface RasterOp {
  id: string;
  name: string;
  kind: 'filter' | 'adjust';
  category: string;
  params: OpParam[];
  apply(b: Buf, p: Record<string, number>): void;
}

const P = (key: string, label: string, min: number, max: number, def: number, step = 1): OpParam => ({ key, label, min, max, step, def });

/** Apply f to every pixel's colour (alpha untouched). */
function perPixel(b: Buf, f: (r: number, g: number, bl: number, a: number) => [number, number, number]) {
  const d = b.data;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, bl] = f(d[i], d[i + 1], d[i + 2], d[i + 3]);
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = bl;
  }
}

function lut(b: Buf, table: (v: number) => number, channels = [0, 1, 2]) {
  const t = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) t[i] = clamp(Math.round(table(i)));
  const d = b.data;
  for (let i = 0; i < d.length; i += 4) for (const c of channels) d[i + c] = t[d[i + c]];
}

/* ===================== adjustments ===================== */

const adjust: RasterOp[] = [
  {
    id: 'brightness-contrast',
    name: 'Brightness / Contrast',
    kind: 'adjust',
    category: 'Tone',
    params: [P('brightness', 'Brightness', -100, 100, 0), P('contrast', 'Contrast', -100, 100, 0)],
    apply(b, p) {
      const c = p.contrast * 2.55;
      const f = (259 * (c + 255)) / (255 * (259 - c));
      lut(b, (v) => f * (v + p.brightness * 2.55 - 128) + 128);
    },
  },
  {
    id: 'levels',
    name: 'Levels',
    kind: 'adjust',
    category: 'Tone',
    params: [P('black', 'Black point', 0, 250, 0), P('white', 'White point', 5, 255, 255), P('gamma', 'Gamma', 0.1, 3, 1, 0.01)],
    apply(b, p) {
      const range = Math.max(1, p.white - p.black);
      lut(b, (v) => 255 * Math.pow(clamp((v - p.black) / range, 0, 1), 1 / p.gamma));
    },
  },
  {
    id: 'exposure',
    name: 'Exposure',
    kind: 'adjust',
    category: 'Tone',
    params: [P('ev', 'Exposure (EV)', -4, 4, 0, 0.05), P('offset', 'Offset', -50, 50, 0), P('gamma', 'Gamma', 0.2, 3, 1, 0.01)],
    apply(b, p) {
      const mul = Math.pow(2, p.ev);
      lut(b, (v) => 255 * Math.pow(clamp((v / 255) * mul + p.offset / 255, 0, 1), 1 / p.gamma));
    },
  },
  {
    id: 'curves',
    name: 'Curves',
    kind: 'adjust',
    category: 'Tone',
    params: [P('shadows', 'Shadows', -60, 60, 0), P('mids', 'Midtones', -60, 60, 0), P('highs', 'Highlights', -60, 60, 0), P('channel', 'Channel (0 all, 1 R, 2 G, 3 B)', 0, 3, 0)],
    apply(b, p) {
      // piecewise-linear curve through (0,0) (64,64+s) (128,128+m) (192,192+h) (255,255), smoothed by averaging
      const pts = [[0, 0], [64, 64 + p.shadows], [128, 128 + p.mids], [192, 192 + p.highs], [255, 255]];
      const f = (v: number) => {
        let i = 0;
        while (i < pts.length - 2 && v > pts[i + 1][0]) i++;
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        return y0 + ((v - x0) / (x1 - x0)) * (y1 - y0);
      };
      const smooth = (v: number) => (f(v - 6) + 2 * f(v) + f(v + 6)) / 4;
      lut(b, smooth, p.channel === 0 ? [0, 1, 2] : [p.channel - 1]);
    },
  },
  {
    id: 'shadows-highlights',
    name: 'Shadows / Highlights',
    kind: 'adjust',
    category: 'Tone',
    params: [P('shadows', 'Shadows', -100, 100, 0), P('highlights', 'Highlights', -100, 100, 0)],
    apply(b, p) {
      perPixel(b, (r, g, bl) => {
        const y = luma(r, g, bl) / 255;
        const lift = (1 - y) * (1 - y) * (p.shadows / 100) * 90;
        const pull = y * y * (p.highlights / 100) * -90;
        return [r + lift + pull, g + lift + pull, bl + lift + pull];
      });
    },
  },
  {
    id: 'hsl',
    name: 'Hue / Saturation / Lightness',
    kind: 'adjust',
    category: 'Colour',
    params: [P('hue', 'Hue', -180, 180, 0), P('sat', 'Saturation', -100, 100, 0), P('light', 'Lightness', -100, 100, 0)],
    apply(b, p) {
      perPixel(b, (r, g, bl) => {
        let [h, s, l] = rgbToHsl(r, g, bl);
        h += p.hue;
        s = clamp(s * (1 + p.sat / 100), 0, 1);
        l = clamp(l + p.light / 200, 0, 1);
        return hslToRgb(h, s, l);
      });
    },
  },
  {
    id: 'vibrance',
    name: 'Vibrance',
    kind: 'adjust',
    category: 'Colour',
    params: [P('amount', 'Vibrance', -100, 100, 0)],
    apply(b, p) {
      perPixel(b, (r, g, bl) => {
        const max = Math.max(r, g, bl);
        const avg = (r + g + bl) / 3;
        const sat = (max - Math.min(r, g, bl)) / 255;
        const k = (p.amount / 100) * (1 - sat); // saturate dull colours more than vivid ones
        return [r + (r - avg) * k, g + (g - avg) * k, bl + (bl - avg) * k];
      });
    },
  },
  {
    id: 'white-balance',
    name: 'White Balance',
    kind: 'adjust',
    category: 'Colour',
    params: [P('temperature', 'Temperature', -100, 100, 0), P('tint', 'Tint', -100, 100, 0)],
    apply(b, p) {
      const t = p.temperature / 100;
      const ti = p.tint / 100;
      perPixel(b, (r, g, bl) => [r * (1 + 0.3 * t), g * (1 - 0.15 * ti), bl * (1 - 0.3 * t)]);
    },
  },
  {
    id: 'colour-balance',
    name: 'Colour Balance',
    kind: 'adjust',
    category: 'Colour',
    params: [P('cyanRed', 'Cyan ↔ Red', -100, 100, 0), P('magentaGreen', 'Magenta ↔ Green', -100, 100, 0), P('yellowBlue', 'Yellow ↔ Blue', -100, 100, 0), P('range', 'Range (0 shadows, 1 mids, 2 highlights)', 0, 2, 1)],
    apply(b, p) {
      perPixel(b, (r, g, bl) => {
        const y = luma(r, g, bl) / 255;
        const w = p.range === 0 ? (1 - y) * (1 - y) : p.range === 2 ? y * y : 1 - Math.pow(2 * y - 1, 2);
        const k = 0.5 * w;
        return [r + p.cyanRed * k, g + p.magentaGreen * k, bl + p.yellowBlue * k];
      });
    },
  },
  {
    id: 'black-white',
    name: 'Black & White',
    kind: 'adjust',
    category: 'Colour',
    params: [P('r', 'Reds', 0, 200, 30), P('g', 'Greens', 0, 200, 59), P('b', 'Blues', 0, 200, 11)],
    apply(b, p) {
      const sum = Math.max(1, p.r + p.g + p.b);
      perPixel(b, (r, g, bl) => {
        const v = (r * p.r + g * p.g + bl * p.b) / sum;
        return [v, v, v];
      });
    },
  },
  {
    id: 'recolour',
    name: 'Recolour',
    kind: 'adjust',
    category: 'Colour',
    params: [P('hue', 'Hue', 0, 360, 30), P('sat', 'Saturation', 0, 100, 60), P('light', 'Lightness', -50, 50, 0)],
    apply(b, p) {
      perPixel(b, (r, g, bl) => hslToRgb(p.hue, p.sat / 100, clamp(luma(r, g, bl) / 255 + p.light / 100, 0, 1)));
    },
  },
  {
    id: 'split-toning',
    name: 'Split Toning',
    kind: 'adjust',
    category: 'Colour',
    params: [P('shadowHue', 'Shadow hue', 0, 360, 220), P('highlightHue', 'Highlight hue', 0, 360, 40), P('amount', 'Amount', 0, 100, 30), P('balance', 'Balance', -100, 100, 0)],
    apply(b, p) {
      const [sr, sg, sb] = hslToRgb(p.shadowHue, 1, 0.5);
      const [hr, hg, hb] = hslToRgb(p.highlightHue, 1, 0.5);
      perPixel(b, (r, g, bl) => {
        const y = clamp(luma(r, g, bl) / 255 + p.balance / 200, 0, 1);
        const k = p.amount / 100;
        const mix = (v: number, s: number, h: number) => v + ((s * (1 - y) + h * y) - 128) * 0.35 * k;
        return [mix(r, sr, hr), mix(g, sg, hg), mix(bl, sb, hb)];
      });
    },
  },
  {
    id: 'posterise',
    name: 'Posterise',
    kind: 'adjust',
    category: 'Effect',
    params: [P('levels', 'Levels', 2, 32, 5)],
    apply(b, p) {
      const n = Math.round(p.levels) - 1;
      lut(b, (v) => Math.round((v / 255) * n) * (255 / n));
    },
  },
  {
    id: 'threshold',
    name: 'Threshold',
    kind: 'adjust',
    category: 'Effect',
    params: [P('level', 'Level', 0, 255, 128)],
    apply(b, p) {
      perPixel(b, (r, g, bl) => {
        const v = luma(r, g, bl) >= p.level ? 255 : 0;
        return [v, v, v];
      });
    },
  },
  { id: 'invert', name: 'Invert', kind: 'adjust', category: 'Effect', params: [], apply: (b) => lut(b, (v) => 255 - v) },
  {
    id: 'auto-levels',
    name: 'Auto Levels',
    kind: 'adjust',
    category: 'Auto',
    params: [P('clip', 'Clip', 0, 5, 0.5, 0.1)],
    apply(b, p) {
      // stretch each channel between its clipped percentiles
      const d = b.data;
      for (let c = 0; c < 3; c++) {
        const hist = new Uint32Array(256);
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3]) (hist[d[i + c]]++, n++);
        if (!n) continue;
        const cut = (n * p.clip) / 100;
        let lo = 0;
        let acc = 0;
        while (lo < 254 && acc + hist[lo] <= cut) acc += hist[lo++];
        let hi = 255;
        acc = 0;
        while (hi > lo + 1 && acc + hist[hi] <= cut) acc += hist[hi--];
        const range = Math.max(1, hi - lo);
        for (let i = 0; i < d.length; i += 4) d[i + c] = clamp(((d[i + c] - lo) / range) * 255);
      }
    },
  },
  {
    id: 'auto-contrast',
    name: 'Auto Contrast',
    kind: 'adjust',
    category: 'Auto',
    params: [],
    apply(b) {
      let lo = 255;
      let hi = 0;
      const d = b.data;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const y = luma(d[i], d[i + 1], d[i + 2]);
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
      }
      const range = Math.max(1, hi - lo);
      lut(b, (v) => ((v - lo) / range) * 255);
    },
  },
  {
    id: 'auto-white-balance',
    name: 'Auto White Balance',
    kind: 'adjust',
    category: 'Auto',
    params: [],
    apply(b) {
      const d = b.data;
      const sum = [0, 0, 0];
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        sum[0] += d[i];
        sum[1] += d[i + 1];
        sum[2] += d[i + 2];
        n++;
      }
      if (!n) return;
      const avg = sum.map((s) => s / n);
      const grey = (avg[0] + avg[1] + avg[2]) / 3; // gray-world assumption
      const gain = avg.map((a) => (a > 1 ? grey / a : 1));
      perPixel(b, (r, g, bl) => [r * gain[0], g * gain[1], bl * gain[2]]);
    },
  },
];

/* ===================== filters ===================== */

function remap(b: Buf, map: (x: number, y: number) => [number, number]) {
  const src = copyBuf(b);
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      const [sx, sy] = map(x, y);
      const i = (y * b.width + x) * 4;
      for (let c = 0; c < 4; c++) b.data[i + c] = sample(src, sx, sy, c);
    }
  }
}

function median3(b: Buf, strength: number) {
  const src = copyBuf(b);
  const { width: w, height: h } = b;
  const win = new Array<number>(9);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let k = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) win[k++] = src.data[(Math.min(h - 1, Math.max(0, y + dy)) * w + Math.min(w - 1, Math.max(0, x + dx))) * 4 + c];
        }
        win.sort((p, q) => p - q);
        const i = (y * w + x) * 4 + c;
        b.data[i] = src.data[i] + (win[4] - src.data[i]) * strength;
      }
    }
  }
}

/** Deterministic pseudo-random numbers so filters are repeatable. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

const filters: RasterOp[] = [
  { id: 'gaussian-blur', name: 'Gaussian Blur', kind: 'filter', category: 'Blur', params: [P('radius', 'Radius', 0, 100, 8, 0.5)], apply: (b, p) => gaussianBlur(b, p.radius) },
  { id: 'box-blur', name: 'Box Blur', kind: 'filter', category: 'Blur', params: [P('radius', 'Radius', 0, 100, 6)], apply: (b, p) => boxBlur(b, p.radius, p.radius) },
  {
    id: 'motion-blur',
    name: 'Motion Blur',
    kind: 'filter',
    category: 'Blur',
    params: [P('angle', 'Angle', 0, 180, 0), P('distance', 'Distance', 1, 100, 20)],
    apply(b, p) {
      const src = copyBuf(b);
      const a = (p.angle * Math.PI) / 180;
      const n = Math.max(2, Math.round(p.distance));
      for (let y = 0; y < b.height; y++) {
        for (let x = 0; x < b.width; x++) {
          const i = (y * b.width + x) * 4;
          const acc = [0, 0, 0, 0];
          for (let k = 0; k < n; k++) {
            const t = k / (n - 1) - 0.5;
            for (let c = 0; c < 4; c++) acc[c] += sample(src, x + Math.cos(a) * t * p.distance, y + Math.sin(a) * t * p.distance, c);
          }
          for (let c = 0; c < 4; c++) b.data[i + c] = acc[c] / n;
        }
      }
    },
  },
  {
    id: 'radial-blur',
    name: 'Radial Blur',
    kind: 'filter',
    category: 'Blur',
    params: [P('amount', 'Amount', 0, 40, 10)],
    apply(b, p) {
      const src = copyBuf(b);
      const cx = b.width / 2;
      const cy = b.height / 2;
      const n = 12;
      for (let y = 0; y < b.height; y++) {
        for (let x = 0; x < b.width; x++) {
          const i = (y * b.width + x) * 4;
          const acc = [0, 0, 0, 0];
          for (let k = 0; k < n; k++) {
            const s = 1 - (k / (n - 1)) * (p.amount / 100);
            for (let c = 0; c < 4; c++) acc[c] += sample(src, cx + (x - cx) * s, cy + (y - cy) * s, c);
          }
          for (let c = 0; c < 4; c++) b.data[i + c] = acc[c] / n;
        }
      }
    },
  },
  {
    id: 'unsharp-mask',
    name: 'Unsharp Mask',
    kind: 'filter',
    category: 'Sharpen',
    params: [P('radius', 'Radius', 0.5, 40, 3, 0.5), P('amount', 'Amount', 0, 400, 120), P('threshold', 'Threshold', 0, 50, 0)],
    apply(b, p) {
      const blur = copyBuf(b);
      gaussianBlur(blur, p.radius, [0, 1, 2]);
      const k = p.amount / 100;
      for (let i = 0; i < b.data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          const diff = b.data[i + c] - blur.data[i + c];
          if (Math.abs(diff) >= p.threshold) b.data[i + c] = clamp(b.data[i + c] + diff * k);
        }
      }
    },
  },
  {
    id: 'clarity',
    name: 'Clarity',
    kind: 'filter',
    category: 'Sharpen',
    params: [P('amount', 'Amount', -100, 100, 30), P('radius', 'Radius', 5, 100, 30)],
    apply(b, p) {
      const blur = copyBuf(b);
      gaussianBlur(blur, p.radius, [0, 1, 2]);
      const k = p.amount / 100;
      for (let i = 0; i < b.data.length; i += 4) {
        const y = luma(b.data[i], b.data[i + 1], b.data[i + 2]) / 255;
        const mid = 1 - Math.pow(2 * y - 1, 2); // act mostly on midtones
        const diff = luma(b.data[i], b.data[i + 1], b.data[i + 2]) - luma(blur.data[i], blur.data[i + 1], blur.data[i + 2]);
        for (let c = 0; c < 3; c++) b.data[i + c] = clamp(b.data[i + c] + diff * k * mid * 1.5);
      }
    },
  },
  {
    id: 'high-pass',
    name: 'High Pass',
    kind: 'filter',
    category: 'Sharpen',
    params: [P('radius', 'Radius', 1, 100, 6, 0.5)],
    apply(b, p) {
      const blur = copyBuf(b);
      gaussianBlur(blur, p.radius, [0, 1, 2]);
      for (let i = 0; i < b.data.length; i += 4) for (let c = 0; c < 3; c++) b.data[i + c] = clamp(128 + b.data[i + c] - blur.data[i + c]);
    },
  },
  {
    id: 'add-noise',
    name: 'Add Noise',
    kind: 'filter',
    category: 'Noise',
    params: [P('amount', 'Amount', 0, 100, 20), P('mono', 'Monochrome (0/1)', 0, 1, 1)],
    apply(b, p) {
      const r = rng(1234);
      const k = p.amount * 2.55;
      for (let i = 0; i < b.data.length; i += 4) {
        const n = (r() - 0.5) * k;
        for (let c = 0; c < 3; c++) b.data[i + c] = clamp(b.data[i + c] + (p.mono ? n : (r() - 0.5) * k));
      }
    },
  },
  { id: 'denoise', name: 'Denoise', kind: 'filter', category: 'Noise', params: [P('strength', 'Strength', 0, 100, 70)], apply: (b, p) => median3(b, p.strength / 100) },
  {
    id: 'dust-scratch',
    name: 'Dust & Scratches',
    kind: 'filter',
    category: 'Noise',
    params: [P('threshold', 'Threshold', 0, 100, 20)],
    apply(b, p) {
      const med = copyBuf(b);
      median3(med, 1);
      for (let i = 0; i < b.data.length; i += 4) {
        const diff = Math.abs(luma(b.data[i], b.data[i + 1], b.data[i + 2]) - luma(med.data[i], med.data[i + 1], med.data[i + 2]));
        if (diff > p.threshold) for (let c = 0; c < 3; c++) b.data[i + c] = med.data[i + c];
      }
    },
  },
  {
    id: 'pixelate',
    name: 'Pixelate',
    kind: 'filter',
    category: 'Stylise',
    params: [P('size', 'Cell size', 2, 100, 10)],
    apply(b, p) {
      const s = Math.max(2, Math.round(p.size));
      const src = copyBuf(b);
      for (let by = 0; by < b.height; by += s) {
        for (let bx = 0; bx < b.width; bx += s) {
          const acc = [0, 0, 0, 0];
          let n = 0;
          for (let y = by; y < Math.min(b.height, by + s); y++) {
            for (let x = bx; x < Math.min(b.width, bx + s); x++) {
              const i = (y * b.width + x) * 4;
              for (let c = 0; c < 4; c++) acc[c] += src.data[i + c];
              n++;
            }
          }
          for (let y = by; y < Math.min(b.height, by + s); y++) {
            for (let x = bx; x < Math.min(b.width, bx + s); x++) {
              const i = (y * b.width + x) * 4;
              for (let c = 0; c < 4; c++) b.data[i + c] = acc[c] / n;
            }
          }
        }
      }
    },
  },
  {
    id: 'halftone',
    name: 'Halftone',
    kind: 'filter',
    category: 'Stylise',
    params: [P('size', 'Dot spacing', 3, 40, 8), P('contrast', 'Contrast', 0, 100, 60)],
    apply(b, p) {
      const src = copyBuf(b);
      const s = p.size;
      for (let y = 0; y < b.height; y++) {
        for (let x = 0; x < b.width; x++) {
          const cx = (Math.floor(x / s) + 0.5) * s;
          const cy = (Math.floor(y / s) + 0.5) * s;
          const sx = Math.min(b.width - 1, Math.floor(cx));
          const sy = Math.min(b.height - 1, Math.floor(cy));
          const si = (sy * b.width + sx) * 4;
          const dark = 1 - luma(src.data[si], src.data[si + 1], src.data[si + 2]) / 255;
          const radius = Math.sqrt(dark) * s * 0.75 * (0.5 + p.contrast / 200);
          const on = Math.hypot(x - cx, y - cy) <= radius;
          const i = (y * b.width + x) * 4;
          b.data[i] = b.data[i + 1] = b.data[i + 2] = on ? 20 : 245;
        }
      }
    },
  },
  {
    id: 'vignette',
    name: 'Vignette',
    kind: 'filter',
    category: 'Stylise',
    params: [P('amount', 'Amount', -100, 100, 50), P('size', 'Size', 10, 100, 60)],
    apply(b, p) {
      const cx = b.width / 2;
      const cy = b.height / 2;
      const maxD = Math.hypot(cx, cy);
      const inner = (p.size / 100) * maxD;
      for (let y = 0; y < b.height; y++) {
        for (let x = 0; x < b.width; x++) {
          const t = clamp((Math.hypot(x - cx, y - cy) - inner) / Math.max(1, maxD - inner), 0, 1);
          const k = 1 - (p.amount / 100) * t * t;
          const i = (y * b.width + x) * 4;
          for (let c = 0; c < 3; c++) b.data[i + c] = clamp(p.amount >= 0 ? b.data[i + c] * k : b.data[i + c] + (255 - b.data[i + c]) * (1 - k));
        }
      }
    },
  },
  {
    id: 'bloom',
    name: 'Bloom',
    kind: 'filter',
    category: 'Stylise',
    params: [P('radius', 'Radius', 1, 60, 12), P('amount', 'Amount', 0, 100, 50), P('threshold', 'Threshold', 0, 255, 160)],
    apply(b, p) {
      const glow = copyBuf(b);
      for (let i = 0; i < glow.data.length; i += 4) {
        const y = luma(glow.data[i], glow.data[i + 1], glow.data[i + 2]);
        const k = y > p.threshold ? 1 : 0;
        for (let c = 0; c < 3; c++) glow.data[i + c] *= k;
      }
      gaussianBlur(glow, p.radius, [0, 1, 2]);
      for (let i = 0; i < b.data.length; i += 4) for (let c = 0; c < 3; c++) b.data[i + c] = clamp(b.data[i + c] + glow.data[i + c] * (p.amount / 100));
    },
  },
  {
    id: 'edge-detect',
    name: 'Edge Detect',
    kind: 'filter',
    category: 'Stylise',
    params: [P('strength', 'Strength', 1, 10, 2, 0.1)],
    apply(b, p) {
      const src = copyBuf(b);
      const { width: w, height: h } = b;
      const L = (x: number, y: number) => {
        const i = (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4;
        return luma(src.data[i], src.data[i + 1], src.data[i + 2]);
      };
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const gx = -L(x - 1, y - 1) - 2 * L(x - 1, y) - L(x - 1, y + 1) + L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1);
          const gy = -L(x - 1, y - 1) - 2 * L(x, y - 1) - L(x + 1, y - 1) + L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1);
          const v = clamp(Math.hypot(gx, gy) * p.strength * 0.5);
          const i = (y * w + x) * 4;
          b.data[i] = b.data[i + 1] = b.data[i + 2] = v;
        }
      }
    },
  },
  {
    id: 'emboss',
    name: 'Emboss',
    kind: 'filter',
    category: 'Stylise',
    params: [P('angle', 'Light angle', 0, 360, 135), P('depth', 'Depth', 1, 10, 3, 0.1)],
    apply(b, p) {
      const src = copyBuf(b);
      const { width: w, height: h } = b;
      const a = (p.angle * Math.PI) / 180;
      const dx = Math.round(Math.cos(a));
      const dy = Math.round(-Math.sin(a));
      const L = (x: number, y: number) => {
        const i = (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4;
        return luma(src.data[i], src.data[i + 1], src.data[i + 2]);
      };
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const v = clamp(128 + (L(x + dx, y + dy) - L(x - dx, y - dy)) * p.depth);
          const i = (y * w + x) * 4;
          b.data[i] = b.data[i + 1] = b.data[i + 2] = v;
        }
      }
    },
  },
  {
    id: 'twirl',
    name: 'Twirl',
    kind: 'filter',
    category: 'Distort',
    params: [P('angle', 'Angle', -720, 720, 180), P('radius', 'Radius %', 5, 100, 70)],
    apply(b, p) {
      const cx = b.width / 2;
      const cy = b.height / 2;
      const R = (Math.min(cx, cy) * p.radius) / 100;
      remap(b, (x, y) => {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy);
        if (d >= R) return [x, y];
        const a = Math.atan2(dy, dx) + ((p.angle * Math.PI) / 180) * Math.pow(1 - d / R, 2);
        return [cx + Math.cos(a) * d, cy + Math.sin(a) * d];
      });
    },
  },
  {
    id: 'ripple',
    name: 'Ripple',
    kind: 'filter',
    category: 'Distort',
    params: [P('amplitude', 'Amplitude', 0, 60, 8), P('wavelength', 'Wavelength', 5, 200, 40)],
    apply(b, p) {
      remap(b, (x, y) => [x + Math.sin((y / p.wavelength) * Math.PI * 2) * p.amplitude, y + Math.sin((x / p.wavelength) * Math.PI * 2) * p.amplitude]);
    },
  },
  {
    id: 'pinch-punch',
    name: 'Pinch / Punch',
    kind: 'filter',
    category: 'Distort',
    params: [P('amount', 'Amount', -100, 100, 50), P('radius', 'Radius %', 5, 100, 80)],
    apply(b, p) {
      const cx = b.width / 2;
      const cy = b.height / 2;
      const R = (Math.min(cx, cy) * p.radius) / 100;
      remap(b, (x, y) => {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy);
        if (d >= R || d === 0) return [x, y];
        const exponent = Math.max(0.1, 1 + p.amount / 100);
        const k = Math.pow(d / R, exponent) * R;
        return [cx + (dx / d) * k, cy + (dy / d) * k];
      });
    },
  },
  {
    id: 'spherical',
    name: 'Spherical',
    kind: 'filter',
    category: 'Distort',
    params: [P('amount', 'Amount', -100, 100, 60)],
    apply(b, p) {
      const cx = b.width / 2;
      const cy = b.height / 2;
      const R = Math.min(cx, cy);
      remap(b, (x, y) => {
        const dx = (x - cx) / R;
        const dy = (y - cy) / R;
        const d = Math.hypot(dx, dy);
        if (d >= 1 || d === 0) return [x, y];
        const k = Math.pow(Math.asin(d) / (Math.PI / 2), 1 - (p.amount / 100) * 0.6) / d;
        return [cx + dx * k * R, cy + dy * k * R];
      });
    },
  },
  {
    id: 'diffuse',
    name: 'Diffuse',
    kind: 'filter',
    category: 'Distort',
    params: [P('radius', 'Radius', 1, 30, 4)],
    apply(b, p) {
      const r = rng(99);
      remap(b, (x, y) => [x + (r() - 0.5) * 2 * p.radius, y + (r() - 0.5) * 2 * p.radius]);
    },
  },
  {
    id: 'voronoi',
    name: 'Voronoi',
    kind: 'filter',
    category: 'Distort',
    params: [P('cells', 'Cells', 4, 600, 120)],
    apply(b, p) {
      const r = rng(7);
      const seeds = Array.from({ length: Math.round(p.cells) }, () => [r() * b.width, r() * b.height]);
      const src = copyBuf(b);
      for (let y = 0; y < b.height; y++) {
        for (let x = 0; x < b.width; x++) {
          let best = 0;
          let bd = Infinity;
          for (let k = 0; k < seeds.length; k++) {
            const d = (seeds[k][0] - x) ** 2 + (seeds[k][1] - y) ** 2;
            if (d < bd) (bd = d, (best = k));
          }
          const si = (Math.min(b.height - 1, Math.floor(seeds[best][1])) * b.width + Math.min(b.width - 1, Math.floor(seeds[best][0]))) * 4;
          const i = (y * b.width + x) * 4;
          for (let c = 0; c < 4; c++) b.data[i + c] = src.data[si + c];
        }
      }
    },
  },
];

export const RASTER_OPS: RasterOp[] = [...adjust, ...filters];
const BY_ID = new Map(RASTER_OPS.map((o) => [o.id, o]));
export const rasterOp = (id: string) => BY_ID.get(id);

export const defaultOpParams = (op: RasterOp): Record<string, number> => Object.fromEntries(op.params.map((q) => [q.key, q.def]));

/** Apply an operation, blending the result with the original by an optional 0..255 mask. */
export function applyOp(b: Buf, op: RasterOp, params: Record<string, number>, mask?: Uint8Array | null) {
  const original = mask ? copyBuf(b) : null;
  op.apply(b, { ...defaultOpParams(op), ...params });
  if (!original || !mask) return;
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    const k = mask[p] / 255;
    if (k >= 1) continue;
    for (let c = 0; c < 4; c++) b.data[i + c] = original.data[i + c] + (b.data[i + c] - original.data[i + c]) * k;
  }
}
