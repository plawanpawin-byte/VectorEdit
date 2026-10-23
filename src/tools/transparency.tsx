import { bbox, unionBox } from '../geometry';
import { toolIcon } from './icons';
import { endLive, live } from '../store';
import type { Session, ToolDef } from './types';
import { editableSelection } from './util';
import { commit, expandToGroups, makeShape } from '../store';
import { offsetShape } from '../offset';
import { NumField } from '../components/Fields';
import { setState, useStore } from '../store';

/** Drag across the selection to fade it out along the drag. */
export const transparencyTool: ToolDef = {
  id: 'transparency',
  label: 'Transparency',
  key: undefined,
  icon: toolIcon.transparency,
  group: 'paint',
  workspaces: ['vector', 'layout'],
  cursor: 'crosshair',
  hint: '**Drag** across the selected objects to fade them: fully visible at the start, transparent at the end. Adjust the end values in Appearance.',
  chrome: 'outline',
  down(c): Session | void {
    const sel = editableSelection(c.st);
    if (!sel.length) return;
    const before = c.st.shapes;
    const ids = new Set(sel.map((s) => s.id));
    const start = c.p;
    return {
      move(m) {
        if (Math.hypot(m.p.x - start.x, m.p.y - start.y) < 2 / m.zoom) return;
        live(m.st.shapes.map((s) => (ids.has(s.id) ? { ...s, fade: { p1: { ...start }, p2: { ...m.p }, from: 1, to: 0 } } : s)));
        m.setOverlay(
          <g pointerEvents="none">
            <line x1={start.x} y1={start.y} x2={m.p.x} y2={m.p.y} stroke="#000" strokeOpacity=".5" strokeWidth={3 / m.zoom} />
            <line x1={start.x} y1={start.y} x2={m.p.x} y2={m.p.y} stroke="#fff" strokeWidth={1.5 / m.zoom} strokeDasharray={`${4 / m.zoom} ${3 / m.zoom}`} />
            <circle cx={start.x} cy={start.y} r={4 / m.zoom} fill="#fff" stroke="#000" strokeWidth={1 / m.zoom} />
            <circle cx={m.p.x} cy={m.p.y} r={4 / m.zoom} fill="#222" stroke="#fff" strokeWidth={1 / m.zoom} />
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

function ContourOptions() {
  const c = useStore((s) => s.contour);
  return (
    <>
      <NumField label="Steps" value={c.steps} min={1} onCommit={(steps) => setState({ contour: { ...c, steps: Math.max(1, Math.min(30, Math.round(steps))) } })} />
      <span className="dim">Join</span>
      <select value={c.join} onChange={(e) => setState({ contour: { ...c, join: e.target.value as typeof c.join } })}>
        <option value="round">Round</option>
        <option value="miter">Miter</option>
        <option value="bevel">Bevel</option>
      </select>
    </>
  );
}

/** Drag outward from the selected shape to create offset copies; drag inward to shrink. */
export const contourTool: ToolDef = {
  id: 'contour',
  label: 'Contour',
  key: undefined,
  icon: toolIcon.contour,
  group: 'edit',
  workspaces: ['vector'],
  cursor: 'crosshair',
  hint: '**Drag** away from a selected shape to create offset outlines (outward), or toward its centre to shrink. Steps are set in the context bar.',
  chrome: 'outline',
  Options: ContourOptions,
  down(c): Session | void {
    const sel = editableSelection(c.st).filter((s) => s.kind !== 'text');
    if (sel.length !== 1) return;
    const shape = sel[0];
    const box = bbox(shape);
    const centre = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    const start = Math.hypot(c.raw.x - centre.x, c.raw.y - centre.y);
    const before = c.st.shapes;
    const { steps, join } = c.st.contour;
    let distance = 0;
    return {
      move(m) {
        distance = Math.hypot(m.raw.x - centre.x, m.raw.y - centre.y) - start;
        const k = 1 / m.zoom;
        m.setOverlay(
          <g pointerEvents="none" fill="none" stroke="#ff5a4e" strokeWidth={1.5 * k}>
            {Array.from({ length: steps }, (_, i) => {
              const d = (distance * (i + 1)) / steps;
              return offsetShape(shape, d, join).map((o, j) => (
                <path key={`${i}-${j}`} d={`M${o.outer.map((p) => `${p.x} ${p.y}`).join('L')}Z${o.holes.map((h) => `M${h.map((p) => `${p.x} ${p.y}`).join('L')}Z`).join('')}`} />
              ));
            })}
          </g>,
        );
      },
      up(m) {
        m.setOverlay(null);
        if (Math.abs(distance) < 1 / m.zoom) return;
        const made = [] as ReturnType<typeof makeShape>[];
        for (let i = 0; i < steps; i++) {
          const d = (distance * (i + 1)) / steps;
          for (const o of offsetShape(shape, d, join)) {
            made.push(
              makeShape('path', {
                name: `${shape.name} contour ${i + 1}`,
                pts: o.outer,
                extra: o.holes,
                closed: true,
                fill: shape.fill,
                gradient: shape.gradient,
                stroke: shape.stroke,
                strokeWidth: shape.strokeWidth,
                dash: shape.dash,
                opacity: shape.opacity,
              }),
            );
          }
        }
        if (!made.length) return;
        // outer copies go behind the original, inner ones in front
        const behind = distance > 0;
        const idx = before.findIndex((s) => s.id === shape.id);
        const next = [...before];
        next.splice(behind ? idx : idx + 1, 0, ...(behind ? made.reverse() : made));
        commit(next, { selection: expandToGroups(made.map((x) => x.id), next) });
      },
    };
  },
};

export { bbox, unionBox };
