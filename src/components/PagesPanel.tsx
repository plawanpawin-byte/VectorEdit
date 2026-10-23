import { useEffect, useState } from 'react';
import { type Asset, deleteAsset, insertAsset, loadAssets, saveSelectionAsAsset } from '../assets';
import { buildShape, defaultParams, SHAPES } from '../shapes';
import {
  activeBoard,
  addArtboard,
  commit,
  deleteArtboard,
  duplicateArtboard,
  getState,
  makeShape,
  setActiveArtboard,
  updateArtboard,
  useStore,
} from '../store';
import { shapeIcon } from '../tools/icons';
import type { Artboard, Shape } from '../types';
import { Duplicate, I, Trash } from './Icons';
import { Artwork, MasterArtwork } from './Artwork';
import { ShapeEl } from './ShapeEl';

function Chev({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 10 10" width="9" height="9" fill="currentColor" style={{ transform: open ? 'rotate(90deg)' : undefined }}>
      <path d="M3 1.5l4 3.5-4 3.5z" />
    </svg>
  );
}

function PageTile({ b, boards, shapes, active, editing, setEditing }: { b: Artboard; boards: Artboard[]; shapes: Shape[]; active: boolean; editing: string | null; setEditing: (id: string | null) => void }) {
  return (
    <div className={'page' + (active ? ' on' : '')} onClick={() => setActiveArtboard(b.id, true)}>
      <svg className="thumb-page" viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} preserveAspectRatio="xMidYMid meet">
        <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#fff" />
        <MasterArtwork board={b} boards={boards} shapes={shapes} />
        <Artwork shapes={shapes} />
      </svg>
      {editing === b.id ? (
        <input
          className="rename"
          autoFocus
          defaultValue={b.name}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => (updateArtboard(b.id, { name: e.target.value || b.name }), setEditing(null))}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      ) : (
        <span className="pname" onDoubleClick={() => setEditing(b.id)}>{b.name}</span>
      )}
    </div>
  );
}

/** Master Pages and Pages in two collapsible sections, each with its own actions. */
export function PagesPanel() {
  const boards = useStore((s) => s.artboards);
  const active = useStore((s) => s.activeArtboard);
  const shapes = useStore((s) => s.shapes);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState({ masters: true, pages: true });
  const masters = boards.filter((b) => b.isMaster);
  const pages = boards.filter((b) => !b.isMaster);
  const current = boards.find((b) => b.id === active) ?? boards[0];
  const activeIsMaster = !!current?.isMaster;
  const nMasters = (n: number) => `${n} ${n === 1 ? 'master' : 'masters'}`;

  return (
    <div className="pages">
      <div className="pages-section">
        <div className="pages-head" onClick={() => setOpen({ ...open, masters: !open.masters })}>
          <Chev open={open.masters} />
          <span>Master Pages</span>
          <em>{nMasters(masters.length)}</em>
          <div className="grow" />
          <button title="New master page" onClick={(e) => (e.stopPropagation(), addArtboard({ isMaster: true, name: `Master ${masters.length + 1}` }))}>{I.plusRect}</button>
          <button title="Delete the selected master page" disabled={!activeIsMaster || boards.length < 2} onClick={(e) => (e.stopPropagation(), deleteArtboard(active))}><Trash /></button>
        </div>
        {open.masters && (
          <div className="page-grid">
            {masters.length === 0 && <p className="hint tight">No master pages. Content on a master repeats behind every page that uses it.</p>}
            {masters.map((b) => (
              <PageTile key={b.id} b={b} boards={boards} shapes={shapes} active={b.id === active} editing={editing} setEditing={setEditing} />
            ))}
          </div>
        )}
      </div>
      <div className="pages-section">
        <div className="pages-head" onClick={() => setOpen({ ...open, pages: !open.pages })}>
          <Chev open={open.pages} />
          <span>Pages</span>
          <em>{pages.length} {pages.length === 1 ? 'page' : 'pages'}</em>
          <div className="grow" />
          <button title="Add page" onClick={(e) => (e.stopPropagation(), addArtboard())}>{I.plusRect}</button>
          <button title="Duplicate page with its content" onClick={(e) => (e.stopPropagation(), duplicateArtboard(active))}><Duplicate /></button>
          <button title="Delete page and its content" disabled={boards.length < 2} onClick={(e) => (e.stopPropagation(), deleteArtboard(active))}><Trash /></button>
        </div>
        {open.pages && (
          <>
            <MasterControls />
            <div className="page-grid">
              {pages.map((b) => (
                <PageTile key={b.id} b={b} boards={boards} shapes={shapes} active={b.id === active} editing={editing} setEditing={setEditing} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MasterControls() {
  const boards = useStore((s) => s.artboards);
  const active = useStore((s) => s.activeArtboard);
  const board = boards.find((b) => b.id === active) ?? boards[0];
  const masters = boards.filter((b) => b.isMaster && b.id !== board.id);
  return (
    <div className="master-box">
      {board.isMaster ? (
        <button className="mini wide" onClick={() => updateArtboard(board.id, { isMaster: false })}>Turn “{board.name}” back into a page</button>
      ) : (
        <>
          <label className="master-pick">
            <span>Master</span>
            <select value={board.master ?? ''} disabled={!masters.length} onChange={(e) => updateArtboard(board.id, { master: e.target.value || null })}>
              <option value="">{masters.length ? 'None' : 'No master pages yet'}</option>
              {masters.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          <button className="mini wide" onClick={() => updateArtboard(board.id, { isMaster: true, master: null })}>Make “{board.name}” a master page</button>
        </>
      )}
    </div>
  );
}

export function AssetsPanel() {
  const [mine, setMine] = useState<Asset[]>([]);
  useEffect(() => setMine(loadAssets()), []);
  const sel = useStore((s) => s.selection.length);
  const place = (id: string) => {
    const st = getState();
    const b = activeBoard(st);
    const size = Math.min(160, b.w / 3, b.h / 3);
    const s = makeShape('shape', { shapeId: id, x: b.x + (b.w - size) / 2, y: b.y + (b.h - size) / 2, w: size, h: size });
    commit([...st.shapes, s], { selection: [s.id] });
  };
  return (
    <div className="panel-body">
      <div className="asset-head">Shapes</div>
      <div className="asset-grid">
        {SHAPES.map((d) => (
          <button key={d.id} className="asset" title={d.name} onClick={() => place(d.id)}>
            {shapeIcon(d.id)}
          </button>
        ))}
      </div>
      <div className="asset-head">
        My assets
        <button className="mini wide" disabled={!sel} title="Save the selection as a reusable asset" onClick={() => setMine(saveSelectionAsAsset() ?? mine)}>
          + Save selection
        </button>
      </div>
      <div className="asset-grid big">
        {mine.length === 0 && <p className="hint tight">Select objects, then save them here to reuse them in any document.</p>}
        {mine.map((a) => (
          <div key={a.id} className="asset my">
            <button title={`Insert ${a.name}`} onClick={() => insertAsset(a)}>
              <svg viewBox={`0 0 ${Math.max(1, a.w)} ${Math.max(1, a.h)}`} width="46" height="46" preserveAspectRatio="xMidYMid meet">
                {a.shapes.map((s) => (
                  <ShapeEl key={s.id} shape={s} />
                ))}
              </svg>
            </button>
            <i title="Delete asset" onClick={() => setMine(deleteAsset(a.id))}>×</i>
          </div>
        ))}
      </div>
    </div>
  );
}

void buildShape;
void defaultParams;
