import { renderToStaticMarkup } from 'react-dom/server';
import { bbox, boxesIntersect } from '../geometry';
import type { Artboard, Shape } from '../types';
import { ShapeEl } from './ShapeEl';

/** SVG of one artboard: every shape that touches it, cropped to its bounds. */
export function toSvg(shapes: Shape[], board: Artboard, transparent = true): string {
  const box = { x: board.x, y: board.y, w: board.w, h: board.h };
  const body = shapes
    .filter((s) => s.visible && boxesIntersect(bbox(s), box))
    .map((s) => renderToStaticMarkup(<ShapeEl shape={s} all={shapes} />))
    .join('\n  ');
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
