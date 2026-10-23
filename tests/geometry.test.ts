import { describe, expect, it } from 'vitest';
import { bbox, flatten, hitTest, ngonPts, pathD, ptsOf, rotateShape, scaleAbout, smoothStroke, toPath, translate } from '../src/geometry';
import { blankShape, normalizeShape } from '../src/shape';

const rect = (x = 0, y = 0, w = 100, h = 50) => blankShape('r', 'rect', { x, y, w, h, fill: '#fff' });

describe('geometry', () => {
  it('computes boxes for parametric shapes', () => {
    expect(bbox(rect(10, 20, 30, 40))).toEqual({ x: 10, y: 20, w: 30, h: 40 });
    const star = blankShape('s', 'shape', { x: 0, y: 0, w: 100, h: 100, shapeId: 'star', params: { points: 5, inner: 0.5 } });
    expect(ptsOf(star)).toHaveLength(10);
    expect(ptsOf(blankShape('p', 'shape', { w: 10, h: 10, shapeId: 'polygon', params: { sides: 7 } }))).toHaveLength(7);
  });

  it('generates a closed polygon from the box and scales with it', () => {
    const hex = blankShape('h', 'shape', { x: 0, y: 0, w: 100, h: 100, shapeId: 'polygon', params: { sides: 6 } });
    const big = scaleAbout(hex, 2, 2, 0, 0);
    expect(bbox(big)).toEqual({ x: 0, y: 0, w: 200, h: 200 });
    expect(pathD(hex).endsWith('Z')).toBe(true);
  });

  it('hit-tests fills and outlines', () => {
    const filled = rect();
    expect(hitTest(filled, 50, 25, 2)).toBe(true);
    expect(hitTest(filled, 150, 25, 2)).toBe(false);
    const outline = blankShape('o', 'rect', { x: 0, y: 0, w: 100, h: 50, stroke: '#000', strokeWidth: 2 });
    expect(hitTest(outline, 50, 25, 1)).toBe(false);
    expect(hitTest(outline, 0, 25, 2)).toBe(true);
  });

  it('ignores hidden shapes when hit-testing', () => {
    expect(hitTest({ ...rect(), visible: false }, 50, 25, 2)).toBe(false);
  });

  it('treats extra contours as holes', () => {
    const hole = ngonPts({ x: 25, y: 25, w: 50, h: 50 }, 4, null);
    const ring = blankShape('c', 'path', { closed: true, fill: '#000', pts: ngonPts({ x: 0, y: 0, w: 100, h: 100 }, 4, null), extra: [hole] });
    expect(hitTest(ring, 50, 50, 0)).toBe(false);
    expect(hitTest(ring, 50, 8, 0)).toBe(true);
  });

  it('converts shapes to paths without changing their bounds', () => {
    const e = blankShape('e', 'ellipse', { x: 10, y: 10, w: 80, h: 40, fill: '#000' });
    const p = toPath(e);
    expect(p.kind).toBe('path');
    const b = bbox(p);
    expect(b.w).toBeCloseTo(80, 0);
    expect(b.h).toBeCloseTo(40, 0);
  });

  it('rotates by 90 degrees about the centre', () => {
    const r = rotateShape(rect(0, 0, 100, 50), 90, 50, 25);
    const b = bbox(r);
    expect(b.w).toBeCloseTo(50);
    expect(b.h).toBeCloseTo(100);
    expect(b.x).toBeCloseTo(25);
  });

  it('translates every contour', () => {
    const s = translate(blankShape('c', 'path', { pts: [{ x: 0, y: 0, hx: 0, hy: 0 }], extra: [[{ x: 1, y: 1, hx: 0, hy: 0 }]] }), 5, 5);
    expect(s.pts[0].x).toBe(5);
    expect(s.extra[0][0].y).toBe(6);
  });

  it('simplifies freehand strokes', () => {
    const raw = Array.from({ length: 200 }, (_, i) => ({ x: i, y: Math.sin(i / 20) * 10 }));
    const pts = smoothStroke(raw, 1);
    expect(pts.length).toBeLessThan(raw.length / 4);
    expect(pts[0].hx).toBe(0);
  });

  it('flattens curves into more than their anchors', () => {
    const c = blankShape('c', 'path', { pts: [{ x: 0, y: 0, hx: 50, hy: 0 }, { x: 100, y: 100, hx: 0, hy: 50 }] });
    expect(flatten(c).length).toBeGreaterThan(5);
  });
});

describe('normalizeShape', () => {
  it('fills missing fields from older documents', () => {
    const s = normalizeShape({ id: 's1', kind: 'rect', x: 1, y: 2, w: 3, h: 4, fill: '#fff' });
    expect(s).not.toBeNull();
    expect(s!.effects).toEqual([]);
    expect(s!.dash).toBe('solid');
    expect(s!.group).toBeNull();
  });

  it('migrates legacy polygon and star kinds to registry shapes', () => {
    const star = normalizeShape({ id: 's2', kind: 'star', x: 0, y: 0, w: 10, h: 10, sides: 7, inner: 0.4 });
    expect(star!.kind).toBe('shape');
    expect(star!.shapeId).toBe('star');
    expect(star!.params.points).toBe(7);
    expect(normalizeShape({ id: 's3', kind: 'polygon', w: 5, h: 5, sides: 8 })!.params.sides).toBe(8);
  });

  it('rejects invalid entries', () => {
    expect(normalizeShape(null)).toBeNull();
    expect(normalizeShape({ id: 's', kind: 'banana' })).toBeNull();
    expect(normalizeShape({ kind: 'rect' })).toBeNull();
  });
});

describe('shear', () => {
  it('moves points horizontally in proportion to their distance from the pivot', async () => {
    const { shearShape } = await import('../src/geometry');
    const r = shearShape(blankShape('r', 'rect', { x: 0, y: 0, w: 100, h: 100, fill: '#000' }), 45, 50, 50);
    const b = bbox(r);
    expect(b.w).toBeCloseTo(200, 0); // top edge shifts left by 50, bottom edge right by 50
    expect(b.h).toBeCloseTo(100, 0);
  });
});
