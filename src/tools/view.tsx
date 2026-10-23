import { getState, setState, zoomAt } from '../store';
import { toolIcon } from './icons';
import type { PointerCtx, Session, ToolDef } from './types';

export function panSession(c: PointerCtx): Session {
  const start = c.screen;
  const { panX, panY } = getState();
  return {
    move(m) {
      setState({ panX: panX + m.screen.x - start.x, panY: panY + m.screen.y - start.y });
    },
  };
}

export const handTool: ToolDef = {
  id: 'hand',
  label: 'Hand',
  key: 'h',
  icon: toolIcon.hand,
  group: 'view',
  workspaces: ['vector', 'pixel', 'layout', 'typography'],
  cursor: 'grab',
  hint: '**Drag** to pan. **Space** gives you the Hand from any tool; scroll to pan, **Ctrl+scroll** to zoom.',
  chrome: 'none',
  down: panSession,
};

export const zoomTool: ToolDef = {
  id: 'zoom',
  label: 'Zoom',
  key: 'z',
  icon: toolIcon.zoom,
  group: 'view',
  workspaces: ['vector', 'pixel', 'layout', 'typography'],
  cursor: 'zoom-in',
  hint: '**Click** to zoom in, **Alt-click** to zoom out. **Ctrl+scroll** zooms at the cursor.',
  chrome: 'none',
  down(c) {
    zoomAt(c.alt ? 1 / 1.5 : 1.5, c.screen.x, c.screen.y);
  },
};

export const measureTool: ToolDef = {
  id: 'measure',
  label: 'Measure',
  key: 'q',
  icon: toolIcon.measure,
  group: 'view',
  workspaces: ['vector', 'layout'],
  cursor: 'crosshair',
  hint: '**Drag** to measure distance and angle. Nothing is added to the document.',
  chrome: 'none',
  down(c) {
    const a = c.raw;
    return {
      move(m) {
        const dx = m.raw.x - a.x;
        const dy = m.raw.y - a.y;
        const len = Math.hypot(dx, dy);
        const ang = (Math.atan2(-dy, dx) * 180) / Math.PI;
        const k = 1 / m.zoom;
        m.setOverlay(
          <g pointerEvents="none">
            <line x1={a.x} y1={a.y} x2={m.raw.x} y2={m.raw.y} stroke="#ffd24a" strokeWidth={1.5 * k} />
            <circle cx={a.x} cy={a.y} r={3 * k} fill="#ffd24a" />
            <circle cx={m.raw.x} cy={m.raw.y} r={3 * k} fill="#ffd24a" />
            <g transform={`translate(${(a.x + m.raw.x) / 2 + 8 * k} ${(a.y + m.raw.y) / 2 - 8 * k}) scale(${k})`}>
              <rect x="-4" y="-13" width="150" height="19" rx="3" fill="#000" fillOpacity=".8" />
              <text fill="#ffd24a" fontSize="11" fontFamily="ui-monospace, Menlo, monospace">
                {len.toFixed(1)} px · {ang.toFixed(1)}°
              </text>
            </g>
          </g>,
        );
      },
    };
  },
};
