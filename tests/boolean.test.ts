import { describe, expect, it } from 'vitest';
import { booleanPieces } from '../src/boolean';
import { blankShape } from '../src/shape';
import type { Pt } from '../src/types';

const rect = (id: string, x: number, y: number, w: number, h: number) => blankShape(id, 'rect', { x, y, w, h, fill: '#000' });
const area = (pts: Pt[]) => Math.abs(pts.reduce((a, p, i) => a + (p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y), 0) / 2);
const total = (pieces: ReturnType<typeof booleanPieces>) => pieces.reduce((a, p) => a + area(p.outer) - p.holes.reduce((h, r) => h + area(r), 0), 0);

const a = rect('a', 0, 0, 100, 100);
const b = rect('b', 50, 50, 100, 100);

describe('boolean operations', () => {
  it('unites overlapping shapes into one', () => {
    const r = booleanPieces([a, b], 'union');
    expect(r).toHaveLength(1);
    expect(total(r)).toBeCloseTo(100 * 100 * 2 - 50 * 50);
  });

  it('subtracts the front shape from the back one', () => {
    expect(total(booleanPieces([a, b], 'subtract'))).toBeCloseTo(100 * 100 - 50 * 50);
  });

  it('intersects', () => {
    expect(total(booleanPieces([a, b], 'intersect'))).toBeCloseTo(50 * 50);
  });

  it('excludes the overlap', () => {
    expect(total(booleanPieces([a, b], 'xor'))).toBeCloseTo(100 * 100 * 2 - 2 * 50 * 50);
  });

  it('returns a hole when a shape is cut from the middle', () => {
    const r = booleanPieces([rect('big', 0, 0, 100, 100), rect('small', 40, 40, 20, 20)], 'subtract');
    expect(r).toHaveLength(1);
    expect(r[0].holes).toHaveLength(1);
  });

  it('returns nothing for disjoint intersections and for fewer than two shapes', () => {
    expect(booleanPieces([a, rect('far', 500, 500, 10, 10)], 'intersect')).toEqual([]);
    expect(booleanPieces([a], 'union')).toEqual([]);
  });

  it('works with curved shapes', () => {
    const e = blankShape('e', 'ellipse', { x: 0, y: 0, w: 100, h: 100, fill: '#000' });
    const r = booleanPieces([e, rect('r', 50, -10, 100, 120)], 'subtract');
    expect(r.length).toBeGreaterThan(0);
    expect(total(r)).toBeGreaterThan(0);
    expect(total(r)).toBeLessThan(Math.PI * 50 * 50);
  });
});
