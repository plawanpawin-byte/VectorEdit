import { describe, expect, it } from 'vitest';
import { blendShapes, lerpColour } from '../src/blend';
import { bbox } from '../src/geometry';
import { blankShape } from '../src/shape';

describe('blend', () => {
  it('blends colours and falls back for non-hex values', () => {
    expect(lerpColour('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(lerpColour('#000', '#fff', 0.25)).toBe('#404040');
    expect(lerpColour(null, '#fff', 0.2)).toBeNull();
  });
  it('creates evenly spaced intermediate shapes', () => {
    const a = blankShape('a', 'rect', { x: 0, y: 0, w: 10, h: 10, fill: '#000000' });
    const b = blankShape('b', 'rect', { x: 100, y: 0, w: 30, h: 10, fill: '#ffffff' });
    const mid = blendShapes(a, b, 3);
    expect(mid.map((s) => s.x)).toEqual([25, 50, 75]);
    expect(mid[1].w).toBe(20);
    expect(mid[1].fill).toBe('#808080');
    expect(blendShapes(a, b, 0)).toEqual([]);
  });
  it('blends matching paths node by node and different paths by box', () => {
    const tri = (dx: number) => blankShape('p', 'path', { closed: true, pts: [{ x: dx, y: 0, hx: 0, hy: 0 }, { x: dx + 10, y: 0, hx: 0, hy: 0 }, { x: dx, y: 10, hx: 0, hy: 0 }] });
    const m = blendShapes(tri(0), tri(100), 1)[0];
    expect(m.pts[0].x).toBe(50);
    const e = blankShape('e', 'ellipse', { x: 200, y: 0, w: 20, h: 20 });
    const mixed = blendShapes(tri(0), e, 1)[0];
    expect(bbox(mixed).x).toBeCloseTo(100);
    expect(bbox(mixed).w).toBeCloseTo(15);
  });
});
