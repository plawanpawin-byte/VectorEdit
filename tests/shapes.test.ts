import { describe, expect, it } from 'vitest';
import { bbox, flatten, hitTest, toPath } from '../src/geometry';
import { blankShape } from '../src/shape';
import { SHAPES, buildShape, defaultParams } from '../src/shapes';

const make = (id: string, w = 100, h = 80, params = {}) =>
  blankShape('t', 'shape', { x: 10, y: 20, w, h, shapeId: id, params: { ...defaultParams(id), ...params }, fill: '#000' });

describe('shape registry', () => {
  it('has the shapes the toolbar advertises', () => {
    expect(SHAPES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(SHAPES.map((s) => s.id)).size).toBe(SHAPES.length);
  });

  for (const def of SHAPES) {
    it(`${def.id}: builds finite anchors inside (or near) its box`, () => {
      const s = make(def.id);
      const { pts, extra } = buildShape(s);
      expect(pts.length).toBeGreaterThanOrEqual(2);
      for (const p of [...pts, ...(extra ?? []).flat()]) {
        for (const v of [p.x, p.y, p.hx, p.hy]) expect(Number.isFinite(v)).toBe(true);
      }
      const b = bbox(s);
      expect(b.w).toBe(100);
      // flattened outline stays within the box plus a small overshoot for curve handles
      for (const p of flatten(s)) {
        expect(p.x).toBeGreaterThan(10 - 25);
        expect(p.x).toBeLessThan(110 + 25);
        expect(p.y).toBeGreaterThan(20 - 25);
        expect(p.y).toBeLessThan(100 + 25);
      }
    });

    it(`${def.id}: survives extreme parameter values`, () => {
      const params = Object.fromEntries(def.params.flatMap((q) => [[q.key, q.min]]));
      const lo = make(def.id, 50, 50, params);
      expect(() => buildShape(lo)).not.toThrow();
      const hi = make(def.id, 50, 50, Object.fromEntries(def.params.map((q) => [q.key, q.max])));
      expect(() => flatten(hi)).not.toThrow();
    });

    it(`${def.id}: converts to a path with the same outline`, () => {
      const s = make(def.id);
      const p = toPath(s);
      expect(p.kind).toBe('path');
      expect(p.pts.length).toBe(buildShape(s).pts.length);
    });
  }

  it('stars get sharper with fewer corner rounding', () => {
    const sharp = buildShape(make('star', 100, 100, { corner: 0 })).pts.length;
    const round = buildShape(make('star', 100, 100, { corner: 0.6 })).pts.length;
    expect(round).toBeGreaterThan(sharp);
  });

  it('rings and cogs have holes that are not hit', () => {
    const ring = make('ring', 100, 100, { thickness: 0.3 });
    expect(buildShape(ring).extra).toHaveLength(1);
    expect(hitTest(ring, 60, 70, 0)).toBe(false); // centre of the hole
    expect(hitTest(ring, 12, 70, 0)).toBe(true); // on the band
  });

  it('spiral is an open path', () => {
    expect(buildShape(make('spiral')).closed).toBe(false);
  });
});
