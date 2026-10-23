import { endLive, live, setState, useStore } from '../store';
import { commitPixels, targetLayer, workingCanvas } from '../raster/layer';
import { warpBuf } from '../raster/warp';
import { envelopeMap, invertMap, inversePerspective, neutralNet, perspectiveMap, boxOfShapes, warpShape, type XY } from '../warp';
import { toolIcon } from './icons';
import { isPixelWorkspace } from './workspaces';
import type { PointerCtx, Session, ToolDef } from './types';
import { editableSelection } from './util';

const eligible = (c: PointerCtx) => editableSelection(c.st).filter((s) => s.kind !== 'text' && !s.raster);

function handleOverlay(points: XY[], lines: [number, number][], zoom: number, active: number) {
  const k = 1 / zoom;
  return (
    <g pointerEvents="none">
      {lines.map(([a, b], i) => (
        <line key={i} x1={points[a].x} y1={points[a].y} x2={points[b].x} y2={points[b].y} stroke="#4aa3ff" strokeWidth={1.2 * k} />
      ))}
      {points.map((p, i) => (
        <rect key={i} x={p.x - 4.5 * k} y={p.y - 4.5 * k} width={9 * k} height={9 * k} fill={i === active ? '#4aa3ff' : '#fff'} stroke="#1b6fd1" strokeWidth={1.2 * k} />
      ))}
    </g>
  );
}

function WarpOptions() {
  const n = useStore((s) => s.warpGrid);
  return (
    <>
      <span className="dim">Mesh</span>
      <select value={n} onChange={(e) => setState({ warpGrid: Number(e.target.value) })}>
        {[3, 4, 5, 6].map((g) => (
          <option key={g} value={g}>{g} × {g} points</option>
        ))}
      </select>
    </>
  );
}

function make(mode: 'perspective' | 'warp'): ToolDef {
  const persp = mode === 'perspective';
  return {
    id: mode,
    label: persp ? 'Perspective' : 'Envelope Warp',
    key: undefined,
    icon: persp ? toolIcon.perspective : toolIcon.warp,
    group: 'edit',
    workspaces: ['vector', 'pixel'],
    cursor: 'crosshair',
    hint: persp
      ? '**Drag** a corner of the selection to apply perspective. Shapes are converted to curves; a pixel layer is resampled.'
      : '**Drag** any handle of the mesh (size in the context bar) to bend the selection like an envelope. Shapes are converted to curves.',
    chrome: 'outline',
    Options: persp ? undefined : WarpOptions,
    down(c): Session | void {
      const raster = isPixelWorkspace(c.st.workspace) ? targetLayer() : null;
      if (isPixelWorkspace(c.st.workspace) && !raster) return;
      const sel = raster ? [] : eligible(c);
      if (!raster && !sel.length) return;
      const box = raster ? { x: raster.x, y: raster.y, w: raster.w, h: raster.h } : boxOfShapes(sel);
      const n = persp ? 2 : c.st.warpGrid;
      const net = neutralNet(box, n);
      // a 2×2 net is the four corners in TL, TR, BL, BR order; perspective wants TL, TR, BR, BL
      const handles = persp ? [net[0], net[1], net[3], net[2]] : net;
      let best = -1;
      let bd = c.tol * 2.5;
      handles.forEach((h, i) => {
        const d = Math.hypot(h.x - c.raw.x, h.y - c.raw.y);
        if (d < bd) (bd = d), (best = i);
      });
      const gridLines: [number, number][] = [];
      if (!persp)
        for (let j = 0; j < n; j++)
          for (let i = 0; i < n; i++) {
            if (i < n - 1) gridLines.push([j * n + i, j * n + i + 1]);
            if (j < n - 1) gridLines.push([j * n + i, (j + 1) * n + i]);
          }
      const show = (pts: XY[], active: number) => {
        c.setOverlay(handleOverlay(pts, persp ? [[0, 1], [1, 2], [2, 3], [3, 0]] : gridLines, c.zoom, active));
      };
      if (best < 0) {
        show(handles, -1);
        return {
          up(m) {
            m.setOverlay(null);
          },
        };
      }
      const before = c.st.shapes;
      const ids = new Set(sel.map((s) => s.id));
      const originals = new Map(sel.map((s) => [s.id, s]));
      let moved = handles;
      return {
        move(m) {
          moved = handles.map((h, i) => (i === best ? { x: m.p.x, y: m.p.y } : h));
          if (!raster) {
            const map = persp ? perspectiveMap(box, moved as [XY, XY, XY, XY]) : envelopeMap(box, net.map((q, i) => (i === best ? { x: m.p.x, y: m.p.y } : q)), n);
            live(m.st.shapes.map((s) => (ids.has(s.id) ? warpShape(originals.get(s.id)!, map) : s)));
          }
          show(moved, best);
        },
        up(m) {
          m.setOverlay(null);
          if (!raster) return endLive(before);
          // pixel layers are resampled once, when the handle is released
          const inverse = persp ? inversePerspective(box, moved as [XY, XY, XY, XY]) : invertMap(envelopeMap(box, moved, n));
          void Promise.resolve(workingCanvas(raster)).then((canvas) => {
            const ctx = canvas.getContext('2d')!;
            const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const out = warpBuf(src, { x: raster.x, y: raster.y, w: raster.w, h: raster.h, rw: raster.rw, rh: raster.rh }, inverse);
            src.data.set(out.data);
            ctx.putImageData(src, 0, 0);
            commitPixels(raster.id, canvas, before);
          });
        },
      };
    },
  };
}

export const perspectiveTool = make('perspective');
export const warpTool = make('warp');
