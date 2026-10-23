import { addSlice, commitDoc, getState, setState } from '../store';
import type { Slice } from '../types';
import { toolIcon } from './icons';
import type { PointerCtx, Session, ToolDef } from './types';

const hit = (slices: Slice[], x: number, y: number) => [...slices].reverse().find((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);

export const sliceTool: ToolDef = {
  id: 'slice',
  label: 'Slice',
  key: 'x',
  icon: toolIcon.slice,
  group: 'slice',
  workspaces: ['slice'],
  cursor: 'crosshair',
  hint: '**Drag** to define an export slice. **Click** a slice to select it, **Delete** removes it. Set format and scale in the Slices panel.',
  chrome: 'none',
  down(c: PointerCtx): Session | void {
    const existing = hit(c.st.slices, c.raw.x, c.raw.y);
    if (existing) {
      setState({ activeSlice: existing.id });
      const orig = existing;
      const start = c.p;
      return {
        move(m) {
          const dx = m.p.x - start.x;
          const dy = m.p.y - start.y;
          setState({ slices: m.st.slices.map((s) => (s.id === orig.id ? { ...s, x: Math.round(orig.x + dx), y: Math.round(orig.y + dy) } : s)) });
        },
        up(m) {
          const now = getState().slices;
          if (now.some((s) => s.id === orig.id && (s.x !== orig.x || s.y !== orig.y))) {
            setState({ slices: m.st.slices });
            commitDoc({ slices: now });
          }
        },
      };
    }
    const start = c.p;
    return {
      move(m) {
        const k = 1 / m.zoom;
        m.setOverlay(
          <rect x={Math.min(start.x, m.p.x)} y={Math.min(start.y, m.p.y)} width={Math.abs(m.p.x - start.x)} height={Math.abs(m.p.y - start.y)} fill="rgba(255,90,78,.12)" stroke="#ff5a4e" strokeWidth={1.5 * k} strokeDasharray={`${5 * k} ${3 * k}`} pointerEvents="none" />,
        );
      },
      up(m) {
        m.setOverlay(null);
        const w = Math.abs(m.p.x - start.x);
        const h = Math.abs(m.p.y - start.y);
        if (w >= 4 && h >= 4) addSlice({ x: Math.min(start.x, m.p.x), y: Math.min(start.y, m.p.y), w, h });
        else setState({ activeSlice: null });
      },
    };
  },
  onDelete() {
    const st = getState();
    if (!st.activeSlice) return false;
    commitDoc({ slices: st.slices.filter((s) => s.id !== st.activeSlice) });
    setState({ activeSlice: null });
    return true;
  },
};
