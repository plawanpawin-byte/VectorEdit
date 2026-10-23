import type { Adjust, AdjustType } from './types';

export interface AdjustDef {
  type: AdjustType;
  label: string;
  a?: { label: string; min: number; max: number; value: number };
  b?: { label: string; min: number; max: number; value: number };
}

export const ADJUSTMENTS: AdjustDef[] = [
  { type: 'brightness', label: 'Brightness / Contrast', a: { label: 'Brightness', min: -100, max: 100, value: 0 }, b: { label: 'Contrast', min: -100, max: 100, value: 0 } },
  { type: 'huesat', label: 'Hue / Saturation', a: { label: 'Hue', min: -180, max: 180, value: 0 }, b: { label: 'Saturation', min: -100, max: 100, value: 0 } },
  { type: 'invert', label: 'Invert' },
  { type: 'grayscale', label: 'Black & White', a: { label: 'Amount', min: 0, max: 100, value: 100 } },
  { type: 'sepia', label: 'Sepia', a: { label: 'Amount', min: 0, max: 100, value: 100 } },
  { type: 'blur', label: 'Gaussian Blur', a: { label: 'Radius', min: 0, max: 40, value: 6 } },
  { type: 'posterize', label: 'Posterize', a: { label: 'Levels', min: 2, max: 16, value: 4 } },
  { type: 'threshold', label: 'Threshold', a: { label: 'Level', min: 0, max: 100, value: 50 } },
];

export const adjustDef = (t: AdjustType) => ADJUSTMENTS.find((d) => d.type === t);

export const defaultAdjust = (t: AdjustType): Adjust => {
  const d = adjustDef(t)!;
  return { type: t, a: d.a?.value ?? 0, b: d.b?.value ?? 0 };
};

const table = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i / (n - 1)).toFixed(4)).join(' ');

/** SVG filter primitives implementing the adjustment (colour-space: sRGB). */
export function filterPrimitives(a: Adjust): { key: string; nodes: Array<{ tag: string; attrs: Record<string, string | number>; children?: Array<{ tag: string; attrs: Record<string, string | number> }> }> } {
  switch (a.type) {
    case 'brightness': {
      const slope = Math.max(0, 1 + a.b / 100);
      const icpt = a.a / 200 + (1 - slope) / 2;
      const fn = { type: 'linear', slope, intercept: icpt };
      return { key: 'bc', nodes: [{ tag: 'feComponentTransfer', attrs: {}, children: [{ tag: 'feFuncR', attrs: fn }, { tag: 'feFuncG', attrs: fn }, { tag: 'feFuncB', attrs: fn }] }] };
    }
    case 'huesat':
      return {
        key: 'hs',
        nodes: [
          { tag: 'feColorMatrix', attrs: { type: 'hueRotate', values: a.a } },
          { tag: 'feColorMatrix', attrs: { type: 'saturate', values: Math.max(0, 1 + a.b / 100) } },
        ],
      };
    case 'invert': {
      const fn = { type: 'table', tableValues: '1 0' };
      return { key: 'inv', nodes: [{ tag: 'feComponentTransfer', attrs: {}, children: [{ tag: 'feFuncR', attrs: fn }, { tag: 'feFuncG', attrs: fn }, { tag: 'feFuncB', attrs: fn }] }] };
    }
    case 'grayscale':
      return { key: 'bw', nodes: [{ tag: 'feColorMatrix', attrs: { type: 'saturate', values: 1 - Math.min(1, Math.max(0, a.a / 100)) } }] };
    case 'sepia': {
      const t = Math.min(1, Math.max(0, a.a / 100));
      const m = [
        [0.393, 0.769, 0.189],
        [0.349, 0.686, 0.168],
        [0.272, 0.534, 0.131],
      ].map((row, r) => row.map((v, c) => (r === c ? 1 - t + v * t : v * t)));
      return { key: 'sep', nodes: [{ tag: 'feColorMatrix', attrs: { type: 'matrix', values: `${m[0].join(' ')} 0 0 ${m[1].join(' ')} 0 0 ${m[2].join(' ')} 0 0 0 0 0 1 0` } }] };
    }
    case 'blur':
      return { key: 'blur', nodes: [{ tag: 'feGaussianBlur', attrs: { stdDeviation: Math.max(0, a.a) } }] };
    case 'posterize': {
      const n = Math.max(2, Math.round(a.a));
      const fn = { type: 'discrete', tableValues: table(n, (v) => v) };
      return { key: 'post', nodes: [{ tag: 'feComponentTransfer', attrs: {}, children: [{ tag: 'feFuncR', attrs: fn }, { tag: 'feFuncG', attrs: fn }, { tag: 'feFuncB', attrs: fn }] }] };
    }
    case 'threshold': {
      const cut = Math.min(1, Math.max(0, a.a / 100));
      const steps = 64;
      const fn = { type: 'discrete', tableValues: table(steps, (v) => (v >= cut ? 1 : 0)) };
      return {
        key: 'thr',
        nodes: [
          { tag: 'feColorMatrix', attrs: { type: 'matrix', values: '0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0' } },
          { tag: 'feComponentTransfer', attrs: {}, children: [{ tag: 'feFuncR', attrs: fn }, { tag: 'feFuncG', attrs: fn }, { tag: 'feFuncB', attrs: fn }] },
        ],
      };
    }
  }
}
