/** Naive (profile-free) RGB ↔ CMYK conversion, values 0..1 for CMYK and 0..255 for RGB. */

export type CMYK = [number, number, number, number];

export function rgbToCmyk(r: number, g: number, b: number): CMYK {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const k = 1 - Math.max(R, G, B);
  if (k >= 1) return [0, 0, 0, 1];
  return [(1 - R - k) / (1 - k), (1 - G - k) / (1 - k), (1 - B - k) / (1 - k), k];
}

export function cmykToRgb(c: number, m: number, y: number, k: number): [number, number, number] {
  const f = (v: number) => Math.round(255 * (1 - Math.min(1, Math.max(0, v))) * (1 - Math.min(1, Math.max(0, k))));
  return [f(c), f(m), f(y)];
}
