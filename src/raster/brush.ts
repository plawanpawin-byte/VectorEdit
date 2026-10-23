import { clamp } from './pixels';
import { cloneCanvas, makeCanvas } from './cache';

export type Texture = 'none' | 'grain' | 'chalk' | 'bristle';

export interface BrushParams {
  /** diameter in document units */
  size: number;
  hardness: number;
  /** maximum opacity of one stroke */
  opacity: number;
  /** opacity of each dab: low values build up like an airbrush */
  flow: number;
  /** distance between dabs as a fraction of the size */
  spacing: number;
  roundness: number;
  angle: number;
  texture: Texture;
  /** random scatter of dabs as a fraction of the size */
  jitter: number;
  /** what pen pressure controls (a mouse always reports full pressure) */
  dynamics?: 'none' | 'size' | 'opacity' | 'both';
}

export interface BrushPreset {
  id: string;
  name: string;
  category: string;
  params: BrushParams;
}

const base: BrushParams = { size: 24, hardness: 0.85, opacity: 1, flow: 1, spacing: 0.12, roundness: 1, angle: 0, texture: 'none', jitter: 0 };
const preset = (id: string, name: string, category: string, p: Partial<BrushParams>): BrushPreset => ({ id, name, category, params: { ...base, ...p } });

export const BRUSH_PRESETS: BrushPreset[] = [
  preset('round', 'Round', 'Basic', {}),
  preset('hard', 'Hard round', 'Basic', { hardness: 1, spacing: 0.08 }),
  preset('soft', 'Soft round', 'Basic', { hardness: 0, size: 40 }),
  preset('airbrush', 'Airbrush', 'Basic', { hardness: 0, size: 60, flow: 0.12, spacing: 0.05 }),
  preset('pencil', 'Pencil', 'Dry media', { size: 4, hardness: 0.95, texture: 'grain', flow: 0.9 }),
  preset('chalk', 'Chalk', 'Dry media', { size: 30, hardness: 0.8, texture: 'chalk', spacing: 0.18, flow: 0.85 }),
  preset('charcoal', 'Charcoal', 'Dry media', { size: 22, hardness: 0.6, texture: 'grain', spacing: 0.1, flow: 0.7 }),
  preset('crayon', 'Crayon', 'Dry media', { size: 16, hardness: 0.9, texture: 'bristle', spacing: 0.14 }),
  preset('marker', 'Chisel marker', 'Ink', { size: 18, hardness: 1, roundness: 0.35, angle: 45, flow: 1 }),
  preset('ink', 'Ink pen', 'Ink', { size: 5, hardness: 1, spacing: 0.05 }),
  preset('watercolour', 'Watercolour', 'Paint', { size: 50, hardness: 0.25, flow: 0.2, opacity: 0.7, texture: 'grain', spacing: 0.06 }),
  preset('oil', 'Oil bristle', 'Paint', { size: 36, hardness: 0.7, texture: 'bristle', roundness: 0.6, angle: 30, spacing: 0.1, flow: 0.9 }),
  preset('splatter', 'Splatter', 'Effects', { size: 10, hardness: 0.9, spacing: 1.4, jitter: 2.2 }),
  preset('pixel', 'Pixel (aliased)', 'Basic', { size: 4, hardness: 1, spacing: 0.5 }),
  preset('sponge', 'Sponge', 'Effects', { size: 44, hardness: 0.5, texture: 'chalk', spacing: 0.35, flow: 0.6, jitter: 0.25 }),
];

export const presetById = (id: string) => BRUSH_PRESETS.find((p) => p.id === id);

/** Deterministic noise in 0..1 for texture lookups. */
function hash(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function textureFactor(t: Texture, x: number, y: number): number {
  switch (t) {
    case 'grain':
      return 0.35 + 0.65 * hash(x, y);
    case 'chalk':
      return hash(x, y) > 0.45 ? 1 : 0.12;
    case 'bristle':
      return 0.45 + 0.55 * hash(Math.floor(x / 2), 0) * (0.6 + 0.4 * hash(x, y));
    default:
      return 1;
  }
}

export function parseColour(c: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A white-less brush tip: the colour with a soft alpha footprint. `d` is the diameter in pixels. */
export function makeTip(d: number, p: BrushParams, colour: [number, number, number], seed = 0): HTMLCanvasElement {
  const size = Math.max(2, Math.ceil(d) + 2);
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const r = d / 2;
  const cx = size / 2;
  const ang = (p.angle * Math.PI) / 180;
  const cos = Math.cos(-ang);
  const sin = Math.sin(-ang);
  const edge = Math.max(0.001, 1 - p.hardness);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cx;
      // rotate into the brush frame, squash by roundness
      const u = dx * cos - dy * sin;
      const v = (dx * sin + dy * cos) / Math.max(0.05, p.roundness);
      const dist = Math.hypot(u, v) / Math.max(0.5, r);
      let a = dist >= 1 ? 0 : p.hardness >= 0.999 ? 1 : clamp((1 - dist) / edge, 0, 1);
      a = a * a * (3 - 2 * a); // smoothstep
      if (a > 0 && p.texture !== 'none') a *= textureFactor(p.texture, x + seed * 7, y + seed * 13);
      const i = (y * size + x) * 4;
      img.data[i] = colour[0];
      img.data[i + 1] = colour[1];
      img.data[i + 2] = colour[2];
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export type StrokeMode = 'paint' | 'erase';

/**
 * Paints dabs along a path onto a stroke canvas and composites the result over a base image.
 * Opacity limits the whole stroke, flow limits each dab, and an optional mask confines the effect.
 */
export class Stroke {
  readonly result: HTMLCanvasElement;
  private readonly strokeCanvas: HTMLCanvasElement;
  private readonly tips: HTMLCanvasElement[];
  private last: { x: number; y: number } | null = null;
  private carry = 0;
  private dabCount = 0;
  private readonly diameter: number;

  constructor(
    private readonly base: HTMLCanvasElement,
    private readonly p: BrushParams,
    /** pixels per document unit */
    scale: number,
    colour: [number, number, number],
    private readonly mode: StrokeMode = 'paint',
    private readonly mask: Uint8Array | null = null,
  ) {
    this.diameter = Math.max(1, p.size * scale);
    this.result = cloneCanvas(base);
    this.strokeCanvas = makeCanvas(base.width, base.height);
    // a few texture variants so textured brushes do not repeat the same dab
    const variants = p.texture === 'none' ? 1 : 4;
    this.tips = Array.from({ length: variants }, (_, i) => makeTip(this.diameter, { ...p, flow: 1 }, colour, i));
  }

  private pressure = 1;

  private stamp(x: number, y: number) {
    const ctx = this.strokeCanvas.getContext('2d')!;
    const tip = this.tips[this.dabCount++ % this.tips.length];
    const dyn = this.p.dynamics ?? 'none';
    const sizeK = dyn === 'size' || dyn === 'both' ? Math.max(0.08, this.pressure) : 1;
    ctx.globalAlpha = this.p.flow * (dyn === 'opacity' || dyn === 'both' ? Math.max(0.05, this.pressure) : 1);
    let px = x;
    let py = y;
    if (this.p.jitter > 0) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * this.p.jitter * this.diameter * 0.5;
      px += Math.cos(a) * d;
      py += Math.sin(a) * d;
    }
    ctx.drawImage(tip, px - (tip.width * sizeK) / 2, py - (tip.height * sizeK) / 2, tip.width * sizeK, tip.height * sizeK);
  }

  begin(x: number, y: number, pressure = 1) {
    this.pressure = pressure;
    this.stamp(x, y);
    this.last = { x, y };
    this.render();
  }

  lineTo(x: number, y: number, pressure = 1) {
    if (!this.last) return this.begin(x, y, pressure);
    const p0 = this.pressure;
    const total = Math.hypot(x - this.last.x, y - this.last.y) || 1;
    const from = { x: this.last.x, y: this.last.y };
    const step = Math.max(0.75, this.diameter * this.p.spacing);
    let { x: lx, y: ly } = this.last;
    let dist = Math.hypot(x - lx, y - ly);
    while (dist + this.carry >= step) {
      const t = (step - this.carry) / dist;
      lx += (x - lx) * t;
      ly += (y - ly) * t;
      this.pressure = p0 + (pressure - p0) * Math.min(1, Math.hypot(lx - from.x, ly - from.y) / total);
      this.stamp(lx, ly);
      dist = Math.hypot(x - lx, y - ly);
      this.carry = 0;
    }
    this.carry += dist;
    this.pressure = pressure;
    this.last = { x, y };
    this.render();
  }

  /** Recomposite the stroke over the base image. */
  render() {
    const ctx = this.result.getContext('2d')!;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, this.result.width, this.result.height);
    ctx.drawImage(this.base, 0, 0);
    let layer: HTMLCanvasElement = this.strokeCanvas;
    if (this.mask) {
      layer = cloneCanvas(this.strokeCanvas);
      const lc = layer.getContext('2d')!;
      const img = lc.getImageData(0, 0, layer.width, layer.height);
      for (let i = 0, m = 0; m < this.mask.length; i += 4, m++) img.data[i + 3] = (img.data[i + 3] * this.mask[m]) / 255;
      lc.putImageData(img, 0, 0);
    }
    ctx.globalAlpha = this.p.opacity;
    ctx.globalCompositeOperation = this.mode === 'erase' ? 'destination-out' : 'source-over';
    ctx.drawImage(layer, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
