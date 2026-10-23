import { renderToStaticMarkup } from 'react-dom/server';
import { bbox, boxesIntersect } from '../geometry';
import type { Artboard, Shape } from '../types';
import { getState } from '../store';
import { Artwork, MasterArtwork } from './Artwork';

/** SVG of one artboard: every shape that touches it, cropped to its bounds. */
export function toSvg(shapes: Shape[], board: Artboard, transparent = true, boards: Artboard[] = getState().artboards): string {
  const box = { x: board.x, y: board.y, w: board.w, h: board.h };
  const visible = shapes.filter((s) => s.visible && boxesIntersect(bbox(s), box));
  const body = renderToStaticMarkup(
    <>
      <MasterArtwork board={board} boards={boards} shapes={shapes} />
      <Artwork shapes={visible} all={shapes} />
    </>,
  );
  const bg = transparent ? '' : `\n  <rect x="${board.x}" y="${board.y}" width="${board.w}" height="${board.h}" fill="#fff"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${board.w}" height="${board.h}" viewBox="${board.x} ${board.y} ${board.w} ${board.h}">${bg}\n  ${body}\n</svg>\n`;
}

const fileName = (board: Artboard, ext: string) => `${board.name.replace(/[^\w.-]+/g, '_') || 'artboard'}.${ext}`;

export function download(blob: Blob, name: string) {
  if (window.desktop) {
    const ext = name.split('.').pop() ?? '';
    void blob.arrayBuffer().then((buf) => window.desktop!.exportFile({ name, ext, data: new Uint8Array(buf) }));
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSvg(shapes: Shape[], board: Artboard) {
  download(new Blob([toSvg(shapes, board)], { type: 'image/svg+xml' }), fileName(board, 'svg'));
}

export function exportPng(shapes: Shape[], board: Artboard, scale = 2) {
  const { w, h } = board;
  const svg = toSvg(shapes, board, false);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = w * scale;
    c.height = h * scale;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    c.toBlob((b) => b && download(b, fileName(board, 'png')));
  };
  img.src = url;
}

/** The artboard as pixels (white page), scaled down so its longest side is at most `maxSize`. */
export function renderBoardPixels(shapes: Shape[], board: Artboard, maxSize = 480): Promise<ImageData> {
  const k = Math.min(1, maxSize / Math.max(board.w, board.h));
  const w = Math.max(1, Math.round(board.w * k));
  const h = Math.max(1, Math.round(board.h * k));
  const url = URL.createObjectURL(new Blob([toSvg(shapes, board, false)], { type: 'image/svg+xml' }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) return reject(new Error('No canvas'));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(ctx.getImageData(0, 0, w, h));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not render the page'));
    };
    img.src = url;
  });
}

/** One PDF with a page per artboard (raster pages at 2×, JPEG-compressed). */
export async function exportPdf(shapes: Shape[], boards: Artboard[], name = 'document') {
  const { buildPdf } = await import('../pdf');
  const pages = [];
  for (const board of boards) {
    const scale = 2;
    const img = await renderBoardPixels(shapes, board, Math.max(board.w, board.h) * scale);
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d')!.putImageData(img, 0, 0);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
    if (!blob) continue;
    pages.push({ width: board.w, height: board.h, jpeg: new Uint8Array(await blob.arrayBuffer()), pxWidth: img.width, pxHeight: img.height });
  }
  if (!pages.length) return;
  download(new Blob([buildPdf(pages, name).buffer as ArrayBuffer], { type: 'application/pdf' }), `${name.replace(/[^\w.-]+/g, '_') || 'document'}.pdf`);
}
