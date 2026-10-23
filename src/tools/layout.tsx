import { NumField } from '../components/Fields';
import { bbox } from '../geometry';
import { pickImages, placeFiles } from '../images';
import { commit, endLive, getState, live, makeShape, penFinish, setState, useStore } from '../store';
import type { Shape } from '../types';
import { toolIcon } from './icons';
import type { PointerCtx, ToolDef } from './types';

/* ---------- Image ---------- */

export const imageTool: ToolDef = {
  id: 'image',
  label: 'Place Image',
  key: 'j',
  icon: toolIcon.image,
  group: 'layout',
  workspaces: ['vector', 'layout'],
  cursor: 'copy',
  hint: '**Click** to choose an image and place it at that point (into the selected picture frame if there is one). You can also **drop** or **paste** images.',
  chrome: 'outline',
  down(c) {
    penFinish(false);
    const at = c.raw;
    void pickImages().then((files) => {
      if (files.length) void placeFiles(files, at);
    });
  },
};

/* ---------- Table ---------- */

function TableOptions() {
  const t = useStore((s) => s.table);
  return (
    <>
      <NumField label="Rows" value={t.rows} min={1} onCommit={(rows) => setState({ table: { ...t, rows: Math.max(1, Math.min(40, Math.round(rows))) } })} />
      <NumField label="Columns" value={t.cols} min={1} onCommit={(cols) => setState({ table: { ...t, cols: Math.max(1, Math.min(20, Math.round(cols))) } })} />
    </>
  );
}

/** Build a table as a group of cell rectangles with text, so it edits with the normal tools. */
export function tableShapes(x: number, y: number, w: number, h: number, rows: number, cols: number, group: string): Shape[] {
  const cw = w / cols;
  const ch = h / rows;
  const out: Shape[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const header = r === 0;
      out.push(
        makeShape('rect', { name: `Cell ${r + 1},${c + 1}`, x: x + c * cw, y: y + r * ch, w: cw, h: ch, fill: header ? '#e7e9ee' : '#ffffff', stroke: '#8a8f99', strokeWidth: 1, group }),
        makeShape('text', {
          name: `Text ${r + 1},${c + 1}`,
          x: x + c * cw + 6,
          y: y + r * ch + Math.max(2, (ch - 14 * 1.2) / 2),
          text: header ? `Column ${c + 1}` : '',
          fontSize: 14,
          fontFamily: 'Arial',
          fontWeight: header ? 700 : 400,
          frameW: Math.max(10, cw - 12),
          fill: '#1c1c1c',
          group,
        }),
      );
    }
  }
  return out;
}

export const tableTool: ToolDef = {
  id: 'table',
  label: 'Table',
  key: 'e',
  icon: toolIcon.table,
  group: 'layout',
  workspaces: ['layout'],
  cursor: 'crosshair',
  hint: '**Drag** to draw a table. Set rows and columns in the context bar. It is a group of cells: ungroup (Shift+Ctrl+G) to edit one cell.',
  chrome: 'outline',
  Options: TableOptions,
  down(c: PointerCtx) {
    penFinish(false);
    const before = c.st.shapes;
    const start = c.p;
    const preview = makeShape('rect', { x: start.x, y: start.y, fill: null, stroke: '#2d8cf0', strokeWidth: 1 });
    live([...before, preview], [preview.id]);
    return {
      move(m) {
        live(m.st.shapes.map((s) => (s.id === preview.id ? { ...s, x: Math.min(start.x, m.p.x), y: Math.min(start.y, m.p.y), w: Math.abs(m.p.x - start.x), h: Math.abs(m.p.y - start.y) } : s)));
      },
      up(m) {
        const p = m.st.shapes.find((s) => s.id === preview.id);
        const b = p ? bbox(p) : null;
        if (!b || b.w < 30 || b.h < 20) {
          live(before, []);
          return;
        }
        const { rows, cols } = getState().table;
        const gid = `g${Date.now().toString(36)}t`;
        const cells = tableShapes(b.x, b.y, b.w, b.h, rows, cols, gid);
        live(before);
        commit([...before, ...cells], { selection: cells.map((c) => c.id) });
      },
    };
  },
};

/* ---------- Picture frames ---------- */

const frameBase = {
  workspaces: ['vector', 'layout'] as ToolDef['workspaces'],
  cursor: 'crosshair',
  chrome: 'outline' as const,
  group: 'layout',
};

function frameDraw(kind: 'rect' | 'ellipse') {
  return (c: PointerCtx) => {
    penFinish(false);
    const before = c.st.shapes;
    const start = c.p;
    const f = makeShape(kind, { name: kind === 'rect' ? 'Picture frame' : 'Picture frame (ellipse)', x: start.x, y: start.y, frame: true, fill: '#e9ebef', stroke: '#a9aeb8', strokeWidth: 1 });
    live([...before, f], [f.id]);
    return {
      move(m: PointerCtx) {
        live(m.st.shapes.map((s) => (s.id === f.id ? { ...s, x: Math.min(start.x, m.p.x), y: Math.min(start.y, m.p.y), w: Math.abs(m.p.x - start.x), h: Math.abs(m.p.y - start.y) } : s)));
      },
      up() {
        const made = getState().shapes.find((s) => s.id === f.id);
        if (!made || made.w < 4 || made.h < 4) live(before, []);
        else endLive(before);
      },
    };
  };
}

export const frameRectTool: ToolDef = {
  ...frameBase,
  id: 'frame-rect',
  label: 'Picture Frame (rectangle)',
  icon: toolIcon.frameRect,
  hint: '**Drag** to draw a picture frame. Then use **Place Image** (J) to fill it, or set the image in Appearance.',
  down: frameDraw('rect'),
};

export const frameEllipseTool: ToolDef = {
  ...frameBase,
  id: 'frame-ellipse',
  label: 'Picture Frame (ellipse)',
  icon: toolIcon.frameEllipse,
  hint: '**Drag** to draw an elliptical picture frame. Then place an image into it.',
  down: frameDraw('ellipse'),
};
