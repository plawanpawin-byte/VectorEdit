import { useEffect, useState } from 'react';
import {
  arrange,
  deleteSelected,
  duplicateSelected,
  fitArtboard,
  getState,
  groupSelected,
  newDocument,
  penCancel,
  penFinish,
  redo,
  resetColors,
  setState,
  swapColors,
  ungroupSelected,
  undo,
  updateSelected,
  useStore,
  zoomAt,
  zoomTo,
} from './store';
import { Canvas } from './components/Canvas';
import { ContextBar } from './components/ContextBar';
import { I } from './components/Icons';
import { Appearance, ColorPanel, History, Layers, Navigator, StrokePanel, Swatches, TransformPanel } from './components/Panels';
import { TopBar, doExport } from './components/TopBar';
import { AssetsPanel, PagesPanel } from './components/PagesPanel';
import { DataPanel } from './components/DataPanel';
import { ScriptPanel } from './components/ScriptPanel';
import { SlicesPanel } from './components/SlicesPanel';
import { MacroPanel } from './components/PixelPanels';
import { ScopesPanel } from './components/ScopesPanel';
import { AdjustmentsPanel, BrushPanel, FiltersPanel, RasterDialog, SelectionPanel } from './components/PixelPanels';
import { CharacterPanel, ParagraphPanel, TextStylesPanel } from './components/TextPanels';
import { isDesktop, openDoc, saveDoc } from './fileio';
import { placeFiles } from './images';
import { RulerH, RulerV, RULER } from './components/Rulers';
import { StatusBar } from './components/StatusBar';
import { Toolbar } from './components/Toolbar';

import { TOOLS, activateTool, isPixelWorkspace, toolDef, toolInWorkspace } from './tools/registry';
import type { Workspace } from './types';
import { deselect, invertSelection, selectAll as selectAllPixels } from './raster/selection';
import { targetLayer } from './raster/layer';

const keyMap = (ws: Workspace) => new Map(TOOLS.filter((t) => t.key && t.workspaces.includes(ws)).map((t) => [t.key!, t.id]));

function usePasteImages() {
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (/INPUT|TEXTAREA/.test((e.target as HTMLElement)?.tagName)) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      e.preventDefault();
      void placeFiles(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);
}

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
          a: () => {
            if (isPixelWorkspace(st.workspace)) {
              const l = targetLayer();
              if (!l) return;
              return e.shiftKey ? deselect() : selectAllPixels(l);
            }
            setState({ selection: e.shiftKey ? [] : st.shapes.filter((s) => s.visible && !s.locked).map((s) => s.id) });
          },
          i: () => {
            const l = targetLayer();
            if (isPixelWorkspace(st.workspace) && l) invertSelection(l);
          },
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
          g: () => (e.shiftKey ? ungroupSelected() : groupSelected()),
          ...(isDesktop() ? {} : { s: () => saveDoc(e.shiftKey), o: openDoc }),
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
        if (toolDef(st.tool)?.onDelete?.()) return;
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
      if (isPixelWorkspace(st.workspace) && (key === '[' || key === ']')) {
        const k = key === ']' ? 1.25 : 0.8;
        return setState({ pbrush: { ...st.pbrush, size: Math.max(1, Math.min(1000, Math.round(st.pbrush.size * k))) } });
      }
      const tool = keyMap(st.workspace).get(key);
      if (tool && toolInWorkspace(tool, st.workspace)) activateTool(tool);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

const SHORTCUTS: [string, string][] = [
  ...TOOLS.filter((t) => t.key).map((t): [string, string] => [t.key!.toUpperCase(), t.label]),
  ['Space', 'Hand (hold)'],
  ['Ctrl+Z / Ctrl+Shift+Z', 'Undo / Redo'],
  ['Ctrl+D', 'Duplicate'],
  ['Ctrl+G / Ctrl+Shift+G', 'Group / Ungroup'],
  ['Ctrl+] / Ctrl+[', 'Forward / Backward'],
  ['Ctrl+0 / Ctrl+1', 'Fit / 100%'],
  ['X / Shift+X / D', 'Fill-stroke target / Swap / Defaults'],
  ['Arrows', 'Nudge (Shift = 10 px)'],
  ['Right-click / hold a tool', 'Open its group'],
];

function Help({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <span>Keyboard Shortcuts</span>
          <button className="ibtn" onClick={onClose}>{I.close}</button>
        </header>
        <dl>
          {SHORTCUTS.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function Dock({ tabs, grow }: { tabs: { id: string; label: string; body: React.ReactNode }[]; grow?: number }) {
  const [chosen, setActive] = useState(tabs[0].id);
  // the chosen tab may vanish when the workspace changes
  const current = tabs.find((t) => t.id === chosen) ?? tabs[0];
  const active = current.id;
  const [open, setOpen] = useState(true);
  return (
    <div className={'dock-group' + (open ? '' : ' closed')} style={{ flexGrow: open ? grow ?? 1 : 0 }}>
      <div className="dock-tabs">
        {tabs.map((t) => (
          <button key={t.id} className={active === t.id && open ? 'on' : ''} onClick={() => (setActive(t.id), setOpen(true))}>
            {t.label}
          </button>
        ))}
        <div className="grow" />
        <button className="collapse" title={open ? 'Collapse' : 'Expand'} onClick={() => setOpen(!open)}>
          <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.3" style={{ transform: open ? undefined : 'rotate(-90deg)' }}>
            <rect x="1" y="1" width="10" height="10" rx="2" />
            <path d="M3.5 5l2.5 2.5L8.5 5" />
          </svg>
        </button>
      </div>
      {open && <div className="dock-body">{current.body}</div>}
    </div>
  );
}

function useDesktopBridge() {
  const filePath = useStore((s) => s.filePath);
  useEffect(() => {
    const d = window.desktop;
    if (!d) return;
    return d.onMenu((c) => {
      if (c === 'new') newDocument();
      else if (c === 'open') void openDoc();
      else if (c === 'save') void saveDoc(false);
      else if (c === 'save-as') void saveDoc(true);
      else if (c === 'export-svg') doExport('svg');
      else if (c === 'export-png') doExport('png');
    });
  }, []);
  useEffect(() => {
    const name = filePath ? filePath.split(/[\\/]/).pop() : 'Untitled';
    window.desktop?.setTitle(`${name} - VectorEdit`);
  }, [filePath]);
}

export function App() {
  useShortcuts();
  usePasteImages();
  useDesktopBridge();
  const rulers = useStore((s) => s.rulers);
  const zoom = useStore((s) => s.zoom);
  const filePath = useStore((s) => s.filePath);
  const workspace = useStore((s) => s.workspace);
  const [help, setHelp] = useState(false);

  return (
    <div className="app">
      <TopBar onHelp={() => setHelp(true)} />
      <ContextBar />
      <div className={'workspace-row' + (workspace === 'layout' ? ' with-left' : '')}>
        <Toolbar />
        {workspace === 'layout' && (
          <aside className="leftdock">
            <Dock
              key="left"
              tabs={[
                { id: 'pages', label: 'Pages', body: <PagesPanel /> },
                { id: 'assets', label: 'Assets', body: <AssetsPanel /> },
              ]}
            />
          </aside>
        )}
        <main className="stage">
          <div className="doc-tabs">
            <div className="doc-tab">
              <span>{filePath ? filePath.split(/[\\/]/).pop() : '<Untitled>'} @ {Math.round(zoom * 100)}%</span>
            </div>
            <div className="grow" />
            <button className="ibtn" title="Close document" onClick={newDocument}>{I.close}</button>
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
            grow={1.6}
            tabs={[
              { id: 'color', label: 'Color', body: <ColorPanel /> },
              { id: 'swatches', label: 'Swatches', body: <Swatches /> },
              ...(isPixelWorkspace(workspace)
                ? [
                    { id: 'brushes', label: 'Brushes', body: <BrushPanel /> },
                    { id: 'adjust', label: 'Adjust', body: <AdjustmentsPanel /> },
                    { id: 'filters', label: 'Filters', body: <FiltersPanel /> },
                    { id: 'selection', label: 'Selection', body: <SelectionPanel /> },
                    { id: 'macros', label: 'Macros', body: <MacroPanel /> },
                    { id: 'scopes', label: 'Scopes', body: <ScopesPanel /> },
                  ]
                : [
                    { id: 'stroke', label: 'Stroke', body: <StrokePanel /> },
                    { id: 'appearance', label: 'Appearance', body: <Appearance /> },
                  ]),
            ]}
          />
          <Dock
            grow={1.2}
            tabs={[
              ...(workspace === 'layout' || workspace === 'typography' ? [{ id: 'data', label: 'Data', body: <DataPanel /> }] : []),
              ...(workspace === 'scripting' ? [{ id: 'script', label: 'Script', body: <ScriptPanel /> }] : []),
              ...(workspace === 'slice' ? [{ id: 'slices', label: 'Slices', body: <SlicesPanel /> }] : []),
              { id: 'layers', label: 'Layers', body: <Layers /> },
              ...(workspace !== 'vector'
                ? [
                    { id: 'char', label: 'Character', body: <CharacterPanel /> },
                    { id: 'para', label: 'Paragraph', body: <ParagraphPanel /> },
                    { id: 'styles', label: 'Styles', body: <TextStylesPanel /> },
                  ]
                : []),
              ...(workspace === 'vector' ? [{ id: 'pages', label: 'Pages', body: <PagesPanel /> }, { id: 'assets', label: 'Assets', body: <AssetsPanel /> }] : []),
            ]}
          />
          <Dock
            grow={0.8}
            tabs={[
              { id: 'transform', label: 'Transform', body: <TransformPanel /> },
              { id: 'navigator', label: 'Navigator', body: <Navigator /> },
              { id: 'history', label: 'History', body: <History /> },
            ]}
          />
        </aside>
      </div>
      <StatusBar />
      <RasterDialog />
      {help && <Help onClose={() => setHelp(false)} />}
    </div>
  );
}
