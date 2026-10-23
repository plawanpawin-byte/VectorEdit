import { useEffect, useRef, useState, type ReactNode } from 'react';
import { bbox, unionBox } from '../geometry';
import {
  activeBoard,
  addAdjustment,
  setGroupFlag,
  deleteSelected,
  duplicateSelected,
  getState,
  deleteSnapshot,
  historyJump,
  restoreSnapshot,
  rotateSelection,
  shearSelection,
  takeSnapshot,
  live,
  makeShape,
  setColor,
  setState,
  setTransform,
  updateSelected,
  updateShape,
  useStore,
  endLive,
} from '../store';
import { Duplicate, Eye, I, Lock, Trash } from './Icons';
import { NumField, Section } from './Fields';
import { Artwork } from './Artwork';
import { ShapeEl } from './ShapeEl';
import { chooseImageInto } from '../images';
import { shapeDef, defaultParams } from '../shapes';
import { addPixelLayer } from '../raster/layer';
import { ADJUSTMENTS, adjustDef, defaultAdjust } from '../adjustments';
import type { AdjustType, ArrowKind, Effect, Pattern, Shape } from '../types';

const SWATCHES = [
  '#000000', '#262626', '#4d4d4d', '#808080', '#b3b3b3', '#d9d9d9', '#f2efe8', '#ffffff',
  '#d93025', '#f08a24', '#f4c20d', '#6fbf4a', '#1aa391', '#2fd3bd', '#2d8cf0', '#5b9cf5',
  '#7a4de0', '#b84fc4', '#e0457b', '#8c5a3c', '#0e3b38', '#17325c', '#4a1c3d', '#5c2a14',
];

const ARROWS: [ArrowKind, string][] = [['', 'None'], ['arrow', 'Arrow'], ['open', 'Open arrow'], ['circle', 'Circle'], ['square', 'Square'], ['diamond', 'Diamond'], ['bar', 'Bar']];
const KIND_LABEL: Record<Shape['kind'], string> = { rect: 'Rectangle', ellipse: 'Ellipse', shape: 'Shape', line: 'Line', path: 'Curve', text: 'Text' };
const BLENDS = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
const label = (b: string) => b.replace(/(^|-)(\w)/g, (_, d, c) => (d ? ' ' : '') + c.toUpperCase());

/* ---------- colour maths ---------- */

const hex2rgb = (h: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h);
  const n = m ? parseInt(m[1], 16) : 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgb2hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

function rgb2hsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max];
}

function hsv2hex(h: number, s: number, v: number) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return rgb2hex(f(5) * 255, f(3) * 255, f(1) * 255);
}

/* ---------- colour ---------- */

function FillStrokeChips() {
  const fill = useStore((s) => s.fill);
  const stroke = useStore((s) => s.stroke);
  const target = useStore((s) => s.colorTarget);
  return (
    <div className="chips">
      <button className={'chip' + (target === 'fill' ? ' on' : '')} onClick={() => setState({ colorTarget: 'fill' })}>
        <b style={{ background: fill ?? undefined }} data-none={fill === null} />
        Fill
      </button>
      <button className={'chip' + (target === 'stroke' ? ' on' : '')} onClick={() => setState({ colorTarget: 'stroke' })}>
        <b className="ring" style={{ borderColor: stroke ?? '#555' }} data-none={stroke === null} />
        Stroke
      </button>
      <button className="chip none" title="Set to none" onClick={() => setColor(getState().colorTarget, null)}>
        <b data-none="true" />
      </button>
    </div>
  );
}

export function ColorPanel() {
  const target = useStore((s) => s.colorTarget);
  const value = useStore((s) => s[s.colorTarget]);
  const hex = value ?? '#ffffff';
  const [h0, s0, v0] = rgb2hsv(...hex2rgb(hex));
  const [hue, setHue] = useState(h0);
  const last = useRef(hex);
  useEffect(() => {
    // keep hue stable for greys, otherwise follow the colour
    if (hex !== last.current && s0 > 0.01) setHue(h0);
    last.current = hex;
  }, [hex, h0, s0]);

  const sq = useRef<HTMLDivElement>(null);
  const pickSV = (e: React.PointerEvent) => {
    const r = sq.current!.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
    const out = hsv2hex(hue, s, v);
    last.current = out;
    setColor(target, out);
  };

  return (
    <div className="panel-body color-panel">
      <FillStrokeChips />
      <div
        ref={sq}
        className="sv"
        style={{ background: `hsl(${hue} 100% 50%)` }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          pickSV(e);
        }}
        onPointerMove={(e) => e.buttons && pickSV(e)}
      >
        <div className="sv-white" />
        <div className="sv-black" />
        <i style={{ left: `${s0 * 100}%`, top: `${(1 - v0) * 100}%` }} />
      </div>
      <input
        type="range"
        className="hue"
        min={0}
        max={359}
        value={Math.round(hue)}
        onChange={(e) => {
          const h = Number(e.target.value);
          setHue(h);
          const out = hsv2hex(h, s0 || 0.8, v0 || 0.8);
          last.current = out;
          setColor(target, out);
        }}
      />
      <div className="color-read">
        <span>H {Math.round(hue)}°</span>
        <span>S {Math.round(s0 * 100)}%</span>
        <span>B {Math.round(v0 * 100)}%</span>
        <input
          className="hex"
          key={hex}
          defaultValue={value ?? 'none'}
          onBlur={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && setColor(target, e.target.value.toLowerCase())}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>
    </div>
  );
}

export function Swatches() {
  const target = useStore((s) => s.colorTarget);
  const value = useStore((s) => s[s.colorTarget]);
  return (
    <div className="panel-body">
      <FillStrokeChips />
      <div className="swatch-grid">
        {SWATCHES.map((c) => (
          <button key={c} className={'swatch' + (value === c ? ' on' : '')} title={c} style={{ background: c }} onClick={() => setColor(target, c)} />
        ))}
      </div>
    </div>
  );
}

/* ---------- stroke ---------- */

export function StrokePanel() {
  const shapes = useStore((s) => s.shapes);
  const selection = useStore((s) => s.selection);
  const def = useStore((s) => s.strokeWidth);
  const one = shapes.find((s) => selection.includes(s.id));
  const width = one ? one.strokeWidth : def;
  const apply = (v: number) => {
    setState({ strokeWidth: v });
    updateSelected((s) => ({ ...s, strokeWidth: v }), 'sw');
  };
  return (
    <div className="panel-body pad">
      <div className="row">
        <span className="lbl">Width</span>
        <input type="range" min={0} max={40} step={0.5} value={width} onChange={(e) => apply(Number(e.target.value))} />
        <NumField label="" value={width} suffix="pt" min={0} step={0.5} onCommit={apply} />
      </div>
      <div className="stroke-preview">
        <svg viewBox="0 0 200 40" width="100%" height="40">
          <path d="M10 28C50 0 90 40 130 14S180 10 190 20" fill="none" stroke="#d6d6d6" strokeWidth={Math.max(0.5, width)} strokeLinecap="round" />
        </svg>
      </div>
      <p className="hint">{one ? `Editing ${selection.length > 1 ? 'selected objects' : one.name}` : 'Default for new objects'}</p>
    </div>
  );
}

/* ---------- appearance ---------- */

const DEFAULT_EFFECT: Record<Effect['type'], Effect> = {
  shadow: { type: 'shadow', enabled: true, color: '#000000', opacity: 0.45, blur: 10, dx: 4, dy: 6 },
  glow: { type: 'glow', enabled: true, color: '#ffd24a', opacity: 0.9, blur: 14, dx: 0, dy: 0 },
  blur: { type: 'blur', enabled: true, color: '#000000', opacity: 1, blur: 6, dx: 0, dy: 0 },
  innerShadow: { type: 'innerShadow', enabled: true, color: '#000000', opacity: 0.55, blur: 8, dx: 3, dy: 4 },
  innerGlow: { type: 'innerGlow', enabled: true, color: '#ffffff', opacity: 0.8, blur: 12, dx: 0, dy: 0 },
  outline: { type: 'outline', enabled: true, color: '#111111', opacity: 1, blur: 6, dx: 0, dy: 0 },
  overlay: { type: 'overlay', enabled: true, color: '#ff7a1a', opacity: 0.5, blur: 0, dx: 0, dy: 0 },
  bevel: { type: 'bevel', enabled: true, color: '#ffffff', opacity: 0.9, blur: 8, dx: 0, dy: 0 },
};

const EFFECT_LABEL: Record<Effect['type'], string> = {
  shadow: 'Drop shadow',
  glow: 'Outer glow',
  blur: 'Gaussian blur',
  innerShadow: 'Inner shadow',
  innerGlow: 'Inner glow',
  outline: 'Outline',
  overlay: 'Colour overlay',
  bevel: 'Bevel / emboss',
};

function ColorBox({ value, onChange, none }: { value: string | null; onChange: (c: string) => void; none?: boolean }) {
  return (
    <label className="swatch-input" style={{ background: value ?? undefined }} data-none={none ?? !value}>
      <input type="color" value={value ?? '#000000'} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="segpick">
      {options.map(([v, label]) => (
        <button key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Appearance() {
  const shapes = useStore((s) => s.shapes);
  const selection = useStore((s) => s.selection);
  const sel = shapes.filter((s) => selection.includes(s.id));
  const one = sel[0];
  if (!one) return <p className="hint pad">Select an object to edit its appearance.</p>;
  const set = (patch: Partial<Shape>, key?: string) => updateSelected((s) => ({ ...s, ...patch }), key);
  const fillMode = one.gradient ? one.gradient.type : one.fill ? 'solid' : 'none';
  const setEffect = (i: number, patch: Partial<Effect>) =>
    updateSelected((s) => ({ ...s, effects: s.effects.map((e, k) => (k === i ? { ...e, ...patch } : e)) }), `fx${i}`);
  const parametric = one.kind === 'rect' || one.kind === 'shape';
  const sdef = one.kind === 'shape' ? shapeDef(one.shapeId) : undefined;
  const hasStroke = !!one.stroke;

  return (
    <div className="panel-body">
      <Section title="Fill">
        <Seg
          value={fillMode as 'none' | 'solid' | 'linear' | 'radial'}
          options={[['none', 'None'], ['solid', 'Solid'], ['linear', 'Linear'], ['radial', 'Radial']]}
          onChange={(m) => {
            if (m === 'none') set({ fill: null, gradient: null });
            else if (m === 'solid') set({ fill: one.fill ?? one.gradient?.a ?? '#5b9cf5', gradient: null });
            else set({ gradient: { type: m, a: one.gradient?.a ?? one.fill ?? '#5b9cf5', b: one.gradient?.b ?? '#0e3b38', angle: one.gradient?.angle ?? 90 } });
          }}
        />
        {fillMode === 'solid' && (
          <div className="row">
            <span className="lbl">Colour</span>
            <ColorBox value={one.fill} onChange={(c) => set({ fill: c }, 'fill')} />
          </div>
        )}
        {one.gradient && (
          <>
            <div className="row">
              <span className="lbl">Stops</span>
              <ColorBox value={one.gradient.a} onChange={(a) => set({ gradient: { ...one.gradient!, a } }, 'ga')} />
              <div className="grad-bar" style={{ background: `linear-gradient(90deg, ${one.gradient.a}, ${one.gradient.b})` }} />
              <ColorBox value={one.gradient.b} onChange={(b) => set({ gradient: { ...one.gradient!, b } }, 'gb')} />
            </div>
            {one.gradient.type === 'linear' && (
              <div className="row">
                <span className="lbl">Angle</span>
                <input type="range" min={0} max={360} value={one.gradient.angle} onChange={(e) => set({ gradient: { ...one.gradient!, angle: Number(e.target.value) } }, 'gang')} />
                <span className="val">{Math.round(one.gradient.angle)}°</span>
              </div>
            )}
          </>
        )}
        <div className="row">
          <span className="lbl">Pattern</span>
          <select
            value={one.pattern?.type ?? ''}
            onChange={(e) => {
              const t = e.target.value as Pattern['type'] | '';
              set({ pattern: t ? { type: t, color: one.pattern?.color ?? '#00000055', size: one.pattern?.size ?? 12, angle: one.pattern?.angle ?? 45, weight: one.pattern?.weight ?? 0.35 } : null });
            }}
          >
            <option value="">None</option>
            <option value="stripes">Stripes (hatch)</option>
            <option value="dots">Dots</option>
            <option value="grid">Grid</option>
            <option value="cross">Cross-hatch</option>
            <option value="checker">Checker</option>
            <option value="waves">Waves</option>
            <option value="bricks">Bricks</option>
            <option value="diamonds">Diamonds</option>
            <option value="zigzag">Zigzag</option>
          </select>
        </div>
        {one.pattern && (
          <>
            <div className="row">
              <span className="lbl">Colour</span>
              <ColorBox value={one.pattern.color.slice(0, 7)} onChange={(c) => set({ pattern: { ...one.pattern!, color: c } }, 'pcol')} />
              <input type="range" min={3} max={80} value={one.pattern.size} onChange={(e) => set({ pattern: { ...one.pattern!, size: Number(e.target.value) } }, 'psz')} />
              <span className="val">{one.pattern.size}</span>
            </div>
            <div className="row">
              <span className="lbl">Angle</span>
              <input type="range" min={0} max={180} value={one.pattern.angle} onChange={(e) => set({ pattern: { ...one.pattern!, angle: Number(e.target.value) } }, 'pan')} />
              <span className="val">{one.pattern.angle}°</span>
            </div>
            <div className="row">
              <span className="lbl">Weight</span>
              <input type="range" min={0.1} max={0.9} step={0.01} value={one.pattern.weight} onChange={(e) => set({ pattern: { ...one.pattern!, weight: Number(e.target.value) } }, 'pwt')} />
              <span className="val">{Math.round(one.pattern.weight * 100)}%</span>
            </div>
          </>
        )}
      </Section>

      <Section title="Stroke">
        <div className="row">
          <span className="lbl">Colour</span>
          <ColorBox value={one.stroke} onChange={(c) => set({ stroke: c }, 'stroke')} />
          <button className="mini" title="No stroke" onClick={() => set({ stroke: null })}>∅</button>
          <NumField label="" value={one.strokeWidth} suffix="pt" min={0} step={0.5} disabled={!hasStroke} onCommit={(v) => set({ strokeWidth: v }, 'sw')} />
        </div>
        {hasStroke && (
          <>
            <div className="row"><span className="lbl">Style</span><Seg value={one.dash ?? 'solid'} options={[['solid', 'Solid'], ['dash', 'Dashed'], ['dot', 'Dotted']]} onChange={(dash) => set({ dash })} /></div>
            <div className="row"><span className="lbl">Cap</span><Seg value={one.cap ?? 'round'} options={[['butt', 'Butt'], ['round', 'Round'], ['square', 'Square']]} onChange={(cap) => set({ cap })} /></div>
            <div className="row"><span className="lbl">Join</span><Seg value={one.join ?? 'round'} options={[['miter', 'Miter'], ['round', 'Round'], ['bevel', 'Bevel']]} onChange={(join) => set({ join })} /></div>
            {(one.kind === 'rect' || one.kind === 'ellipse' || (one.kind === 'path' && one.closed) || one.kind === 'shape') && (
              <div className="row"><span className="lbl">Align</span><Seg value={one.strokeAlign ?? 'center'} options={[['center', 'Centre'], ['inside', 'Inside'], ['outside', 'Outside']]} onChange={(strokeAlign) => set({ strokeAlign })} /></div>
            )}
            {(one.kind === 'line' || (one.kind === 'path' && !one.closed)) && (
              <>
                <div className="row">
                  <span className="lbl">Start</span>
                  <select value={one.arrowStart ?? ''} onChange={(e) => set({ arrowStart: e.target.value as ArrowKind })}>
                    {ARROWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="row">
                  <span className="lbl">End</span>
                  <select value={one.arrowEnd ?? ''} onChange={(e) => set({ arrowEnd: e.target.value as ArrowKind })}>
                    {ARROWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </>
            )}
          </>
        )}
      </Section>

      {parametric && sel.length === 1 && (
        <Section title="Shape">
          {one.kind === 'rect' && (
            <div className="row">
              <span className="lbl">Corner</span>
              <input type="range" min={0} max={Math.max(1, Math.round(Math.min(one.w, one.h) / 2))} value={one.radius ?? 0} onChange={(e) => set({ radius: Number(e.target.value) }, 'radius')} />
              <span className="val">{Math.round(one.radius ?? 0)}</span>
            </div>
          )}
          {sdef?.params.map((q) => {
            const value = one.params[q.key] ?? defaultParams(one.shapeId)[q.key];
            return (
              <div className="row" key={q.key}>
                <span className="lbl">{q.label}</span>
                <input type="range" min={q.min} max={q.max} step={q.step} value={value} onChange={(e) => set({ params: { ...one.params, [q.key]: Number(e.target.value) } }, `p-${q.key}`)} />
                <span className="val">{q.step >= 1 ? Math.round(value) : value.toFixed(2)}</span>
              </div>
            );
          })}
        </Section>
      )}

      {(one.src || one.frame) && sel.length === 1 && (
        <Section title="Image">
          <div className="row">
            <button className="mini wide" onClick={() => void chooseImageInto(one.id)}>
              {one.src ? 'Replace…' : 'Choose image…'}
            </button>
            {one.src && <button className="mini wide" onClick={() => set({ src: '' })}>Remove</button>}
          </div>
          <Seg value={one.fit ?? 'fill'} options={[['fill', 'Fill'], ['fit', 'Fit']]} onChange={(fit) => set({ fit })} />
        </Section>
      )}

      <Section title="Transparency">
        {one.fade ? (
          <>
            <div className="row">
              <span className="lbl">Start</span>
              <input type="range" min={0} max={1} step={0.01} value={one.fade.from} onChange={(e) => set({ fade: { ...one.fade!, from: Number(e.target.value) } }, 'fdf')} />
              <span className="val">{Math.round(one.fade.from * 100)}%</span>
            </div>
            <div className="row">
              <span className="lbl">End</span>
              <input type="range" min={0} max={1} step={0.01} value={one.fade.to} onChange={(e) => set({ fade: { ...one.fade!, to: Number(e.target.value) } }, 'fdt')} />
              <span className="val">{Math.round(one.fade.to * 100)}%</span>
            </div>
            <button className="mini wide" onClick={() => set({ fade: null })}>Remove fade</button>
          </>
        ) : (
          <p className="hint tight">Use the Transparency tool to drag a fade across the object.</p>
        )}
      </Section>

      <Section
        title="Effects"
        right={
          <select
            className="addfx"
            value=""
            onChange={(e) => {
              const t = e.target.value as Effect['type'];
              if (t) set({ effects: [...(one.effects ?? []), { ...DEFAULT_EFFECT[t] }] });
            }}
          >
            <option value="">+ Add</option>
            {(Object.keys(EFFECT_LABEL) as Effect['type'][]).map((t) => (
              <option key={t} value={t}>
                {EFFECT_LABEL[t]}
              </option>
            ))}
          </select>
        }
      >
        {(one.effects ?? []).length === 0 && <p className="hint tight">No effects.</p>}
        {(one.effects ?? []).map((fx, i) => (
          <div key={i} className="fx">
            <div className="fx-head">
              <label className="check">
                <input type="checkbox" checked={fx.enabled} onChange={(e) => setEffect(i, { enabled: e.target.checked })} />
                {EFFECT_LABEL[fx.type]}
              </label>
              <button className="mini" title="Remove effect" onClick={() => set({ effects: one.effects.filter((_, k) => k !== i) })}>×</button>
            </div>
            {fx.type !== 'blur' && (
              <div className="row">
                <span className="lbl">Colour</span>
                <ColorBox value={fx.color} onChange={(color) => setEffect(i, { color })} />
                <input type="range" min={0} max={100} value={Math.round(fx.opacity * 100)} onChange={(e) => setEffect(i, { opacity: Number(e.target.value) / 100 })} />
                <span className="val">{Math.round(fx.opacity * 100)}%</span>
              </div>
            )}
            {fx.type !== 'overlay' && (
            <div className="row">
              <span className="lbl">{fx.type === 'outline' ? 'Width' : fx.type === 'bevel' ? 'Depth' : 'Radius'}</span>
              <input type="range" min={0} max={60} value={fx.blur} onChange={(e) => setEffect(i, { blur: Number(e.target.value) })} />
              <span className="val">{fx.blur}</span>
            </div>
            )}
            {(fx.type === 'shadow' || fx.type === 'innerShadow') && (
              <div className="grid2">
                <NumField label="X" value={fx.dx} onCommit={(dx) => setEffect(i, { dx })} />
                <NumField label="Y" value={fx.dy} onCommit={(dy) => setEffect(i, { dy })} />
              </div>
            )}
          </div>
        ))}
      </Section>

      {sel.length === 1 && one.kind === 'text' && (
        <Section title="Text">
          <textarea id="text-content" className="textarea" rows={3} value={one.text} onChange={(e) => updateShape(one.id, { text: e.target.value }, 'text')} />
          <NumField label="Size" value={one.fontSize} suffix="px" min={1} onCommit={(fontSize) => updateShape(one.id, { fontSize }, 'fs')} />
        </Section>
      )}
    </div>
  );
}

/* ---------- layers ---------- */

function LayerRow({ s, depth, editing, setEditing }: { s: Shape; depth: number; editing: string | null; setEditing: (id: string | null) => void }) {
  const selected = useStore((st) => st.selection.includes(s.id));
  return (
    <div
      className={'layer' + (selected ? ' sel' : '') + (s.visible ? '' : ' hidden')}
      style={{ paddingLeft: 8 + depth * 14 }}
      onClick={(e) => {
        if (s.locked) return;
        const sl = getState().selection;
        setState({ selection: e.shiftKey ? (sl.includes(s.id) ? sl.filter((i) => i !== s.id) : [...sl, s.id]) : [s.id] });
      }}
    >
      <span className={'thumb' + (s.adjust ? ' adj' : '')}>
        {s.adjust ? (
          <svg viewBox="0 0 20 20" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="10" cy="10" r="6.5" />
            <path d="M10 3.5v13" />
            <path d="M10 3.5a6.5 6.5 0 010 13z" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox={(() => { const b = bbox(s); const pad = Math.max(b.w, b.h) * 0.08 + 1; return `${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`; })()} width="22" height="22" preserveAspectRatio="xMidYMid meet">
            <ShapeEl shape={{ ...s, visible: true, blend: 'normal' }} />
          </svg>
        )}
      </span>
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
        <span className="name" onDoubleClick={() => setEditing(s.id)}>
          {s.name}
          <em>{s.adjust ? 'Adjustment' : s.kind === 'shape' ? (shapeDef(s.shapeId)?.name ?? 'Shape') : KIND_LABEL[s.kind]}</em>
        </span>
      )}
      <button className={'ic' + (s.locked ? ' on' : ' faint')} title="Lock" onClick={(e) => (e.stopPropagation(), updateShape(s.id, { locked: !s.locked }))}>
        <Lock on={s.locked} />
      </button>
      <button className={'ic' + (s.visible ? '' : ' off')} title="Visibility" onClick={(e) => (e.stopPropagation(), updateShape(s.id, { visible: !s.visible }))}>
        <Eye off={!s.visible} />
      </button>
    </div>
  );
}

function AdjustControls({ s }: { s: Shape }) {
  const adj = s.adjust!;
  const def = adjustDef(adj.type)!;
  const set = (patch: Partial<typeof adj>, key: string) => updateShape(s.id, { adjust: { ...adj, ...patch } }, key);
  return (
    <div className="adjust-box">
      <select value={adj.type} onChange={(e) => updateShape(s.id, { adjust: defaultAdjust(e.target.value as AdjustType), name: adjustDef(e.target.value as AdjustType)!.label })}>
        {ADJUSTMENTS.map((d) => (
          <option key={d.type} value={d.type}>{d.label}</option>
        ))}
      </select>
      {(['a', 'b'] as const).map((k) => {
        const f = def[k];
        if (!f) return null;
        return (
          <label key={k} className="adj-row">
            <span>{f.label}</span>
            <input type="range" min={f.min} max={f.max} value={adj[k]} onChange={(e) => set({ [k]: Number(e.target.value) }, 'adj' + k + s.id)} />
            <em>{Math.round(adj[k])}</em>
          </label>
        );
      })}
    </div>
  );
}

export function Layers() {
  const shapes = useStore((s) => s.shapes);
  const selection = useStore((s) => s.selection);
  const [editing, setEditing] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [adjMenu, setAdjMenu] = useState(false);
  const one = shapes.find((s) => selection.includes(s.id));
  const list = [...shapes].reverse();

  // rows: groups become a header followed by their (indented) members
  const rows: ReactNode[] = [];
  const seen = new Set<string>();
  let groupNo = 0;
  for (const s of list) {
    if (!s.group) {
      rows.push(<LayerRow key={s.id} s={s} depth={0} editing={editing} setEditing={setEditing} />);
      continue;
    }
    if (seen.has(s.group)) continue;
    seen.add(s.group);
    const gid = s.group;
    const members = list.filter((m) => m.group === gid);
    const open = !collapsed.has(gid);
    const allVisible = members.every((m) => m.visible);
    const allLocked = members.every((m) => m.locked);
    const groupSel = members.every((m) => selection.includes(m.id));
    groupNo++;
    rows.push(
      <div key={gid} className={'layer group-row' + (groupSel ? ' sel' : '') + (allVisible ? '' : ' hidden')} onClick={() => setState({ selection: members.filter((m) => !m.locked).map((m) => m.id) })}>
        <button className="ic chev" title={open ? 'Collapse' : 'Expand'} onClick={(e) => (e.stopPropagation(), setCollapsed((c) => { const n = new Set(c); open ? n.add(gid) : n.delete(gid); return n; }))}>
          <svg viewBox="0 0 10 10" width="9" height="9" fill="currentColor" style={{ transform: open ? 'rotate(90deg)' : undefined }}>
            <path d="M3 1.5l4 3.5-4 3.5z" />
          </svg>
        </button>
        <span className="thumb folder">
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.3">
            <path d="M2.5 5.5h5l1.5 2h8.500v8h-15z" />
          </svg>
        </span>
        <span className="name">
          Group {groupNo}
          <em>{members.length} {members.length === 1 ? 'layer' : 'layers'}</em>
        </span>
        <button className={'ic' + (allLocked ? ' on' : ' faint')} title="Lock group" onClick={(e) => (e.stopPropagation(), setGroupFlag(gid, 'locked', !allLocked))}>
          <Lock on={allLocked} />
        </button>
        <button className={'ic' + (allVisible ? '' : ' off')} title="Group visibility" onClick={(e) => (e.stopPropagation(), setGroupFlag(gid, 'visible', !allVisible))}>
          <Eye off={!allVisible} />
        </button>
      </div>,
    );
    if (open) for (const m of members) rows.push(<LayerRow key={m.id} s={m} depth={1} editing={editing} setEditing={setEditing} />);
  }

  return (
    <div className="layers">
      <div className="layer-opts">
        <span>Opacity</span>
        <select
          disabled={!one}
          value={one ? Math.round(one.opacity * 10) * 10 : 100}
          onChange={(e) => updateSelected((s) => ({ ...s, opacity: Number(e.target.value) / 100 }))}
        >
          {[100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0].map((v) => (
            <option key={v} value={v}>{v} %</option>
          ))}
        </select>
        <select disabled={!one || !!one.adjust} value={one?.blend ?? 'normal'} onChange={(e) => updateSelected((s) => ({ ...s, blend: e.target.value }))}>
          {BLENDS.map((b) => (
            <option key={b} value={b}>{label(b)}</option>
          ))}
        </select>
      </div>
      {one?.adjust && <AdjustControls s={one} />}
      <div className="layer-list">
        {list.length === 0 && <p className="hint">No objects yet.</p>}
        {rows}
      </div>
      <footer className="layer-foot">
        <button
          title="New rectangle"
          onClick={() => {
            const st = getState();
            const ab = activeBoard(st);
            const r = makeShape('rect', { x: ab.x + ab.w / 2 - 60, y: ab.y + ab.h / 2 - 40, w: 120, h: 80 });
            const before = st.shapes;
            live([...before, r], [r.id]);
            endLive(before);
          }}
        >
          {I.plusRect}
        </button>
        <button title="New pixel layer" className="txt" onClick={() => addPixelLayer()}>+ Pixel</button>
        <div className="pop">
          <button title="New adjustment layer: filters everything below it, non-destructively" className="txt" onClick={() => setAdjMenu(!adjMenu)}>
            + Adjust
          </button>
          {adjMenu && (
            <div className="menu-pop up" onMouseLeave={() => setAdjMenu(false)}>
              {ADJUSTMENTS.map((d) => (
                <button key={d.type} onClick={() => (addAdjustment(d.type), setAdjMenu(false))}>{d.label}</button>
              ))}
            </div>
          )}
        </div>
        <div className="grow" />
        <button title="Duplicate (Ctrl+D)" onClick={duplicateSelected}><Duplicate /></button>
        <button title="Delete" onClick={deleteSelected}><Trash /></button>
      </footer>
    </div>
  );
}

/* ---------- transform / navigator / history ---------- */

export function TransformPanel() {
  const shapes = useStore((s) => s.shapes);
  const selection = useStore((s) => s.selection);
  const box = unionBox(shapes.filter((s) => selection.includes(s.id)).map(bbox));
  return (
    <div className="panel-body pad">
      <div className="grid2">
        <NumField label="X" value={box?.x ?? null} suffix="px" disabled={!box} onCommit={(x) => box && setTransform(box, { x })} />
        <NumField label="W" value={box?.w ?? null} suffix="px" min={0.01} disabled={!box} onCommit={(w) => box && setTransform(box, { w })} />
        <NumField label="Y" value={box?.y ?? null} suffix="px" disabled={!box} onCommit={(y) => box && setTransform(box, { y })} />
        <NumField label="H" value={box?.h ?? null} suffix="px" min={0.01} disabled={!box} onCommit={(h) => box && setTransform(box, { h })} />
        <NumField label="R" value={0} suffix="°" disabled={!box} onCommit={(deg) => rotateSelection(deg)} />
        <NumField label="S" value={0} suffix="°" disabled={!box} onCommit={(deg) => shearSelection(Math.max(-80, Math.min(80, deg)))} />
      </div>
      <p className="hint tight">R rotates and S shears the selection by the amount you type.</p>
    </div>
  );
}

export function Navigator() {
  const shapes = useStore((s) => s.shapes);
  const artboards = useStore((s) => s.artboards);
  const zoom = useStore((s) => s.zoom);
  const panX = useStore((s) => s.panX);
  const panY = useStore((s) => s.panY);
  const viewport = useStore((s) => s.viewport);
  const ref = useRef<SVGSVGElement>(null);
  const all = unionBox(artboards.map((a) => ({ x: a.x, y: a.y, w: a.w, h: a.h }))) ?? { x: 0, y: 0, w: 800, h: 600 };
  const pad = Math.max(all.w, all.h) * 0.1;
  const vb = { x: all.x - pad, y: all.y - pad, w: all.w + pad * 2, h: all.h + pad * 2 };
  const center = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const scale = Math.max(vb.w / r.width, vb.h / r.height);
    const ox = (r.width - vb.w / scale) / 2;
    const oy = (r.height - vb.h / scale) / 2;
    const dx = vb.x + (e.clientX - r.left - ox) * scale;
    const dy = vb.y + (e.clientY - r.top - oy) * scale;
    setState({ panX: viewport.w / 2 - dx * zoom, panY: viewport.h / 2 - dy * zoom });
  };
  return (
    <div className="panel-body pad">
      <svg
        ref={ref}
        className="nav"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        onPointerDown={(e) => ((e.target as Element).setPointerCapture(e.pointerId), center(e))}
        onPointerMove={(e) => e.buttons && center(e)}
      >
        {artboards.map((a) => (
          <rect key={a.id} x={a.x} y={a.y} width={a.w} height={a.h} fill="#fff" />
        ))}
        <Artwork shapes={shapes} />
        <rect x={-panX / zoom} y={-panY / zoom} width={viewport.w / zoom} height={viewport.h / zoom} fill="none" stroke="#ff5a4e" strokeWidth={vb.w / 120} />
      </svg>
      <div className="row">
        <span className="lbl">Zoom</span>
        <input type="range" min={5} max={800} value={Math.round(zoom * 100)} onChange={(e) => {
          const st = getState();
          const nz = Number(e.target.value) / 100;
          const k = nz / st.zoom;
          setState({ zoom: nz, panX: st.viewport.w / 2 - (st.viewport.w / 2 - st.panX) * k, panY: st.viewport.h / 2 - (st.viewport.h / 2 - st.panY) * k });
        }} />
        <span className="val">{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
}

export function History() {
  const past = useStore((s) => s.past.length);
  const future = useStore((s) => s.future.length);
  const snapshots = useStore((s) => s.snapshots);
  const total = past + future;
  return (
    <div className="panel-body pad">
      <div className="row">
        <span className="lbl">Position</span>
        <input type="range" min={0} max={total} value={past} disabled={!total} onChange={(e) => historyJump(Number(e.target.value))} />
        <span className="val">{past}/{total}</span>
      </div>
      <div className="history-list">
        {Array.from({ length: total + 1 }, (_, i) => (
          <button key={i} className={(i === past ? 'on' : '') + (i > past ? ' future' : '')} onClick={() => historyJump(i)}>
            {i === 0 ? 'Open document' : `Step ${i}`}
          </button>
        )).reverse()}
      </div>
      <div className="snap-head">
        <span>Snapshots</span>
        <button className="mini wide" onClick={() => takeSnapshot()}>+ Take snapshot</button>
      </div>
      <div className="snap-list">
        {snapshots.length === 0 && <p className="hint tight">A snapshot saves the whole document so you can return to it later.</p>}
        {snapshots.map((sn) => (
          <div key={sn.id} className="snap">
            <button onClick={() => restoreSnapshot(sn.id)} title="Restore this snapshot (undoable)">
              <b>{sn.name}</b>
              <em>{new Date(sn.time).toLocaleTimeString()} · {sn.shapes.length} objects</em>
            </button>
            <i title="Delete snapshot" onClick={() => deleteSnapshot(sn.id)}>×</i>
          </div>
        ))}
      </div>
    </div>
  );
}
