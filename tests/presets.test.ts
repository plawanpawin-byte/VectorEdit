import { describe, expect, it } from 'vitest';
import { QUICK_PRESETS } from '../src/raster/presets';
import { applyOp, rasterOp } from '../src/raster/ops';
import { newBuf } from '../src/raster/pixels';

describe('quick presets', () => {
  it('only use known operations and parameters inside their ranges', () => {
    for (const p of QUICK_PRESETS) {
      expect(p.steps.length, p.id).toBeGreaterThan(0);
      for (const s of p.steps) {
        const op = rasterOp(s.op);
        expect(op, `${p.id}: ${s.op}`).toBeTruthy();
        for (const [k, v] of Object.entries(s.params)) {
          const def = op!.params.find((q) => q.key === k);
          expect(def, `${p.id}: ${s.op}.${k}`).toBeTruthy();
          expect(v).toBeGreaterThanOrEqual(def!.min);
          expect(v).toBeLessThanOrEqual(def!.max);
        }
      }
    }
  });
  it('change a test image without breaking alpha', () => {
    for (const p of QUICK_PRESETS) {
      const b = newBuf(16, 16);
      for (let i = 0; i < b.data.length; i += 4) b.data.set([120, 90, 60, 255], i);
      const before = Array.from(b.data);
      for (const s of p.steps) applyOp(b, rasterOp(s.op)!, s.params);
      expect(Array.from(b.data), p.id).not.toEqual(before);
      expect(b.data[3], p.id).toBe(255);
    }
  });
});
