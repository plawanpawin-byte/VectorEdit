import { addArtboard, commitDoc, deleteArtboard, docOf, endLiveDoc, getState, liveDoc, setState, shapesOn } from '../store';
import { translate } from '../geometry';
import type { Artboard } from '../types';
import { toolIcon } from './icons';
import type { PointerCtx, Session, ToolDef } from './types';

const inside = (a: Artboard, x: number, y: number) => x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h;

function resize(handle: string, id: string, c: PointerCtx): Session {
  const before = docOf(c.st);
  const a0 = c.st.artboards.find((a) => a.id === id)!;
  return {
    move(m) {
      let { x, y, w, h } = a0;
      const px = m.p.x;
      const py = m.p.y;
      if (handle.includes('e')) w = Math.max(10, px - a0.x);
      if (handle.includes('s')) h = Math.max(10, py - a0.y);
      if (handle.includes('w')) {
        w = Math.max(10, a0.x + a0.w - px);
        x = a0.x + a0.w - w;
      }
      if (handle.includes('n')) {
        h = Math.max(10, a0.y + a0.h - py);
        y = a0.y + a0.h - h;
      }
      liveDoc({ artboards: m.st.artboards.map((a) => (a.id === id ? { ...a, x, y, w: Math.round(w), h: Math.round(h) } : a)) });
    },
    up() {
      endLiveDoc(before);
    },
  };
}

function moveBoard(id: string, c: PointerCtx): Session {
  const before = docOf(c.st);
  const a0 = c.st.artboards.find((a) => a.id === id)!;
  const content = new Map(shapesOn(a0, c.st.shapes).map((s) => [s.id, s]));
  const start = c.p;
  return {
    move(m) {
      const dx = m.p.x - start.x;
      const dy = m.p.y - start.y;
      liveDoc({
        artboards: m.st.artboards.map((a) => (a.id === id ? { ...a, x: a0.x + dx, y: a0.y + dy } : a)),
        shapes: m.st.shapes.map((s) => (content.has(s.id) ? translate(content.get(s.id)!, dx, dy) : s)),
      });
    },
    up() {
      endLiveDoc(before);
    },
  };
}

function createBoard(c: PointerCtx): Session {
  const before = docOf(c.st);
  const start = c.p;
  const id = `a${Date.now().toString(36)}n`;
  return {
    move(m) {
      const x = Math.min(start.x, m.p.x);
      const y = Math.min(start.y, m.p.y);
      const w = Math.abs(m.p.x - start.x);
      const h = Math.abs(m.p.y - start.y);
      if (w < 4 && h < 4) return;
      const board: Artboard = { id, name: `Page ${before.artboards.length + 1}`, x, y, w: Math.round(w), h: Math.round(h) };
      liveDoc({ artboards: [...before.artboards, board] });
      setState({ activeArtboard: id });
    },
    up(m) {
      const made = getState().artboards.find((a) => a.id === id);
      if (made && made.w >= 20 && made.h >= 20) endLiveDoc(before);
      else liveDoc({ artboards: before.artboards });
      void m;
    },
  };
}

export const artboardTool: ToolDef = {
  id: 'artboard',
  label: 'Artboard',
  key: 'o',
  icon: toolIcon.artboard,
  group: 'artboard',
  workspaces: ['vector', 'layout'],
  cursor: 'crosshair',
  hint: '**Drag** on empty canvas to add a page. **Drag** a page to move it with its content, drag its handles to resize. **Delete** removes the page.',
  chrome: 'artboard',
  down(c) {
    const handle = c.target.getAttribute?.('data-ab');
    if (handle) return resize(handle, c.st.activeArtboard, c);
    const hit = [...c.st.artboards].reverse().find((a) => inside(a, c.raw.x, c.raw.y));
    if (hit) {
      setState({ activeArtboard: hit.id });
      return moveBoard(hit.id, c);
    }
    return createBoard(c);
  },
  onDelete() {
    const st = getState();
    if (st.artboards.length < 2) return true; // never delete the last page
    deleteArtboard(st.activeArtboard);
    return true;
  },
};

export { addArtboard, commitDoc };
