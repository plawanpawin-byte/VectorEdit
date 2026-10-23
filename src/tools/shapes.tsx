import { NumField } from '../components/Fields';
import { bbox } from '../geometry';
import { SHAPES, defaultParams, shapeDef } from '../shapes';
import { endLive, getState, live, makeShape, penFinish, setState, useStore } from '../store';
import type { Shape, Tool } from '../types';
import { shapeIcon, toolIcon } from './icons';
import type { PointerCtx, Session, ToolDef } from './types';

/** Draw by dragging a box. `make` builds the shape at the start point. Shift = square, Alt = from the centre. */
function boxDraw(c: PointerCtx, make: (x: number, y: number) => Shape): Session {
  const before = c.st.shapes;
  const shape = make(c.p.x, c.p.y);
  live([...before, shape], [shape.id]);
  const start = c.p;
  return {
    move(m) {
      let dx = m.p.x - start.x;
      let dy = m.p.y - start.y;
      if (m.shift) {
        const k = Math.max(Math.abs(dx), Math.abs(dy));
        dx = Math.sign(dx || 1) * k;
        dy = Math.sign(dy || 1) * k;
      }
      let x0 = start.x;
      let y0 = start.y;
      let x1 = start.x + dx;
      let y1 = start.y + dy;
      if (m.alt) {
        x0 = start.x - dx;
        y0 = start.y - dy;
      }
      live(m.st.shapes.map((s) => (s.id === shape.id ? { ...s, x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) } : s)));
    },
    up(m) {
      const made = getState().shapes.find((s) => s.id === shape.id);
      const b = made ? bbox(made) : null;
      if (!b || (b.w < 2 && b.h < 2)) live(before, []);
      else endLive(before);
      void m;
    },
  };
}

function lineDraw(c: PointerCtx): Session {
  const before = c.st.shapes;
  const shape = makeShape('line', { pts: [{ x: c.p.x, y: c.p.y, hx: 0, hy: 0 }, { x: c.p.x, y: c.p.y, hx: 0, hy: 0 }] });
  live([...before, shape], [shape.id]);
  const start = c.p;
  return {
    move(m) {
      let x1 = m.p.x;
      let y1 = m.p.y;
      if (m.shift) {
        const ang = Math.round(Math.atan2(y1 - start.y, x1 - start.x) / (Math.PI / 4)) * (Math.PI / 4);
        const len = Math.hypot(x1 - start.x, y1 - start.y);
        x1 = start.x + Math.cos(ang) * len;
        y1 = start.y + Math.sin(ang) * len;
      }
      live(m.st.shapes.map((s) => (s.id === shape.id ? { ...s, pts: [s.pts[0], { x: x1, y: y1, hx: 0, hy: 0 }] } : s)));
    },
    up() {
      const made = getState().shapes.find((s) => s.id === shape.id);
      if (!made || (bbox(made).w < 2 && bbox(made).h < 2)) live(before, []);
      else endLive(before);
    },
  };
}

const base = {
  workspaces: ['vector', 'layout'] as ToolDef['workspaces'],
  cursor: 'crosshair',
  chrome: 'outline' as const,
};

export const rectTool: ToolDef = {
  ...base,
  id: 'rect',
  label: 'Rectangle',
  key: 'm',
  icon: toolIcon.rect,
  group: 'shapes',
  hint: '**Drag** to draw a rectangle. **Shift** makes a square, **Alt** draws from the centre.',
  down: (c) => (penFinish(false), boxDraw(c, (x, y) => makeShape('rect', { x, y }))),
};

export const rrectTool: ToolDef = {
  ...base,
  id: 'rrect',
  label: 'Rounded Rectangle',
  key: 'u',
  icon: toolIcon.rrect,
  group: 'shapes',
  hint: '**Drag** to draw a rounded rectangle. Change the corner radius in Appearance.',
  down: (c) => (penFinish(false), boxDraw(c, (x, y) => makeShape('rect', { x, y, radius: 16 }))),
};

export const ellipseTool: ToolDef = {
  ...base,
  id: 'ellipse',
  label: 'Ellipse',
  key: 'l',
  icon: toolIcon.ellipse,
  group: 'shapes',
  hint: '**Drag** to draw an ellipse. **Shift** makes a circle, **Alt** draws from the centre.',
  down: (c) => (penFinish(false), boxDraw(c, (x, y) => makeShape('ellipse', { x, y }))),
};

export const lineTool: ToolDef = {
  ...base,
  id: 'line',
  label: 'Line Segment',
  key: '\\',
  icon: toolIcon.line,
  group: 'shapes',
  hint: '**Drag** to draw a line. **Shift** snaps to 45°.',
  down: (c) => (penFinish(false), lineDraw(c)),
};

function ShapeOptions() {
  const tool = useStore((s) => s.tool);
  const all = useStore((s) => s.shapeParams);
  const id = tool.startsWith('shape:') ? tool.slice(6) : '';
  const def = shapeDef(id);
  if (!def) return null;
  const values = { ...defaultParams(id), ...all[id] };
  return (
    <>
      {def.params.slice(0, 3).map((p) => (
        <NumField
          key={p.key}
          label={p.label}
          value={values[p.key]}
          min={p.min}
          step={p.step}
          onCommit={(v) => setState({ shapeParams: { ...all, [id]: { ...values, [p.key]: Math.max(p.min, Math.min(p.max, v)) } } })}
        />
      ))}
    </>
  );
}

/** One tool per registry shape; the toolbar shows them in a single flyout. */
export const shapeTools: ToolDef[] = SHAPES.map((def) => ({
  ...base,
  id: `shape:${def.id}` as Tool,
  label: def.name,
  icon: shapeIcon(def.id),
  group: 'shapes',
  hint: `**Drag** to draw. Adjust ${def.params.map((p) => p.label.toLowerCase()).join(', ') || 'size'} here or in Appearance. **Shift** keeps proportions.`,
  down: (c: PointerCtx) => (penFinish(false), boxDraw(c, (x, y) => makeShape('shape', { x, y, shapeId: def.id }))),
  Options: def.params.length ? ShapeOptions : undefined,
}));
