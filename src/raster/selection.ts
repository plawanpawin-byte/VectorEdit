import { getState, setState } from '../store';
import type { Shape } from '../types';
import { makeCanvas } from './cache';
import { type Buf, boxBlur, morphMask } from './pixels';

/** A pixel selection: one 0..255 coverage value per pixel of a single layer. Not part of undo history. */
export interface PixelSel {
  layerId: string;
  w: number;
  h: number;
  mask: Uint8Array;
  /** bumps on every change so cached overlays can be refreshed */
  version: number;
}

export type SelectMode = 'replace' | 'add' | 'subtract' | 'intersect';

let versionCounter = 0;

export const modeFromKeys = (shift: boolean, alt: boolean): SelectMode | null => (shift && alt ? 'intersect' : shift ? 'add' : alt ? 'subtract' : null);

export function blankMask(w: number, h: number): Uint8Array {
  return new Uint8Array(w * h);
}

/** Selection for a layer, or null when none exists for it. */
export function selectionFor(layer: Shape): PixelSel | null {
  const s = getState().pixelSel;
  return s && s.layerId === layer.id && s.w === layer.rw && s.h === layer.rh ? s : null;
}

export function setSelection(layer: Shape, mask: Uint8Array) {
  const any = mask.some((v) => v > 0);
  setState({ pixelSel: any ? { layerId: layer.id, w: layer.rw, h: layer.rh, mask, version: ++versionCounter } : null });
}

/** Combine a new mask with the existing selection of the layer. */
export function combineMasks(old: Uint8Array | null, incoming: Uint8Array, mode: SelectMode): Uint8Array {
  if (mode === 'replace') return incoming;
  if (!old) return mode === 'add' ? incoming : new Uint8Array(incoming.length); // nothing to subtract from or intersect with
  const out = new Uint8Array(old.length);
  for (let i = 0; i < old.length; i++) {
    const a = old[i];
    const b = incoming[i];
    out[i] = mode === 'add' ? Math.max(a, b) : mode === 'subtract' ? Math.round((a * (255 - b)) / 255) : Math.round((a * b) / 255);
  }
  return out;
}

/** Apply a new region to the layer's selection using the given mode. */
export function applySelection(layer: Shape, region: Uint8Array, mode: SelectMode) {
  const old = selectionFor(layer)?.mask ?? null;
  setSelection(layer, combineMasks(old, region, mode));
}

/** Rasterise a drawing callback (white shapes on transparent) into a mask at the layer's pixel size. */
export function maskFromDraw(layer: Shape, draw: (ctx: CanvasRenderingContext2D) => void): Uint8Array {
  const c = makeCanvas(layer.rw, layer.rh);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  draw(ctx);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const mask = new Uint8Array(c.width * c.height);
  for (let i = 0; i < mask.length; i++) mask[i] = img.data[i * 4 + 3];
  return mask;
}

export function selectAll(layer: Shape) {
  setSelection(layer, new Uint8Array(layer.rw * layer.rh).fill(255));
}

export function deselect() {
  setState({ pixelSel: null });
}

export function invertSelection(layer: Shape) {
  const cur = selectionFor(layer);
  const out = new Uint8Array(layer.rw * layer.rh);
  for (let i = 0; i < out.length; i++) out[i] = 255 - (cur ? cur.mask[i] : 0);
  setSelection(layer, out);
}

export function growSelection(layer: Shape, px: number) {
  const cur = selectionFor(layer);
  if (cur) setSelection(layer, morphMask(cur.mask, cur.w, cur.h, px));
}

export function featherSelection(layer: Shape, radius: number) {
  const cur = selectionFor(layer);
  if (!cur || radius < 1) return;
  const buf: Buf = { width: cur.w, height: cur.h, data: new Uint8ClampedArray(cur.w * cur.h * 4) };
  for (let i = 0; i < cur.mask.length; i++) buf.data[i * 4 + 3] = cur.mask[i];
  for (let k = 0; k < 3; k++) boxBlur(buf, radius, radius, [3]);
  const out = new Uint8Array(cur.mask.length);
  for (let i = 0; i < out.length; i++) out[i] = buf.data[i * 4 + 3];
  setSelection(layer, out);
}

/** Round off jagged edges: blur, then threshold. */
export function smoothSelection(layer: Shape, radius: number) {
  const cur = selectionFor(layer);
  if (!cur || radius < 1) return;
  const buf: Buf = { width: cur.w, height: cur.h, data: new Uint8ClampedArray(cur.w * cur.h * 4) };
  for (let i = 0; i < cur.mask.length; i++) buf.data[i * 4 + 3] = cur.mask[i];
  for (let k = 0; k < 3; k++) boxBlur(buf, radius, radius, [3]);
  const out = new Uint8Array(cur.mask.length);
  for (let i = 0; i < out.length; i++) out[i] = buf.data[i * 4 + 3] >= 128 ? 255 : 0;
  setSelection(layer, out);
}

/** A tinted overlay (with a crisp outline) for showing the selection on the canvas. */
export function overlayDataUrl(sel: PixelSel): string {
  const c = makeCanvas(sel.w, sel.h);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(sel.w, sel.h);
  const { w, h, mask } = sel;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const on = mask[i] > 127;
      const edge =
        on && ((x > 0 && mask[i - 1] <= 127) || (x < w - 1 && mask[i + 1] <= 127) || (y > 0 && mask[i - w] <= 127) || (y < h - 1 && mask[i + w] <= 127));
      const o = i * 4;
      if (edge) {
        // alternating dashes read as marching ants
        const dash = (x + y) % 8 < 4;
        img.data.set(dash ? [255, 255, 255, 255] : [0, 0, 0, 255], o);
      } else if (mask[i] > 0) img.data.set([45, 140, 240, Math.round(mask[i] * 0.22)], o);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}
