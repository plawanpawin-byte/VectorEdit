import { describe, expect, it } from 'vitest';
import { buildPdf } from '../src/pdf';

const text = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join('');
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const page = (w: number, h: number) => ({ width: w, height: h, jpeg, pxWidth: 2, pxHeight: 2 });

describe('pdf writer', () => {
  it('writes a valid skeleton with one page per image and sizes in points', () => {
    const t = text(buildPdf([page(800, 600), page(100, 200)]));
    expect(t.startsWith('%PDF-1.4')).toBe(true);
    expect(t).toContain('/Count 2');
    expect(t).toContain('/MediaBox [0 0 600 450]');
    expect(t).toContain('/MediaBox [0 0 75 150]');
    expect(t.trimEnd().endsWith('%%EOF')).toBe(true);
  });
  it('xref offsets point at their objects', () => {
    const bytes = buildPdf([page(10, 10), page(20, 20)]);
    const t = text(bytes);
    const start = Number(/startxref\n(\d+)/.exec(t)![1]);
    expect(t.slice(start, start + 4)).toBe('xref');
    const rows = t.slice(start).split('\n').slice(3, 3 + 9); // objects 1..9
    rows.forEach((row, i) => {
      const off = Number(row.slice(0, 10));
      expect(t.slice(off, off + `${i + 1} 0 obj`.length), `object ${i + 1}`).toBe(`${i + 1} 0 obj`);
    });
  });
  it('embeds the image bytes untouched and declares their length', () => {
    const big = new Uint8Array(300).map((_, i) => i % 256);
    const t = text(buildPdf([{ ...page(5, 5), jpeg: big }]));
    expect(t).toContain('/Length 300');
    expect(t).toContain(text(big));
  });
});
