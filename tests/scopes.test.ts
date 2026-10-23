import { describe, expect, it } from 'vitest';
import { histogram, vectorscope, waveform } from '../src/scopes';

const img = (w: number, h: number, f: (x: number, y: number) => [number, number, number, number]) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(f(x, y), (y * w + x) * 4);
  return { width: w, height: h, data };
};

describe('scopes', () => {
  it('histogram counts each channel and skips transparent pixels', () => {
    const h = histogram(img(4, 1, (x) => (x < 3 ? [10, 20, 30, 255] : [200, 200, 200, 0])));
    expect(h.r[10]).toBe(3);
    expect(h.g[20]).toBe(3);
    expect(h.b[30]).toBe(3);
    expect(h.r[200]).toBe(0);
  });
  it('waveform places a bright left half and dark right half in different columns', () => {
    const w = waveform(img(16, 4, (x) => (x < 8 ? [250, 250, 250, 255] : [5, 5, 5, 255])), 2);
    expect(w[0 * 256 + 250]).toBeCloseTo(1, 5); // every pixel of column 0 is bright
    expect(w[1 * 256 + 5]).toBeGreaterThan(0);
    expect(w[0 * 256 + 5]).toBe(0);
  });
  it('vectorscope puts neutral grey at the centre and red off-centre', () => {
    const size = 33;
    const grey = vectorscope(img(8, 8, () => [128, 128, 128, 255]), size);
    expect(grey[16 * size + 16]).toBeGreaterThan(0);
    const red = vectorscope(img(8, 8, () => [255, 0, 0, 255]), size);
    expect(red[16 * size + 16]).toBe(0);
    expect(red.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });
});
