import { useSyncExternalStore } from 'react';
import type { Box, Pt, Shape, ShapeKind, Tool } from './types';
import { bbox, scaleAbout, translate, unionBox } from './geometry';

export interface State {
  shapes: Shape[];
  selection: string[];
  tool: Tool;
  zoom: number;
  panX: number;
  panY: number;
  viewport: { w: number; h: number };
  artboard: { w: number; h: number };
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  colorTarget: 'fill' | 'stroke';
  rulers: boolean;
  grid: boolean;
  past: Shape[][];
  future: Shape[][];
  cursor: { x: number; y: number };
  pen: Pt[] | null;
}

let counter = 0;

function seed(): Shape[] {
  const base = (kind: ShapeKind, p: Partial<Shape>): Shape => ({
    id: `s${++counter}`,
    kind,
    name: '',
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    pts: [],
    closed: false,
    text: '',
    fontSize: 24,
    fill: null,
    stroke: null,
    strokeWidth: 1,
    opacity: 1,
    visible: true,
    locked: false,
    ...p,
  });
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
  artboard: { w: 800, h: 600 },
  fill: '#5b9cf5',
  stroke: '#1c1c1c',
  strokeWidth: 2,
  colorTarget: 'fill',
  rulers: true,
  grid: false,
  past: [],
  future: [],
  cursor: { x: 0, y: 0 },
  pen: null,
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

let lastKey = '';
let lastTime = 0;

export function commit(
  shapes: Shape[],
  opts: { selection?: string[]; key?: string; before?: Shape[] } = {},
) {
  const now = Date.now();
  const coalesce = !!opts.key && opts.key === lastKey && now - lastTime < 700;
  lastKey = opts.key ?? '';
  lastTime = now;
  const past = coalesce ? state.past : [...state.past, opts.before ?? state.shapes].slice(-100);
  setState({ shapes, past, future: [], ...(opts.selection ? { selection: opts.selection } : {}) });
}

/** Update without recording history (during drags). Pair with endLive. */
export function live(shapes: Shape[], selection?: string[]) {
  setState({ shapes, ...(selection ? { selection } : {}) });
}

export function endLive(before: Shape[]) {
  if (state.shapes !== before) {
    lastKey = '';
    setState({ past: [...state.past, before].slice(-100), future: [] });
  }
}

function pruneSelection(shapes: Shape[], sel: string[]) {
  const ids = new Set(shapes.map((s) => s.id));
  return sel.filter((id) => ids.has(id));
}

export function undo() {
  const { past, future, shapes, selection } = state;
  if (!past.length) return;
  const prev = past[past.length - 1];
  lastKey = '';
  setState({
    shapes: prev,
    past: past.slice(0, -1),
    future: [shapes, ...future],
    selection: pruneSelection(prev, selection),
  });
}

export function redo() {
  const { past, future, shapes, selection } = state;
  if (!future.length) return;
  const next = future[0];
  lastKey = '';
  setState({
    shapes: next,
    past: [...past, shapes],
    future: future.slice(1),
    selection: pruneSelection(next, selection),
  });
}

/* ---------- shapes ---------- */

const NAMES: Record<ShapeKind, string> = {
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  line: 'Line',
  path: 'Path',
  text: 'Text',
};

export function makeShape(kind: ShapeKind, p: Partial<Shape> = {}): Shape {
  const st = state;
  const count = st.shapes.filter((s) => s.kind === kind).length + 1;
  return {
    id: `s${++counter}`,
    kind,
    name: `${NAMES[kind]} ${count}`,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    pts: [],
    closed: false,
    text: 'Type here',
    fontSize: 24,
    fill: kind === 'line' ? null : st.fill,
    stroke: kind === 'text' ? null : (st.stroke ?? (kind === 'line' ? '#1c1c1c' : null)),
    strokeWidth: st.strokeWidth,
    opacity: 1,
    visible: true,
    locked: false,
    ...p,
  };
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

export function fitArtboard() {
  const { viewport, artboard } = state;
  if (!viewport.w || !viewport.h) return;
  const zoom = Math.min(Math.max(0.05, (viewport.w - 120) / artboard.w), (viewport.h - 120) / artboard.h);
  setState({
    zoom,
    panX: (viewport.w - artboard.w * zoom) / 2,
    panY: (viewport.h - artboard.h * zoom) / 2,
  });
}

export function newDocument() {
  setState({ shapes: [], selection: [], past: [], future: [], pen: null });
}
