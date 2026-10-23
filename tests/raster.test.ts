import { describe, expect, it } from 'vitest';
import { RASTER_OPS, applyOp, rasterOp } from '../src/raster/ops';
import { type Buf, boxBlur, copyBuf, floodMask, gaussianBlur, hslToRgb, morphMask, newBuf, rgbToHsl } from '../src/raster/pixels';

function solid(w: number, h: number, rgba: [number, number, number, number]): Buf {
  const b = newBuf(w, h);
  for (let i = 0; i < b.data.length; i += 4) b.data.set(rgba, i);
  return b;
}

/** Left half black, right half white. */
function halves(w = 16, h = 8): Buf {
  const b = newBuf(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b.data.set(x < w / 2 ? [0, 0, 0, 255] : [255, 255, 255, 255], (y * w + x) * 4);
  return b;
}

const px = (b: Buf, x: number, y: number) => Array.from(b.data.slice((y * b.width + x) * 4, (y * b.width + x) * 4 + 4));

describe('colour spaces', () => {
  it('round-trips rgb through hsl', () => {
    for (const c of [[200, 40, 90], [12, 250, 60], [128, 128, 128], [0, 0, 255]] as const) {
      const [h, s, l] = rgbToHsl(c[0], c[1], c[2]);
      const back = hslToRgb(h, s, l);
      back.forEach((v, i) => expect(v).toBeCloseTo(c[i], 0));
    }
  });
});

describe('blur', () => {
  it('leaves a flat image unchanged', () => {
    const b = solid(10, 10, [90, 120, 30, 255]);
    gaussianBlur(b, 5);
    expect(px(b, 4, 4)).toEqual([90, 120, 30, 255]);
  });

  it('spreads an edge', () => {
    const b = halves();
    boxBlur(b, 2, 0);
    const edge = px(b, 8, 4)[0];
    expect(edge).toBeGreaterThan(30);
    expect(edge).toBeLessThan(225);
  });
});

describe('flood fill and masks', () => {
  it('selects the connected region only', () => {
    const b = halves(16, 8);
    const m = floodMask(b, 2, 2, 5, true);
    expect(m[2 * 16 + 2]).toBe(255);
    expect(m[2 * 16 + 12]).toBe(0);
    expect(m.reduce((a, v) => a + (v ? 1 : 0), 0)).toBe(8 * 8);
  });

  it('non-contiguous mode finds separated areas of the same colour', () => {
    const b = solid(9, 1, [255, 255, 255, 255]);
    b.data.set([0, 0, 0, 255], 4 * 4); // a black pixel splits the row
    expect(floodMask(b, 0, 0, 5, true).reduce((a, v) => a + (v ? 1 : 0), 0)).toBe(4);
    expect(floodMask(b, 0, 0, 5, false).reduce((a, v) => a + (v ? 1 : 0), 0)).toBe(8);
  });

  it('respects tolerance', () => {
    const b = solid(4, 1, [100, 100, 100, 255]);
    b.data.set([110, 110, 110, 255], 4);
    expect(floodMask(b, 0, 0, 2, true)[1]).toBe(0);
    expect(floodMask(b, 0, 0, 30, true)[1]).toBe(255);
  });

  it('grows and shrinks masks', () => {
    const m = new Uint8Array(9 * 9);
    m[4 * 9 + 4] = 255;
    const grown = morphMask(m, 9, 9, 1);
    expect(grown.reduce((a, v) => a + (v ? 1 : 0), 0)).toBe(9);
    const back = morphMask(grown, 9, 9, -1);
    expect(back.reduce((a, v) => a + (v ? 1 : 0), 0)).toBe(1);
  });
});

describe('adjustments', () => {
  it('inverting twice restores the image', () => {
    const b = halves();
    const orig = copyBuf(b);
    applyOp(b, rasterOp('invert')!, {});
    expect(px(b, 0, 0)).toEqual([255, 255, 255, 255]);
    applyOp(b, rasterOp('invert')!, {});
    expect(Array.from(b.data)).toEqual(Array.from(orig.data));
  });

  it('brightness raises and lowers values', () => {
    const up = solid(2, 2, [100, 100, 100, 255]);
    applyOp(up, rasterOp('brightness-contrast')!, { brightness: 30 });
    expect(up.data[0]).toBeGreaterThan(100);
    const down = solid(2, 2, [100, 100, 100, 255]);
    applyOp(down, rasterOp('brightness-contrast')!, { brightness: -30 });
    expect(down.data[0]).toBeLessThan(100);
  });

  it('thresholds to black and white', () => {
    const b = solid(2, 1, [200, 200, 200, 255]);
    b.data.set([40, 40, 40, 255], 4);
    applyOp(b, rasterOp('threshold')!, { level: 128 });
    expect(px(b, 0, 0).slice(0, 3)).toEqual([255, 255, 255]);
    expect(px(b, 1, 0).slice(0, 3)).toEqual([0, 0, 0]);
  });

  it('posterise limits distinct levels', () => {
    const b = newBuf(256, 1);
    for (let x = 0; x < 256; x++) b.data.set([x, x, x, 255], x * 4);
    applyOp(b, rasterOp('posterise')!, { levels: 4 });
    const levels = new Set(Array.from({ length: 256 }, (_, x) => b.data[x * 4]));
    expect(levels.size).toBe(4);
  });

  it('black & white removes colour', () => {
    const b = solid(2, 2, [220, 40, 90, 255]);
    applyOp(b, rasterOp('black-white')!, {});
    expect(b.data[0]).toBe(b.data[1]);
    expect(b.data[1]).toBe(b.data[2]);
  });

  it('desaturating via HSL gives grey', () => {
    const b = solid(2, 2, [220, 40, 90, 255]);
    applyOp(b, rasterOp('hsl')!, { sat: -100 });
    expect(Math.abs(b.data[0] - b.data[1])).toBeLessThanOrEqual(1);
  });

  it('auto levels stretches a narrow range', () => {
    const b = newBuf(10, 1);
    for (let x = 0; x < 10; x++) b.data.set([100 + x * 5, 100 + x * 5, 100 + x * 5, 255], x * 4);
    applyOp(b, rasterOp('auto-levels')!, { clip: 0 });
    expect(b.data[0]).toBe(0);
    expect(b.data[9 * 4]).toBe(255);
  });

  it('white balance warms by lifting red and lowering blue', () => {
    const b = solid(2, 2, [128, 128, 128, 255]);
    applyOp(b, rasterOp('white-balance')!, { temperature: 50 });
    expect(b.data[0]).toBeGreaterThan(128);
    expect(b.data[2]).toBeLessThan(128);
  });

  it('never changes alpha', () => {
    const b = solid(3, 3, [50, 60, 70, 99]);
    for (const op of RASTER_OPS.filter((o) => o.kind === 'adjust')) applyOp(b, op, {});
    expect(b.data[3]).toBe(99);
  });
});

describe('masked application', () => {
  it('only changes pixels inside the mask', () => {
    const b = solid(4, 1, [100, 100, 100, 255]);
    const mask = new Uint8Array([255, 255, 0, 0]);
    applyOp(b, rasterOp('invert')!, {}, mask);
    expect(px(b, 0, 0)[0]).toBe(155);
    expect(px(b, 3, 0)[0]).toBe(100);
  });

  it('blends partially for feathered masks', () => {
    const b = solid(1, 1, [0, 0, 0, 255]);
    applyOp(b, rasterOp('invert')!, {}, new Uint8Array([128]));
    expect(b.data[0]).toBeGreaterThan(100);
    expect(b.data[0]).toBeLessThan(155);
  });
});

describe('every operation', () => {
  for (const op of RASTER_OPS) {
    it(`${op.id} runs on its defaults without producing NaN`, () => {
      const b = halves(24, 16);
      applyOp(b, op, {});
      expect(b.data.every((v) => Number.isFinite(v))).toBe(true);
      expect(b.data.length).toBe(24 * 16 * 4);
    });

    it(`${op.id} is stable at its extremes`, () => {
      const lo = Object.fromEntries(op.params.map((q) => [q.key, q.min]));
      const hi = Object.fromEntries(op.params.map((q) => [q.key, q.max]));
      for (const params of [lo, hi]) {
        const b = halves(20, 12);
        expect(() => applyOp(b, op, params)).not.toThrow();
        expect(b.data.every((v) => v >= 0 && v <= 255)).toBe(true);
      }
    });
  }

  it('has unique ids and sensible parameter ranges', () => {
    expect(new Set(RASTER_OPS.map((o) => o.id)).size).toBe(RASTER_OPS.length);
    for (const op of RASTER_OPS) for (const q of op.params) expect(q.min).toBeLessThanOrEqual(q.def), expect(q.def).toBeLessThanOrEqual(q.max);
  });
});

describe('added filters and adjustments', () => {
  const run = (id: string, b: Buf, params: Record<string, number> = {}) => (applyOp(b, rasterOp(id)!, params), b);
  it('median removes a single hot pixel', () => {
    const b = solid(7, 7, [50, 50, 50, 255]);
    b.data.set([255, 255, 255, 255], (3 * 7 + 3) * 4);
    run('median', b, { radius: 1 });
    expect(px(b, 3, 3)[0]).toBe(50);
  });
  it('maximum grows light areas and minimum grows dark ones', () => {
    const grown = run('maximum', halves(), { radius: 2 });
    expect(px(grown, 6, 4)[0]).toBe(255);
    const shrunk = run('minimum', halves(), { radius: 2 });
    expect(px(shrunk, 9, 4)[0]).toBe(0);
  });
  it('bilateral keeps a hard edge while lens blur softens it', () => {
    const edge = run('bilateral', halves(), { radius: 3, tolerance: 20 });
    expect(px(edge, 7, 4)[0]).toBeLessThan(10);
    expect(px(edge, 8, 4)[0]).toBeGreaterThan(245);
    const lens = run('lens-blur', halves(), { radius: 4, highlights: 0 });
    expect(px(lens, 7, 4)[0]).toBeGreaterThan(10);
  });
  it('selective colour only touches the targeted hue', () => {
    const b = newBuf(2, 1);
    b.data.set([255, 0, 0, 255, 0, 0, 255, 255], 0);
    run('selective-colour', b, { hue: 0, range: 30, shift: 120, sat: 0, lum: 0 });
    expect(px(b, 0, 0)[1]).toBeGreaterThan(200); // red moved to green
    expect(px(b, 1, 0)).toEqual([0, 0, 255, 255]); // blue untouched
  });
  it('tone compression pulls values toward the midpoint', () => {
    const b = run('tone-compression', halves(), { amount: 50, mid: 128 });
    expect(px(b, 0, 0)[0]).toBe(64);
    expect(px(b, 15, 0)[0]).toBe(192);
  });
  it('normal map of a flat image points straight out', () => {
    const b = run('normals', solid(4, 4, [90, 90, 90, 255]));
    expect(px(b, 2, 2)).toEqual([128, 128, 255, 255]);
  });
  it('polar conversions run and keep alpha', () => {
    const b = run('rect-to-polar', halves());
    expect(px(b, 8, 4)[3]).toBe(255);
    run('polar-to-rect', b);
  });
});
