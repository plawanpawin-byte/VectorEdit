import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  arrange,
  deleteSelected,
  duplicateSelected,
  fitArtboard,
  getState,
  groupSelected,
  confirmDiscard,
  isDirty,
  newDocument,
  openNewDocument,
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
  leaveStartPage,
  zoomAt,
  zoomTo,
} from './store';
import { Canvas } from './components/Canvas';
import { ContextBar } from './components/ContextBar';
import { I } from './components/Icons';
import { Appearance, ColorPanel, History, Layers, Navigator, SnapshotsPanel, StrokePanel, Swatches, TransformPanel } from './components/Panels';
import { TopBar, doExport } from './components/TopBar';
import { AssetsPanel, PagesPanel } from './components/PagesPanel';
import { LibraryPanel } from './components/LibraryPanel';
import { DataPanel } from './components/DataPanel';
import { ScriptPanel } from './components/ScriptPanel';
import { SlicesPanel } from './components/SlicesPanel';
import { MacroPanel } from './components/PixelPanels';
import { ScopesPanel } from './components/ScopesPanel';
import { AdjustmentsPanel, BrushPanel, FiltersPanel, RasterDialog, SelectionPanel } from './components/PixelPanels';
import { CharacterPanel, ParagraphPanel, TextStylesPanel } from './components/TextPanels';
import { isDesktop, openDoc, openDocText, saveDoc } from './fileio';
import { RulerH, RulerV, RULER } from './components/Rulers';
import { StatusBar } from './components/StatusBar';
import { MenuBar } from './components/MenuBar';
import { FloatingTools } from './components/FloatingTools';
import { NewDocument } from './components/NewDocument';
import { StartPage } from './components/StartPage';
import { importFiles, importFilesDialog, kindOf, looksLikeSvg, reportImport } from './importer';
import { PathBrushesPanel, QuickFxPanel, StylesPanel } from './components/StylePanels';
import { Toolbar } from './components/Toolbar';

import { TOOLS, activateTool, isPixelWorkspace, toolDef, toolInWorkspace } from './tools/registry';
import type { Workspace } from './types';
import { deselect, invertSelection, selectAll as selectAllPixels } from './raster/selection';
import { targetLayer } from './raster/layer';

const keyMap = (ws: Workspace) => new Map(TOOLS.filter((t) => t.key && t.workspaces.includes(ws)).map((t) => [t.key!, t.id]));

function usePasteImages() {
  useEffect(() => {
    const editable = (t: EventTarget | null) => /INPUT|TEXTAREA|SELECT/.test((t as HTMLElement)?.tagName) || !!(t as HTMLElement)?.isContentEditable;
    const onPaste = (e: ClipboardEvent) => {
      if (editable(e.target)) return;
      const data = e.clipboardData;
      if (!data) return;
      // files, plus pictures that only arrive as clipboard items (screenshots, "copy image")
      const files = Array.from(data.files).filter((f) => kindOf(f.name, f.type) !== 'other');
      for (const item of Array.from(data.items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f && !files.some((x) => x.size === f.size && x.type === f.type)) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        leaveStartPage();
        void importFiles(files).then(reportImport);
        return;
      }
      const text = data.getData('text/plain');
      if (text && looksLikeSvg(text)) {
        e.preventDefault();
        leaveStartPage();
        void importFiles([new File([text], 'Pasted.svg', { type: 'image/svg+xml' })]).then(reportImport);
      }
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    };
    const onDrop = (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (!files.length) return;
      e.preventDefault();
      const docs = files.filter((f) => f.name.toLowerCase().endsWith('.vedit'));
      const images = files.filter((f) => kindOf(f.name, f.type) !== 'other');
      if (docs.length && !images.length) {
        void docs[0].text().then((t) => {
          if (confirmDiscard()) void openDocText(t);
        });
        return;
      }
      if (!images.length) return alert('Drop PNG, JPG, GIF, WebP, BMP or SVG files, or a .vedit document.');
      const st = getState();
      const canvas = document.querySelector('.canvas')?.getBoundingClientRect();
      const at = canvas && e.clientX >= canvas.left && e.clientX <= canvas.right && e.clientY >= canvas.top && e.clientY <= canvas.bottom
        ? { x: (e.clientX - canvas.left - st.panX) / st.zoom, y: (e.clientY - canvas.top - st.panY) / st.zoom }
        : undefined;
      leaveStartPage();
      void importFiles(images, at).then(reportImport);
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (isDirty()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('paste', onPaste);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    window.addEventListener('beforeunload', onUnload);
    (window as unknown as { __veDirty?: () => boolean }).__veDirty = isDirty;
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('beforeunload', onUnload);
    };
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
          n: openNewDocument,
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

/** Tabs that do not fit the dock's width move into a ⋯ menu instead of being clipped. */
function useFittingTabs(labels: string[]) {
  const bar = useRef<HTMLDivElement>(null);
  const widths = useRef(new Map<string, number>());
  const [count, setCount] = useState(labels.length);
  const fit = () => {
    const el = bar.current;
    if (!el) return;
    const avail = el.clientWidth - 30; // room for the collapse button and the ⋯ menu
    const more = 26;
    let used = 0;
    let k = 0;
    for (const label of labels) {
      const w = widths.current.get(label) ?? label.length * 6.6 + 12;
      if (used + w > avail - (k < labels.length - 1 ? more : 0)) break;
      used += w;
      k++;
    }
    setCount(Math.max(1, k));
  };
  useLayoutEffect(() => {
    bar.current?.querySelectorAll<HTMLButtonElement>('button[data-tab]').forEach((b) => widths.current.set(b.dataset.tab!, b.offsetWidth));
    fit();
  });
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels.join('|')]);
  return { bar, count };
}

function Dock({ tabs, grow }: { tabs: { id: string; label: string; body: React.ReactNode }[]; grow?: number }) {
  const [chosen, setActive] = useState(tabs[0].id);
  // the chosen tab may vanish when the workspace changes
  const current = tabs.find((t) => t.id === chosen) ?? tabs[0];
  const active = current.id;
  const [open, setOpen] = useState(true);
  const [menu, setMenu] = useState(false);
  const { bar, count } = useFittingTabs(tabs.map((t) => t.label));
  const shown = tabs.slice(0, count);
  const hidden = tabs.slice(count);
  return (
    <div className={'dock-group' + (open ? '' : ' closed')} style={{ flexGrow: open ? grow ?? 1 : 0 }}>
      <div className="dock-tabs" ref={bar}>
        {shown.map((t) => (
          <button key={t.id} data-tab={t.label} className={active === t.id && open ? 'on' : ''} onClick={() => (setActive(t.id), setOpen(true))}>
            {t.label}
          </button>
        ))}
        {hidden.length > 0 && (
          <div className="pop">
            <button className={'ibtn tabmore' + (menu ? ' on' : '')} title="More panels" onClick={() => setMenu(!menu)}>
              ⋯
            </button>
            {menu && (
              <div className="pop-panel menu-list" onMouseLeave={() => setMenu(false)}>
                {hidden.map((t) => (
                  <button key={t.id} onClick={() => (setActive(t.id), setOpen(true), setMenu(false))}>
                    <span className="chk">{active === t.id ? '✓' : ''}</span>
                    <span>{t.label}</span>
                    <span className="sc" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
    // a document the app was launched with (double-clicked in the file manager)
    void d.takePendingFile().then((f) => {
      if (f) {
        setState({ newDocOpen: false });
        void openDocText(f.text, f.path);
      }
    });
    const offFile = d.onOpenFile((f) => {
      if (confirmDiscard()) void openDocText(f.text, f.path);
    });
    const offMenu = d.onMenu((c) => {
      if (c === 'new') openNewDocument();
      else if (c === 'import') void importFilesDialog();
      else if (c === 'open') void openDoc();
      else if (c === 'save') void saveDoc(false);
      else if (c === 'save-as') void saveDoc(true);
      else if (c === 'export-svg') doExport('svg');
      else if (c === 'export-png') doExport('png');
    });
    return () => (offFile(), offMenu());
  }, []);
  useEffect(() => {
    const name = filePath ? filePath.split(/[\\/]/).pop() : 'Untitled';
    window.desktop?.setTitle(`${name} - lunaticDesign`);
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
      <MenuBar onHelp={() => setHelp(true)} />
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
            <button className="ibtn" title="Close document" onClick={() => confirmDiscard() && newDocument()}>{I.close}</button>
          </div>
          <div className="canvas-wrap" style={{ ['--ruler' as string]: rulers ? `${RULER}px` : '0px' }}>
            <FloatingTools />
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
                    ...(workspace === 'colour' ? [{ id: 'library', label: 'Library', body: <LibraryPanel /> }] : []),
                    { id: 'macros', label: 'Macros', body: <MacroPanel /> },
                    { id: 'scopes', label: 'Scopes', body: <ScopesPanel /> },
                    ...(workspace === 'retouching' ? [{ id: 'snapshots', label: 'Snapshots', body: <div className="panel-body pad"><SnapshotsPanel /></div> }] : []),
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
              ...(workspace === 'vector'
                ? [
                    { id: 'pathbrushes', label: 'Path Brushes', body: <PathBrushesPanel /> },
                    { id: 'quickfx', label: 'Quick FX', body: <QuickFxPanel /> },
                    { id: 'vstyles', label: 'Styles', body: <StylesPanel /> },
                  ]
                : []),
            ]}
          />
          <Dock
            grow={0.8}
            tabs={[
              { id: 'transform', label: 'Transform', body: <TransformPanel /> },
              { id: 'navigator', label: 'Navigator', body: <Navigator /> },
              { id: 'history', label: 'History', body: <History /> },
              ...(workspace === 'vector' ? [{ id: 'pages', label: 'Pages', body: <PagesPanel /> }, { id: 'assets', label: 'Assets', body: <AssetsPanel /> }] : []),
            ]}
          />
        </aside>
      </div>
      <StatusBar />
      <RasterDialog />
      <NewDocument />
      <StartPage />
      {help && <Help onClose={() => setHelp(false)} />}
    </div>
  );
}
