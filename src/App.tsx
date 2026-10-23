import { useEffect, useState } from 'react';
import type { Tool } from './types';
import {
  arrange,
  deleteSelected,
  duplicateSelected,
  fitArtboard,
  getState,
  newDocument,
  penCancel,
  penFinish,
  redo,
  resetColors,
  setState,
  setTool,
  swapColors,
  undo,
  updateSelected,
  useStore,
  zoomAt,
  zoomTo,
} from './store';
import { Canvas } from './components/Canvas';
import { MenuBar } from './components/MenuBar';
import { OptionsBar } from './components/OptionsBar';
import { ColorPanel, Layers, Properties, Swatches } from './components/Panels';
import { RulerH, RulerV, RULER } from './components/Rulers';
import { StatusBar } from './components/StatusBar';
import { Toolbar } from './components/Toolbar';

const TOOL_KEYS: Record<string, Tool> = {
  v: 'select',
  a: 'direct',
  p: 'pen',
  m: 'rect',
  l: 'ellipse',
  '\\': 'line',
  t: 'text',
  h: 'hand',
  z: 'zoom',
};

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const st = getState();

      if (mod) {
        const map: Record<string, () => void> = {
          z: () => (e.shiftKey ? redo() : undo()),
          y: redo,
          d: duplicateSelected,
          a: () => setState({ selection: e.shiftKey ? [] : st.shapes.filter((s) => s.visible && !s.locked).map((s) => s.id) }),
          '0': fitArtboard,
          '1': () => zoomTo(1),
          '=': () => zoomAt(1.25, st.viewport.w / 2, st.viewport.h / 2),
          '+': () => zoomAt(1.25, st.viewport.w / 2, st.viewport.h / 2),
          '-': () => zoomAt(0.8, st.viewport.w / 2, st.viewport.h / 2),
          r: () => setState({ rulers: !st.rulers }),
          "'": () => setState({ grid: !st.grid }),
          ']': () => arrange(e.shiftKey ? 'front' : 'forward'),
          '[': () => arrange(e.shiftKey ? 'back' : 'backward'),
          n: newDocument,
        };
        const fn = map[key];
        if (fn) {
          e.preventDefault();
          fn();
        }
        return;
      }

      if (e.key === 'Enter' && st.pen) return penFinish(false);
      if (e.key === 'Escape') {
        if (st.pen) penCancel();
        else setState({ selection: [] });
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        return deleteSelected();
      }
      if (e.key.startsWith('Arrow') && st.selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        updateSelected(
          (s) => ({
            ...s,
            x: s.x + dx,
            y: s.y + dy,
            pts: s.pts.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
          }),
          'nudge',
        );
        return;
      }
      if (key === 'x' && e.shiftKey) return swapColors();
      if (key === 'x') return setState({ colorTarget: st.colorTarget === 'fill' ? 'stroke' : 'fill' });
      if (key === 'd') return resetColors();
      const tool = TOOL_KEYS[key];
      if (tool) setTool(tool);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function Dock({ tabs }: { tabs: { id: string; label: string; body: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0].id);
  return (
    <div className="dock-group">
      <div className="dock-tabs">
        {tabs.map((t) => (
          <button key={t.id} className={active === t.id ? 'on' : ''} onClick={() => setActive(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="dock-body">{tabs.find((t) => t.id === active)!.body}</div>
    </div>
  );
}

export function App() {
  useShortcuts();
  const rulers = useStore((s) => s.rulers);
  const zoom = useStore((s) => s.zoom);

  return (
    <div className="app">
      <MenuBar />
      <OptionsBar />
      <div className="workspace-row">
        <Toolbar />
        <main className="stage">
          <div className="doc-tabs">
            <div className="doc-tab">
              <span>Untitled-1 @ {Math.round(zoom * 100)}% (RGB/Preview)</span>
            </div>
          </div>
          <div className="canvas-wrap" style={{ ['--ruler' as string]: rulers ? `${RULER}px` : '0px' }}>
            {rulers && (
              <>
                <div className="corner" />
                <RulerH />
                <RulerV />
              </>
            )}
            <Canvas />
          </div>
        </main>
        <aside className="dock">
          <Dock
            tabs={[
              { id: 'props', label: 'Properties', body: <Properties /> },
              { id: 'color', label: 'Color', body: <ColorPanel /> },
              { id: 'swatches', label: 'Swatches', body: <Swatches /> },
            ]}
          />
          <Dock tabs={[{ id: 'layers', label: 'Layers', body: <Layers /> }]} />
        </aside>
      </div>
      <StatusBar />
    </div>
  );
}
