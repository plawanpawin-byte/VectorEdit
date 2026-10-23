import { blendShapes } from '../blend';
import { canBoolean } from '../boolean';
import { commit, getState, makeShape, setState, useStore } from '../store';
import { divideRegions, multiPolygonD, regionContains, unionRegions, type Region } from '../objectops';
import type { Pt, Shape } from '../types';
import { NumField } from '../components/Fields';
import { toolIcon } from './icons';
import type { PointerCtx, Session, ToolDef } from './types';
import { shapeAt } from './util';

const toPts = (ring: [number, number][]): Pt[] => {
  const pts = ring.map(([x, y]) => ({ x, y, hx: 0, hy: 0 }));
  if (pts.length > 1 && pts[0].x === pts[pts.length - 1].x && pts[0].y === pts[pts.length - 1].y) pts.pop();
  return pts;
};

const regionShape = (mp: Region['mp'], style: Shape, name: string): Shape =>
  makeShape('path', { name, closed: true, pts: toPts(mp[0][0]), extra: [...mp[0].slice(1).map(toPts), ...mp.slice(1).flatMap((poly) => poly.map(toPts))], fill: style.fill, gradient: style.gradient, stroke: style.stroke, strokeWidth: style.strokeWidth, opacity: style.opacity });

/* ---------- Blend ---------- */

function BlendOptions() {
  const n = useStore((s) => s.blendSteps);
  return <NumField label="Steps" value={n} min={1} onCommit={(v) => setState({ blendSteps: Math.max(1, Math.min(100, Math.round(v))) })} />;
}

export const blendTool: ToolDef = {
  id: 'blend',
  label: 'Blend',
  key: undefined,
  icon: toolIcon.blend,
  group: 'paint',
  workspaces: ['vector'],
  cursor: 'crosshair',
  hint: '**Drag** from one object to another to create evenly spaced steps between them. Set the step count in the context bar.',
  chrome: 'outline',
  Options: BlendOptions,
  down(c): Session | void {
    const a = shapeAt(c.st, c.raw, c.tol);
    if (!a) return;
    return {
      move(m) {
        const k = 1 / m.zoom;
        m.setOverlay(<line x1={c.raw.x} y1={c.raw.y} x2={m.raw.x} y2={m.raw.y} stroke="#4aa3ff" strokeWidth={1.5 * k} strokeDasharray={`${5 * k} ${3 * k}`} pointerEvents="none" />);
      },
      up(m) {
        m.setOverlay(null);
        const b = shapeAt(getState(), m.raw, m.tol);
        if (!b || b.id === a.id) return;
        const steps = blendShapes(a, b, getState().blendSteps);
        const st = getState();
        // new shapes sit just above the lower of the two originals
        const at = Math.min(st.shapes.indexOf(a), st.shapes.indexOf(b)) + 1;
        const fixed = steps.map((s) => {
          const { id: _id, ...rest } = s;
          return makeShape(s.kind, rest);
        });
        commit([...st.shapes.slice(0, at), ...fixed, ...st.shapes.slice(at)], { selection: fixed.map((s) => s.id) });
      },
    };
  },
};

/* ---------- Shape Builder ---------- */

export const shapeBuilderTool: ToolDef = {
  id: 'shapebuilder',
  label: 'Shape Builder',
  key: undefined,
  icon: toolIcon.shapebuilder,
  group: 'edit',
  workspaces: ['vector'],
  cursor: 'crosshair',
  hint: 'Select overlapping shapes, then **drag** across the pieces to merge them. **Alt-drag** across pieces to delete them. Untouched pieces stay separate.',
  chrome: 'outline',
  down(c): Session | void {
    const pool = c.st.shapes.filter((s) => c.st.selection.includes(s.id) && canBoolean(s));
    if (pool.length < 1) return;
    const regions = divideRegions(pool);
    const touched = new Set<number>();
    const remove = c.alt;
    const touch = (p: { x: number; y: number }, ctx: PointerCtx) => {
      regions.forEach((r, i) => {
        if (regionContains(r.mp, p.x, p.y)) touched.add(i);
      });
      const k = 1 / ctx.zoom;
      ctx.setOverlay(
        <g pointerEvents="none">
          {regions.map((r, i) => (
            <path key={i} d={multiPolygonD(r.mp)} fillRule="evenodd" fill={touched.has(i) ? (remove ? 'rgba(255,90,78,.45)' : 'rgba(74,163,255,.45)') : 'rgba(255,255,255,.04)'} stroke="#4aa3ff" strokeWidth={1 * k} />
          ))}
        </g>,
      );
    };
    touch(c.raw, c);
    return {
      move: (m) => touch(m.raw, m),
      up(m) {
        m.setOverlay(null);
        if (!touched.size) return;
        const st = getState();
        const ids = new Set(pool.map((s) => s.id));
        const at = Math.min(...pool.map((s) => st.shapes.indexOf(s)));
        const rest = st.shapes.filter((s) => !ids.has(s.id));
        const insertAt = st.shapes.slice(0, at).filter((s) => !ids.has(s.id)).length;
        const made: Shape[] = [];
        const picked = [...touched].sort((x, y) => x - y);
        if (!remove) {
          const merged = unionRegions(picked.map((i) => regions[i].mp));
          made.push(regionShape(merged, pool[regions[picked[picked.length - 1]].owner], 'Merged'));
        }
        regions.forEach((r, i) => {
          if (!touched.has(i)) made.push(regionShape(r.mp, pool[r.owner], `Piece ${made.length + 1}`));
        });
        commit([...rest.slice(0, insertAt), ...made, ...rest.slice(insertAt)], { selection: made.slice(0, 1).map((s) => s.id) });
      },
    };
  },
};

/* ---------- Vector Flood Fill ---------- */

export const vectorFloodTool: ToolDef = {
  id: 'vflood',
  label: 'Vector Flood Fill',
  key: undefined,
  icon: toolIcon.vflood,
  group: 'paint',
  workspaces: ['vector'],
  cursor: 'crosshair',
  hint: '**Click** inside an area enclosed by overlapping shapes to fill exactly that area with the current fill colour.',
  chrome: 'none',
  down(c): Session | void {
    const closed = c.st.shapes.filter((s) => s.kind !== 'text' && canBoolean(s));
    if (!closed.length) return;
    const regions = divideRegions(closed);
    const hit = regions.find((r) => regionContains(r.mp, c.raw.x, c.raw.y));
    if (!hit) return;
    const style: Shape = { ...closed[hit.owner], fill: c.st.fill ?? closed[hit.owner].fill, gradient: null, stroke: null };
    const made = regionShape(hit.mp, style, 'Flood fill');
    commit([...c.st.shapes, made], { selection: [made.id] });
  },
};

/* ---------- Area measure ---------- */

let area: { pts: { x: number; y: number }[]; done: boolean } = { pts: [], done: false };

const shoelace = (p: { x: number; y: number }[]) => Math.abs(p.reduce((s, q, i) => s + (q.x * p[(i + 1) % p.length].y - p[(i + 1) % p.length].x * q.y), 0) / 2);
const perimeter = (p: { x: number; y: number }[], closed: boolean) => p.reduce((s, q, i) => (i === p.length - 1 && !closed ? s : s + Math.hypot(q.x - p[(i + 1) % p.length].x, q.y - p[(i + 1) % p.length].y)), 0);

function areaOverlay(c: PointerCtx) {
  const k = 1 / c.zoom;
  const p = area.pts;
  const d = p.map((q, i) => `${i ? 'L' : 'M'}${q.x} ${q.y}`).join('') + (area.done ? 'Z' : '');
  const cx = p.reduce((s, q) => s + q.x, 0) / p.length;
  const cy = p.reduce((s, q) => s + q.y, 0) / p.length;
  c.setOverlay(
    <g pointerEvents="none">
      <path d={d} fill={area.done ? 'rgba(255,210,74,.22)' : 'none'} stroke="#ffd24a" strokeWidth={1.5 * k} />
      {p.map((q, i) => (
        <circle key={i} cx={q.x} cy={q.y} r={3 * k} fill="#ffd24a" />
      ))}
      {p.length >= 2 && (
        <g transform={`translate(${cx} ${cy}) scale(${k})`}>
          <rect x="-4" y="-13" width="190" height="19" rx="3" fill="#000" fillOpacity=".8" />
          <text fill="#ffd24a" fontSize="11" fontFamily="ui-monospace, Menlo, monospace">
            {p.length >= 3 ? `${shoelace(p).toFixed(0)} px² · ` : ''}P {perimeter(p, area.done).toFixed(1)} px
          </text>
        </g>
      )}
    </g>,
  );
}

export const areaMeasureTool: ToolDef = {
  id: 'areameasure',
  label: 'Area Measure',
  key: undefined,
  icon: toolIcon.areameasure,
  group: 'view',
  workspaces: ['vector', 'layout'],
  cursor: 'crosshair',
  hint: '**Click** to place corners and read the area and perimeter. **Double-click** closes the shape; the next click starts a new one.',
  chrome: 'none',
  down(c) {
    if (area.done) area = { pts: [], done: false };
    area.pts.push({ x: c.raw.x, y: c.raw.y });
    areaOverlay(c);
  },
  dblclick(c) {
    area.done = true;
    areaOverlay(c);
  },
};
