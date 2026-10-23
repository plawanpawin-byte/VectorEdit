import { renderToStaticMarkup } from 'react-dom/server';
import { Artwork } from './components/Artwork';
import { bbox, boxesIntersect } from './geometry';
import { download } from './components/exporter';
import type { Shape, Slice } from './types';

const fileName = (s: Slice) => `${s.name.replace(/[^\w.-]+/g, '_') || 'slice'}${s.scale !== 1 ? `@${s.scale}x` : ''}.${s.format}`;

/** SVG markup of everything inside a slice, cropped to it. */
export function sliceSvg(shapes: Shape[], s: Slice, background?: string): string {
  const box = { x: s.x, y: s.y, w: s.w, h: s.h };
  const visible = shapes.filter((sh) => sh.visible && boxesIntersect(bbox(sh), box));
  const body = renderToStaticMarkup(<Artwork shapes={visible} all={shapes} />);
  const bg = background ? `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}" height="${s.h}" viewBox="${s.x} ${s.y} ${s.w} ${s.h}">${bg}\n  ${body}\n</svg>\n`;
}

/** Render a slice to a blob in its format and scale. */
export function renderSlice(shapes: Shape[], s: Slice): Promise<Blob> {
  if (s.format === 'svg') return Promise.resolve(new Blob([sliceSvg(shapes, s)], { type: 'image/svg+xml' }));
  const svg = sliceSvg(shapes, s, s.format === 'jpg' ? '#ffffff' : undefined);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(s.w * s.scale));
      c.height = Math.max(1, Math.round(s.h * s.scale));
      const ctx = c.getContext('2d');
      if (!ctx) return reject(new Error('No canvas'));
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the slice'))), s.format === 'jpg' ? 'image/jpeg' : 'image/png', 0.92);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not render the slice'));
    };
    img.src = url;
  });
}

export async function exportSlice(shapes: Shape[], s: Slice) {
  download(await renderSlice(shapes, s), fileName(s));
}

export async function exportAllSlices(shapes: Shape[], slices: Slice[]) {
  for (const s of slices) {
    await exportSlice(shapes, s);
    await new Promise((r) => setTimeout(r, 200)); // browsers drop downloads fired in the same tick
  }
}
