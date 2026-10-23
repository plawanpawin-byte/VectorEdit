import { activeBoard, commit, getState, makeShape, setState } from '../store';
import type { Artboard, Shape } from '../types';
import { cachedCanvas, cloneCanvas, encodeCanvas, loadCanvas, makeCanvas } from './cache';

const MAX_EDGE = 2048;

/** A transparent pixel layer covering a page, at most MAX_EDGE pixels on the long side. */
export function blankLayerShape(board: Artboard, name = 'Pixel layer'): Shape {
  const k = Math.min(1, MAX_EDGE / Math.max(board.w, board.h));
  const rw = Math.max(1, Math.round(board.w * k));
  const rh = Math.max(1, Math.round(board.h * k));
  const canvas = makeCanvas(rw, rh);
  const src = encodeCanvas(canvas);
  return makeShape('rect', { name, x: board.x, y: board.y, w: board.w, h: board.h, src, raster: true, rw, rh, fill: null, stroke: null });
}

export function addPixelLayer(name?: string): Shape {
  const st = getState();
  const layer = blankLayerShape(activeBoard(st), name ?? `Pixel layer ${st.shapes.filter((s) => s.raster).length + 1}`);
  commit([...st.shapes, layer], { selection: [layer.id] });
  return layer;
}

/** Put an existing vector/image shape's appearance into pixels (used by "Rasterise"). */
export async function rasteriseShapeToLayer(shape: Shape, svgMarkup: string): Promise<Shape> {
  const k = Math.min(1, MAX_EDGE / Math.max(shape.w, shape.h, 1));
  const rw = Math.max(1, Math.round(shape.w * k));
  const rh = Math.max(1, Math.round(shape.h * k));
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Could not rasterise'));
    i.src = URL.createObjectURL(new Blob([svgMarkup], { type: 'image/svg+xml' }));
  });
  const c = makeCanvas(rw, rh);
  c.getContext('2d')!.drawImage(img, 0, 0, rw, rh);
  return { ...shape, kind: 'rect', radius: 0, src: encodeCanvas(c), raster: true, rw, rh, fill: null, stroke: null, gradient: null, effects: [] };
}

/** The pixel layer pixel tools should edit: the selected one, else the top-most visible one. */
export function targetLayer(): Shape | null {
  const st = getState();
  const sel = st.shapes.find((s) => s.raster && st.selection.includes(s.id) && !s.locked && s.visible);
  if (sel) return sel;
  for (let i = st.shapes.length - 1; i >= 0; i--) {
    const s = st.shapes[i];
    if (s.raster && !s.locked && s.visible) return s;
  }
  return null;
}

/** Like targetLayer, but creates a layer when the document has none. */
export function ensureLayer(): Shape {
  return targetLayer() ?? addPixelLayer();
}

/** Map a document point to a pixel position in the layer. */
export function toPixel(layer: Shape, x: number, y: number) {
  return { x: ((x - layer.x) / layer.w) * layer.rw, y: ((y - layer.y) / layer.h) * layer.rh };
}

export function pixelScale(layer: Shape) {
  return { sx: layer.rw / layer.w, sy: layer.rh / layer.h };
}

/** A private, paintable copy of the layer's pixels, ready now when cached or after decoding. */
export function workingCanvas(layer: Shape): HTMLCanvasElement | Promise<HTMLCanvasElement> {
  const hit = cachedCanvas(layer.src);
  return hit ? cloneCanvas(hit) : loadCanvas(layer.src);
}

/** Show pixels in the layer without touching history (for live previews). */
export function previewCanvas(layerId: string, canvas: HTMLCanvasElement) {
  const src = canvas.toDataURL('image/png');
  setState({ shapes: getState().shapes.map((s) => (s.id === layerId ? { ...s, src } : s)) });
}

/** Write edited pixels into the layer as one undoable step. `before` is the document state when the edit began. */
export function commitPixels(layerId: string, canvas: HTMLCanvasElement, before: Shape[], key?: string) {
  const src = encodeCanvas(canvas);
  commit(
    getState().shapes.map((s) => (s.id === layerId ? { ...s, src } : s)),
    { before, key },
  );
}
