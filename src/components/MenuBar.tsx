import { useEffect, useRef, useState } from 'react';
import { WORKSPACES, setWorkspace } from '../tools/registry';
import {
  activeBoard,
  addArtboard,
  arrange,
  booleanOp,
  convertToCurves,
  deleteSelected,
  duplicateArtboard,
  duplicateSelected,
  expandStroke,
  fitArtboard,
  flip,
  getState,
  groupSelected,
  openAgents,
  openNewDocument,
  redo,
  rotateSelection,
  selectAll,
  setState,
  undo,
  ungroupSelected,
  updateSelected,
  useStore,
  zoomAt,
  zoomTo,
} from '../store';
import { openDoc, saveDoc } from '../fileio';
import { importFilesDialog } from '../importer';
import { openRasterOp } from '../raster/dialog';
import { RASTER_OPS } from '../raster/ops';
import { mergeDown, rasteriseSelection } from '../raster/rasterise';
import { targetLayer } from '../raster/layer';
import { deselect, featherSelection, growSelection, invertSelection, selectAll as selectAllPixels, smoothSelection } from '../raster/selection';
import { divideSelected, joinSelected, reverseSelected, separateSelected, setAll, smoothSelected } from '../objectcmds';
import { doExport, runPdf } from './TopBar';
import { THEMES, setTheme } from '../theme';

interface Item {
  label: string;
  shortcut?: string;
  action?: () => void;
  head?: boolean;
  checked?: boolean;
}

const zoomBy = (f: number) => {
  const { viewport } = getState();
  zoomAt(f, viewport.w / 2, viewport.h / 2);
};
const onLayer = (f: (layer: NonNullable<ReturnType<typeof targetLayer>>) => void) => () => {
  const layer = targetLayer();
  if (layer) f(layer);
};
const opItems = (kind: 'adjust' | 'filter'): Item[] => {
  const ops = RASTER_OPS.filter((o) => o.kind === kind);
  return Array.from(new Set(ops.map((o) => o.category))).flatMap((cat) => [
    { label: cat, head: true },
    ...ops.filter((o) => o.category === cat).map((o) => ({ label: o.name + (o.params.length ? '…' : ''), action: () => void openRasterOp(o.id) })),
  ]);
};

/** Desktop-style menu bar (File, Edit, Document…) drawn in the page so it looks the same in the browser and in Electron. */
export function MenuBar({ onHelp }: { onHelp: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);
  const rulers = useStore((s) => s.rulers);
  const grid = useStore((s) => s.grid);
  const snap = useStore((s) => s.snap);
  const workspace = useStore((s) => s.workspace);
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(null);
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('mousedown', h);
    window.addEventListener('keydown', k);
    return () => (window.removeEventListener('mousedown', h), window.removeEventListener('keydown', k));
  }, [open]);

  const menus: [string, Item[]][] = [
    ['File', [
      { label: 'New…', shortcut: 'Ctrl+N', action: openNewDocument },
      { label: 'Open…', shortcut: 'Ctrl+O', action: () => void openDoc() },
      { label: 'Import images or SVG…', action: () => void importFilesDialog() },
      { label: 'Save', shortcut: 'Ctrl+S', action: () => void saveDoc(false) },
      { label: 'Save As…', shortcut: 'Shift+Ctrl+S', action: () => void saveDoc(true) },
      { label: 'Export', head: true },
      { label: 'Page as PNG…', action: () => doExport('png') },
      { label: 'Page as SVG…', action: () => doExport('svg') },
      { label: 'Page as PDF…', action: () => void runPdf([activeBoard()], activeBoard().name) },
      { label: 'All pages as PNG…', action: () => doExport('png', true) },
      { label: 'All pages as SVG…', action: () => doExport('svg', true) },
      { label: 'All pages as PDF…', action: () => void runPdf(getState().artboards, 'document') },
    ]],
    ['Edit', [
      { label: 'Undo', shortcut: 'Ctrl+Z', action: undo },
      { label: 'Redo', shortcut: 'Shift+Ctrl+Z', action: redo },
      { label: 'Duplicate', shortcut: 'Ctrl+D', action: duplicateSelected },
      { label: 'Delete', shortcut: 'Del', action: deleteSelected },
      { label: 'Select All', shortcut: 'Ctrl+A', action: selectAll },
      { label: 'Deselect', shortcut: 'Esc', action: () => setState({ selection: [] }) },
    ]],
    ['Document', [
      { label: 'Add Page', action: () => addArtboard() },
      { label: 'Duplicate Page', action: () => duplicateArtboard(activeBoard().id) },
      { label: 'Snapping', checked: snap, action: () => setState({ snap: !snap }) },
    ]],
    ['Text', [
      { label: 'Show Typography Studio', action: () => setWorkspace('typography') },
      { label: 'Convert to Curves', shortcut: 'Ctrl+Enter', action: convertToCurves },
    ]],
    ['Vector', [
      { label: 'Convert to Curves', action: convertToCurves },
      { label: 'Expand Stroke', action: () => void expandStroke() },
      { label: 'Reverse Curve', action: reverseSelected },
      { label: 'Join Curves', action: joinSelected },
      { label: 'Smooth Curves', action: smoothSelected },
      { label: 'Separate Curves', action: separateSelected },
      { label: 'Geometry', head: true },
      { label: 'Add', action: () => booleanOp('union') },
      { label: 'Subtract', action: () => booleanOp('subtract') },
      { label: 'Intersect', action: () => booleanOp('intersect') },
      { label: 'Xor', action: () => booleanOp('xor') },
      { label: 'Divide', action: divideSelected },
    ]],
    ['Pixel', [
      { label: 'Rasterise', action: () => void rasteriseSelection() },
      { label: 'Merge Down', action: () => void mergeDown() },
      { label: 'Selection', head: true },
      { label: 'Select All', action: onLayer(selectAllPixels) },
      { label: 'Deselect', action: () => deselect() },
      { label: 'Invert', action: onLayer(invertSelection) },
      { label: 'Grow 4 px', action: onLayer((l) => growSelection(l, 4)) },
      { label: 'Shrink 4 px', action: onLayer((l) => growSelection(l, -4)) },
      { label: 'Feather 8 px', action: onLayer((l) => featherSelection(l, 8)) },
      { label: 'Smooth', action: onLayer((l) => smoothSelection(l, 5)) },
      { label: 'Filters', head: true },
      ...opItems('filter'),
    ]],
    ['Layer', [
      { label: 'Group', shortcut: 'Ctrl+G', action: groupSelected },
      { label: 'Ungroup', shortcut: 'Shift+Ctrl+G', action: ungroupSelected },
      { label: 'Arrange', head: true },
      { label: 'Move to Front', action: () => arrange('front') },
      { label: 'Move Forward', action: () => arrange('forward') },
      { label: 'Move Back', action: () => arrange('backward') },
      { label: 'Move to Back', action: () => arrange('back') },
      { label: 'Transform', head: true },
      { label: 'Flip Horizontal', action: () => flip('h') },
      { label: 'Flip Vertical', action: () => flip('v') },
      { label: 'Rotate Clockwise', action: () => rotateSelection(90) },
      { label: 'Rotate Anticlockwise', action: () => rotateSelection(-90) },
      { label: 'Visibility', head: true },
      { label: 'Lock', action: () => (updateSelected((s) => ({ ...s, locked: true })), setState({ selection: [] })) },
      { label: 'Unlock All', action: () => setAll('locked', false) },
      { label: 'Hide', action: () => (updateSelected((s) => ({ ...s, visible: false })), setState({ selection: [] })) },
      { label: 'Show All', action: () => setAll('visible', true) },
      { label: 'New Adjustment', head: true },
      ...opItems('adjust'),
    ]],
    ['View', [
      { label: 'Zoom In', shortcut: 'Ctrl++', action: () => zoomBy(1.25) },
      { label: 'Zoom Out', shortcut: 'Ctrl+-', action: () => zoomBy(0.8) },
      { label: 'Zoom to Fit', shortcut: 'Ctrl+0', action: () => fitArtboard() },
      { label: 'Actual Size', shortcut: 'Ctrl+1', action: () => zoomTo(1) },
      { label: 'Show Rulers', shortcut: 'Ctrl+R', checked: rulers, action: () => setState({ rulers: !rulers }) },
      { label: 'Show Grid', checked: grid, action: () => setState({ grid: !grid }) },
    ]],
    ['Window', [
      { label: 'Studios', head: true },
      ...WORKSPACES.map((w) => ({ label: w.label, checked: workspace === w.id, action: () => setWorkspace(w.id) })),
      { label: 'Theme', head: true },
      ...THEMES.map((t) => ({ label: t.label, checked: theme === t.id, action: () => setTheme(t.id) })),
      { label: 'AI agents', head: true },
      { label: 'Connect AI agents…', action: openAgents },
    ]],
    ['Help', [
      { label: 'Keyboard Shortcuts', shortcut: 'F1', action: onHelp },
      { label: 'Project on GitHub', action: () => void window.open('https://github.com/plawanpawin-byte/VectorEdit', '_blank') },
    ]],
  ];

  return (
    <nav className="menubar" ref={ref}>
      {menus.map(([name, items]) => (
        <div key={name} className="menubar-item">
          <button
            className={open === name ? 'on' : ''}
            onMouseDown={(e) => (e.preventDefault(), setOpen(open === name ? null : name))}
            onMouseEnter={() => open && setOpen(name)}
          >
            {name}
          </button>
          {open === name && (
            <div className="pop-panel menu-list">
              {items.map((it, i) =>
                it.head ? (
                  <div key={i} className="menu-head">{it.label}</div>
                ) : (
                  <button key={i} onClick={() => (setOpen(null), it.action?.())}>
                    <span className="chk">{it.checked ? '✓' : ''}</span>
                    <span>{it.label}</span>
                    <span className="sc">{it.shortcut}</span>
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
