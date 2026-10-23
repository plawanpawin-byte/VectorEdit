import { useState } from 'react';
import { bbox, unionBox } from '../geometry';
import {
  arrange,
  deleteSelected,
  duplicateSelected,
  getState,
  setColor,
  setState,
  setTransform,
  updateSelected,
  updateShape,
  useStore,
} from '../store';
import { Duplicate, Eye, Lock, Trash } from './Icons';
import { NumField, Section } from './Fields';

const SWATCHES = [
  '#000000', '#2b2b2b', '#555555', '#808080', '#aaaaaa', '#d4d4d4', '#f2efe8', '#ffffff',
  '#d93025', '#f08a24', '#f4c20d', '#6fbf4a', '#1aa391', '#2fd3bd', '#2d8cf0', '#5b9cf5',
  '#7a4de0', '#b84fc4', '#e0457b', '#8c5a3c', '#0e3b38', '#17325c', '#4a1c3d', '#5c2a14',
];

const hex2rgb = (h: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h);
  const n = m ? parseInt(m[1], 16) : 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
const rgb2hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

function Swatch({ color, size = 18, onClick, title }: { color: string | null; size?: number; onClick?: () => void; title?: string }) {
  return (
    <button
      className={'swatch' + (color === null ? ' none' : '')}
      title={title ?? color ?? 'None'}
      style={{ width: size, height: size, background: color ?? undefined }}
      onClick={onClick}
    />
  );
}

function ColorRow({ label, target }: { label: string; target: 'fill' | 'stroke' }) {
  const value = useStore((s) => s[target]);
  return (
    <div className="row">
      <span className="lbl">{label}</span>
      <label className="swatch-input" style={{ background: value ?? undefined }} data-none={value === null}>
        <input type="color" value={value ?? '#000000'} onChange={(e) => setColor(target, e.target.value)} />
      </label>
      <input
        className="hex"
        value={value ?? 'None'}
        onChange={() => {}}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (/^#[0-9a-f]{6}$/i.test(v)) setColor(target, v.toLowerCase());
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        key={value}
        defaultValue={value ?? 'None'}
      />
      <button className="mini" title="No colour" onClick={() => setColor(target, null)}>
        ∅
      </button>
    </div>
  );
}

export function Properties() {
  const shapes = useStore((s) => s.shapes);
  const selection = useStore((s) => s.selection);
  const artboard = useStore((s) => s.artboard);
  const rulers = useStore((s) => s.rulers);
  const grid = useStore((s) => s.grid);
  const strokeWidth = useStore((s) => s.strokeWidth);
  const sel = shapes.filter((s) => selection.includes(s.id));
  const box = unionBox(sel.map(bbox));
  const one = sel.length === 1 ? sel[0] : null;

  if (!sel.length) {
    return (
      <div className="panel-body">
        <Section title="Document">
          <div className="grid2">
            <NumField label="W" value={artboard.w} suffix="px" min={1} onCommit={(w) => setState({ artboard: { ...artboard, w } })} />
            <NumField label="H" value={artboard.h} suffix="px" min={1} onCommit={(h) => setState({ artboard: { ...artboard, h } })} />
          </div>
          <label className="check">
            <input type="checkbox" checked={rulers} onChange={(e) => setState({ rulers: e.target.checked })} /> Show rulers
          </label>
          <label className="check">
            <input type="checkbox" checked={grid} onChange={(e) => setState({ grid: e.target.checked })} /> Show grid
          </label>
        </Section>
        <Section title="Defaults for new objects">
          <ColorRow label="Fill" target="fill" />
          <ColorRow label="Stroke" target="stroke" />
          <div className="row">
            <NumField label="Weight" value={strokeWidth} suffix="pt" min={0} step={0.5} onCommit={(v) => setState({ strokeWidth: v })} />
          </div>
        </Section>
        <p className="hint">Select an object to edit its properties.</p>
      </div>
    );
  }

  return (
    <div className="panel-body">
      <div className="obj-title">{one ? one.name : `${sel.length} objects`}</div>
      {box && (
        <Section title="Transform">
          <div className="grid2">
            <NumField label="X" value={box.x} suffix="px" onCommit={(x) => setTransform(box, { x })} />
            <NumField label="Y" value={box.y} suffix="px" onCommit={(y) => setTransform(box, { y })} />
            <NumField label="W" value={box.w} suffix="px" min={0.01} onCommit={(w) => setTransform(box, { w })} />
            <NumField label="H" value={box.h} suffix="px" min={0.01} onCommit={(h) => setTransform(box, { h })} />
          </div>
        </Section>
      )}
      <Section title="Appearance">
        <div className="row">
          <span className="lbl">Fill</span>
          <label className="swatch-input" style={{ background: one?.fill ?? undefined }} data-none={!one?.fill}>
            <input type="color" value={one?.fill ?? '#000000'} onChange={(e) => updateSelected((s) => ({ ...s, fill: e.target.value }), 'fill')} />
          </label>
          <button className="mini" title="No fill" onClick={() => updateSelected((s) => ({ ...s, fill: null }))}>∅</button>
        </div>
        <div className="row">
          <span className="lbl">Stroke</span>
          <label className="swatch-input" style={{ background: one?.stroke ?? undefined }} data-none={!one?.stroke}>
            <input type="color" value={one?.stroke ?? '#000000'} onChange={(e) => updateSelected((s) => ({ ...s, stroke: e.target.value }), 'stroke')} />
          </label>
          <NumField label="" value={one?.strokeWidth ?? null} suffix="pt" min={0} step={0.5} onCommit={(v) => updateSelected((s) => ({ ...s, strokeWidth: v }), 'sw')} />
          <button className="mini" title="No stroke" onClick={() => updateSelected((s) => ({ ...s, stroke: null }))}>∅</button>
        </div>
        <div className="row">
          <span className="lbl">Opacity</span>
          <input
            className="range"
            type="range"
            min={0}
            max={100}
            value={Math.round((one?.opacity ?? 1) * 100)}
            onChange={(e) => updateSelected((s) => ({ ...s, opacity: Number(e.target.value) / 100 }), 'opacity')}
          />
          <span className="val">{Math.round((one?.opacity ?? 1) * 100)}%</span>
        </div>
      </Section>
      {one?.kind === 'text' && (
        <Section title="Text">
          <textarea
            id="text-content"
            className="textarea"
            rows={3}
            value={one.text}
            onChange={(e) => updateShape(one.id, { text: e.target.value }, 'text')}
          />
          <div className="grid2">
            <NumField label="Size" value={one.fontSize} suffix="px" min={1} onCommit={(fontSize) => updateShape(one.id, { fontSize }, 'fs')} />
          </div>
        </Section>
      )}
      <Section title="Arrange">
        <div className="btn-row">
          <button onClick={() => arrange('front')}>To front</button>
          <button onClick={() => arrange('forward')}>Forward</button>
          <button onClick={() => arrange('backward')}>Backward</button>
          <button onClick={() => arrange('back')}>To back</button>
        </div>
      </Section>
    </div>
  );
}

export function ColorPanel() {
  const target = useStore((s) => s.colorTarget);
  const fill = useStore((s) => s.fill);
  const stroke = useStore((s) => s.stroke);
  const value = (target === 'fill' ? fill : stroke) ?? '#000000';
  const [r, g, b] = hex2rgb(value);
  const channel = (name: string, v: number, idx: 0 | 1 | 2) => {
    const lo = [r, g, b];
    const hi = [r, g, b];
    lo[idx] = 0;
    hi[idx] = 255;
    return (
      <div className="slider-row" key={name}>
        <span>{name}</span>
        <input
          type="range"
          min={0}
          max={255}
          value={v}
          className="ch"
          style={{ background: `linear-gradient(90deg, ${rgb2hex(lo[0], lo[1], lo[2])}, ${rgb2hex(hi[0], hi[1], hi[2])})` }}
          onChange={(e) => {
            const c = [r, g, b];
            c[idx] = Number(e.target.value);
            setColor(target, rgb2hex(c[0], c[1], c[2]));
          }}
        />
        <input className="chv" value={v} readOnly />
      </div>
    );
  };
  return (
    <div className="panel-body">
      <div className="tabs-mini">
        <button className={target === 'fill' ? 'on' : ''} onClick={() => setState({ colorTarget: 'fill' })}>Fill</button>
        <button className={target === 'stroke' ? 'on' : ''} onClick={() => setState({ colorTarget: 'stroke' })}>Stroke</button>
      </div>
      {channel('R', r, 0)}
      {channel('G', g, 1)}
      {channel('B', b, 2)}
      <div className="row">
        <span className="lbl">Hex</span>
        <input
          className="hex"
          key={value}
          defaultValue={value}
          onBlur={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && setColor(target, e.target.value.toLowerCase())}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>
    </div>
  );
}

export function Swatches() {
  const target = useStore((s) => s.colorTarget);
  return (
    <div className="panel-body">
      <div className="swatch-grid">
        <Swatch color={null} title="None" onClick={() => setColor(target, null)} />
        {SWATCHES.map((c) => (
          <Swatch key={c} color={c} onClick={() => setColor(target, c)} />
        ))}
      </div>
    </div>
  );
}

export function Layers() {
  const shapes = useStore((s) => s.shapes);
  const selection = useStore((s) => s.selection);
  const [editing, setEditing] = useState<string | null>(null);
  const list = [...shapes].reverse();
  return (
    <div className="layers">
      <div className="layer-list">
        {list.length === 0 && <p className="hint">No objects yet.</p>}
        {list.map((s) => (
          <div
            key={s.id}
            className={'layer' + (selection.includes(s.id) ? ' sel' : '')}
            onClick={(e) => {
              if (s.locked) return;
              const sl = getState().selection;
              setState({ selection: e.shiftKey ? (sl.includes(s.id) ? sl.filter((i) => i !== s.id) : [...sl, s.id]) : [s.id] });
            }}
          >
            <button className={'ic' + (s.visible ? '' : ' off')} title="Toggle visibility" onClick={(e) => (e.stopPropagation(), updateShape(s.id, { visible: !s.visible }))}>
              <Eye off={!s.visible} />
            </button>
            <button className={'ic' + (s.locked ? ' on' : ' faint')} title="Toggle lock" onClick={(e) => (e.stopPropagation(), updateShape(s.id, { locked: !s.locked }))}>
              <Lock on={s.locked} />
            </button>
            <span className="thumb" style={{ background: s.fill ?? 'transparent', borderColor: s.stroke ?? '#555' }} />
            {editing === s.id ? (
              <input
                className="rename"
                autoFocus
                defaultValue={s.name}
                onBlur={(e) => (updateShape(s.id, { name: e.target.value || s.name }), setEditing(null))}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="name" onDoubleClick={() => setEditing(s.id)}>{s.name}</span>
            )}
          </div>
        ))}
      </div>
      <footer className="layer-foot">
        <span>{shapes.length} {shapes.length === 1 ? 'item' : 'items'}</span>
        <div>
          <button title="Duplicate (Ctrl+D)" onClick={duplicateSelected}><Duplicate /></button>
          <button title="Delete" onClick={deleteSelected}><Trash /></button>
        </div>
      </footer>
    </div>
  );
}

export { Swatch };
