import { useEffect, useRef, useState } from 'react';
import type { Mode } from '../types';
import {
  align,
  arrange,
  deleteSelected,
  duplicateSelected,
  fitArtboard,
  flip,
  getState,
  newDocument,
  redo,
  selectAll,
  setMode,
  setState,
  undo,
  updateSelected,
  useStore,
  zoomAt,
  zoomTo,
} from '../store';
import { exportPng, exportSvg } from './exporter';
import { I, Logo } from './Icons';

interface Item {
  label?: string;
  shortcut?: string;
  action?: () => void;
  head?: boolean;
  checked?: boolean;
}

const zoomBy = (f: number) => {
  const { viewport } = getState();
  zoomAt(f, viewport.w / 2, viewport.h / 2);
};
const doExport = (kind: 'png' | 'svg') => {
  const { shapes, artboard } = getState();
  (kind === 'png' ? exportPng : exportSvg)(shapes, artboard.w, artboard.h);
};

function useOutside(close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [close]);
  return ref;
}

function Popover({ button, children, className = '', title }: { button: React.ReactNode; children: (close: () => void) => React.ReactNode; className?: string; title?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(() => setOpen(false));
  return (
    <div className={'pop ' + className} ref={ref}>
      <button className={'ibtn' + (open ? ' on' : '')} title={title} onClick={() => setOpen(!open)}>
        {button}
      </button>
      {open && <div className="pop-panel">{children(() => setOpen(false))}</div>}
    </div>
  );
}

const MODES: { id: Mode; label: string; icon: React.ReactNode }[] = [
  { id: 'vector', label: 'Vector', icon: I.vector },
  { id: 'layout', label: 'Layout', icon: I.layout },
  { id: 'draw', label: 'Draw', icon: I.draw },
];

export function TopBar({ onHelp }: { onHelp: () => void }) {
  const mode = useStore((s) => s.mode);
  const rulers = useStore((s) => s.rulers);
  const grid = useStore((s) => s.grid);
  const snap = useStore((s) => s.snap);
  const hasSel = useStore((s) => s.selection.length > 0);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);

  const menu: Item[] = [
    { label: 'File', head: true },
    { label: 'New Document', shortcut: 'Ctrl+N', action: newDocument },
    { label: 'Export SVG…', action: () => doExport('svg') },
    { label: 'Export PNG…', action: () => doExport('png') },
    { label: 'Edit', head: true },
    { label: 'Duplicate', shortcut: 'Ctrl+D', action: duplicateSelected },
    { label: 'Delete', shortcut: 'Del', action: deleteSelected },
    { label: 'Select All', shortcut: 'Ctrl+A', action: selectAll },
    { label: 'Deselect', shortcut: 'Esc', action: () => setState({ selection: [] }) },
    { label: 'Object', head: true },
    { label: 'Lock Selection', action: () => (updateSelected((s) => ({ ...s, locked: true })), setState({ selection: [] })) },
    { label: 'Unlock All', action: () => setState({ shapes: getState().shapes.map((s) => ({ ...s, locked: false })) }) },
    { label: 'Hide Selection', action: () => (updateSelected((s) => ({ ...s, visible: false })), setState({ selection: [] })) },
    { label: 'Show All', action: () => setState({ shapes: getState().shapes.map((s) => ({ ...s, visible: true })) }) },
    { label: 'View', head: true },
    { label: 'Zoom In', shortcut: 'Ctrl++', action: () => zoomBy(1.25) },
    { label: 'Zoom Out', shortcut: 'Ctrl+−', action: () => zoomBy(0.8) },
    { label: 'Fit Artboard', shortcut: 'Ctrl+0', action: fitArtboard },
    { label: 'Actual Size', shortcut: 'Ctrl+1', action: () => zoomTo(1) },
    { label: 'Rulers', shortcut: 'Ctrl+R', checked: rulers, action: () => setState({ rulers: !getState().rulers }) },
  ];

  return (
    <header className="topbar">
      <div className="brand" title="VectorEdit">
        <Logo />
      </div>
      <div className="modes">
        {MODES.map((m) => (
          <button key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>
            {m.icon}
            <span>{m.label}</span>
          </button>
        ))}
      </div>
      <Popover button={I.more} title="Menu" className="left">
        {(close) => (
          <div className="menu-list">
            {menu.map((it, i) =>
              it.head ? (
                <div key={i} className="menu-head">{it.label}</div>
              ) : (
                <button key={i} onClick={() => (close(), it.action?.())}>
                  <span className="chk">{it.checked ? '✓' : ''}</span>
                  <span>{it.label}</span>
                  <span className="sc">{it.shortcut}</span>
                </button>
              ),
            )}
          </div>
        )}
      </Popover>
      <div className="seg">
        <button className="ibtn" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>{I.undo}</button>
        <button className="ibtn" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}>{I.redo}</button>
      </div>

      <div className="grow" />

      <div className="seg">
        <button className="ibtn" title="Bring to Front" disabled={!hasSel} onClick={() => arrange('front')}>{I.front}</button>
        <button className="ibtn" title="Bring Forward" disabled={!hasSel} onClick={() => arrange('forward')}>{I.forward}</button>
        <button className="ibtn" title="Send Backward" disabled={!hasSel} onClick={() => arrange('backward')}>{I.backward}</button>
        <button className="ibtn" title="Send to Back" disabled={!hasSel} onClick={() => arrange('back')}>{I.back}</button>
      </div>
      <div className="seg">
        <button className="ibtn" title="Flip Horizontal" disabled={!hasSel} onClick={() => flip('h')}>{I.flipH}</button>
        <button className="ibtn" title="Flip Vertical" disabled={!hasSel} onClick={() => flip('v')}>{I.flipV}</button>
      </div>
      <Popover button={I.alignL} title="Align">
        {() => (
          <div className="align-grid">
            <p>Align {getState().selection.length > 1 ? 'to selection' : 'to artboard'}</p>
            <div>
              <button className="ibtn" title="Left" onClick={() => align('left')}>{I.alignL}</button>
              <button className="ibtn" title="Center" onClick={() => align('hcenter')}>{I.alignC}</button>
              <button className="ibtn" title="Right" onClick={() => align('right')}>{I.alignR}</button>
            </div>
            <div>
              <button className="ibtn" title="Top" onClick={() => align('top')}>{I.alignT}</button>
              <button className="ibtn" title="Middle" onClick={() => align('vcenter')}>{I.alignM}</button>
              <button className="ibtn" title="Bottom" onClick={() => align('bottom')}>{I.alignB}</button>
            </div>
          </div>
        )}
      </Popover>
      <div className="seg">
        <button className={'ibtn' + (grid ? ' on' : '')} title="Show Grid (Ctrl+')" onClick={() => setState({ grid: !grid })}>{I.grid}</button>
        <button className={'ibtn' + (snap ? ' on' : '')} title="Snap to 10 px" onClick={() => setState({ snap: !snap })}>{I.magnet}</button>
      </div>

      <div className="export">
        <button className="export-main" onClick={() => doExport('png')}>
          <i />
          Export PNG
        </button>
        <Popover button={I.caret} title="More export formats" className="right">
          {(close) => (
            <div className="menu-list">
              <button onClick={() => (close(), doExport('png'))}><span className="chk" /><span>PNG (2×)</span><span className="sc" /></button>
              <button onClick={() => (close(), doExport('svg'))}><span className="chk" /><span>SVG</span><span className="sc" /></button>
            </div>
          )}
        </Popover>
      </div>
      <button className="ibtn help" title="Keyboard shortcuts" onClick={onHelp}>{I.help}</button>
    </header>
  );
}

export { Popover };
