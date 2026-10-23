import { useSyncExternalStore } from 'react';
import type { PixelSel } from './raster/selection';
import type { AdjustType, Artboard, Box, Doc, Guide, Pt, Shape, ShapeKind, Slice, Snapshot, Tool, Workspace } from './types';
import { bbox, rotateShape, scaleAbout, shearShape, toPath, translate, unionBox } from './geometry';
import { type BoolOp, booleanPieces, canBoolean } from './boolean';
import { inGroup, topGroup, unwrapGroup, wrapGroup } from './groups';
import { adjustDef, defaultAdjust } from './adjustments';
import { blankShape, normalizeShape } from './shape';
import { strokeOutline } from './offset';
import { defaultParams, shapeDef } from './shapes';

export interface State {
  shapes: Shape[];
  selection: string[];
  tool: Tool;
  zoom: number;
  panX: number;
  panY: number;
  viewport: { w: number; h: number };
  artboards: Artboard[];
  activeArtboard: string;
  guides: Guide[];
  slices: Slice[];
  activeSlice: string | null;
  guidesVisible: boolean;
  snapshots: Snapshot[];
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  colorTarget: 'fill' | 'stroke';
  rulers: boolean;
  grid: boolean;
  snap: boolean;
  workspace: Workspace;
  past: Doc[];
  future: Doc[];
  cursor: { x: number; y: number };
  pen: Pt[] | null;
  editingText: string | null;
  filePath: string | null;
  /** last used parameters per registry shape, applied to newly drawn shapes */
  shapeParams: Record<string, Record<string, number>>;
  /** last tool used in each toolbar group (the group button shows it) */
  lastTool: Record<string, Tool>;
  /** selected nodes of the node/corner tools */
  nodeSel: { id: string; i: number }[];
  brush: { size: number; profile: 'taper' | 'uniform' | 'calligraphic'; taper: number };
  gradientType: 'linear' | 'radial';
  table: { rows: number; cols: number };
  contour: { steps: number; join: 'round' | 'miter' | 'bevel' };
  /** pixel selection of the layer being edited (not saved, not undoable) */
  pixelSel: PixelSel | null;
  rasterDialog: import('./raster/dialog').RasterDialogState | null;
  warpGrid: number;
  macroRecording: boolean;
  macroSteps: number;
  pbrush: import('./raster/brush').BrushParams & { preset: string };
  pixel: { tolerance: number; contiguous: boolean; selectMode: 'replace' | 'add' | 'subtract' | 'intersect'; strength: number; fillMode: 'fill' | 'gradient' };
}

let counter = 0;

function seed(): Shape[] {
  const base = (kind: ShapeKind, p: Partial<Shape>): Shape => blankShape(`s${++counter}`, kind, { fontSize: 24, ...p });
  return [
    base('rect', { name: 'Background', x: 80, y: 80, w: 640, h: 440, fill: '#f2efe8', stroke: null }),
    base('ellipse', { name: 'Sun', x: 470, y: 140, w: 160, h: 160, fill: '#f08a24', stroke: null }),
    base('path', {
      name: 'Ridge',
      closed: true,
      fill: '#0e3b38',
      pts: [
        { x: 80, y: 520, hx: 0, hy: 0 },
        { x: 80, y: 400, hx: 0, hy: 0 },
        { x: 250, y: 280, hx: 70, hy: -40 },
        { x: 430, y: 420, hx: 60, hy: 40 },
        { x: 560, y: 340, hx: 50, hy: -30 },
        { x: 720, y: 450, hx: 0, hy: 0 },
        { x: 720, y: 520, hx: 0, hy: 0 },
      ],
    }),
    base('path', {
      name: 'Trail',
      closed: false,
      stroke: '#2fd3bd',
      strokeWidth: 5,
      pts: [
        { x: 130, y: 500, hx: 90, hy: -60 },
        { x: 330, y: 430, hx: 80, hy: 20 },
        { x: 520, y: 490, hx: 60, hy: 0 },
      ],
    }),
    base('text', { name: 'Title', x: 120, y: 110, text: 'Northern Ridge', fontSize: 34, fill: '#0e3b38' }),
  ];
}

let state: State = {
  shapes: seed(),
  selection: [],
  tool: 'select',
  zoom: 1,
  panX: 0,
  panY: 0,
  viewport: { w: 0, h: 0 },
  artboards: [{ id: 'a1', name: 'Page 1', x: 0, y: 0, w: 800, h: 600 }],
  activeArtboard: 'a1',
  guides: [],
  slices: [],
  activeSlice: null,
  guidesVisible: true,
  snapshots: [],
  fill: '#5b9cf5',
  stroke: '#1c1c1c',
  strokeWidth: 2,
  colorTarget: 'fill',
  rulers: true,
  grid: false,
  snap: false,
  workspace: 'vector',
  past: [],
  future: [],
  cursor: { x: 0, y: 0 },
  pen: null,
  editingText: null,
  filePath: null,
  shapeParams: {},
  lastTool: {},
  nodeSel: [],
  brush: { size: 12, profile: 'taper', taper: 0.7 },
  gradientType: 'linear',
  table: { rows: 4, cols: 3 },
  contour: { steps: 3, join: 'round' },
  pixelSel: null,
  rasterDialog: null,
  warpGrid: 4,
  macroRecording: false,
  macroSteps: 0,
  pbrush: { preset: 'round', size: 24, hardness: 0.85, opacity: 1, flow: 1, spacing: 0.12, roundness: 1, angle: 0, texture: 'none', jitter: 0 },
  pixel: { tolerance: 32, contiguous: true, selectMode: 'replace', strength: 0.5, fillMode: 'fill' },
};

const listeners = new Set<() => void>();
export const getState = () => state;

export function setState(p: Partial<State>) {
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => sel(state),
  );
}

/* ---------- history ---------- */

export const docOf = (s: State = state): Doc => ({ shapes: s.shapes, artboards: s.artboards, guides: s.guides, slices: s.slices });

let lastKey = '';
let lastTime = 0;
const MAX_HISTORY = 100;

/** Characters of pixel data the undo history may hold before the oldest steps are dropped. */
export const HISTORY_PIXEL_BUDGET = 160_000_000;

/** Drop the oldest history entries while the distinct pixel layers they hold exceed the budget. */
export function trimHistory(past: Doc[], current: Doc, budget = HISTORY_PIXEL_BUDGET): Doc[] {
  const size = (docs: Doc[]) => {
    const seen = new Set<string>();
    let total = 0;
    for (const d of docs) for (const s of d.shapes) if (s.src && !seen.has(s.src)) (seen.add(s.src), (total += s.src.length));
    return total;
  };
  let start = 0;
  while (start < past.length - 1 && size([...past.slice(start), current]) > budget) start++;
  return start ? past.slice(start) : past;
}

function pushPast(entry: Doc, key?: string): Doc[] {
  const now = Date.now();
  const coalesce = !!key && key === lastKey && now - lastTime < 700;
  lastKey = key ?? '';
  lastTime = now;
  if (coalesce) return state.past;
  return trimHistory([...state.past, entry].slice(-MAX_HISTORY), docOf());
}

export function commit(shapes: Shape[], opts: { selection?: string[]; key?: string; before?: Shape[] } = {}) {
  if (batchStart) return setState({ shapes, ...(opts.selection ? { selection: opts.selection } : {}) });
  const past = pushPast({ ...docOf(), shapes: opts.before ?? state.shapes }, opts.key);
  setState({ shapes, past, future: [], ...(opts.selection ? { selection: opts.selection } : {}) });
}

/** Commit a change to any part of the document (artboards, guides, shapes). */
export function commitDoc(patch: Partial<Doc>, opts: { selection?: string[]; key?: string } = {}) {
  if (batchStart) return setState({ ...patch, ...(opts.selection ? { selection: opts.selection } : {}) });
  const past = pushPast(docOf(), opts.key);
  setState({ ...patch, past, future: [], ...(opts.selection ? { selection: opts.selection } : {}) });
}

/** Update without recording history (during drags). Pair with endLive. */
export function live(shapes: Shape[], selection?: string[]) {
  setState({ shapes, ...(selection ? { selection } : {}) });
}

export function liveDoc(patch: Partial<Doc>) {
  setState(patch);
}

export function endLive(before: Shape[]) {
  if (state.shapes !== before) {
    lastKey = '';
    setState({ past: [...state.past, { ...docOf(), shapes: before }].slice(-MAX_HISTORY), future: [] });
  }
}

/** Like endLive, for gestures that changed more than the shapes. */
export function endLiveDoc(before: Doc) {
  const now = docOf();
  if (now.shapes !== before.shapes || now.artboards !== before.artboards || now.guides !== before.guides || now.slices !== before.slices) {
    lastKey = '';
    setState({ past: [...state.past, before].slice(-MAX_HISTORY), future: [] });
  }
}

function pruneSelection(shapes: Shape[], sel: string[]) {
  const ids = new Set(shapes.map((s) => s.id));
  return sel.filter((id) => ids.has(id));
}

function restore(doc: Doc, past: Doc[], future: Doc[]) {
  const active = doc.artboards.some((a) => a.id === state.activeArtboard) ? state.activeArtboard : doc.artboards[0]?.id;
  setState({ ...doc, past, future, activeArtboard: active, selection: pruneSelection(doc.shapes, state.selection), nodeSel: [] });
}

export function undo() {
  const { past, future } = state;
  if (!past.length) return;
  lastKey = '';
  restore(past[past.length - 1], past.slice(0, -1), [docOf(), ...future]);
}

export function redo() {
  const { past, future } = state;
  if (!future.length) return;
  lastKey = '';
  restore(future[0], [...past, docOf()], future.slice(1));
}

/* ---------- shapes ---------- */

const NAMES: Record<ShapeKind, string> = {
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  shape: 'Shape',
  line: 'Line',
  path: 'Path',
  text: 'Text',
};

export function makeShape(kind: ShapeKind, p: Partial<Shape> = {}): Shape {
  const st = state;
  const def = kind === 'shape' && p.shapeId ? shapeDef(p.shapeId) : undefined;
  const label = def?.name ?? NAMES[kind];
  const count = st.shapes.filter((s) => (def ? s.shapeId === def.id : s.kind === kind)).length + 1;
  const isLine = kind === 'line' || !!def?.open;
  return blankShape(`s${++counter}`, kind, {
    name: `${label} ${count}`,
    text: p.shapeId === 'qr' ? 'https://example.com' : 'Type here',
    params: p.shapeId ? { ...defaultParams(p.shapeId), ...st.shapeParams[p.shapeId] } : {},
    fill: p.shapeId === 'qr' ? '#111111' : isLine ? null : st.fill,
    stroke: kind === 'text' || p.shapeId === 'qr' ? null : (st.stroke ?? (isLine ? '#1c1c1c' : null)),
    strokeWidth: st.strokeWidth,
    ...p,
  });
}

export function selectedShapes(): Shape[] {
  const sel = new Set(state.selection);
  return state.shapes.filter((s) => sel.has(s.id));
}

export function selectionBox(): Box | null {
  return unionBox(selectedShapes().map(bbox));
}

export function updateSelected(fn: (s: Shape) => Shape, key?: string) {
  const sel = new Set(state.selection);
  if (!sel.size) return;
  commit(
    state.shapes.map((s) => (sel.has(s.id) && !s.locked ? fn(s) : s)),
    { key },
  );
}

export function updateShape(id: string, patch: Partial<Shape>, key?: string) {
  commit(
    state.shapes.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    { key },
  );
}

export function deleteSelected() {
  const sel = new Set(state.selection);
  if (!sel.size) return;
  commit(
    state.shapes.filter((s) => !sel.has(s.id) || s.locked),
    { selection: state.shapes.filter((s) => sel.has(s.id) && s.locked).map((s) => s.id) },
  );
}

export function duplicateSelected() {
  const chosen = selectedShapes();
  if (!chosen.length) return;
  const copies = chosen.map((s) => ({ ...translate(s, 12, 12), id: `s${++counter}`, name: `${s.name} copy`, locked: false }));
  commit([...state.shapes, ...copies], { selection: copies.map((c) => c.id) });
}

export function selectAll() {
  setState({ selection: state.shapes.filter((s) => s.visible && !s.locked).map((s) => s.id) });
}

export function arrange(mode: 'front' | 'forward' | 'backward' | 'back') {
  const sel = new Set(state.selection);
  if (!sel.size) return;
  const list = [...state.shapes];
  if (mode === 'front') {
    commit([...list.filter((s) => !sel.has(s.id)), ...list.filter((s) => sel.has(s.id))]);
    return;
  }
  if (mode === 'back') {
    commit([...list.filter((s) => sel.has(s.id)), ...list.filter((s) => !sel.has(s.id))]);
    return;
  }
  if (mode === 'forward') {
    for (let i = list.length - 2; i >= 0; i--) {
      if (sel.has(list[i].id) && !sel.has(list[i + 1].id)) [list[i], list[i + 1]] = [list[i + 1], list[i]];
    }
  } else {
    for (let i = 1; i < list.length; i++) {
      if (sel.has(list[i].id) && !sel.has(list[i - 1].id)) [list[i], list[i - 1]] = [list[i - 1], list[i]];
    }
  }
  commit(list);
}

export function setTransform(box: Box, next: Partial<Box>) {
  const sel = new Set(state.selection);
  const nx = next.x ?? box.x;
  const ny = next.y ?? box.y;
  const sx = next.w !== undefined && box.w > 0 ? next.w / box.w : 1;
  const sy = next.h !== undefined && box.h > 0 ? next.h / box.h : 1;
  commit(
    state.shapes.map((s) => {
      if (!sel.has(s.id) || s.locked) return s;
      const scaled = scaleAbout(s, sx, sy, box.x, box.y);
      return translate(scaled, nx - box.x, ny - box.y);
    }),
    { key: 'xform' },
  );
}

/* ---------- colour & tools ---------- */

export function setColor(target: 'fill' | 'stroke', value: string | null) {
  setState({ [target]: value } as Partial<State>);
  updateSelected((s) => (s.kind === 'text' && target === 'stroke' ? s : { ...s, [target]: value }), `color-${target}`);
}

export function swapColors() {
  const { fill, stroke } = state;
  setState({ fill: stroke, stroke: fill });
  updateSelected((s) => ({ ...s, fill: stroke, stroke: fill }));
}

export function resetColors() {
  setState({ fill: '#ffffff', stroke: '#000000' });
}

export function setTool(tool: Tool) {
  if (state.tool === 'pen' && tool !== 'pen') penFinish(false);
  setState({ tool });
}

/* ---------- pen ---------- */

export function penAdd(p: Pt) {
  setState({ pen: [...(state.pen ?? []), p] });
}

export function penDragLast(hx: number, hy: number) {
  if (!state.pen?.length) return;
  const pts = state.pen.slice();
  pts[pts.length - 1] = { ...pts[pts.length - 1], hx, hy };
  setState({ pen: pts });
}

export function penDropLast() {
  if (state.pen?.length) setState({ pen: state.pen.slice(0, -1) });
}

export function penFinish(closed: boolean) {
  const pts = state.pen;
  if (!pts) return;
  setState({ pen: null });
  if (pts.length < 2) return;
  const shape = makeShape('path', { pts, closed, fill: closed ? state.fill : null, stroke: state.stroke ?? '#1c1c1c' });
  commit([...state.shapes, shape], { selection: [shape.id] });
}

export function penCancel() {
  setState({ pen: null });
}

/* ---------- view ---------- */

export function zoomAt(factor: number, sx: number, sy: number) {
  const { zoom, panX, panY } = state;
  const nz = Math.min(32, Math.max(0.05, zoom * factor));
  const k = nz / zoom;
  setState({ zoom: nz, panX: sx - (sx - panX) * k, panY: sy - (sy - panY) * k });
}

export function zoomTo(nz: number) {
  const { viewport } = state;
  zoomAt(nz / state.zoom, viewport.w / 2, viewport.h / 2);
}

export const activeBoard = (s: State = state): Artboard => s.artboards.find((a) => a.id === s.activeArtboard) ?? s.artboards[0];

/** Fit the active artboard (or the given one) in the window. */
export function fitArtboard(id?: string) {
  const { viewport } = state;
  const board = id ? (state.artboards.find((a) => a.id === id) ?? activeBoard()) : activeBoard();
  if (!viewport.w || !viewport.h || !board) return;
  const zoom = Math.min(Math.max(0.05, (viewport.w - 120) / board.w), (viewport.h - 120) / board.h);
  setState({
    zoom,
    panX: (viewport.w - board.w * zoom) / 2 - board.x * zoom,
    panY: (viewport.h - board.h * zoom) / 2 - board.y * zoom,
  });
}

export function newDocument() {
  setState({
    shapes: [],
    selection: [],
    past: [],
    future: [],
    pen: null,
    filePath: null,
    artboards: [{ id: 'a1', name: 'Page 1', x: 0, y: 0, w: 800, h: 600 }],
    activeArtboard: 'a1',
    guides: [],
    slices: [],
    activeSlice: null,
    snapshots: [],
  });
  fitArtboard();
}

export function loadDocument(raw: unknown[], boards: Artboard[], filePath: string | null, extra: { guides?: Guide[]; slices?: Slice[]; snapshots?: Snapshot[] } = {}) {
  const shapes = raw.map(normalizeShape).filter((x): x is Shape => x !== null);
  if (!boards.length) boards = [{ id: 'a1', name: 'Page 1', x: 0, y: 0, w: 800, h: 600 }];
  // keep generated ids unique against the loaded ones
  counter = Math.max(counter, ...shapes.map((s) => Number(/^s(\d+)$/.exec(s.id)?.[1] ?? 0)));
  setState({
    shapes,
    artboards: boards,
    activeArtboard: boards[0].id,
    guides: extra.guides ?? [],
    slices: extra.slices ?? [],
    activeSlice: null,
    snapshots: extra.snapshots ?? [],
    selection: [],
    past: [],
    future: [],
    pen: null,
    editingText: null,
    nodeSel: [],
    filePath,
  });
  fitArtboard();
}

/* ---------- align / flip / history ---------- */

const activeBoardBox = (): Box => {
  const a = activeBoard();
  return { x: a.x, y: a.y, w: a.w, h: a.h };
};

export function align(how: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') {
  const sel = selectedShapes().filter((s) => !s.locked);
  if (!sel.length) return;
  const ref: Box =
    sel.length === 1 ? activeBoardBox() : unionBox(sel.map(bbox))!;
  const ids = new Set(sel.map((s) => s.id));
  commit(
    state.shapes.map((s) => {
      if (!ids.has(s.id)) return s;
      const b = bbox(s);
      const dx =
        how === 'left' ? ref.x - b.x : how === 'right' ? ref.x + ref.w - (b.x + b.w) : how === 'hcenter' ? ref.x + ref.w / 2 - (b.x + b.w / 2) : 0;
      const dy =
        how === 'top' ? ref.y - b.y : how === 'bottom' ? ref.y + ref.h - (b.y + b.h) : how === 'vcenter' ? ref.y + ref.h / 2 - (b.y + b.h / 2) : 0;
      return translate(s, dx, dy);
    }),
  );
}

export function flip(axis: 'h' | 'v') {
  const box = selectionBox();
  if (!box) return;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  updateSelected((s) => (s.kind === 'text' ? s : scaleAbout(s, axis === 'h' ? -1 : 1, axis === 'v' ? -1 : 1, cx, cy)));
}

export function historyJump(target: number) {
  while (state.past.length > target && state.past.length) undo();
  while (state.past.length < target && state.future.length) redo();
}

export function rotateSelection(deg: number) {
  const box = selectionBox();
  if (!box) return;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  updateSelected((s) => rotateShape(s, deg, cx, cy));
}

export function shearSelection(deg: number) {
  const box = selectionBox();
  if (!box || !deg) return;
  const oy = box.y + box.h / 2;
  updateSelected((s) => shearShape(s, deg, box.x + box.w / 2, oy));
}

export function updateRadius(r: number) {
  updateSelected((s) => (s.kind === 'rect' ? { ...s, radius: Math.max(0, Math.min(r, Math.min(s.w, s.h) / 2)) } : s), 'radius');
}

/** Snap a coordinate to guides and artboard edges (always) and to the 10 px grid (when snapping is on). */
export function snapV(v: number, axis?: 'x' | 'y', zoom = state.zoom): number {
  const tol = 6 / zoom;
  if (axis) {
    const candidates: number[] = [];
    if (state.guidesVisible) for (const g of state.guides) if (g.axis === (axis === 'x' ? 'v' : 'h')) candidates.push(g.pos);
    for (const a of state.artboards) candidates.push(...(axis === 'x' ? [a.x, a.x + a.w, a.x + a.w / 2] : [a.y, a.y + a.h, a.y + a.h / 2]));
    let best = v;
    let dist = tol;
    for (const c of candidates) {
      const d = Math.abs(c - v);
      if (d < dist) {
        dist = d;
        best = c;
      }
    }
    if (best !== v) return best;
  }
  return state.snap ? Math.round(v / 10) * 10 : v;
}

/* ---------- artboards ---------- */

let boardCounter = 1;

const centreIn = (s: Shape, a: Artboard) => {
  const b = bbox(s);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  return cx >= a.x && cx <= a.x + a.w && cy >= a.y && cy <= a.y + a.h;
};

/** Artboard whose area holds the centre of the shape. */
export const boardOf = (s: Shape, boards: Artboard[] = state.artboards) => boards.find((a) => centreIn(s, a));
export const shapesOn = (a: Artboard, shapes: Shape[] = state.shapes) => shapes.filter((s) => centreIn(s, a));

export function addArtboard(p: Partial<Artboard> = {}): Artboard {
  const last = state.artboards.reduce((m, a) => Math.max(m, a.x + a.w), 0);
  const ref = activeBoard();
  boardCounter = Math.max(boardCounter, state.artboards.length) + 1;
  const board: Artboard = { id: `a${Date.now().toString(36)}${boardCounter}`, name: `Page ${state.artboards.length + 1}`, x: last + 60, y: ref.y, w: ref.w, h: ref.h, ...p };
  commitDoc({ artboards: [...state.artboards, board] });
  setState({ activeArtboard: board.id });
  return board;
}

export function duplicateArtboard(id: string) {
  const src = state.artboards.find((a) => a.id === id);
  if (!src) return;
  const board = { ...src, id: `a${Date.now().toString(36)}${++boardCounter}`, name: `${src.name} copy`, x: state.artboards.reduce((m, a) => Math.max(m, a.x + a.w), 0) + 60 };
  const dx = board.x - src.x;
  const copies = shapesOn(src).map((s) => ({ ...translate(s, dx, 0), id: `s${++counter}` }));
  commitDoc({ artboards: [...state.artboards, board], shapes: [...state.shapes, ...copies] });
  setState({ activeArtboard: board.id });
}

export function deleteArtboard(id: string) {
  if (state.artboards.length < 2) return;
  const board = state.artboards.find((a) => a.id === id);
  if (!board) return;
  const gone = new Set(shapesOn(board).map((s) => s.id));
  const boards = state.artboards.filter((a) => a.id !== id);
  commitDoc({ artboards: boards, shapes: state.shapes.filter((s) => !gone.has(s.id)) }, { selection: state.selection.filter((i) => !gone.has(i)) });
  if (state.activeArtboard === id) setState({ activeArtboard: boards[0].id });
}

export function updateArtboard(id: string, patch: Partial<Artboard>, key?: string) {
  commitDoc({ artboards: state.artboards.map((a) => (a.id === id ? { ...a, ...patch } : a)) }, { key });
}

export function setActiveArtboard(id: string, focus = false) {
  if (!state.artboards.some((a) => a.id === id)) return;
  setState({ activeArtboard: id });
  if (focus) fitArtboard(id);
}

/* ---------- guides ---------- */

export function addGuide(axis: 'h' | 'v', pos: number) {
  commitDoc({ guides: [...state.guides, { id: `g${Date.now().toString(36)}${state.guides.length}`, axis, pos }] });
}
export function removeGuide(id: string) {
  commitDoc({ guides: state.guides.filter((g) => g.id !== id) });
}
export function clearGuides() {
  if (state.guides.length) commitDoc({ guides: [] });
}

/* ---------- snapshots ---------- */

export function takeSnapshot(name?: string) {
  const n = state.snapshots.length + 1;
  const snap: Snapshot = { ...docOf(), id: `n${Date.now().toString(36)}`, name: name ?? `Snapshot ${n}`, time: Date.now() };
  setState({ snapshots: [...state.snapshots, snap] });
}
export function restoreSnapshot(id: string) {
  const snap = state.snapshots.find((x) => x.id === id);
  if (!snap) return;
  commitDoc({ shapes: snap.shapes, artboards: snap.artboards, guides: snap.guides, slices: snap.slices ?? [] });
  if (!snap.artboards.some((a) => a.id === state.activeArtboard)) setState({ activeArtboard: snap.artboards[0].id });
}
export function deleteSnapshot(id: string) {
  setState({ snapshots: state.snapshots.filter((x) => x.id !== id) });
}

/* ---------- groups ---------- */

let groupCounter = 0;

export function expandToGroups(ids: string[], shapes: Shape[] = state.shapes): string[] {
  const groups = new Set(shapes.filter((s) => ids.includes(s.id) && s.group).map((s) => topGroup(s.group)));
  if (!groups.size) return ids;
  return Array.from(new Set([...ids, ...shapes.filter((s) => s.group && groups.has(topGroup(s.group))).map((s) => s.id)]));
}

export function groupSelected() {
  const sel = new Set(state.selection);
  const members = state.shapes.filter((s) => sel.has(s.id) && !s.locked);
  if (members.length < 2) return;
  const gid = `g${Date.now().toString(36)}${++groupCounter}`;
  const topIndex = Math.max(...members.map((m) => state.shapes.indexOf(m)));
  const ids = new Set(members.map((m) => m.id));
  const rest = state.shapes.filter((s) => !ids.has(s.id));
  // keep the group's members together, at the position of its top-most member
  const before = state.shapes.slice(0, topIndex + 1).filter((s) => !ids.has(s.id)).length;
  const grouped = members.map((m) => ({ ...m, group: wrapGroup(m.group, gid) }));
  commit([...rest.slice(0, before), ...grouped, ...rest.slice(before)], { selection: grouped.map((g) => g.id) });
}

export function ungroupSelected() {
  const groups = new Set(state.shapes.filter((s) => state.selection.includes(s.id) && s.group).map((s) => topGroup(s.group)));
  if (!groups.size) return;
  commit(state.shapes.map((s) => (s.group && groups.has(topGroup(s.group)) ? { ...s, group: unwrapGroup(s.group) } : s)));
}

/* ---------- curves & boolean ---------- */

export function convertToCurves() {
  updateSelected((s) => (s.kind === 'text' ? s : toPath(s)));
}

/** Returns false when fewer than two eligible shapes are selected. */
export function booleanOp(op: BoolOp): boolean {
  const sel = new Set(state.selection);
  const ordered = state.shapes.filter((s) => sel.has(s.id) && canBoolean(s));
  if (ordered.length < 2) return false;
  const pieces = booleanPieces(ordered, op);
  const style = ordered[0];
  const ids = new Set(ordered.map((s) => s.id));
  const made = pieces.map((piece, i) =>
    makeShape('path', {
      name: pieces.length > 1 ? `${op === 'subtract' ? 'Subtract' : op[0].toUpperCase() + op.slice(1)} ${i + 1}` : op[0].toUpperCase() + op.slice(1),
      closed: true,
      pts: piece.outer,
      extra: piece.holes,
      fill: style.fill,
      gradient: style.gradient,
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
      dash: style.dash,
      cap: style.cap,
      join: style.join,
      opacity: style.opacity,
      effects: style.effects,
    }),
  );
  const at = Math.min(...ordered.map((s) => state.shapes.indexOf(s)));
  const rest = state.shapes.filter((s) => !ids.has(s.id));
  const insertAt = state.shapes.slice(0, at).filter((s) => !ids.has(s.id)).length;
  commit([...rest.slice(0, insertAt), ...made, ...rest.slice(insertAt)], { selection: made.map((m) => m.id) });
  return true;
}

/** Replace stroked shapes with filled outlines of their strokes. */
export function expandStroke() {
  const sel = new Set(state.selection);
  const targets = state.shapes.filter((s) => sel.has(s.id) && !s.locked && s.stroke && s.kind !== 'text' && !s.raster);
  if (!targets.length) return false;
  const replaced = new Map<string, Shape[]>();
  for (const s of targets) {
    const parts = strokeOutline(s);
    if (!parts.length) continue;
    replaced.set(
      s.id,
      parts.map((c, i) =>
        makeShape('path', { name: `${s.name} stroke${parts.length > 1 ? ` ${i + 1}` : ''}`, pts: c.outer, extra: c.holes, closed: true, fill: s.stroke, stroke: null, opacity: s.opacity, group: s.group }),
      ),
    );
  }
  if (!replaced.size) return false;
  const next = state.shapes.flatMap((s) => {
    const parts = replaced.get(s.id);
    if (!parts) return [s];
    // keep the fill of the original (without its stroke) under the new outline
    return s.fill || s.gradient ? [{ ...s, stroke: null }, ...parts] : parts;
  });
  commit(next, { selection: Array.from(replaced.values()).flat().map((p) => p.id) });
  return true;
}

/* ---------- slices ---------- */

export function addSlice(rect: Box, p: Partial<Slice> = {}): Slice {
  const n = state.slices.length + 1;
  const slice: Slice = { id: `sl${Date.now().toString(36)}${n}`, name: `Slice ${n}`, x: Math.round(rect.x), y: Math.round(rect.y), w: Math.max(1, Math.round(rect.w)), h: Math.max(1, Math.round(rect.h)), format: 'png', scale: 1, ...p };
  commitDoc({ slices: [...state.slices, slice] });
  setState({ activeSlice: slice.id });
  return slice;
}

export function updateSlice(id: string, patch: Partial<Slice>, key?: string) {
  commitDoc({ slices: state.slices.map((s) => (s.id === id ? { ...s, ...patch } : s)) }, { key });
}

export function removeSlice(id: string) {
  commitDoc({ slices: state.slices.filter((s) => s.id !== id) });
  if (state.activeSlice === id) setState({ activeSlice: null });
}

export function slicesFromArtboards() {
  const made = state.artboards.map((a, i) => ({ id: `sl${Date.now().toString(36)}a${i}`, name: a.name, x: a.x, y: a.y, w: a.w, h: a.h, format: 'png' as const, scale: 1 }));
  commitDoc({ slices: [...state.slices, ...made] });
}

export function sliceFromSelection() {
  const box = selectionBox();
  if (box) addSlice(box, { name: selectedShapes()[0]?.name ?? undefined });
}

/* ---------- batching (scripts, macros): many edits become one undo step ---------- */

let batchStart: Doc | null = null;

export function beginBatch() {
  if (!batchStart) batchStart = docOf();
}

export function endBatch() {
  const start = batchStart;
  batchStart = null;
  if (!start) return;
  const now = docOf();
  if (now.shapes !== start.shapes || now.artboards !== start.artboards || now.guides !== start.guides || now.slices !== start.slices) {
    lastKey = '';
    setState({ past: [...state.past, start].slice(-MAX_HISTORY), future: [] });
  }
}

/* ---------- adjustment layers ---------- */

export function addAdjustment(type: AdjustType): Shape {
  const board = activeBoard();
  const def = adjustDef(type)!;
  const sh = makeShape('rect', {
    name: def.label,
    x: board.x,
    y: board.y,
    w: board.w,
    h: board.h,
    fill: null,
    stroke: null,
    adjust: defaultAdjust(type),
  });
  commit([...state.shapes, sh], { selection: [sh.id] });
  return sh;
}

/** Toggle visibility or lock for every member of a group at once. */
export function setGroupFlag(gid: string, flag: 'visible' | 'locked', value: boolean) {
  commit(state.shapes.map((s) => (inGroup(s, gid) ? { ...s, [flag]: value } : s)));
}

/* ---------- clipping masks ---------- */

/** The top-most selected shape becomes the mask; the other selected shapes are clipped to its outline. */
export function makeClippingMask(): boolean {
  const picked = state.shapes.filter((s) => state.selection.includes(s.id) && !s.locked && !s.adjust);
  if (picked.length < 2) return false;
  const mask = picked[picked.length - 1];
  const targets = new Set(picked.slice(0, -1).map((s) => s.id));
  commit(state.shapes.map((s) => (targets.has(s.id) ? { ...s, clip: mask.id } : s)));
  return true;
}

export function releaseClippingMask() {
  const sel = new Set(state.selection);
  if (!state.shapes.some((s) => s.clip && (sel.has(s.id) || sel.has(s.clip)))) return;
  commit(state.shapes.map((s) => (s.clip && (sel.has(s.id) || sel.has(s.clip)) ? { ...s, clip: null } : s)));
}
