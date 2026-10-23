import { useEffect, useRef, useState } from 'react';
import {
  arrange,
  deleteSelected,
  duplicateSelected,
  fitArtboard,
  getState,
  newDocument,
  redo,
  selectAll,
  setState,
  undo,
  updateSelected,
  useStore,
  zoomAt,
  zoomTo,
} from '../store';
import { exportPng, exportSvg } from './exporter';
import { Logo } from './Icons';

interface Item {
  label?: string;
  shortcut?: string;
  action?: () => void;
  sep?: boolean;
  checked?: boolean;
}

const zoomBy = (f: number) => {
  const { viewport } = getState();
  zoomAt(f, viewport.w / 2, viewport.h / 2);
};

export function MenuBar() {
  const rulers = useStore((s) => s.rulers);
  const grid = useStore((s) => s.grid);
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);

  const menus: Record<string, Item[]> = {
    File: [
      { label: 'New', shortcut: 'Ctrl+N', action: newDocument },
      { sep: true },
      { label: 'Export as SVG…', action: () => exportSvg(getState().shapes, getState().artboard.w, getState().artboard.h) },
      { label: 'Export as PNG…', action: () => exportPng(getState().shapes, getState().artboard.w, getState().artboard.h) },
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', action: undo },
      { label: 'Redo', shortcut: 'Shift+Ctrl+Z', action: redo },
      { sep: true },
      { label: 'Duplicate', shortcut: 'Ctrl+D', action: duplicateSelected },
      { label: 'Delete', shortcut: 'Del', action: deleteSelected },
      { sep: true },
      { label: 'Select All', shortcut: 'Ctrl+A', action: selectAll },
      { label: 'Deselect', shortcut: 'Shift+Ctrl+A', action: () => setState({ selection: [] }) },
    ],
    Object: [
      { label: 'Bring to Front', shortcut: 'Shift+Ctrl+]', action: () => arrange('front') },
      { label: 'Bring Forward', shortcut: 'Ctrl+]', action: () => arrange('forward') },
      { label: 'Send Backward', shortcut: 'Ctrl+[', action: () => arrange('backward') },
      { label: 'Send to Back', shortcut: 'Shift+Ctrl+[', action: () => arrange('back') },
      { sep: true },
      { label: 'Lock Selection', shortcut: 'Ctrl+2', action: () => (updateSelected((s) => ({ ...s, locked: true })), setState({ selection: [] })) },
      { label: 'Unlock All', shortcut: 'Alt+Ctrl+2', action: () => setState({ shapes: getState().shapes.map((s) => ({ ...s, locked: false })) }) },
      { label: 'Hide Selection', shortcut: 'Ctrl+3', action: () => (updateSelected((s) => ({ ...s, visible: false })), setState({ selection: [] })) },
      { label: 'Show All', shortcut: 'Alt+Ctrl+3', action: () => setState({ shapes: getState().shapes.map((s) => ({ ...s, visible: true })) }) },
    ],
    View: [
      { label: 'Zoom In', shortcut: 'Ctrl++', action: () => zoomBy(1.25) },
      { label: 'Zoom Out', shortcut: 'Ctrl+−', action: () => zoomBy(0.8) },
      { label: 'Fit Artboard in Window', shortcut: 'Ctrl+0', action: fitArtboard },
      { label: 'Actual Size', shortcut: 'Ctrl+1', action: () => zoomTo(1) },
      { sep: true },
      { label: 'Rulers', shortcut: 'Ctrl+R', checked: rulers, action: () => setState({ rulers: !getState().rulers }) },
      { label: 'Grid', shortcut: "Ctrl+'", checked: grid, action: () => setState({ grid: !getState().grid }) },
    ],
  };

  return (
    <header className="menubar" ref={ref}>
      <div className="brand" title="VectorEdit">
        <Logo />
      </div>
      {Object.entries(menus).map(([name, items]) => (
        <div key={name} className="menu">
          <button
            className={open === name ? 'on' : ''}
            onMouseDown={(e) => (e.preventDefault(), setOpen(open === name ? null : name))}
            onMouseEnter={() => open && setOpen(name)}
          >
            {name}
          </button>
          {open === name && (
            <div className="dropdown">
              {items.map((it, i) =>
                it.sep ? (
                  <hr key={i} />
                ) : (
                  <button
                    key={i}
                    onClick={() => {
                      setOpen(null);
                      it.action?.();
                    }}
                  >
                    <span className="chk">{it.checked ? '✓' : ''}</span>
                    <span className="lab">{it.label}</span>
                    <span className="sc">{it.shortcut}</span>
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
      <div className="grow" />
      <div className="workspace">Essentials</div>
    </header>
  );
}
