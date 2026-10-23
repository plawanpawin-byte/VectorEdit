import { describe, expect, it } from 'vitest';
import { pickInTriangle, triangle } from '../src/components/ColorWheel';

describe('colour wheel triangle', () => {
  it('maps the three corners to pure colour, white and black', () => {
    const t = triangle(120);
    const c = pickInTriangle(120, t.c.x, t.c.y);
    expect(c.s).toBeCloseTo(1, 3);
    expect(c.v).toBeCloseTo(1, 3);
    const w = pickInTriangle(120, t.w.x, t.w.y);
    expect(w.s).toBeCloseTo(0, 3);
    expect(w.v).toBeCloseTo(1, 3);
    const k = pickInTriangle(120, t.k.x, t.k.y);
    expect(k.v).toBeCloseTo(0, 3);
  });
  it('clamps points outside the triangle onto it', () => {
    const q = pickInTriangle(0, 5000, 5000);
    expect(q.s).toBeGreaterThanOrEqual(0);
    expect(q.s).toBeLessThanOrEqual(1);
    expect(q.v).toBeGreaterThanOrEqual(0);
    expect(q.v).toBeLessThanOrEqual(1);
  });
  it('midpoint of the white-black edge is mid grey', () => {
    const t = triangle(200);
    const q = pickInTriangle(200, (t.w.x + t.k.x) / 2, (t.w.y + t.k.y) / 2);
    expect(q.s).toBeCloseTo(0, 3);
    expect(q.v).toBeCloseTo(0.5, 3);
  });
});
