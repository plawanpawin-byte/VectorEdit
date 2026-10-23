import { divideRegions, joinOpen, reversePts, simplify, smoothPts, stepRepeat, traceMask } from './objectops';
import { isClosed, ptsOf, toPath } from './geometry';
import { workingCanvas } from './raster/layer';
import { commit, getState, makeShape } from './store';
import type { Pt, Shape } from './types';
import { canBoolean } from './boolean';

const selected = () => getState().shapes.filter((s) => getState().selection.includes(s.id) && !s.locked);
const replace = (map: Map<string, Shape | Shape[] | null>, selection?: string[]) => {
  const out: Shape[] = [];
  for (const s of getState().shapes) {
    const r = map.get(s.id);
    if (r === undefined) out.push(s);
    else if (Array.isArray(r)) out.push(...r);
    else if (r) out.push(r);
  }
  commit(out, selection ? { selection } : {});
};

/** A new shape (fresh id) that inherits everything from `s` except what `patch` overrides. */
const fresh = (s: Shape, patch: Partial<Shape>) => {
  const { id: _id, ...rest } = s;
  return makeShape(s.kind, { ...rest, ...patch });
};

const editable = (s: Shape) => s.kind !== 'text' && !s.raster && !s.adjust;

/** Split overlapping shapes into every region; each region takes the style of the shape visible there. */
export function divideSelected(): boolean {
  const ordered = selected().filter(canBoolean);
  if (ordered.length < 2) return false;
  const regions = divideRegions(ordered);
  const made: Shape[] = [];
  regions.forEach((r) =>
    r.mp.forEach((poly) => {
      const toPts = (ring: [number, number][]): Pt[] => {
        const pts = ring.map(([x, y]) => ({ x, y, hx: 0, hy: 0 }));
        if (pts.length > 1 && pts[0].x === pts[pts.length - 1].x && pts[0].y === pts[pts.length - 1].y) pts.pop();
        return pts;
      };
      const o = ordered[r.owner];
      made.push(makeShape('path', { name: `${o.name} piece ${made.length + 1}`, closed: true, pts: toPts(poly[0]), extra: poly.slice(1).map(toPts), fill: o.fill, gradient: o.gradient, stroke: o.stroke, strokeWidth: o.strokeWidth, opacity: o.opacity }));
    }),
  );
  const ids = new Set(ordered.map((s) => s.id));
  const at = getState().shapes.findIndex((s) => ids.has(s.id));
  const rest = getState().shapes.filter((s) => !ids.has(s.id));
  const insertAt = getState().shapes.slice(0, at).filter((s) => !ids.has(s.id)).length;
  commit([...rest.slice(0, insertAt), ...made, ...rest.slice(insertAt)], { selection: made.map((m) => m.id) });
  return true;
}

export function reverseSelected() {
  const map = new Map<string, Shape>();
  for (const s of selected().filter(editable)) {
    const p = toPath(s);
    if (p.kind === 'path') map.set(s.id, { ...p, pts: reversePts(p.pts) });
  }
  if (map.size) replace(map);
}

export function smoothSelected() {
  const map = new Map<string, Shape>();
  for (const s of selected().filter(editable)) {
    const p = toPath(s);
    if (p.kind === 'path') map.set(s.id, { ...p, pts: smoothPts(p.pts, p.closed), extra: p.extra.map((r) => smoothPts(r, true)) });
  }
  if (map.size) replace(map);
}

/** Join two selected open paths into one. */
export function joinSelected(): boolean {
  const open = selected().filter((s) => (s.kind === 'path' || s.kind === 'line') && !isClosed(s));
  if (open.length !== 2) return false;
  const [a, b] = open;
  const joined: Shape = { ...toPath(a), kind: 'path', pts: joinOpen(ptsOf(a), ptsOf(b)), closed: false };
  replace(new Map<string, Shape | null>([[a.id, joined], [b.id, null]]), [a.id]);
  return true;
}

/** Turn a compound path (with holes or islands) into separate paths. */
export function separateSelected(): boolean {
  const out = new Map<string, Shape[]>();
  const ids: string[] = [];
  for (const s of selected().filter(editable)) {
    const p = toPath(s);
    if (p.kind !== 'path' || !p.extra.length) continue;
    const parts = [p.pts, ...p.extra].map((pts, i) => fresh(p, { name: `${s.name} ${i + 1}`, pts, extra: [], closed: true }));
    out.set(s.id, parts);
    ids.push(...parts.map((x) => x.id));
  }
  if (!out.size) return false;
  replace(out, ids);
  return true;
}

export function strokeWeight(delta: number) {
  const map = new Map<string, Shape>();
  for (const s of selected()) if (s.stroke) map.set(s.id, { ...s, strokeWidth: Math.max(0.25, Math.round((s.strokeWidth + delta) * 100) / 100) });
  if (map.size) replace(map);
}

export function setAll(flag: 'visible' | 'locked', value: boolean) {
  const st = getState();
  commit(st.shapes.map((s) => ({ ...s, [flag]: value })));
}

export function stepRepeatSelected(count: number, dx: number, dy: number): boolean {
  const sel = selected();
  if (!sel.length || count < 1) return false;
  const copies = sel.flatMap((s) => stepRepeat(s, count, dx, dy).map((c, i) => fresh(c, { name: `${s.name} ${i + 2}` })));
  commit([...getState().shapes, ...copies], { selection: copies.map((c) => c.id) });
  return true;
}

/** Trace a pixel layer into vector shapes. `level` is a 0-255 brightness cut-off; dark pixels become shapes. */
export async function traceSelected(level: number, detail: number): Promise<boolean> {
  const st = getState();
  const layer = st.shapes.find((s) => st.selection.includes(s.id) && s.raster);
  if (!layer) return false;
  const canvas = await workingCanvas(layer);
  const img = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width: w, height: h } = img;
  const dark = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 128) return false;
    return data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722 < level;
  };
  const sx = layer.w / w;
  const sy = layer.h / h;
  const rings = traceMask(w, h, dark)
    .map((r) => simplify([...r, r[0]], Math.max(0.3, detail)).slice(0, -1))
    .filter((r) => r.length >= 3)
    .map((r): Pt[] => r.map((p) => ({ x: layer.x + p.x * sx, y: layer.y + p.y * sy, hx: 0, hy: 0 })));
  if (!rings.length) return false;
  const traced = makeShape('path', { name: `${layer.name} (traced)`, closed: true, pts: rings[0], extra: rings.slice(1), fill: '#111111', stroke: null });
  commit([...st.shapes, traced], { selection: [traced.id] });
  return true;
}

