import { describe, expect, it } from 'vitest';
import { divideRegions } from '../src/objectops';
import { brushOutline } from '../src/brush';
import { makeShape } from '../src/store';

describe('brush strokes in region division', () => {
  it('does not overflow the stack with scribbled strokes', () => {
    const strokes = Array.from({ length: 6 }, (_, k) => {
      const raw = Array.from({ length: 120 }, (_, i) => ({ x: 100 + 80 * Math.sin(i / 5 + k) + i * 0.5, y: 100 + 80 * Math.cos(i / 3 + k) }));
      return makeShape('path', { closed: true, pts: brushOutline(raw, { size: 12, profile: 'taper', taper: 0.7 }), fill: '#000' });
    });
    let err: unknown = null;
    const t = Date.now();
    try { divideRegions(strokes); } catch (e) { err = e; }
    console.log('ms', Date.now() - t, err && String(err));
    expect(err).toBeNull();
  });
});

import { floodRegion, regionContains } from '../src/objectops';

describe('flood region', () => {
  it('finds the lens where two circles overlap, quickly, and owns it by the top shape', () => {
    const a = makeShape('ellipse', { x: 0, y: 0, w: 100, h: 100, fill: '#f00' });
    const b = makeShape('ellipse', { x: 50, y: 0, w: 100, h: 100, fill: '#00f' });
    const r = floodRegion([a, b], 75, 50)!;
    expect(r).not.toBeNull();
    expect(r.owner).toBe(1);
    expect(regionContains(r.mp, 75, 50)).toBe(true);
    expect(regionContains(r.mp, 25, 50)).toBe(false); // only in the first circle
    expect(regionContains(r.mp, 125, 50)).toBe(false); // only in the second
  });
  it('excludes a shape that cuts into the clicked area', () => {
    const a = makeShape('rect', { x: 0, y: 0, w: 100, h: 100 });
    const hole = makeShape('rect', { x: 40, y: 40, w: 20, h: 20 });
    const r = floodRegion([a, hole], 10, 10)!; // under only the first; the second is cut out
    expect(regionContains(r.mp, 10, 10)).toBe(true);
    expect(regionContains(r.mp, 50, 50)).toBe(false);
  });
  it('returns null outside every shape and stays quick on scribbles', () => {
    const strokes = Array.from({ length: 12 }, (_, k) => {
      const raw = Array.from({ length: 120 }, (_, i) => ({ x: 100 + 80 * Math.sin(i / 5 + k) + i * 0.5, y: 100 + 80 * Math.cos(i / 3 + k) }));
      return makeShape('path', { closed: true, pts: brushOutline(raw, { size: 12, profile: 'taper', taper: 0.7 }), fill: '#000' });
    });
    expect(floodRegion(strokes, -500, -500)).toBeNull();
    const t = Date.now();
    floodRegion(strokes, 100, 180);
    expect(Date.now() - t).toBeLessThan(1500);
  });
});
