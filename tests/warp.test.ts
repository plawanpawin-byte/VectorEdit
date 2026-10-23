import { describe, expect, it } from 'vitest';
import { bbox } from '../src/geometry';
import { blankShape } from '../src/shape';
import { envelopeMap, neutralNet, perspectiveMap, subdividePts, warpShape } from '../src/warp';

const box = { x: 0, y: 0, w: 100, h: 50 };
const rect = blankShape('r', 'rect', box);

describe('warp', () => {
  it('perspective with the original corners is the identity', () => {
    const m = perspectiveMap(box, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }]);
    const p = m({ x: 30, y: 20 });
    expect(p.x).toBeCloseTo(30);
    expect(p.y).toBeCloseTo(20);
  });
  it('perspective maps the corners onto the quad', () => {
    const q: [any, any, any, any] = [{ x: 10, y: 0 }, { x: 90, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }];
    const m = perspectiveMap(box, q);
    expect(m({ x: 100, y: 0 }).x).toBeCloseTo(90);
    expect(m({ x: 0, y: 50 }).x).toBeCloseTo(0);
  });
  it('neutral envelope is the identity', () => {
    const m = envelopeMap(box, neutralNet(box));
    const p = m({ x: 25, y: 10 });
    expect(p.x).toBeCloseTo(25);
    expect(p.y).toBeCloseTo(10);
  });
  it('larger meshes are also the identity until a handle moves', () => {
    for (const n of [4, 5, 6]) {
      const m = envelopeMap(box, neutralNet(box, n), n);
      const p = m({ x: 37, y: 12 });
      expect(p.x).toBeCloseTo(37);
      expect(p.y).toBeCloseTo(12);
    }
  });
  it('moving one handle of a 4x4 mesh bends only nearby points most', () => {
    const net = neutralNet(box, 4);
    net[5] = { x: net[5].x, y: net[5].y - 20 };
    const m = envelopeMap(box, net, 4);
    expect(m({ x: 33, y: 17 }).y).toBeLessThan(17);
    expect(m({ x: 0, y: 0 }).y).toBeCloseTo(0);
    expect(m({ x: 100, y: 50 }).y).toBeCloseTo(50);
  });
  it('subdividing keeps endpoints and adds points', () => {
    const pts = [{ x: 0, y: 0, hx: 10, hy: 0 }, { x: 30, y: 0, hx: 0, hy: 0 }];
    const out = subdividePts(pts, false, 4);
    expect(out).toHaveLength(5);
    expect(out[0].x).toBe(0);
    expect(out[4].x).toBe(30);
  });
  it('warping a rect yields a path inside the target quad', () => {
    const m = perspectiveMap(box, [{ x: 20, y: 0 }, { x: 80, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }]);
    const w = warpShape(rect, m);
    expect(w.kind).toBe('path');
    const b = bbox(w);
    expect(b.x).toBeCloseTo(0, 0);
    expect(b.w).toBeCloseTo(100, 0);
  });
});

import { inversePerspective, invertMap } from '../src/warp';
import { warpBuf } from '../src/raster/warp';
import { newBuf } from '../src/raster/pixels';

describe('inverse maps and raster warping', () => {
  const q: [any, any, any, any] = [{ x: 15, y: 0 }, { x: 85, y: 10 }, { x: 100, y: 50 }, { x: 0, y: 40 }];
  it('inverse perspective undoes the forward map', () => {
    const fwd = perspectiveMap(box, q);
    const inv = inversePerspective(box, q);
    for (const p of [{ x: 10, y: 10 }, { x: 70, y: 35 }, { x: 99, y: 1 }]) {
      const back = inv(fwd(p));
      expect(back.x).toBeCloseTo(p.x, 4);
      expect(back.y).toBeCloseTo(p.y, 4);
    }
  });
  it('Newton inversion undoes an envelope warp', () => {
    const net = neutralNet(box, 4);
    net[5] = { x: net[5].x + 8, y: net[5].y - 12 };
    const fwd = envelopeMap(box, net, 4);
    const inv = invertMap(fwd);
    const p = { x: 40, y: 20 };
    const back = inv(fwd(p));
    expect(back.x).toBeCloseTo(p.x, 1);
    expect(back.y).toBeCloseTo(p.y, 1);
  });
  it('shifts pixels with a translation and leaves uncovered areas transparent', () => {
    const src = newBuf(10, 10);
    for (let i = 0; i < src.data.length; i += 4) src.data.set([200, 0, 0, 255], i);
    const out = warpBuf(src, { x: 0, y: 0, w: 10, h: 10, rw: 10, rh: 10 }, (p) => ({ x: p.x - 4, y: p.y }));
    expect(out.data[(5 * 10 + 6) * 4 + 3]).toBe(255);
    expect(out.data[(5 * 10 + 1) * 4 + 3]).toBe(0);
  });
});
