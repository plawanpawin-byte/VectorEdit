import { describe, expect, it } from 'vitest';
import { cmykToRgb, rgbToCmyk } from '../src/cmyk';

describe('cmyk', () => {
  it('maps the primaries', () => {
    expect(rgbToCmyk(255, 255, 255)).toEqual([0, 0, 0, 0]);
    expect(rgbToCmyk(0, 0, 0)).toEqual([0, 0, 0, 1]);
    expect(rgbToCmyk(255, 0, 0)).toEqual([0, 1, 1, 0]);
    expect(cmykToRgb(0, 1, 1, 0)).toEqual([255, 0, 0]);
    expect(cmykToRgb(0, 0, 0, 1)).toEqual([0, 0, 0]);
  });
  it('round-trips arbitrary colours within rounding', () => {
    for (const c of [[200, 40, 90], [12, 250, 60], [128, 128, 128], [1, 2, 3]] as const) {
      const back = cmykToRgb(...rgbToCmyk(c[0], c[1], c[2]));
      back.forEach((v, i) => expect(Math.abs(v - c[i])).toBeLessThanOrEqual(1));
    }
  });
});
