/* Pixel data of raster layers lives in canvases. A layer's `src` (a PNG data URL) is the saved,
   undoable form; this cache maps each src to a ready-to-use canvas so tools can paint at once. */

const MAX_ENTRIES = 32;
const cache = new Map<string, HTMLCanvasElement>();

function touch(src: string, c: HTMLCanvasElement) {
  cache.delete(src);
  cache.set(src, c);
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height);
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}

export const cachedCanvas = (src: string) => cache.get(src);

/** Remember the canvas that produced `src` so the next edit does not have to decode it. */
export function registerCanvas(src: string, canvas: HTMLCanvasElement) {
  touch(src, canvas);
}

/** The pixels for `src`, decoded if necessary. The returned canvas is a private copy: safe to paint on. */
export async function loadCanvas(src: string): Promise<HTMLCanvasElement> {
  const hit = cache.get(src);
  if (hit) return cloneCanvas(hit);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Could not decode layer pixels'));
    i.src = src;
  });
  const c = makeCanvas(img.naturalWidth, img.naturalHeight);
  c.getContext('2d')!.drawImage(img, 0, 0);
  touch(src, cloneCanvas(c));
  return c;
}

/** Encode a canvas and remember it, returning the new src. */
export function encodeCanvas(canvas: HTMLCanvasElement): string {
  const src = canvas.toDataURL('image/png');
  registerCanvas(src, cloneCanvas(canvas));
  return src;
}

/** Decode every raster layer of a document so tools can start without waiting. */
export async function preloadRasters(shapes: { raster: boolean; src: string }[]) {
  await Promise.all(shapes.filter((s) => s.raster && s.src).map((s) => loadCanvas(s.src).catch(() => null)));
}
