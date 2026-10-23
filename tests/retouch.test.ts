import { describe, expect, it } from 'vitest';
import { dab } from '../src/raster/retouch';
import { type Buf, newBuf } from '../src/raster/pixels';

function solid(w: number, h: number, c: [number, number, number]): Buf {
  const b = newBuf(w, h);
  for (let i = 0; i < b.data.length; i += 4) b.data.set([...c, 255], i);
  return b;
}
const px = (b: Buf, x: number, y: number) => Array.from(b.data.slice((y * b.width + x) * 4, (y * b.width + x) * 4 + 3));

describe('retouch brushes', () => {
  it('dodge lightens and burn darkens under the brush only', () => {
    const a = solid(21, 21, [100, 100, 100]);
    dab(a, 'dodge', 10, 10, 6, 1, 1);
    expect(px(a, 10, 10)[0]).toBeGreaterThan(100);
    expect(px(a, 0, 0)[0]).toBe(100);
    const b = solid(21, 21, [100, 100, 100]);
    dab(b, 'burn', 10, 10, 6, 1, 1);
    expect(px(b, 10, 10)[0]).toBeLessThan(100);
  });

  it('blur smooths a single bright pixel', () => {
    const b = solid(21, 21, [0, 0, 0]);
    b.data.set([255, 255, 255, 255], (10 * 21 + 10) * 4);
    dab(b, 'blur', 10, 10, 8, 1, 1);
    expect(px(b, 10, 10)[0]).toBeLessThan(255);
    expect(px(b, 11, 10)[0]).toBeGreaterThan(0);
  });

  it('sharpen increases local contrast', () => {
    const b = solid(21, 21, [100, 100, 100]);
    b.data.set([140, 140, 140, 255], (10 * 21 + 10) * 4);
    dab(b, 'sharpen', 10, 10, 6, 1, 1);
    expect(px(b, 10, 10)[0]).toBeGreaterThan(140);
  });

  it('clone copies pixels from the offset source', () => {
    const b = solid(30, 10, [0, 0, 0]);
    for (let y = 0; y < 10; y++) for (let x = 20; x < 30; x++) b.data.set([200, 50, 50, 255], (y * 30 + x) * 4);
    dab(b, 'clone', 5, 5, 4, 1, 1, { source: { dx: 20, dy: 0 } });
    expect(px(b, 5, 5)[0]).toBeGreaterThan(150);
  });

  it('blemish removal fills a spot with the surrounding colour', () => {
    const b = solid(31, 31, [200, 180, 160]);
    for (let y = 13; y <= 17; y++) for (let x = 13; x <= 17; x++) b.data.set([90, 30, 30, 255], (y * 31 + x) * 4);
    dab(b, 'blemish', 15, 15, 5, 1, 1);
    expect(px(b, 15, 15)[0]).toBeGreaterThan(180);
  });

  it('red-eye removal reduces red only where it dominates', () => {
    const b = solid(11, 11, [200, 60, 60]);
    b.data.set([60, 200, 60, 255], (5 * 11 + 8) * 4);
    dab(b, 'redeye', 5, 5, 6, 1, 1);
    expect(px(b, 5, 5)[0]).toBeLessThan(100);
    expect(px(b, 8, 5)[0]).toBe(60);
  });

  it('smudge drags colour along the stroke', () => {
    const b = solid(40, 11, [0, 0, 0]);
    for (let y = 0; y < 11; y++) for (let x = 0; x < 6; x++) b.data.set([255, 0, 0, 255], (y * 40 + x) * 4);
    let carried = dab(b, 'smudge', 4, 5, 5, 1, 1).carried;
    for (let x = 6; x <= 20; x += 2) carried = dab(b, 'smudge', x, 5, 5, 1, 0.9, { carried }).carried;
    expect(px(b, 14, 5)[0]).toBeGreaterThan(20);
  });

  it('is confined by a mask', () => {
    const b = solid(21, 21, [100, 100, 100]);
    const mask = new Uint8Array(21 * 21); // nothing selected
    dab(b, 'dodge', 10, 10, 6, 1, 1, { mask });
    expect(px(b, 10, 10)[0]).toBe(100);
  });

  it('does not throw near or outside the edges', () => {
    const b = solid(10, 10, [50, 50, 50]);
    expect(() => dab(b, 'blur', -3, -3, 5, 0.5, 1)).not.toThrow();
    expect(() => dab(b, 'dodge', 100, 100, 5, 0.5, 1)).not.toThrow();
    expect(() => dab(b, 'smudge', 0, 0, 5, 0.5, 1)).not.toThrow();
  });
});

describe('more retouch brushes', () => {
  it('median removes a hot pixel', () => {
    const b = solid(21, 21, [40, 40, 40]);
    b.data.set([255, 255, 255, 255], (10 * 21 + 10) * 4);
    dab(b, 'median', 10, 10, 5, 1, 1);
    expect(px(b, 10, 10)[0]).toBe(40);
  });
  it('colour replace changes only pixels near the picked colour and keeps lightness', () => {
    const b = solid(21, 21, [200, 40, 40]);
    b.data.set([20, 20, 200, 255], (10 * 21 + 12) * 4); // a blue pixel that must stay
    dab(b, 'colourreplace', 10, 10, 8, 1, 1, { target: [200, 40, 40], replace: [0, 0, 255], tolerance: 60 });
    const [r, , bl] = px(b, 10, 8);
    expect(bl).toBeGreaterThan(r);
    expect(px(b, 12, 10)).toEqual([20, 20, 200]);
    expect(px(b, 0, 0)).toEqual([200, 40, 40]); // outside the brush
  });
  it('background eraser clears only pixels near the picked colour', () => {
    const b = solid(21, 21, [255, 255, 255]);
    b.data.set([0, 0, 0, 255], (10 * 21 + 10) * 4);
    dab(b, 'bgerase', 10, 10, 8, 1, 1, { target: [255, 255, 255], tolerance: 30 });
    expect(b.data[(10 * 21 + 8) * 4 + 3]).toBe(0);
    expect(b.data[(10 * 21 + 10) * 4 + 3]).toBe(255);
  });
  it('mixer brush drags paint along and tints it', () => {
    const b = solid(41, 11, [255, 255, 255]);
    let carried = dab(b, 'mixer', 5, 5, 4, 1, 1, { replace: [255, 0, 0] }).carried;
    for (let x = 6; x < 30; x += 2) carried = dab(b, 'mixer', x, 5, 4, 1, 1, { carried, replace: [255, 0, 0] }).carried;
    expect(px(b, 29, 5)[1]).toBeLessThan(200); // picked up red along the way
  });
});

describe('healing brush', () => {
  it('copies texture from the source but keeps the destination tone', () => {
    const b = solid(61, 21, [200, 200, 200]);
    for (let y = 0; y < 21; y++) for (let x = 0; x < 30; x++) b.data.set([60 + (x % 2) * 20, 60 + (x % 2) * 20, 60 + (x % 2) * 20, 255], (y * 61 + x) * 4); // dark textured source on the left
    dab(b, 'heal', 45, 10, 6, 1, 1, { source: { dx: -30, dy: 0 } });
    const v = [px(b, 44, 10)[0], px(b, 45, 10)[0]];
    expect(v[0]).not.toBe(v[1]); // texture arrived
    expect(Math.min(...v)).toBeGreaterThan(150); // but tone stayed bright like the destination
  });
});
