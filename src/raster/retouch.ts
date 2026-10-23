import { type Buf, clamp, copyBuf, hslToRgb, luma, rgbToHsl, sample } from './pixels';

/* Retouching brushes. Each stamp changes pixels inside a circle, weighted by a soft falloff, the brush
   strength and (optionally) a selection mask. All functions edit a buffer in place and are DOM-free. */

export type RetouchKind = 'blur' | 'sharpen' | 'smudge' | 'dodge' | 'burn' | 'clone' | 'blemish' | 'redeye' | 'saturate' | 'desaturate' | 'median' | 'colourreplace' | 'bgerase' | 'mixer';

export interface DabOptions {
  mask?: Uint8Array | null;
  /** smudge: pixels carried along the stroke (size (2r+1)^2) */
  carried?: Buf | null;
  /** clone: offset from destination to source in pixels */
  source?: { dx: number; dy: number } | null;
  /** colourreplace / bgerase: the colour picked at the start of the stroke, and how far from it a pixel may be (0..255) */
  target?: [number, number, number] | null;
  tolerance?: number;
  /** colourreplace: the new colour; mixer: the paint mixed into what is carried */
  replace?: [number, number, number] | null;
}

const falloff = (d: number, hardness: number) => {
  if (d >= 1) return 0;
  const edge = Math.max(0.001, 1 - hardness);
  const a = clamp((1 - d) / edge, 0, 1) as number;
  return a * a * (3 - 2 * a);
};

export interface DabResult {
  carried: Buf | null;
}

/** Apply one stamp. `r` is the radius in pixels; strength 0..1. */
export function dab(buf: Buf, kind: RetouchKind, cx: number, cy: number, r: number, hardness: number, strength: number, o: DabOptions = {}): DabResult {
  const { width: w, height: h, data } = buf;
  const x0 = Math.max(0, Math.floor(cx - r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y1 = Math.min(h - 1, Math.ceil(cy + r));
  if (x1 < x0 || y1 < y0) return { carried: o.carried ?? null };
  const weight = (x: number, y: number) => falloff(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r, hardness) * strength * (o.mask ? o.mask[y * w + x] / 255 : 1);

  // a snapshot of the dab region, so neighbouring pixels are read unmodified
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const snap: Buf = { width: bw, height: bh, data: new Uint8ClampedArray(bw * bh * 4) };
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) snap.data.set(data.subarray(((y0 + y) * w + x0 + x) * 4, ((y0 + y) * w + x0 + x) * 4 + 4), (y * bw + x) * 4);
  const at = (x: number, y: number, c: number) => snap.data[(Math.min(bh - 1, Math.max(0, y - y0)) * bw + Math.min(bw - 1, Math.max(0, x - x0))) * 4 + c];

  let carried = o.carried ?? null;
  const size = Math.ceil(r) * 2 + 1;
  if ((kind === 'smudge' || kind === 'mixer') && (!carried || carried.width !== size)) {
    carried = { width: size, height: size, data: new Uint8ClampedArray(size * size * 4) };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) for (let c = 0; c < 4; c++) carried.data[(y * size + x) * 4 + c] = sample(buf, cx - r + x, cy - r + y, c);
    return { carried }; // the first stamp only picks up paint
  }
  if (kind === 'mixer' && carried && o.replace) {
    // every stamp stirs a little of the chosen paint into what the brush carries
    for (let k = 0; k < carried.data.length; k += 4) for (let c = 0; c < 3; c++) carried.data[k + c] += (o.replace[c] - carried.data[k + c]) * 0.12;
  }

  // average colour of a ring around the dab, for blemish removal
  let ring: [number, number, number] | null = null;
  if (kind === 'blemish') {
    const acc = [0, 0, 0];
    let n = 0;
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      const px = Math.round(cx + Math.cos(ang) * r * 1.35);
      const py = Math.round(cy + Math.sin(ang) * r * 1.35);
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const i = (py * w + px) * 4;
      acc[0] += data[i];
      acc[1] += data[i + 1];
      acc[2] += data[i + 2];
      n++;
    }
    ring = n ? [acc[0] / n, acc[1] / n, acc[2] / n] : null;
  }

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const wt = weight(x, y);
      if (wt <= 0) continue;
      const i = (y * w + x) * 4;
      const r0 = at(x, y, 0);
      const g0 = at(x, y, 1);
      const b0 = at(x, y, 2);
      let nr = r0;
      let ng = g0;
      let nb = b0;
      switch (kind) {
        case 'blur': {
          let sr = 0;
          let sg = 0;
          let sb = 0;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) (sr += at(x + dx, y + dy, 0), (sg += at(x + dx, y + dy, 1)), (sb += at(x + dx, y + dy, 2)));
          [nr, ng, nb] = [sr / 25, sg / 25, sb / 25];
          break;
        }
        case 'sharpen': {
          let sr = 0;
          let sg = 0;
          let sb = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) (sr += at(x + dx, y + dy, 0), (sg += at(x + dx, y + dy, 1)), (sb += at(x + dx, y + dy, 2)));
          nr = r0 + (r0 - sr / 9) * 2.5;
          ng = g0 + (g0 - sg / 9) * 2.5;
          nb = b0 + (b0 - sb / 9) * 2.5;
          break;
        }
        case 'smudge':
        case 'mixer': {
          const cxp = Math.min(carried!.width - 1, Math.max(0, Math.round(x - cx + r)));
          const cyp = Math.min(carried!.height - 1, Math.max(0, Math.round(y - cy + r)));
          const ci = (cyp * carried!.width + cxp) * 4;
          [nr, ng, nb] = [carried!.data[ci], carried!.data[ci + 1], carried!.data[ci + 2]];
          break;
        }
        case 'dodge':
        case 'burn': {
          const k = kind === 'dodge' ? 1 : -1;
          const y01 = luma(r0, g0, b0) / 255;
          const range = kind === 'dodge' ? 1 - y01 * 0.5 : 0.5 + y01 * 0.5; // protect already extreme tones
          nr = r0 + k * 60 * range;
          ng = g0 + k * 60 * range;
          nb = b0 + k * 60 * range;
          break;
        }
        case 'clone': {
          if (!o.source) break;
          nr = sample(buf, x + o.source.dx, y + o.source.dy, 0);
          ng = sample(buf, x + o.source.dx, y + o.source.dy, 1);
          nb = sample(buf, x + o.source.dx, y + o.source.dy, 2);
          break;
        }
        case 'blemish': {
          if (ring) [nr, ng, nb] = ring;
          break;
        }
        case 'redeye': {
          if (r0 > g0 * 1.4 && r0 > b0 * 1.4) nr = (g0 + b0) / 2 * 0.9;
          break;
        }
        case 'median': {
          const win: number[][] = [[], [], []];
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (let c = 0; c < 3; c++) win[c].push(at(x + dx, y + dy, c));
          [nr, ng, nb] = win.map((v) => v.sort((p, q) => p - q)[4]);
          break;
        }
        case 'colourreplace': {
          if (!o.target || !o.replace) break;
          if (Math.hypot(r0 - o.target[0], g0 - o.target[1], b0 - o.target[2]) > (o.tolerance ?? 40)) break;
          const [rh, rs] = rgbToHsl(o.replace[0], o.replace[1], o.replace[2]);
          const [, , sl] = rgbToHsl(r0, g0, b0);
          [nr, ng, nb] = hslToRgb(rh, rs, sl); // new hue and saturation, original lightness
          break;
        }
        case 'bgerase': {
          if (!o.target) break;
          const near = Math.hypot(r0 - o.target[0], g0 - o.target[1], b0 - o.target[2]) <= (o.tolerance ?? 40);
          if (near) data[i + 3] = clamp(data[i + 3] * (1 - wt));
          continue;
        }
        case 'saturate':
        case 'desaturate': {
          const [hh, ss, ll] = rgbToHsl(r0, g0, b0);
          [nr, ng, nb] = hslToRgb(hh, clamp(ss * (kind === 'saturate' ? 1.6 : 0.4), 0, 1), ll);
          break;
        }
      }
      data[i] = clamp(r0 + (nr - r0) * (kind === 'clone' || kind === 'blemish' ? Math.min(1, wt * 1.4) : wt));
      data[i + 1] = clamp(g0 + (ng - g0) * (kind === 'clone' || kind === 'blemish' ? Math.min(1, wt * 1.4) : wt));
      data[i + 2] = clamp(b0 + (nb - b0) * (kind === 'clone' || kind === 'blemish' ? Math.min(1, wt * 1.4) : wt));
      if (kind === 'smudge' || kind === 'mixer') {
        // keep carrying what we just wrote
        const cxp = Math.min(carried!.width - 1, Math.max(0, Math.round(x - cx + r)));
        const cyp = Math.min(carried!.height - 1, Math.max(0, Math.round(y - cy + r)));
        const ci = (cyp * carried!.width + cxp) * 4;
        carried!.data[ci] = data[i];
        carried!.data[ci + 1] = data[i + 1];
        carried!.data[ci + 2] = data[i + 2];
      }
    }
  }
  void copyBuf;
  return { carried };
}
