import { bbox, rotateShape, unionBox } from '../geometry';
import { commit, endLive, getState, live, makeShape, setColor, setState, updateSelected, useStore } from '../store';
import { hitTest } from '../geometry';
import { toolIcon } from './icons';
import type { PointerCtx, Session, ToolDef } from './types';
import { editableSelection } from './util';

/* ---------- Eyedropper ---------- */

export const eyedropperTool: ToolDef = {
  id: 'eyedropper',
  label: 'Eyedropper',
  key: 'i',
  icon: toolIcon.eyedropper,
  group: 'paint',
  workspaces: ['vector', 'layout', 'typography'],
  cursor: 'crosshair',
  hint: '**Click** an object to copy its fill and stroke to the selection and to new objects.',
  chrome: 'outline',
  down(c) {
    for (let i = c.st.shapes.length - 1; i >= 0; i--) {
      const src = c.st.shapes[i];
      if (hitTest(src, c.raw.x, c.raw.y, c.tol)) {
        setState({ strokeWidth: src.strokeWidth });
        setColor('fill', src.fill);
        setColor('stroke', src.stroke);
        if (src.gradient) updateSelected((s) => ({ ...s, gradient: src.gradient }));
        return;
      }
    }
  },
};

/* ---------- Fill (gradient) tool ---------- */

function FillOptions() {
  const type = useStore((s) => s.gradientType);
  return (
    <>
      <span className="dim">Gradient</span>
      <select value={type} onChange={(e) => setState({ gradientType: e.target.value as 'linear' | 'radial' })}>
        <option value="linear">Linear</option>
        <option value="radial">Radial</option>
      </select>
    </>
  );
}

export const fillTool: ToolDef = {
  id: 'fill',
  label: 'Fill (gradient)',
  key: 'g',
  icon: toolIcon.fill,
  group: 'paint',
  workspaces: ['vector', 'layout'],
  cursor: 'crosshair',
  hint: '**Drag** across the selected shapes to place a gradient. Linear runs along the drag; radial grows from the start point.',
  chrome: 'outline',
  Options: FillOptions,
  down(c): Session | void {
    const sel = editableSelection(c.st);
    if (!sel.length) return;
    const start = c.p;
    const before = c.st.shapes;
    const ids = new Set(sel.map((s) => s.id));
    const colours = (s: (typeof sel)[number]) => ({ a: s.gradient?.a ?? s.fill ?? '#ffffff', b: s.gradient?.b ?? c.st.stroke ?? '#000000' });
    return {
      move(m) {
        if (Math.hypot(m.p.x - start.x, m.p.y - start.y) < 2 / m.zoom) return;
        live(
          m.st.shapes.map((s) =>
            ids.has(s.id) ? { ...s, gradient: { type: m.st.gradientType, ...colours(before.find((q) => q.id === s.id)!), angle: 0, p1: { ...start }, p2: { ...m.p } } } : s,
          ),
        );
        m.setOverlay(
          <g pointerEvents="none" stroke="#fff" strokeWidth={1.5 / m.zoom}>
            <line x1={start.x} y1={start.y} x2={m.p.x} y2={m.p.y} stroke="#000" strokeOpacity=".5" strokeWidth={3 / m.zoom} />
            <line x1={start.x} y1={start.y} x2={m.p.x} y2={m.p.y} />
            <circle cx={start.x} cy={start.y} r={4 / m.zoom} fill="#fff" stroke="#000" strokeWidth={1 / m.zoom} />
            <circle cx={m.p.x} cy={m.p.y} r={4 / m.zoom} fill="#2d8cf0" stroke="#fff" />
          </g>,
        );
      },
      up(m) {
        m.setOverlay(null);
        endLive(before);
      },
    };
  },
};

/* ---------- Rotate ---------- */

export const rotateTool: ToolDef = {
  id: 'rotate',
  label: 'Rotate',
  key: 'r',
  icon: toolIcon.rotate,
  group: 'transform',
  workspaces: ['vector', 'layout'],
  cursor: 'crosshair',
  hint: '**Drag** around the selection to rotate it. **Shift** snaps to 15°.',
  chrome: 'outline',
  down(c) {
    const sel = editableSelection(c.st).filter((s) => s.kind !== 'text');
    const box = unionBox(sel.map(bbox));
    if (!box) return;
    const centre = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    const startAngle = Math.atan2(c.raw.y - centre.y, c.raw.x - centre.x);
    const orig = new Map(sel.map((s) => [s.id, s]));
    const before = c.st.shapes;
    return {
      move(m) {
        let deg = ((Math.atan2(m.raw.y - centre.y, m.raw.x - centre.x) - startAngle) * 180) / Math.PI;
        if (m.shift) deg = Math.round(deg / 15) * 15;
        live(m.st.shapes.map((s) => (orig.has(s.id) ? rotateShape(orig.get(s.id)!, deg, centre.x, centre.y) : s)));
        m.setOverlay(<circle cx={centre.x} cy={centre.y} r={4 / m.zoom} fill="#fff" stroke="#2d8cf0" strokeWidth={1.5 / m.zoom} pointerEvents="none" />);
      },
      up(m) {
        m.setOverlay(null);
        endLive(before);
      },
    };
  },
};

export { commit, getState, makeShape };
void (null as unknown as PointerCtx);
