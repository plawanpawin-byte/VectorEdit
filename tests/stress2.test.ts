import { describe, expect, it } from 'vitest';
import { divideRegions } from '../src/objectops';
import { booleanPieces } from '../src/boolean';
import { makeShape } from '../src/store';

describe('degenerate shapes', () => {
  it('survive flood-fill division', () => {
    const shapes = [
      makeShape('rect', { x: 10, y: 10, w: 0, h: 0 }),
      makeShape('rect', { x: 10, y: 10, w: 0, h: 50 }),
      makeShape('rect', { x: 10, y: 10, w: 50, h: 0 }),
      makeShape('rect', { x: 10, y: 10, w: 50, h: 50 }),
      makeShape('rect', { x: 10, y: 10, w: 50, h: 50 }),
      makeShape('ellipse', { x: 10, y: 10, w: 50, h: 50 }),
      makeShape('ellipse', { x: 10, y: 10, w: 0.001, h: 50 }),
    ];
    let err: unknown = null;
    try { divideRegions(shapes); } catch (e) { err = e; }
    expect(err).toBeNull();
  });
  it('survive union', () => {
    const shapes = Array.from({ length: 30 }, (_, i) => makeShape('rect', { x: 10 + (i % 3), y: 10, w: i % 4 === 0 ? 0 : 40, h: 40 }));
    let err: unknown = null;
    try { booleanPieces(shapes, 'union'); } catch (e) { err = e; }
    expect(err).toBeNull();
  });
});
