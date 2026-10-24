import { renderPngBase64 } from './components/exporter';
import { parseDoc, serializeDoc } from './document';
import { validSize } from './docpresets';
import { openDocText } from './fileio';
import { activeBoard, commit, getState, isDirty, makeShape, markClean, newDocument, redo, setState, undo } from './store';
import type { Shape, ShapeKind } from './types';

/**
 * The commands an AI agent can use on the open document. The desktop app exposes them to a local MCP server
 * (see electron/mcp-server.cjs); they only run when that bridge calls them.
 */

const KINDS: ShapeKind[] = ['rect', 'ellipse', 'shape', 'line', 'path', 'text'];
// fields an agent must not set: identity, and the big embedded picture data
const LOCKED_KEYS = new Set(['id', 'kind', 'src', 'mask']);
const MAX_SHAPES_PER_CALL = 200;

type Params = Record<string, unknown>;

const isRecord = (v: unknown): v is Params => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Keep only known shape fields whose value has the right type, and say what was dropped. */
function cleanProps(raw: unknown, kind: ShapeKind): { props: Partial<Shape>; ignored: string[] } {
  const props: Record<string, unknown> = {};
  const ignored: string[] = [];
  if (raw === undefined) return { props, ignored };
  if (!isRecord(raw)) throw new Error('props must be an object');
  const blank = makeShape(kind, {}) as unknown as Params;
  for (const [key, value] of Object.entries(raw)) {
    if (LOCKED_KEYS.has(key) || !(key in blank)) {
      ignored.push(key);
      continue;
    }
    const want = blank[key];
    const ok =
      value === null
        ? want === null || typeof want === 'string' || isRecord(want)
        : typeof value === typeof want && (typeof value !== 'number' || Number.isFinite(value)) && Array.isArray(value) === Array.isArray(want);
    if (!ok) {
      ignored.push(key);
      continue;
    }
    props[key] = value;
  }
  return { props: props as Partial<Shape>, ignored };
}

const summary = (s: Shape) => ({
  id: s.id,
  kind: s.kind,
  shapeId: s.kind === 'shape' ? s.shapeId : undefined,
  name: s.name,
  x: Math.round(s.x * 100) / 100,
  y: Math.round(s.y * 100) / 100,
  w: Math.round(s.w * 100) / 100,
  h: Math.round(s.h * 100) / 100,
  fill: s.fill,
  stroke: s.stroke,
  strokeWidth: s.strokeWidth,
  opacity: s.opacity,
  text: s.kind === 'text' ? s.text.slice(0, 200) : undefined,
  fontSize: s.kind === 'text' ? s.fontSize : undefined,
  visible: s.visible,
  locked: s.locked,
  hasImage: !!s.src,
});

/** An agent must not silently throw away what the user has not saved. */
function guardUnsaved(params: Params) {
  if (isDirty() && params.discardUnsaved !== true) {
    throw new Error('The open document has unsaved changes. Ask the user, then repeat with discardUnsaved: true, or save it first with save_document.');
  }
}

const idsOf = (v: unknown): string[] => {
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new Error('ids must be an array of shape ids');
  return v as string[];
};

export async function callAgentApi(method: string, params: Params = {}): Promise<unknown> {
  const st = getState();
  switch (method) {
    case 'status': {
      return {
        app: 'Lunatic Design',
        workspace: st.workspace,
        artboards: st.artboards.map((a) => ({ id: a.id, name: a.name, x: a.x, y: a.y, w: a.w, h: a.h })),
        activeArtboard: st.activeArtboard,
        shapeCount: st.shapes.length,
        selection: st.selection,
        canUndo: st.past.length > 0,
        canRedo: st.future.length > 0,
      };
    }
    case 'get_document': {
      return { artboards: st.artboards, activeArtboard: st.activeArtboard, shapes: st.shapes.map(summary), selection: st.selection };
    }
    case 'new_document': {
      guardUnsaved(params);
      const w = Math.round(Number(params.width));
      const h = Math.round(Number(params.height));
      const bad = validSize(w, h);
      if (bad) throw new Error(bad);
      newDocument({ w, h, name: typeof params.name === 'string' ? params.name.slice(0, 80) : undefined });
      return { ok: true, width: w, height: h };
    }
    case 'add_shape': {
      const kind = params.kind as ShapeKind;
      if (!KINDS.includes(kind)) throw new Error(`kind must be one of ${KINDS.join(', ')}`);
      const { props, ignored } = cleanProps(params.props, kind);
      if (kind === 'shape' && !props.shapeId) throw new Error('a "shape" needs props.shapeId, for example "star", "heart" or "cog"');
      const board = activeBoard(st);
      const shape = makeShape(kind, { x: board.x + board.w / 4, y: board.y + board.h / 4, w: board.w / 2, h: board.h / 2, ...props });
      commit([...st.shapes, shape], { selection: [shape.id] });
      return { id: shape.id, shape: summary(getState().shapes.find((s) => s.id === shape.id) ?? shape), ignored };
    }
    case 'add_shapes': {
      if (!Array.isArray(params.shapes) || !params.shapes.length) throw new Error('shapes must be a non-empty array of {kind, props}');
      if (params.shapes.length > MAX_SHAPES_PER_CALL) throw new Error(`at most ${MAX_SHAPES_PER_CALL} shapes per call`);
      const made: Shape[] = [];
      const ignored: string[] = [];
      for (const item of params.shapes) {
        if (!isRecord(item)) throw new Error('each shape must be {kind, props}');
        const kind = item.kind as ShapeKind;
        if (!KINDS.includes(kind)) throw new Error(`kind must be one of ${KINDS.join(', ')}`);
        const cleaned = cleanProps(item.props, kind);
        if (kind === 'shape' && !cleaned.props.shapeId) throw new Error('a "shape" needs props.shapeId');
        made.push(makeShape(kind, cleaned.props));
        ignored.push(...cleaned.ignored);
      }
      // one history step for the whole batch, so a single undo removes it
      commit([...st.shapes, ...made], { selection: made.map((s) => s.id) });
      return { ids: made.map((s) => s.id), ignored };
    }
    case 'update_shape': {
      const id = String(params.id);
      const target = st.shapes.find((s) => s.id === id);
      if (!target) throw new Error(`no shape with id ${id}`);
      const { props, ignored } = cleanProps(params.props, target.kind);
      commit(st.shapes.map((s) => (s.id === id ? { ...s, ...props } : s)));
      return { id, shape: summary(getState().shapes.find((s) => s.id === id)!), ignored };
    }
    case 'delete_shapes': {
      const ids = new Set(idsOf(params.ids));
      const next = st.shapes.filter((s) => !ids.has(s.id));
      commit(next, { selection: st.selection.filter((id) => !ids.has(id)) });
      return { deleted: st.shapes.length - next.length };
    }
    case 'select': {
      const ids = idsOf(params.ids).filter((id) => st.shapes.some((s) => s.id === id));
      setState({ selection: ids });
      return { selection: ids };
    }
    case 'undo':
      undo();
      return { canUndo: getState().past.length > 0 };
    case 'redo':
      redo();
      return { canRedo: getState().future.length > 0 };
    case 'export_png': {
      const scale = Math.min(4, Math.max(0.1, Number(params.scale ?? 1) || 1));
      const out = await renderPngBase64(st.shapes, activeBoard(st), scale);
      return { mimeType: 'image/png', ...out };
    }
    case 'get_file_text':
      return { text: serializeDoc(st) };
    case 'mark_clean':
      markClean();
      return { ok: true };
    case 'load_file_text': {
      guardUnsaved(params);
      if (typeof params.text !== 'string') throw new Error('text must be the contents of a .vedit file');
      parseDoc(params.text); // throws with a clear message when it is not a document
      await openDocText(params.text, typeof params.path === 'string' ? params.path : null);
      return { ok: true };
    }
    default:
      throw new Error(`unknown method ${method}`);
  }
}

declare global {
  interface Window {
    __lunaticApi?: { call: typeof callAgentApi };
  }
}

/** Make the commands reachable by the desktop bridge. */
export function installAgentApi() {
  window.__lunaticApi = { call: callAgentApi };
}
