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
import { Duplicate, I, Trash } from './Icons';
import { Artwork } from './Artwork';
import { ShapeEl } from './ShapeEl';

export function PagesPanel() {
  const boards = useStore((s) => s.artboards);
  const active = useStore((s) => s.activeArtboard);
  const shapes = useStore((s) => s.shapes);
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="pages">
      <div className="pages-bar">
        <span className="dim">{boards.length} {boards.length === 1 ? 'page' : 'pages'}</span>
        <div className="grow" />
        <button title="Add page" onClick={() => addArtboard()}>{I.plusRect}</button>
        <button title="Duplicate page with its content" onClick={() => duplicateArtboard(active)}><Duplicate /></button>
        <button title="Delete page and its content" disabled={boards.length < 2} onClick={() => deleteArtboard(active)}><Trash /></button>
      </div>
      <div className="page-grid">
        {boards.map((b) => (
          <div key={b.id} className={'page' + (b.id === active ? ' on' : '')} onClick={() => setActiveArtboard(b.id, true)}>
            <svg className="thumb-page" viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} preserveAspectRatio="xMidYMid meet">
              <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#fff" />
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
            <em>{b.w} × {b.h}</em>
          </div>
        ))}
      </div>
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
