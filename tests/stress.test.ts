import { describe, expect, it } from 'vitest';
import { divideRegions } from '../src/objectops';
import { booleanPieces } from '../src/boolean';
import { makeShape } from '../src/store';

const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

describe('overlay stress', () => {
  it('divides many overlapping shapes without overflowing the stack', () => {
    const shapes = Array.from({ length: 60 }, (_, i) =>
      makeShape(i % 2 ? 'ellipse' : 'rect', { x: rnd() * 300, y: rnd() * 300, w: 20 + rnd() * 200, h: 20 + rnd() * 200 }),
    );
    expect(() => divideRegions(shapes)).not.toThrow();
  });

  it('unions many shapes', () => {
    const shapes = Array.from({ length: 120 }, () => makeShape('ellipse', { x: rnd() * 300, y: rnd() * 300, w: 30 + rnd() * 100, h: 30 + rnd() * 100 }));
    expect(() => booleanPieces(shapes, 'union')).not.toThrow();
  });
});
