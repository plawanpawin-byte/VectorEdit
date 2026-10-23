import { describe, expect, it } from 'vitest';
import type { Geom, MultiPolygon } from 'polygon-clipping';
import { clip, robust } from '../src/clip';

const square = (x: number, y: number, s: number): Geom => [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]];

describe('clip', () => {
  it('combines polygons like the underlying library', () => {
    expect(clip.union(square(0, 0, 10), square(5, 5, 10))).toHaveLength(1);
    expect(clip.intersection(square(0, 0, 10), square(20, 20, 5))).toHaveLength(0);
    expect(clip.difference(square(0, 0, 10), square(2, 2, 2))[0]).toHaveLength(2); // a hole
  });

  it('retries on a coarser grid when the first attempt throws', () => {
    let calls = 0;
    const flaky = (g: Geom): MultiPolygon => {
      calls++;
      const x = (g as number[][][])[0][0][0];
      if (x !== Math.round(x * 100) / 100) throw new Error('Unable to pop() SweepEvent');
      return [[[[x, 0]]]] as MultiPolygon;
    };
    const out = robust(flaky, [[[[0.123456789, 0], [1, 0], [1, 1], [0.123456789, 0]]]]);
    expect(calls).toBe(2);
    expect(out[0][0][0][0]).toBeCloseTo(0.12, 5);
  });

  it('rethrows when no grid helps', () => {
    expect(() => robust(() => { throw new Error('boom'); }, [square(0, 0, 1)])).toThrow('boom');
  });
});
