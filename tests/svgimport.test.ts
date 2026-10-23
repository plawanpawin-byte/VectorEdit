import { describe, expect, it } from 'vitest';
import { bbox } from '../src/geometry';
import { importSvg, parsePathData, parseTransform, parseXml } from '../src/svgimport';

describe('svg import', () => {
  it('reads elements, attributes, self-closing tags and ignores comments', () => {
    const n = parseXml('<?xml version="1.0"?><!-- hi --><svg viewBox="0 0 10 10"><g id="a"><rect x="1" width="2"/></g></svg>')!;
    expect(n.attrs.viewBox).toBe('0 0 10 10');
    expect(n.children[0].children[0].attrs).toEqual({ x: '1', width: '2' });
  });
  it('parses path commands: relative, shorthand, quadratic, arcs and close', () => {
    const subs = parsePathData('M10 10 h20 v20 H10 z M50 50 c10 0 20 10 20 20 s-10 20 -20 20 q10 0 10 -10 t10 -10 a10 10 0 0 1 20 0');
    expect(subs).toHaveLength(2);
    expect(subs[0].closed).toBe(true);
    expect(subs[0].pts.map((p) => [p.x, p.y])).toEqual([[10, 10], [30, 10], [30, 30], [10, 30]]);
    expect(subs[1].closed).toBe(false);
    const last = subs[1].pts[subs[1].pts.length - 1];
    expect(last.x).toBeCloseTo(50 + 20 + (-20) + 10 + 10 + 20, 3); // end of the arc
  });
  it('transforms compose left to right', () => {
    const m = parseTransform('translate(10 20) scale(2)');
    expect(m).toEqual([2, 0, 0, 2, 10, 20]);
    const r = parseTransform('rotate(90)');
    expect(r[1]).toBeCloseTo(1);
  });
  it('imports shapes with styles, viewBox offset, groups and holes', () => {
    const r = importSvg(`<svg viewBox="10 10 100 80" xmlns="http://www.w3.org/2000/svg">
      <g fill="#ff0000" stroke="#00f" stroke-width="3"><rect x="10" y="10" width="40" height="20" rx="4"/><circle cx="70" cy="50" r="10" fill="none"/></g>
      <path d="M0 0H20V20H0Z M5 5V15H15V5Z" style="fill:#0a0" transform="translate(30 40)"/>
      <linearGradient id="g"/><foo/></svg>`)!;
    expect(r.width).toBe(100);
    expect(r.height).toBe(80);
    expect(r.shapes).toHaveLength(3);
    const [rect, circle, compound] = r.shapes;
    expect(rect.fill).toBe('#ff0000');
    expect(rect.stroke).toBe('#00f');
    expect(rect.strokeWidth).toBe(3);
    expect(rect.group).toBeTruthy();
    expect(rect.group).toBe(circle.group);
    expect(circle.fill).toBeNull();
    expect(bbox(rect).x).toBeCloseTo(0, 1); // viewBox origin removed
    expect(bbox(circle).w).toBeCloseTo(20, 0);
    expect(compound.fill).toBe('#0a0');
    expect(compound.extra).toHaveLength(1);
    expect(bbox(compound).x).toBeCloseTo(20); // translate(30) minus viewBox 10
    expect(r.skipped).toEqual(['foo']);
  });
  it('returns null for non-SVG input', () => {
    expect(importSvg('<html></html>')).toBeNull();
    expect(importSvg('')).toBeNull();
  });
});
