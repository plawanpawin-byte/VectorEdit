import { endLive, live } from '../store';
import { envelopeMap, neutralNet, perspectiveMap, boxOfShapes, warpShape, type XY } from '../warp';
import { toolIcon } from './icons';
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

function make(mode: 'perspective' | 'warp'): ToolDef {
  const persp = mode === 'perspective';
  const cornerIdx = [0, 2, 8, 6]; // corners within the 3×3 net
  return {
    id: mode,
    label: persp ? 'Perspective' : 'Envelope Warp',
    key: undefined,
    icon: persp ? toolIcon.perspective : toolIcon.warp,
    group: 'edit',
    workspaces: ['vector'],
    cursor: 'crosshair',
    hint: persp
      ? '**Drag** a corner of the selection to apply perspective. Shapes are converted to curves.'
      : '**Drag** any of the 9 handles to bend the selection like an envelope. Shapes are converted to curves.',
    chrome: 'outline',
    down(c): Session | void {
      const sel = eligible(c);
      if (!sel.length) return;
      const box = boxOfShapes(sel);
      const net = neutralNet(box);
      const handles = persp ? cornerIdx.map((i) => net[i]) : net;
      let best = -1;
      let bd = c.tol * 2.5;
      handles.forEach((h, i) => {
        const d = Math.hypot(h.x - c.raw.x, h.y - c.raw.y);
        if (d < bd) (bd = d), (best = i);
      });
      const show = (pts: XY[], active: number) => {
        c.setOverlay(
          persp
            ? handleOverlay(pts, [[0, 1], [1, 2], [2, 3], [3, 0]], c.zoom, active)
            : handleOverlay(pts, [[0, 1], [1, 2], [3, 4], [4, 5], [6, 7], [7, 8], [0, 3], [3, 6], [1, 4], [4, 7], [2, 5], [5, 8]], c.zoom, active),
        );
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
      return {
        move(m) {
          const moved = handles.map((h, i) => (i === best ? { x: m.p.x, y: m.p.y } : h));
          const map = persp ? perspectiveMap(box, moved as [XY, XY, XY, XY]) : envelopeMap(box, net.map((n, i) => (i === best ? { x: m.p.x, y: m.p.y } : n)));
          live(m.st.shapes.map((s) => (ids.has(s.id) ? warpShape(originals.get(s.id)!, map) : s)));
          show(moved, best);
        },
        up(m) {
          m.setOverlay(null);
          endLive(before);
        },
      };
    },
  };
}

export const perspectiveTool = make('perspective');
export const warpTool = make('warp');
