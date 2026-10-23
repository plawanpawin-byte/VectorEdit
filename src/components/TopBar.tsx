import { useEffect, useRef, useState } from 'react';
import { WORKSPACES, setWorkspace } from '../tools/registry';
import {
  align,
  arrange,
  activeBoard,
  booleanOp,
  convertToCurves,
  flip,
  getState,
  groupSelected,
  redo,
  setState,
  undo,
  ungroupSelected,
  useStore,
} from '../store';
import type { Artboard } from '../types';
import { exportPdf, exportPng, exportSvg } from './exporter';
import { divideSelected, joinSelected, reverseSelected, separateSelected, setAll, smoothSelected, stepRepeatSelected, strokeWeight, traceSelected } from '../objectcmds';
import { I, Logo } from './Icons';

export const runPdf = (boards: Artboard[], name: string) =>
  exportPdf(getState().shapes, boards, name).then((r) => {
    if (r.raster.length) alert(`Exported. ${r.vector} page(s) are vector; the rest were saved as images because they use features PDF export cannot draw as vectors yet:\n\n${r.raster.join('\n')}`);
  });

export const doExport = (kind: 'png' | 'svg', all = false) => {
  const st = getState();
  const boards = all ? st.artboards : [activeBoard(st)];
  boards.forEach((board, i) => setTimeout(() => (kind === 'png' ? exportPng : exportSvg)(st.shapes, board), i * 250));
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

const PRIMARY = ['vector', 'pixel', 'layout'];

const WS_ACCENT: Record<string, string> = { vector: '#05cde5', pixel: '#8f9bff', retouching: '#c58bff', colour: '#ffb25c', compositing: '#6fd9a0', layout: '#ff806b', typography: '#ffd45c', slice: '#ff6b6b', scripting: '#a9b4c2' };

const WS_ICON: Record<string, React.ReactNode> = { vector: I.vector, pixel: I.pixel, layout: I.layout, typography: I.typo, slice: I.grid, scripting: I.code, retouching: I.retouch, colour: I.colour, compositing: I.composite };

function ObjectMenu() {
  const [rep, setRep] = useState({ count: 3, dx: 40, dy: 0 });
  const [trace, setTrace] = useState({ level: 128, detail: 1 });
  const [msg, setMsg] = useState('');
  const run = (fn: () => boolean | void | Promise<boolean | void>, fail: string, close: () => void) => async () => {
    const ok = await fn();
    if (ok === false) setMsg(fail);
    else close();
  };
  const num = (k: keyof typeof rep) => (
    <input className="mini-num" type="number" value={rep[k]} onChange={(e) => setRep({ ...rep, [k]: Number(e.target.value) })} onKeyDown={(e) => e.stopPropagation()} />
  );
  return (
    <Popover button={<span className="txtbtn">Object</span>} className="left" title="Object operations">
      {(close) => (
        <div className="menu-list object-menu">
          <div className="menu-head">Combine</div>
          <button onClick={run(divideSelected, 'Select two or more overlapping closed shapes.', close)}><span className="chk" /><span>Divide</span><span className="sc" /></button>
          <div className="menu-head">Paths</div>
          <button onClick={run(reverseSelected, '', close)}><span className="chk" /><span>Reverse direction</span><span className="sc" /></button>
          <button onClick={run(joinSelected, 'Select exactly two open paths.', close)}><span className="chk" /><span>Join two open paths</span><span className="sc" /></button>
          <button onClick={run(smoothSelected, '', close)}><span className="chk" /><span>Smooth curves</span><span className="sc" /></button>
          <button onClick={run(separateSelected, 'Select a compound path (a shape with holes).', close)}><span className="chk" /><span>Separate compound path</span><span className="sc" /></button>
          <button onClick={run(convertToCurves, '', close)}><span className="chk" /><span>Convert to curves</span><span className="sc" /></button>
          <button onClick={run(() => strokeWeight(1), '', () => undefined)}><span className="chk" /><span>Stroke weight +1</span><span className="sc" /></button>
          <button onClick={run(() => strokeWeight(-1), '', () => undefined)}><span className="chk" /><span>Stroke weight −1</span><span className="sc" /></button>
          <div className="menu-head">Step and repeat</div>
          <div className="menu-form">
            <label>Copies {num('count')}</label>
            <label>ΔX {num('dx')}</label>
            <label>ΔY {num('dy')}</label>
            <button className="mini wide" onClick={run(() => stepRepeatSelected(rep.count, rep.dx, rep.dy), 'Select something to repeat.', close)}>Repeat</button>
          </div>
          <div className="menu-head">Image trace (selected pixel layer)</div>
          <div className="menu-form">
            <label>
              Threshold
              <input type="range" min={10} max={245} value={trace.level} onChange={(e) => setTrace({ ...trace, level: Number(e.target.value) })} />
            </label>
            <label>
              Detail
              <input type="range" min={0.3} max={4} step={0.1} value={trace.detail} onChange={(e) => setTrace({ ...trace, detail: Number(e.target.value) })} />
            </label>
            <button className="mini wide" onClick={run(() => traceSelected(trace.level, trace.detail), 'Select a pixel layer with dark artwork on it.', close)}>Trace</button>
          </div>
          <div className="menu-head">All layers</div>
          <button onClick={() => (setAll('visible', true), close())}><span className="chk" /><span>Show all</span><span className="sc" /></button>
          <button onClick={() => (setAll('visible', false), close())}><span className="chk" /><span>Hide all</span><span className="sc" /></button>
          <button onClick={() => (setAll('locked', true), close())}><span className="chk" /><span>Lock all</span><span className="sc" /></button>
          <button onClick={() => (setAll('locked', false), close())}><span className="chk" /><span>Unlock all</span><span className="sc" /></button>
          {msg && <p className="menu-msg">{msg}</p>}
        </div>
      )}
    </Popover>
  );
}

export function TopBar({ onHelp }: { onHelp: () => void }) {
  const workspace = useStore((s) => s.workspace);
  const grid = useStore((s) => s.grid);
  const snap = useStore((s) => s.snap);
  const hasSel = useStore((s) => s.selection.length > 0);
  const sel = useStore((s) => s.selection.length);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);


  return (
    <header className="topbar">
      <div className="brand" title="VectorEdit">
        <Logo />
      </div>
      <div className="modes">
        {WORKSPACES.filter((m) => PRIMARY.includes(m.id) || m.id === workspace).map((m) => (
          <button key={m.id} className={workspace === m.id ? 'on' : ''} style={{ ['--ws' as string]: WS_ACCENT[m.id] }} title={m.description} onClick={() => setWorkspace(m.id)}>
            {WS_ICON[m.id]}
            <span>{m.label}</span>
          </button>
        ))}
      </div>
      <Popover button={I.more} title="More studios" className="left">
        {(close) => (
          <div className="menu-list">
            <div className="menu-head">More studios</div>
            {WORKSPACES.filter((m) => !PRIMARY.includes(m.id)).map((m) => (
              <button key={m.id} onClick={() => (close(), setWorkspace(m.id))}>
                <span className="chk">{workspace === m.id ? '✓' : ''}</span>
                <span>{m.label}</span>
                <span className="sc" />
              </button>
            ))}
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
      <div className="seg">
        <button className="ibtn" title="Add (union)" disabled={sel < 2} onClick={() => booleanOp('union')}>{I.union}</button>
        <button className="ibtn" title="Subtract (front objects cut the back one)" disabled={sel < 2} onClick={() => booleanOp('subtract')}>{I.subtract}</button>
        <button className="ibtn" title="Intersect" disabled={sel < 2} onClick={() => booleanOp('intersect')}>{I.intersect}</button>
        <button className="ibtn" title="Exclude (xor)" disabled={sel < 2} onClick={() => booleanOp('xor')}>{I.xor}</button>
      </div>
      <ObjectMenu />
      <div className="seg">
        <button className="ibtn" title="Group (Ctrl+G)" disabled={sel < 2} onClick={groupSelected}>{I.group}</button>
        <button className="ibtn" title="Ungroup (Shift+Ctrl+G)" disabled={!hasSel} onClick={ungroupSelected}>{I.ungroup}</button>
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
