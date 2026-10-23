import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ShapeEl } from '../src/components/ShapeEl';
import { bbox } from '../src/geometry';
import { blankShape } from '../src/shape';
import { layoutText, measureText } from '../src/textlayout';

const text = (t: string, p = {}) => blankShape('t', 'text', { x: 10, y: 20, text: t, fontSize: 20, fill: '#000', ...p });

describe('text layout', () => {
  it('keeps artistic text on one line per paragraph', () => {
    const l = layoutText(text('one two three\nfour'));
    expect(l.lines.map((x) => x.text)).toEqual(['one two three', 'four']);
  });

  it('wraps frame text at word boundaries', () => {
    const t = text('the quick brown fox jumps over the lazy dog', { frameW: 140 });
    const l = layoutText(t);
    expect(l.lines.length).toBeGreaterThan(2);
    for (const line of l.lines) expect(measureText(line.text, t)).toBeLessThanOrEqual(140 + 1);
    expect(l.lines.map((x) => x.text).join(' ')).toBe('the quick brown fox jumps over the lazy dog');
  });

  it('breaks a word that is wider than the frame', () => {
    const t = text('supercalifragilisticexpialidocious', { frameW: 80 });
    const l = layoutText(t);
    expect(l.lines.length).toBeGreaterThan(1);
    expect(l.lines.join('')).not.toBe('');
  });

  it('anchors lines according to alignment', () => {
    const left = layoutText(text('hello', { frameW: 200, align: 'left' })).lines[0].x;
    const centre = layoutText(text('hello', { frameW: 200, align: 'center' })).lines[0].x;
    const right = layoutText(text('hello', { frameW: 200, align: 'right' })).lines[0].x;
    expect(left).toBe(10);
    expect(centre).toBe(110);
    expect(right).toBe(210);
  });

  it('grows with line height and letter spacing', () => {
    const base = text('abc\ndef');
    const tall = text('abc\ndef', { lineHeight: 2 });
    expect(bbox(tall).h).toBeGreaterThan(bbox(base).h);
    expect(bbox(text('abc', { letterSpacing: 10 })).w).toBeGreaterThan(bbox(text('abc')).w);
  });

  it('uses the frame width as the box width', () => {
    expect(bbox(text('x', { frameW: 333 })).w).toBe(333);
  });
});

describe('text rendering', () => {
  it('sets text along a path', () => {
    const path = blankShape('p', 'path', { pts: [{ x: 0, y: 0, hx: 0, hy: 0 }, { x: 100, y: 0, hx: 0, hy: 0 }] });
    const t = text('along', { pathId: 'p' });
    const svg = renderToStaticMarkup(createElement(ShapeEl, { shape: t, all: [path, t] }));
    expect(svg).toContain('<textPath');
    expect(svg).toContain('along');
  });

  it('falls back to plain text when the path is missing', () => {
    const t = text('lost', { pathId: 'gone' });
    const svg = renderToStaticMarkup(createElement(ShapeEl, { shape: t, all: [t] }));
    expect(svg).not.toContain('textPath');
    expect(svg).toContain('lost');
  });

  it('applies font settings', () => {
    const svg = renderToStaticMarkup(createElement(ShapeEl, { shape: text('x', { fontFamily: 'Arial', fontWeight: 700, italic: true, underline: true }) }));
    expect(svg).toContain('font-weight="700"');
    expect(svg).toContain('font-style="italic"');
    expect(svg).toContain('underline');
  });
});
