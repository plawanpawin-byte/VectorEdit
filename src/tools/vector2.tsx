import { blendShapes } from '../blend';
import { canBoolean } from '../boolean';
import { bbox } from '../geometry';
import { meshGridPoint } from '../mesh';
import { commit, endLive, getState, live, makeShape, setState, useStore } from '../store';
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

/* ---------- Crop (non-destructive: a clipping mask) ---------- */

export const vectorCropTool: ToolDef = {
  id: 'vcrop',
  label: 'Crop',
  key: undefined,
  icon: toolIcon.crop,
  group: 'view',
  workspaces: ['vector', 'layout', 'typography'],
  cursor: 'crosshair',
  hint: 'Select objects or an image, then **drag** the area to keep. Everything outside is hidden by a clipping mask; use Release in Layers to undo it.',
  chrome: 'outline',
  down(c): Session | void {
    const targets = c.st.shapes.filter((s) => c.st.selection.includes(s.id) && !s.locked && !s.adjust);
    if (!targets.length) return;
    const start = c.p;
    let box = { x: start.x, y: start.y, w: 0, h: 0 };
    return {
      move(m) {
        box = { x: Math.min(start.x, m.p.x), y: Math.min(start.y, m.p.y), w: Math.abs(m.p.x - start.x), h: Math.abs(m.p.y - start.y) };
        const k = 1 / m.zoom;
        m.setOverlay(<rect x={box.x} y={box.y} width={box.w} height={box.h} fill="rgba(255,255,255,.08)" stroke="#fff" strokeWidth={1.5 * k} strokeDasharray={`${5 * k} ${3 * k}`} pointerEvents="none" />);
      },
      up(m) {
        m.setOverlay(null);
        if (box.w < 2 || box.h < 2) return;
        const st = getState();
        const ids = new Set(targets.map((t) => t.id));
        const mask = makeShape('rect', { name: 'Crop', ...box, fill: null, stroke: null });
        const top = Math.max(...targets.map((t) => st.shapes.indexOf(t)));
        const clipped = st.shapes.map((s) => (ids.has(s.id) ? { ...s, clip: mask.id } : s));
        commit([...clipped.slice(0, top + 1), mask, ...clipped.slice(top + 1)], { selection: targets.map((t) => t.id) });
      },
    };
  },
};

/* ---------- Mesh editing: drag the grid points of a mesh fill ---------- */

export const meshEditTool: ToolDef = {
  id: 'meshedit',
  label: 'Mesh Edit',
  key: undefined,
  icon: toolIcon.meshedit,
  group: 'paint',
  workspaces: ['vector', 'layout'],
  cursor: 'crosshair',
  hint: 'Select a shape with a mesh fill (Appearance → Mesh), then **drag** a grid point to bend the colours. **Alt-click** a point to reset it.',
  chrome: 'outline',
  down(c): Session | void {
    const shape = c.st.shapes.find((s) => c.st.selection.includes(s.id) && s.mesh);
    if (!shape?.mesh) return;
    const box = bbox(shape);
    const mesh = shape.mesh;
    const n = mesh.n;
    const at = (i: number, j: number) => {
      const p = meshGridPoint(mesh, i, j);
      return { x: box.x + p.x * box.w, y: box.y + p.y * box.h };
    };
    let best = -1;
    let bd = c.tol * 3;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const p = at(i, j);
        const d = Math.hypot(p.x - c.raw.x, p.y - c.raw.y);
        if (d < bd) (bd = d), (best = j * n + i);
      }
    const draw = (m: PointerCtx, pts: { x: number; y: number }[], active: number) => {
      const k = 1 / m.zoom;
      m.setOverlay(
        <g pointerEvents="none">
          {pts.map((p, i) => {
            const x = box.x + p.x * box.w, y = box.y + p.y * box.h;
            return (
              <g key={i}>
                {i % n < n - 1 && <line x1={x} y1={y} x2={box.x + pts[i + 1].x * box.w} y2={box.y + pts[i + 1].y * box.h} stroke="#fff" strokeOpacity=".6" strokeWidth={k} />}
                {i + n < pts.length && <line x1={x} y1={y} x2={box.x + pts[i + n].x * box.w} y2={box.y + pts[i + n].y * box.h} stroke="#fff" strokeOpacity=".6" strokeWidth={k} />}
              </g>
            );
          })}
          {pts.map((p, i) => (
            <circle key={'c' + i} cx={box.x + p.x * box.w} cy={box.y + p.y * box.h} r={5 * k} fill={i === active ? '#4aa3ff' : '#fff'} stroke="#000" strokeWidth={k} />
          ))}
        </g>,
      );
    };
    const grid = Array.from({ length: n * n }, (_, i) => ({ ...meshGridPoint(mesh, i % n, Math.floor(i / n)) }));
    if (best < 0) {
      draw(c, grid, -1);
      return { up: (m) => m.setOverlay(null) };
    }
    const before = c.st.shapes;
    const apply = (pts: { x: number; y: number }[]) => live(before.map((s) => (s.id === shape.id ? { ...s, mesh: { ...mesh, pts } } : s)));
    if (c.alt) {
      const pts = grid.map((p, i) => (i === best ? { x: (i % n) / (n - 1), y: Math.floor(i / n) / (n - 1) } : p));
      apply(pts);
      return { up: (m) => (m.setOverlay(null), endLive(before)) };
    }
    return {
      move(m) {
        const pts = grid.map((p, i) => (i === best ? { x: box.w ? (m.raw.x - box.x) / box.w : p.x, y: box.h ? (m.raw.y - box.y) / box.h : p.y } : p));
        apply(pts);
        draw(m, pts, best);
      },
      up(m) {
        m.setOverlay(null);
        endLive(before);
      },
    };
  },
};
