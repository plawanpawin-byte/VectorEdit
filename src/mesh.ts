import type { Mesh } from './types';

/* Mesh gradient: an n×n grid of colours blended smoothly across a shape's bounding box. */

const hexRgb = (c: string): [number, number, number] => {
  const m = /^#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/i.exec(c);
  if (!m) return [128, 128, 128];
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

const toHex = (v: [number, number, number]) => '#' + v.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Colour at (u, v) in 0..1; control points sit on the grid corners, in between blend with a smooth curve. */
export function meshColour(mesh: Mesh, u: number, v: number): string {
  const n = mesh.n;
  const gx = Math.max(0, Math.min(1, u)) * (n - 1);
  const gy = Math.max(0, Math.min(1, v)) * (n - 1);
  const x0 = Math.min(n - 2, Math.floor(gx));
  const y0 = Math.min(n - 2, Math.floor(gy));
  const tx = smooth(gx - x0);
  const ty = smooth(gy - y0);
  const at = (x: number, y: number) => hexRgb(mesh.colors[y * n + x] ?? '#808080');
  const [a, b, c, d] = [at(x0, y0), at(x0 + 1, y0), at(x0, y0 + 1), at(x0 + 1, y0 + 1)];
  const mix = (i: number) => (a[i] * (1 - tx) + b[i] * tx) * (1 - ty) + (c[i] * (1 - tx) + d[i] * tx) * ty;
  return toHex([mix(0), mix(1), mix(2)]);
}

export interface MeshCell {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

/** Tile the box with `res`×`res` flat cells sampled from the mesh (cells overlap a little so no seams show). */
export function meshCells(mesh: Mesh, box: { x: number; y: number; w: number; h: number }, res = 32): MeshCell[] {
  const cells: MeshCell[] = [];
  const cw = box.w / res;
  const ch = box.h / res;
  const pad = Math.min(cw, ch) * 0.35;
  for (let j = 0; j < res; j++)
    for (let i = 0; i < res; i++)
      cells.push({ x: box.x + i * cw, y: box.y + j * ch, w: cw + pad, h: ch + pad, fill: meshColour(mesh, (i + 0.5) / res, (j + 0.5) / res) });
  return cells;
}

/** A starting mesh: the given colour with soft variation, so the effect is visible straight away. */
export function defaultMesh(n: number, base: string | null): Mesh {
  const [r, g, b] = hexRgb(base ?? '#5b9cf5');
  const colors = Array.from({ length: n * n }, (_, i) => {
    const k = (i % n) / (n - 1) - 0.5;
    const l = Math.floor(i / n) / (n - 1) - 0.5;
    return toHex([r + k * 120, g + l * 90, b - k * 80 + l * 60]);
  });
  return { n, colors };
}

/** Position (0..1 box coordinates) of the grid point at column i, row j. */
export const meshGridPoint = (mesh: Mesh, i: number, j: number): { x: number; y: number } =>
  mesh.pts?.[j * mesh.n + i] ?? { x: i / (mesh.n - 1), y: j / (mesh.n - 1) };

/** Piecewise-bilinear position of the mesh surface at parameters (u, v) in 0..1. */
export function meshPosition(mesh: Mesh, u: number, v: number): { x: number; y: number } {
  const n = mesh.n;
  const gx = Math.max(0, Math.min(1, u)) * (n - 1);
  const gy = Math.max(0, Math.min(1, v)) * (n - 1);
  const x0 = Math.min(n - 2, Math.floor(gx));
  const y0 = Math.min(n - 2, Math.floor(gy));
  const tx = gx - x0;
  const ty = gy - y0;
  const a = meshGridPoint(mesh, x0, y0), b = meshGridPoint(mesh, x0 + 1, y0), c = meshGridPoint(mesh, x0, y0 + 1), d = meshGridPoint(mesh, x0 + 1, y0 + 1);
  const mix = (k: 'x' | 'y') => (a[k] * (1 - tx) + b[k] * tx) * (1 - ty) + (c[k] * (1 - tx) + d[k] * tx) * ty;
  return { x: mix('x'), y: mix('y') };
}

export interface MeshQuad {
  /** four corners in box-relative document units */
  d: string;
  fill: string;
}

/** The mesh as `res`×`res` flat-coloured quads that follow the moved grid points. */
export function meshQuads(mesh: Mesh, box: { x: number; y: number; w: number; h: number }, res = 40): MeshQuad[] {
  const out: MeshQuad[] = [];
  const P = (u: number, v: number) => {
    const p = meshPosition(mesh, u, v);
    return `${(box.x + p.x * box.w).toFixed(2)} ${(box.y + p.y * box.h).toFixed(2)}`;
  };
  for (let j = 0; j < res; j++)
    for (let i = 0; i < res; i++) {
      const u0 = i / res, u1 = (i + 1) / res, v0 = j / res, v1 = (j + 1) / res;
      out.push({ d: `M${P(u0, v0)}L${P(u1, v0)}L${P(u1, v1)}L${P(u0, v1)}Z`, fill: meshColour(mesh, (u0 + u1) / 2, (v0 + v1) / 2) });
    }
  return out;
}
