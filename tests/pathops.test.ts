import { describe, expect, it } from 'vitest';
import { flatten } from '../src/geometry';
import { deleteNodes, insertNode, nearestOnPath, splitPath, toggleNode } from '../src/pathops';
import { blankShape } from '../src/shape';
import type { Pt } from '../src/types';

const line: Pt[] = [
  { x: 0, y: 0, hx: 0, hy: 0 },
  { x: 100, y: 0, hx: 0, hy: 0 },
];
const curve: Pt[] = [
  { x: 0, y: 0, hx: 40, hy: 0 },
  { x: 100, y: 100, hx: 0, hy: 40 },
];
const shape = (pts: Pt[], closed = false) => blankShape('p', 'path', { pts, closed });

describe('path operations', () => {
  it('finds the nearest point on a path', () => {
    const n = nearestOnPath(line, false, { x: 30, y: 12 })!;
    expect(n.seg).toBe(0);
    expect(n.pt.x).toBeCloseTo(30, 0);
    expect(n.dist).toBeCloseTo(12, 0);
  });

  it('inserts a node without changing the curve', () => {
    const before = flatten(shape(curve), 200);
    const pts = insertNode(curve, false, 0, 0.4);
    expect(pts).toHaveLength(3);
    const after = flatten(shape(pts), 200);
    // every original sample lies close to the new outline
    for (const p of before) {
      const d = Math.min(...after.map((q) => Math.hypot(q.x - p.x, q.y - p.y)));
      expect(d).toBeLessThan(0.6);
    }
  });

  it('splits an open path into two', () => {
    const three: Pt[] = [...line, { x: 200, y: 0, hx: 0, hy: 0 }];
    const parts = splitPath(three, false, 0, 0.5);
    expect(parts).toHaveLength(2);
    expect(parts[0][parts[0].length - 1].x).toBeCloseTo(50);
    expect(parts[1][0].x).toBeCloseTo(50);
  });

  it('turns a closed path into one open path when split', () => {
    const tri: Pt[] = [
      { x: 0, y: 0, hx: 0, hy: 0 },
      { x: 100, y: 0, hx: 0, hy: 0 },
      { x: 50, y: 80, hx: 0, hy: 0 },
    ];
    const parts = splitPath(tri, true, 0, 0.5);
    expect(parts).toHaveLength(1);
    expect(parts[0][0].x).toBeCloseTo(50);
    expect(parts[0][parts[0].length - 1].x).toBeCloseTo(50);
  });

  it('deletes nodes but keeps at least two', () => {
    const three: Pt[] = [...line, { x: 200, y: 0, hx: 0, hy: 0 }];
    expect(deleteNodes(three, [1])).toHaveLength(2);
    expect(deleteNodes(three, [0, 1])).toBeNull();
  });

  it('toggles a node between sharp and smooth', () => {
    const three: Pt[] = [{ x: 0, y: 0, hx: 0, hy: 0 }, { x: 50, y: 50, hx: 0, hy: 0 }, { x: 100, y: 0, hx: 0, hy: 0 }];
    const smooth = toggleNode(three, false, 1);
    expect(smooth[1].hx).not.toBe(0);
    const sharp = toggleNode(smooth, false, 1);
    expect(sharp[1].hx).toBe(0);
    expect(sharp[1].ix).toBe(0);
  });
});
