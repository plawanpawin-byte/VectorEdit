import { brushOutline } from '../brush';
import { smoothStroke } from '../geometry';
import { commit, getState, makeShape, penAdd, penDragLast, penDropLast, penFinish, setState } from '../store';
import { toolIcon } from './icons';
import type { PointerCtx, Session, ToolDef, XY } from './types';

/* ---------- Pen ---------- */

function penDown(c: PointerCtx): Session | void {
  const first = c.st.pen?.[0];
  if (first && c.st.pen!.length >= 2 && Math.hypot(c.p.x - first.x, c.p.y - first.y) <= 8 / c.zoom) {
    penFinish(true);
    return;
  }
  penAdd({ x: c.p.x, y: c.p.y, hx: 0, hy: 0 });
  return {
    move(m) {
      const pts = getState().pen;
      if (!pts?.length) return;
      const last = pts[pts.length - 1];
      const dx = m.p.x - last.x;
      const dy = m.p.y - last.y;
      if (Math.hypot(dx, dy) > 3 / m.zoom) penDragLast(dx, dy);
    },
  };
}

export const penTool: ToolDef = {
  id: 'pen',
  label: 'Pen',
  key: 'p',
  icon: toolIcon.pen,
  group: 'draw',
  workspaces: ['vector', 'layout'],
  cursor: 'crosshair',
  hint: '**Click** to add a node, **drag** to pull curve handles. **Click** the first node to close, **Enter** or **double-click** to finish, **Esc** cancels.',
  chrome: 'outline',
  down: penDown,
  dblclick() {
    // the double click already added a duplicate node
    penDropLast();
    penFinish(false);
  },
};

/* ---------- Pencil ---------- */

function freehand(c: PointerCtx, finish: (raw: XY[], zoom: number) => void): Session {
  const raw: XY[] = [c.raw];
  return {
    move(m) {
      const last = raw[raw.length - 1];
      if (Math.hypot(m.raw.x - last.x, m.raw.y - last.y) < 2 / m.zoom) return;
      raw.push(m.raw);
      m.setOverlay(<path d={`M${raw.map((q) => `${q.x} ${q.y}`).join('L')}`} fill="none" stroke="#2d8cf0" strokeWidth={1.5 / m.zoom} strokeLinejoin="round" pointerEvents="none" />);
    },
    up(m) {
      m.setOverlay(null);
      if (raw.length > 2) finish(raw, m.zoom);
    },
  };
}

export const pencilTool: ToolDef = {
  id: 'pencil',
  label: 'Pencil',
  key: 'n',
  icon: toolIcon.pencil,
  group: 'draw',
  workspaces: ['vector', 'layout'],
  cursor: 'crosshair',
  hint: '**Drag** to draw freehand. The stroke is simplified into smooth curves.',
  chrome: 'outline',
  down(c) {
    penFinish(false);
    return freehand(c, (raw, zoom) => {
      const st = getState();
      const shape = makeShape('path', { pts: smoothStroke(raw, 1.5 / zoom), closed: false, fill: null, stroke: st.stroke ?? '#1c1c1c' });
      commit([...st.shapes, shape], { selection: [shape.id] });
    });
  },
};

/* ---------- Vector brush ---------- */

export const brushTool: ToolDef = {
  id: 'vbrush',
  label: 'Vector Brush',
  key: 'b',
  icon: toolIcon.vbrush,
  group: 'draw',
  workspaces: ['vector'],
  cursor: 'crosshair',
  hint: '**Drag** to paint a variable-width stroke. Pick the profile and size in the context bar.',
  chrome: 'outline',
  down(c) {
    penFinish(false);
    return freehand(c, (raw) => {
      const st = getState();
      const outline = brushOutline(raw, st.brush);
      if (outline.length < 3) return;
      const shape = makeShape('path', { name: 'Brush stroke', pts: outline, closed: true, fill: st.stroke ?? st.fill ?? '#1c1c1c', stroke: null });
      commit([...st.shapes, shape], { selection: [shape.id] });
    });
  },
  Options: BrushOptions,
};

import type { ComponentType } from 'react';
import { NumField } from '../components/Fields';
import { useStore } from '../store';

function BrushOptions() {
  const brush = useStore((s) => s.brush);
  return (
    <>
      <span className="dim">Profile</span>
      <select value={brush.profile} onChange={(e) => setState({ brush: { ...brush, profile: e.target.value as typeof brush.profile } })}>
        <option value="taper">Tapered</option>
        <option value="uniform">Uniform</option>
        <option value="calligraphic">Calligraphic</option>
      </select>
      <NumField label="Size" value={brush.size} suffix="px" min={1} onCommit={(size) => setState({ brush: { ...brush, size } })} />
    </>
  );
}
export type { ComponentType };
