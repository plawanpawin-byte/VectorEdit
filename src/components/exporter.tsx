import { renderToStaticMarkup } from 'react-dom/server';
import type { Shape } from '../types';
import { ShapeEl } from './ShapeEl';

export function toSvg(shapes: Shape[], w: number, h: number, transparent = true): string {
  const body = shapes.map((s) => renderToStaticMarkup(<ShapeEl shape={s} />)).join('\n  ');
  const bg = transparent ? '' : `\n  <rect width="${w}" height="${h}" fill="#fff"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg}\n  ${body}\n</svg>\n`;
}

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

export function exportSvg(shapes: Shape[], w: number, h: number) {
  download(new Blob([toSvg(shapes, w, h)], { type: 'image/svg+xml' }), 'Untitled-1.svg');
}

export function exportPng(shapes: Shape[], w: number, h: number, scale = 2) {
  const svg = toSvg(shapes, w, h, false);
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
    c.toBlob((b) => b && download(b, 'Untitled-1.png'));
  };
  img.src = url;
}
