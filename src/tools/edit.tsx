import { cutPieces } from '../boolean';
import { bbox, boxesIntersect, isClosed, toPath } from '../geometry';
import { nearestOnPath, splitPath } from '../pathops';
import { commit, getState, makeShape } from '../store';
import type { Shape } from '../types';
import { toolIcon } from './icons';
import type { PointerCtx, Session, ToolDef } from './types';
import { shapeAt } from './util';

const CUTTABLE = (s: Shape) => s.visible && !s.locked && s.kind !== 'text' && s.kind !== 'line' && (s.kind !== 'path' || s.closed) && isClosed(s);

/** Knife: drag a line across closed shapes to cut them into pieces. */
function knifeDown(c: PointerCtx): Session {
  const a = c.raw;
  let b = c.raw;
  return {
    move(m) {
      b = m.raw;
      m.setOverlay(<path d={`M${a.x} ${a.y}L${b.x} ${b.y}`} stroke="#ff5a4e" strokeWidth={1.5 / m.zoom} strokeDasharray={`${5 / m.zoom} ${3 / m.zoom}`} pointerEvents="none" />);
    },
    up(m) {
      m.setOverlay(null);
      if (Math.hypot(b.x - a.x, b.y - a.y) < 4 / m.zoom) return;
      const st = getState();
      const lineBox = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x) || 0.01, h: Math.abs(b.y - a.y) || 0.01 };
      const targets = (st.selection.length ? st.shapes.filter((s) => st.selection.includes(s.id)) : st.shapes).filter((s) => CUTTABLE(s) && boxesIntersect(bbox(s), lineBox));
      if (!targets.length) return;
      const ids = new Set<string>();
      const replaced = new Map<string, Shape[]>();
      for (const s of targets) {
        const pieces = cutPieces(s, a, b, 0.4 / m.zoom);
        if (!pieces || pieces.length < 2) continue;
        ids.add(s.id);
        replaced.set(
          s.id,
          pieces.map((piece, i) => ({
            ...makeShape('path', { name: `${s.name} ${i + 1}`, pts: piece.outer, extra: piece.holes, closed: true }),
            fill: s.fill,
            gradient: s.gradient,
            stroke: s.stroke,
            strokeWidth: s.strokeWidth,
            dash: s.dash,
            cap: s.cap,
            join: s.join,
            opacity: s.opacity,
            effects: s.effects,
            group: s.group,
          })),
        );
      }
      if (!ids.size) return;
      const next = st.shapes.flatMap((s) => replaced.get(s.id) ?? [s]);
      commit(next, { selection: Array.from(replaced.values()).flat().map((s) => s.id) });
    },
  };
}

export const knifeTool: ToolDef = {
  id: 'knife',
  label: 'Knife',
  key: 'k',
  icon: toolIcon.knife,
  group: 'edit',
  workspaces: ['vector'],
  cursor: 'crosshair',
  hint: '**Drag** a line across shapes to cut them into pieces (cuts the selection, or every shape under the line).',
  chrome: 'outline',
  down: knifeDown,
};

/** Scissors: click a path to split it at that point. */
function scissorsDown(c: PointerCtx): void {
  const st = c.st;
  let best: { shape: Shape; seg: number; t: number; dist: number } | null = null;
  for (const s of st.shapes) {
    if (s.locked || !s.visible || s.kind === 'text') continue;
    const p = s.kind === 'path' || s.kind === 'line' ? s : toPath(s);
    if (!p.pts.length) continue;
    const near = nearestOnPath(p.pts, p.closed, c.raw);
    if (near && near.dist <= c.tol * 1.5 && (!best || near.dist < best.dist)) best = { shape: p, seg: near.seg, t: near.t, dist: near.dist };
  }
  if (!best) return;
  const { shape, seg, t } = best;
  const parts = splitPath(shape.pts, shape.closed, seg, t);
  if (!parts.length) return;
  const made = parts.map((pts, i) => ({ ...shape, id: i === 0 ? shape.id : `${shape.id}s${Date.now().toString(36)}${i}`, name: i === 0 ? shape.name : `${shape.name} ${i + 1}`, pts, closed: false, extra: [] }));
  const next = st.shapes.flatMap((s) => (s.id === shape.id ? made : [s]));
  commit(next, { selection: made.map((m) => m.id) });
}

export const scissorsTool: ToolDef = {
  id: 'scissors',
  label: 'Scissors',
  key: 'x',
  icon: toolIcon.scissors,
  group: 'edit',
  workspaces: ['vector'],
  cursor: 'crosshair',
  hint: '**Click** on a path to split it at that point. A closed shape becomes an open path.',
  chrome: 'outline',
  down: scissorsDown,
};

export { shapeAt };
