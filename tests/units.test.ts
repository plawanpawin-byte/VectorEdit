import { describe, expect, it } from 'vitest';
import { fromPx, toPx, UNITS } from '../src/units';

describe('units', () => {
  it('uses 96 pixels per inch', () => {
    expect(fromPx(96, 'in')).toBeCloseTo(1);
    expect(fromPx(96, 'pt')).toBeCloseTo(72);
    expect(fromPx(96, 'mm')).toBeCloseTo(25.4);
    expect(fromPx(96, 'cm')).toBeCloseTo(2.54);
    expect(fromPx(10, 'px')).toBe(10);
  });
  it('round-trips', () => {
    for (const u of UNITS) expect(toPx(fromPx(123.456, u), u)).toBeCloseTo(123.456, 6);
  });
});
