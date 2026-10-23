import { describe, expect, it } from 'vitest';
import { PATH_BRUSHES } from '../src/brushpresets';
import { QUICK_FX } from '../src/quickfx';
import { applyLook, lookOf } from '../src/stylepresets';
import { makeShape } from '../src/store';

describe('path brush presets', () => {
  it('have unique ids and sane brush settings', () => {
    expect(new Set(PATH_BRUSHES.map((p) => p.id)).size).toBe(PATH_BRUSHES.length);
    for (const p of PATH_BRUSHES) {
      expect(p.brush.size).toBeGreaterThan(0);
      expect(['taper', 'uniform', 'calligraphic']).toContain(p.brush.profile);
    }
  });
});

describe('quick fx presets', () => {
  it('have unique ids and every effect is enabled', () => {
    expect(new Set(QUICK_FX.map((q) => q.id)).size).toBe(QUICK_FX.length);
    for (const q of QUICK_FX) for (const e of q.effects) expect(e.enabled).toBe(true);
  });
});

describe('styles', () => {
  it('copies the look of one shape onto another without sharing effect objects', () => {
    const a = makeShape('rect', { fill: '#ff0000', stroke: '#000000', strokeWidth: 4, effects: [{ type: 'shadow', enabled: true, color: '#000', opacity: 0.5, blur: 4, dx: 1, dy: 2 }] });
    const b = makeShape('ellipse', { fill: '#00ff00' });
    const out = applyLook(b, lookOf(a));
    expect(out.fill).toBe('#ff0000');
    expect(out.strokeWidth).toBe(4);
    expect(out.effects).toEqual(a.effects);
    expect(out.effects[0]).not.toBe(a.effects[0]);
    expect(out.id).toBe(b.id);
  });
});
