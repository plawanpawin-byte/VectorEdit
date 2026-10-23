import { describe, expect, it } from 'vitest';
import { buildPdf } from '../src/pdf';
import { rgb, unsupported, vectorPage } from '../src/pdfvector';
import { blankShape } from '../src/shape';
import type { Artboard } from '../src/types';

const board: Artboard = { id: 'a', name: 'Page 1', x: 0, y: 0, w: 200, h: 100 };
const text = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join('');

describe('vector pdf', () => {
  it('parses colours', () => {
    expect(rgb('#ff0000')).toEqual([1, 0, 0]);
    expect(rgb('#0f0')).toEqual([0, 1, 0]);
    expect(rgb('url(#g)')).toBeNull();
    expect(rgb(null)).toBeNull();
  });
  it('reports what needs rasterising', () => {
    expect(unsupported(blankShape('t', 'text', { text: 'x' }))).toBe('text');
    expect(unsupported(blankShape('r', 'rect', { fill: '#f00', w: 5, h: 5 }))).toBeNull();
    expect(unsupported(blankShape('r', 'rect', { fill: '#f00', blend: 'multiply' }))).toBe('blend mode');
    expect(unsupported(blankShape('r', 'rect', { gradient: { type: 'linear', a: '#000', b: '#fff', angle: 0 } }))).toBe('gradient or pattern fill');
  });
  it('writes fill, stroke, dash, opacity and flips the y axis', () => {
    const rect = blankShape('r', 'rect', { x: 20, y: 10, w: 100, h: 40, fill: '#ff0000', stroke: '#0000ff', strokeWidth: 4, dash: 'dash', opacity: 0.5 });
    const res = vectorPage([rect], board);
    expect('page' in res).toBe(true);
    const page = (res as { page: { content: string; alphas: number[] } }).page;
    expect(page.alphas).toEqual([0.5]);
    expect(page.content).toContain('/GS0 gs');
    expect(page.content).toContain('1 0 0 rg');
    expect(page.content).toContain('0 0 1 RG');
    expect(page.content).toMatch(/\[\d+(\.\d+)? \d+(\.\d+)?\] 0 d/);
    expect(page.content).toContain('B\n');
    expect(page.content).toContain('15 67.5 m'); // (20,10) on a 100px tall page: x 15pt, y (100-10)*0.75
  });
  it('uses even-odd fill for shapes with holes and refuses unsupported pages', () => {
    const donut = blankShape('d', 'path', { closed: true, fill: '#000', pts: [{ x: 0, y: 0, hx: 0, hy: 0 }, { x: 50, y: 0, hx: 0, hy: 0 }, { x: 50, y: 50, hx: 0, hy: 0 }], extra: [[{ x: 10, y: 10, hx: 0, hy: 0 }, { x: 20, y: 10, hx: 0, hy: 0 }, { x: 20, y: 20, hx: 0, hy: 0 }]] });
    const ok = vectorPage([donut], board) as { page: { content: string } };
    expect(ok.page.content).toContain('f*');
    const bad = vectorPage([blankShape('t', 'text', { name: 'Title', text: 'x' })], board);
    expect(bad).toEqual({ reason: '“Title” uses text' });
  });
  it('embeds vector pages in a PDF with a consistent xref', () => {
    const page = (vectorPage([blankShape('r', 'rect', { x: 0, y: 0, w: 10, h: 10, fill: '#000' })], board) as { page: import('../src/pdf').PdfVectorPage }).page;
    const t = text(buildPdf([page, page]));
    expect(t).toContain('/Count 2');
    const start = Number(/startxref\n(\d+)/.exec(t)![1]);
    const rows = t.slice(start).split('\n').slice(3, 3 + 9);
    rows.forEach((row, i) => expect(t.slice(Number(row.slice(0, 10)), Number(row.slice(0, 10)) + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
  });
});
