import { describe, expect, it } from 'vitest';
import { bbox } from '../src/geometry';
import { divideRegions, joinOpen, reversePts, simplify, smoothPts, stepRepeat, traceMask } from '../src/objectops';
import { blankShape } from '../src/shape';
import type { Pt } from '../src/types';

const pt = (x: number, y: number, hx = 0, hy = 0): Pt => ({ x, y, hx, hy });
const area = (ring: { x: number; y: number }[]) => Math.abs(ring.reduce((s, p, i) => s + (p.x * ring[(i + 1) % ring.length].y - ring[(i + 1) % ring.length].x * p.y), 0) / 2);

describe('object ops', () => {
  it('reverses a path and swaps handles', () => {
    const r = reversePts([pt(0, 0, 10, 0), pt(50, 0, 5, 5)]);
    expect(r[0].x).toBe(50);
    expect(r[0].hx).toBe(-5); // old in-handle becomes the out-handle
    expect(r[1].ix).toBe(10);
  });
  it('joins open paths at their nearest ends, merging coincident ones', () => {
    const j = joinOpen([pt(0, 0), pt(10, 0)], [pt(10, 0), pt(20, 5)]);
    expect(j).toHaveLength(3);
    const k = joinOpen([pt(0, 0), pt(10, 0)], [pt(40, 0), pt(30, 0)]);
    expect(k.map((p) => p.x)).toEqual([0, 10, 30, 40]);
  });
  it('smoothing gives interior nodes handles and leaves end nodes alone', () => {
    const s = smoothPts([pt(0, 0), pt(10, 10), pt(20, 0)], false);
    expect(s[1].hx).not.toBe(0);
    expect(s[0].hx).toBe(0);
  });
  it('divide splits two overlapping squares into three regions', () => {
    const a = blankShape('a', 'rect', { x: 0, y: 0, w: 10, h: 10, fill: '#f00' });
    const b = blankShape('b', 'rect', { x: 5, y: 5, w: 10, h: 10, fill: '#00f' });
    const regions = divideRegions([a, b]);
    expect(regions).toHaveLength(3);
    expect(regions.find((r) => r.owner === 1 && r.mp.length === 1 && Math.abs(area(r.mp[0][0].map(([x, y]) => ({ x, y }))) - 25) < 1e-6)).toBeTruthy(); // overlap belongs to the top shape
  });
  it('step and repeat offsets every copy', () => {
    const r = blankShape('r', 'rect', { x: 0, y: 0, w: 10, h: 10 });
    const copies = stepRepeat(r, 3, 20, 5);
    expect(copies.map((c) => c.x)).toEqual([20, 40, 60]);
    expect(bbox(copies[2]).y).toBe(15);
  });
  it('simplify drops collinear points', () => {
    expect(simplify([{ x: 0, y: 0 }, { x: 5, y: 0.01 }, { x: 10, y: 0 }], 0.1)).toHaveLength(2);
  });
  it('traces a filled block and a hole', () => {
    // 6x6 with a 2x2 block at (1,1) and a 4x4 block at (0..?) -> test a ring with a hole
    const grid = (x: number, y: number) => x >= 1 && x <= 4 && y >= 1 && y <= 4 && !(x >= 2 && x <= 3 && y >= 2 && y <= 3);
    const rings = traceMask(6, 6, grid);
    expect(rings).toHaveLength(2);
    const areas = rings.map(area).sort((p, q) => q - p);
    expect(areas[0]).toBeCloseTo(16);
    expect(areas[1]).toBeCloseTo(4);
  });
});
