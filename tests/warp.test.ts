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
