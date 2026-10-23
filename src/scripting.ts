import { addArtboard, beginBatch, commit, endBatch, getState, groupSelected, makeShape, redo, setState, undo, updateShape } from './store';
import type { Shape, ShapeKind } from './types';

export interface ScriptApp {
  shapes(): Shape[];
  selection(): string[];
  select(ids: string[]): void;
  add(kind: ShapeKind, props?: Partial<Shape>): string;
  update(id: string, props: Partial<Shape>): void;
  remove(ids: string[]): void;
  group(ids?: string[]): void;
  addPage(props?: { name?: string; x?: number; y?: number; w?: number; h?: number }): string;
  undo(): void;
  redo(): void;
  log(...args: unknown[]): void;
}

export interface ScriptResult {
  ok: boolean;
  logs: string[];
  error?: string;
}

const fmt = (v: unknown) => {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

/** The scripting surface. Edits made through it collapse into a single undo step. */
export function createApp(logs: string[]): ScriptApp {
  return {
    shapes: () => getState().shapes.map((s) => ({ ...s })),
    selection: () => [...getState().selection],
    select: (ids) => setState({ selection: ids.filter((id) => getState().shapes.some((s) => s.id === id)) }),
    add(kind, props = {}) {
      const sh = makeShape(kind, props);
      commit([...getState().shapes, sh], { selection: [sh.id] });
      return sh.id;
    },
    update: (id, props) => updateShape(id, props),
    remove(ids) {
      const keep = new Set(ids);
      commit(getState().shapes.filter((s) => !keep.has(s.id)), { selection: [] });
    },
    group(ids) {
      if (ids) setState({ selection: ids });
      groupSelected();
    },
    addPage: (props) => addArtboard(props).id,
    undo,
    redo,
    log: (...a) => void logs.push(a.map(fmt).join(' ')),
  };
}

/** Runs user code with only `app` in scope. Not a security sandbox: only run code you trust. */
export function runScript(code: string): ScriptResult {
  const logs: string[] = [];
  const app = createApp(logs);
  beginBatch();
  try {
    const result = new Function('app', `"use strict";\n${code}`)(app);
    if (result !== undefined) logs.push(fmt(result));
    return { ok: true, logs };
  } catch (e) {
    return { ok: false, logs, error: e instanceof Error ? e.message : String(e) };
  } finally {
    endBatch();
  }
}

export interface SavedScript {
  id: string;
  name: string;
  code: string;
}

const KEY = 'vectoredit.scripts';

export function loadScripts(): SavedScript[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((s) => s && typeof s.code === 'string' && typeof s.name === 'string') : [];
  } catch {
    return [];
  }
}

export function saveScripts(list: SavedScript[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: scripts stay in memory only */
  }
}

export const EXAMPLE_SCRIPT = `// Draw a row of circles, then group them.
const ids = [];
for (let i = 0; i < 6; i++) {
  ids.push(app.add('ellipse', {
    x: 40 + i * 70, y: 40, w: 60, h: 60,
    fill: 'hsl(' + i * 55 + ' 70% 55%)', stroke: null,
  }));
}
app.group(ids);
app.log('created', ids.length, 'circles');
`;
