import { describe, expect, it } from 'vitest';
import { defaultMesh, meshCells, meshColour } from '../src/mesh';

const mesh = { n: 2, colors: ['#ff0000', '#00ff00', '#0000ff', '#ffffff'] };

describe('mesh gradient', () => {
  it('returns the control colours at the corners and a blend between them', () => {
    expect(meshColour(mesh, 0, 0)).toBe('#ff0000');
    expect(meshColour(mesh, 1, 0)).toBe('#00ff00');
    expect(meshColour(mesh, 0, 1)).toBe('#0000ff');
    expect(meshColour(mesh, 1, 1)).toBe('#ffffff');
    expect(meshColour(mesh, 0.5, 0)).toBe('#808000');
  });
  it('tiles a box with overlapping cells', () => {
    const cells = meshCells(mesh, { x: 10, y: 20, w: 100, h: 50 }, 4);
    expect(cells).toHaveLength(16);
    expect(cells[0].x).toBe(10);
    expect(cells[15].y).toBeCloseTo(20 + 37.5);
    expect(cells[0].w).toBeGreaterThan(25);
  });
  it('builds a default mesh of the right size', () => {
    const m = defaultMesh(3, '#336699');
    expect(m.colors).toHaveLength(9);
    expect(new Set(m.colors).size).toBeGreaterThan(3);
  });
});

import { meshPosition, meshQuads } from '../src/mesh';
describe('free-form mesh', () => {
  it('follows moved grid points', () => {
    const even = { n: 2, colors: ['#f00', '#0f0', '#00f', '#fff'] };
    expect(meshPosition(even, 0.5, 0.5)).toEqual({ x: 0.5, y: 0.5 });
    const moved = { ...even, pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0.5, y: 0.5 }] };
    const p = meshPosition(moved, 1, 1);
    expect(p).toEqual({ x: 0.5, y: 0.5 });
    expect(meshQuads(moved, { x: 0, y: 0, w: 100, h: 100 }, 4)).toHaveLength(16);
  });
});
