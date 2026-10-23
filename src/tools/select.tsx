import { bbox, boxesIntersect, hitTest, scaleAbout, toPath, translate, unionBox } from '../geometry';
import { deleteNodes, insertNode, nearestOnPath, setSmoothHandle, toggleNode } from '../pathops';
import {
  commit,
  endLive,
  expandToGroups,
  getState,
  live,
  setState,
} from '../store';
import type { Box, Pt, Shape } from '../types';
import { toolIcon } from './icons';
import type { PointerCtx, Session, ToolDef } from './types';
import { editableSelection, shapeAt } from './util';

const MARQUEE_STYLE = { fill: 'rgba(45,140,240,.12)', stroke: '#2d8cf0' };

function marqueeOverlay(b: Box, zoom: number) {
  return <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={MARQUEE_STYLE.fill} stroke={MARQUEE_STYLE.stroke} strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} pointerEvents="none" />;
}

function marquee(c: PointerCtx, base: string[]): Session {
  const start = c.p;
  return {
    move(m) {
      const box = { x: Math.min(start.x, m.p.x), y: Math.min(start.y, m.p.y), w: Math.abs(m.p.x - start.x), h: Math.abs(m.p.y - start.y) };
      m.setOverlay(marqueeOverlay(box, m.zoom));
      const ids = m.st.shapes.filter((s) => s.visible && !s.locked && boxesIntersect(box, bbox(s))).map((s) => s.id);
      setState({ selection: expandToGroups(Array.from(new Set([...base, ...ids])), m.st.shapes) });
    },
    up(m) {
      m.setOverlay(null);
    },
  };
}

/* ---------- Move / transform ---------- */

function moveSession(c: PointerCtx, moving: Shape[], before: Shape[]): Session {
  const orig = new Map(moving.map((s) => [s.id, s]));
  const start = c.p;
  return {
    move(m) {
      let dx = m.p.x - start.x;
      let dy = m.p.y - start.y;
      if (m.shift) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      live(m.st.shapes.map((s) => (orig.has(s.id) ? translate(orig.get(s.id)!, dx, dy) : s)));
    },
    up() {
      endLive(before);
    },
  };
}

function resizeSession(handle: string, box: Box, sel: Shape[], before: Shape[]): Session {
  const orig = new Map(sel.map((s) => [s.id, s]));
  return {
    move(m) {
      const dragX = handle.includes('e') ? box.x + box.w : handle.includes('w') ? box.x : null;
      const dragY = handle.includes('s') ? box.y + box.h : handle.includes('n') ? box.y : null;
      const ax = dragX === null ? box.x : dragX === box.x ? box.x + box.w : box.x;
      const ay = dragY === null ? box.y : dragY === box.y ? box.y + box.h : box.y;
      let sx = dragX === null || dragX === ax ? 1 : (m.p.x - ax) / (dragX - ax);
      let sy = dragY === null || dragY === ay ? 1 : (m.p.y - ay) / (dragY - ay);
      if (m.shift && dragX !== null && dragY !== null) {
        const k = Math.max(Math.abs(sx), Math.abs(sy));
        sx = Math.sign(sx || 1) * k;
        sy = Math.sign(sy || 1) * k;
      }
      if (m.alt) {
        // scale from the centre
        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        const kx = dragX === null ? 1 : (m.p.x - cx) / (dragX - cx);
        const ky = dragY === null ? 1 : (m.p.y - cy) / (dragY - cy);
        live(m.st.shapes.map((s) => (orig.has(s.id) ? scaleAbout(orig.get(s.id)!, kx, ky, cx, cy) : s)));
        return;
      }
      live(m.st.shapes.map((s) => (orig.has(s.id) ? scaleAbout(orig.get(s.id)!, sx, sy, ax, ay) : s)));
    },
    up() {
      endLive(before);
    },
  };
}

function selectDown(c: PointerCtx): Session | void {
  const st = c.st;
  const handle = c.target.getAttribute?.('data-h');
  if (handle) {
    const sel = editableSelection(st);
    const box = unionBox(sel.map(bbox));
    if (box) return resizeSession(handle, box, sel, st.shapes);
  }
  let hit = shapeAt(st, c.raw, c.tol);
  if (hit && !st.autoSelect && !c.shift && !st.selection.includes(hit.id)) hit = undefined; // Auto-select off: only the current selection can be grabbed
  if (!hit) {
    if (!st.autoSelect && !c.shift && st.selection.length) {
      // inside the selection's box a drag still moves it; elsewhere it starts a marquee
      const sel = editableSelection(st);
      const box = unionBox(sel.map(bbox));
      if (box && c.raw.x >= box.x && c.raw.x <= box.x + box.w && c.raw.y >= box.y && c.raw.y <= box.y + box.h) return moveSession(c, sel, st.shapes);
    }
    const base = c.shift ? st.selection : [];
    setState({ selection: base });
    return marquee(c, base);
  }
  const members = expandToGroups([hit.id], st.shapes);
  let selection = st.selection;
  if (c.shift) selection = selection.includes(hit.id) ? selection.filter((i) => !members.includes(i)) : [...selection, ...members];
  else if (!selection.includes(hit.id)) selection = members;
  selection = Array.from(new Set(selection));
  setState({ selection });
  let before = st.shapes;
  let moving = st.shapes.filter((s) => selection.includes(s.id) && !s.locked);
  if (c.alt) {
    // alt-drag moves a copy and leaves the original in place
    const copies = moving.map((s, i) => ({ ...s, id: `${s.id}c${Date.now().toString(36)}${i}`, name: `${s.name} copy` }));
    live([...st.shapes, ...copies], copies.map((s) => s.id));
    moving = copies;
  }
  return moveSession(c, moving, before);
}

export const selectTool: ToolDef = {
  id: 'select',
  label: 'Move',
  key: 'v',
  icon: toolIcon.select,
  group: 'select',
  workspaces: ['vector', 'pixel', 'layout', 'typography', 'slice', 'scripting'],
  cursor: 'default',
  hint: '**Click** to select, **drag** to move or marquee-select. **Shift** adds, **Alt-drag** copies, drag handles to scale (**Alt** = from centre).',
  chrome: 'transform',
  down: selectDown,
  dblclick(c) {
    // double-click text to edit it in place
    const t = [...c.st.shapes].reverse().find((s) => s.kind === 'text' && !s.locked && hitTest(s, c.raw.x, c.raw.y, c.tol));
    if (t) setState({ selection: [t.id], editingText: t.id });
  },
};

/* ---------- Node tool ---------- */

type NodePart = 'p' | 'out' | 'in';

function updatePts(id: string, fn: (pts: Pt[]) => Pt[]) {
  return getState().shapes.map((s) => (s.id === id ? { ...s, pts: fn(s.pts) } : s));
}

function nodeDrag(id: string, i: number, part: NodePart, before: Shape[]): Session {
  const original = before.find((s) => s.id === id)!.pts[i];
  return {
    move(m) {
      live(
        updatePts(id, (pts) => {
          const next = pts.map((q) => ({ ...q }));
          const pt = next[i];
          if (part === 'p') {
            pt.x = m.p.x;
            pt.y = m.p.y;
            pt.hx = original.hx;
            pt.hy = original.hy;
          } else if (part === 'out') {
            pt.hx = m.p.x - pt.x;
            pt.hy = m.p.y - pt.y;
            // alt breaks the symmetry: freeze the incoming handle where it was
            if (m.alt && pt.ix === undefined) {
              pt.ix = -original.hx;
              pt.iy = -original.hy;
            }
          } else if (m.alt || pt.ix !== undefined) {
            pt.ix = m.p.x - pt.x;
            pt.iy = m.p.y - pt.y;
          } else {
            pt.hx = pt.x - m.p.x;
            pt.hy = pt.y - m.p.y;
          }
          return next;
        }),
      );
    },
    up() {
      endLive(before);
    },
  };
}

function nodeDown(c: PointerCtx): Session | void {
  const st = c.st;
  const a = c.target.getAttribute?.('data-a');
  if (a) {
    const [id, idx, part] = a.split(':');
    const i = Number(idx);
    if (part === 'p') {
      const already = st.nodeSel.some((n) => n.id === id && n.i === i);
      setState({ nodeSel: c.shift ? (already ? st.nodeSel.filter((n) => !(n.id === id && n.i === i)) : [...st.nodeSel, { id, i }]) : already ? st.nodeSel : [{ id, i }] });
    }
    return nodeDrag(id, i, part as NodePart, st.shapes);
  }
  const hit = shapeAt(st, c.raw, c.tol);
  if (!hit) {
    setState({ selection: [], nodeSel: [] });
    return marquee(c, []);
  }
  if (hit.kind !== 'path' && hit.kind !== 'line' && hit.kind !== 'text') {
    // nodes need real curves: convert the parametric shape first
    commit(st.shapes.map((s) => (s.id === hit.id ? toPath(hit) : s)), { selection: [hit.id] });
    setState({ nodeSel: [] });
    return;
  }
  setState({ selection: [hit.id], nodeSel: [] });
  const moving = [hit];
  return moveSession(c, moving, st.shapes);
}

function nodeDouble(c: PointerCtx) {
  const st = c.st;
  const target = st.shapes.find((s) => st.selection.includes(s.id) && (s.kind === 'path' || s.kind === 'line') && !s.locked);
  if (!target) return;
  const near = nearestOnPath(target.pts, target.closed, c.raw);
  if (!near || near.dist > c.tol * 2) return;
  commit(st.shapes.map((s) => (s.id === target.id ? { ...s, pts: insertNode(s.pts, s.closed, near.seg, near.t) } : s)));
}

function nodeDelete(): boolean {
  const st = getState();
  if (!st.nodeSel.length) return false;
  const byShape = new Map<string, number[]>();
  for (const n of st.nodeSel) byShape.set(n.id, [...(byShape.get(n.id) ?? []), n.i]);
  const removed = new Set<string>();
  const next = st.shapes.map((s) => {
    const idx = byShape.get(s.id);
    if (!idx) return s;
    const pts = deleteNodes(s.pts, idx);
    if (!pts) {
      removed.add(s.id);
      return s;
    }
    return { ...s, pts };
  });
  commit(next.filter((s) => !removed.has(s.id)));
  setState({ nodeSel: [] });
  return true;
}

export const nodeTool: ToolDef = {
  id: 'direct',
  label: 'Node',
  key: 'a',
  icon: toolIcon.direct,
  group: 'select',
  workspaces: ['vector', 'layout'],
  cursor: 'default',
  hint: '**Click** a shape to edit its nodes. **Drag** nodes and handles (**Alt** splits a handle). **Double-click** a segment to add a node, **Delete** removes the selected node.',
  chrome: 'nodes',
  down: nodeDown,
  dblclick: nodeDouble,
  onDelete: nodeDelete,
};

/* ---------- Corner tool ---------- */

function cornerDown(c: PointerCtx): Session | void {
  const st = c.st;
  const a = c.target.getAttribute?.('data-a');
  if (!a) {
    const hit = shapeAt(st, c.raw, c.tol);
    if (hit && hit.kind !== 'path' && hit.kind !== 'line' && hit.kind !== 'text') {
      commit(st.shapes.map((s) => (s.id === hit.id ? toPath(hit) : s)), { selection: [hit.id] });
    } else setState({ selection: hit ? [hit.id] : [], nodeSel: [] });
    return;
  }
  const [id, idx, part] = a.split(':');
  const i = Number(idx);
  if (part !== 'p') return nodeDrag(id, i, part as NodePart, st.shapes);
  const before = st.shapes;
  const node = before.find((s) => s.id === id)!.pts[i];
  let dragged = false;
  return {
    move(m) {
      if (!dragged && Math.hypot(m.p.x - node.x, m.p.y - node.y) < 4 / m.zoom) return;
      dragged = true;
      live(updatePts(id, (pts) => setSmoothHandle(pts, i, m.p.x - node.x, m.p.y - node.y)));
    },
    up() {
      if (dragged) return endLive(before);
      const shape = before.find((s) => s.id === id)!;
      commit(before.map((s) => (s.id === id ? { ...s, pts: toggleNode(s.pts, s.closed, i) } : s)));
      void shape;
    },
  };
}

export const cornerTool: ToolDef = {
  id: 'corner',
  label: 'Corner',
  key: 'c',
  icon: toolIcon.corner,
  group: 'select',
  workspaces: ['vector'],
  cursor: 'default',
  hint: '**Click** a node to switch it between sharp and smooth. **Drag** from a node to pull out smooth handles.',
  chrome: 'nodes',
  down: cornerDown,
};

export { hitTest };
