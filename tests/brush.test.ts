import { describe, expect, it } from 'vitest';
import { cutPieces } from '../src/boolean';
import { brushOutline } from '../src/brush';
import { blankShape } from '../src/shape';

const stroke = Array.from({ length: 60 }, (_, i) => ({ x: i * 3, y: Math.sin(i / 8) * 12 }));

describe('vector brush', () => {
  it('builds a closed outline around the stroke', () => {
    const o = brushOutline(stroke, { size: 12, profile: 'uniform', taper: 0.7 });
    expect(o.length).toBeGreaterThan(20);
    const ys = o.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(12);
  });

  it('tapers towards the ends', () => {
    const o = brushOutline(stroke, { size: 20, profile: 'taper', taper: 0.7 });
    const half = o.length / 2;
    const widthAt = (i: number) => Math.hypot(o[i].x - o[o.length - 1 - i].x, o[i].y - o[o.length - 1 - i].y);
    expect(widthAt(Math.floor(half / 2))).toBeGreaterThan(widthAt(0));
  });

  it('returns nothing for a single point', () => {
    expect(brushOutline([{ x: 0, y: 0 }], { size: 10, profile: 'taper', taper: 0.5 })).toEqual([]);
  });
});

describe('knife', () => {
  const rect = blankShape('r', 'rect', { x: 0, y: 0, w: 100, h: 100, fill: '#000' });
  it('cuts a rectangle into two pieces', () => {
    const pieces = cutPieces(rect, { x: 50, y: -10 }, { x: 50, y: 110 }, 0.4)!;
    expect(pieces).toHaveLength(2);
  });
  it('does nothing when the line misses', () => {
    expect(cutPieces(rect, { x: 300, y: 0 }, { x: 300, y: 100 }, 0.4)).toBeNull();
  });
  it('does not separate a shape the line only notches', () => {
    expect(cutPieces(rect, { x: 50, y: -10 }, { x: 50, y: 40 }, 0.4)).toBeNull();
  });
});
