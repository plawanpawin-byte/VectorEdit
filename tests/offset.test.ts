import { describe, expect, it } from 'vitest';
import { offsetShape, strokeOutline } from '../src/offset';
import { blankShape } from '../src/shape';
import type { Pt } from '../src/types';

const area = (pts: Pt[]) => Math.abs(pts.reduce((a, p, i) => a + (p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y), 0) / 2);
const total = (c: { outer: Pt[]; holes: Pt[][] }[]) => c.reduce((a, x) => a + area(x.outer) - x.holes.reduce((h, r) => h + area(r), 0), 0);

const square = blankShape('s', 'rect', { x: 0, y: 0, w: 100, h: 100, fill: '#000' });

describe('offset', () => {
  it('grows and shrinks a square', () => {
    const grown = offsetShape(square, 10, 'miter');
    expect(total(grown)).toBeCloseTo(120 * 120, -1);
    const shrunk = offsetShape(square, -10, 'miter');
    expect(total(shrunk)).toBeCloseTo(80 * 80, -1);
  });

  it('rounds the corners when growing with round joins', () => {
    const round = total(offsetShape(square, 10, 'round'));
    expect(round).toBeLessThan(120 * 120);
    expect(round).toBeGreaterThan(100 * 100 + 4 * 100 * 10);
  });

  it('keeps holes of a ring shape', () => {
    const ring = blankShape('r', 'shape', { x: 0, y: 0, w: 100, h: 100, shapeId: 'ring', params: { thickness: 0.3 }, fill: '#000' });
    const out = offsetShape(ring, 5, 'round');
    expect(out).toHaveLength(1);
    expect(out[0].holes).toHaveLength(1);
  });

  it('collapses a shrunk shape to nothing', () => {
    expect(offsetShape(square, -80)).toEqual([]);
  });
});

describe('expand stroke', () => {
  it('turns an open line into a filled rectangle-like outline', () => {
    const line = blankShape('l', 'line', { stroke: '#000', strokeWidth: 10, cap: 'butt', pts: [{ x: 0, y: 0, hx: 0, hy: 0 }, { x: 100, y: 0, hx: 0, hy: 0 }] });
    const out = strokeOutline(line);
    expect(out).toHaveLength(1);
    expect(total(out)).toBeCloseTo(100 * 10, -1);
  });

  it('adds round caps', () => {
    const line = blankShape('l', 'line', { stroke: '#000', strokeWidth: 10, cap: 'round', pts: [{ x: 0, y: 0, hx: 0, hy: 0 }, { x: 100, y: 0, hx: 0, hy: 0 }] });
    expect(total(strokeOutline(line))).toBeGreaterThan(100 * 10 + 50);
  });

  it('outlines a closed shape as a ring', () => {
    const out = strokeOutline({ ...square, stroke: '#000', strokeWidth: 10 });
    expect(out).toHaveLength(1);
    expect(out[0].holes).toHaveLength(1);
    expect(total(out)).toBeCloseTo(110 * 110 - 90 * 90, -2);
  });
});
