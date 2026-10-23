import { useEffect, useRef, useState } from 'react';
import { BRUSH_PRESETS, Stroke, parseColour, presetById } from '../raster/brush';
import { makeCanvas } from '../raster/cache';
import { applyRasterDialog, cancelRasterDialog, openRasterOp, setRasterPreview, updateRasterParams } from '../raster/dialog';
import { commitPixels, targetLayer, workingCanvas } from '../raster/layer';
import { loadMacros, playMacro, saveMacros, startRecording, stopRecording, type PixelMacro } from '../raster/macro';
import { RASTER_OPS, rasterOp } from '../raster/ops';
import { RANGE_LABELS, outlineSelection, selectRange, type RangeKind } from '../raster/range';
import { deselect, featherSelection, growSelection, invertSelection, selectAll, selectionFor, smoothSelection } from '../raster/selection';
import { getState, setState, useStore } from '../store';
import { NumField, Section } from './Fields';

/* ---------- brush panel ---------- */

function BrushPreview() {
  const ref = useRef<HTMLCanvasElement>(null);
  const b = useStore((s) => s.pbrush);
  const fill = useStore((s) => s.fill);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = 232;
    const h = 56;
    const base = makeCanvas(w, h);
    // preview at a size that fits the box, keeping the brush's own proportions
    const scale = Math.min(1, 34 / Math.max(1, b.size));
    const stroke = new Stroke(base, { ...b }, scale, parseColour(fill ?? '#000000'), 'paint');
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const x = 14 + t * (w - 28);
      const y = h / 2 + Math.sin(t * Math.PI * 2) * 12;
      if (i === 0) stroke.begin(x, y);
      else stroke.lineTo(x, y);
    }
    const ctx = el.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(stroke.result, 0, 0);
  }, [b, fill]);
  return <canvas ref={ref} width={232} height={56} className="brush-preview" />;
}

export function BrushPanel() {
  const b = useStore((s) => s.pbrush);
  const set = (patch: Partial<typeof b>) => setState({ pbrush: { ...b, ...patch, preset: 'custom' } });
  const slider = (label: string, key: 'size' | 'hardness' | 'opacity' | 'flow' | 'spacing' | 'roundness' | 'angle' | 'jitter', min: number, max: number, step: number, fmt: (v: number) => string) => (
    <div className="row" key={key}>
      <span className="lbl">{label}</span>
      <input type="range" min={min} max={max} step={step} value={b[key]} onChange={(e) => set({ [key]: Number(e.target.value) } as Partial<typeof b>)} />
      <span className="val">{fmt(b[key])}</span>
    </div>
  );
  return (
    <div className="panel-body">
      <div className="pad">
        <BrushPreview />
      </div>
      <Section title="Brushes">
        <div className="preset-grid">
          {BRUSH_PRESETS.map((p) => (
            <button key={p.id} className={b.preset === p.id ? 'on' : ''} onClick={() => setState({ pbrush: { ...p.params, preset: p.id } })} title={p.category}>
              {p.name}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Shape">
        {slider('Size', 'size', 1, 400, 1, (v) => `${Math.round(v)}`)}
        {slider('Hardness', 'hardness', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`)}
        {slider('Roundness', 'roundness', 0.1, 1, 0.01, (v) => `${Math.round(v * 100)}%`)}
        {slider('Angle', 'angle', 0, 180, 1, (v) => `${Math.round(v)}°`)}
        <div className="row">
          <span className="lbl">Texture</span>
          <select value={b.texture} onChange={(e) => set({ texture: e.target.value as typeof b.texture })}>
            <option value="none">None</option>
            <option value="grain">Grain</option>
            <option value="chalk">Chalk</option>
            <option value="bristle">Bristle</option>
          </select>
        </div>
      </Section>
      <Section title="Dynamics">
        {slider('Opacity', 'opacity', 0.01, 1, 0.01, (v) => `${Math.round(v * 100)}%`)}
        {slider('Flow', 'flow', 0.01, 1, 0.01, (v) => `${Math.round(v * 100)}%`)}
        {slider('Spacing', 'spacing', 0.02, 1.5, 0.01, (v) => `${Math.round(v * 100)}%`)}
        {slider('Scatter', 'jitter', 0, 3, 0.05, (v) => v.toFixed(2))}
      </Section>
    </div>
  );
  void presetById;
}

/* ---------- adjustments and filters ---------- */

function OpList({ kind }: { kind: 'adjust' | 'filter' }) {
  const ops = RASTER_OPS.filter((o) => o.kind === kind);
  const cats = Array.from(new Set(ops.map((o) => o.category)));
  return (
    <div className="panel-body">
      {cats.map((cat) => (
        <Section key={cat} title={cat}>
          <div className="op-list">
            {ops
              .filter((o) => o.category === cat)
              .map((o) => (
                <button key={o.id} onClick={() => void openRasterOp(o.id)}>
                  {o.name}
                  {o.params.length ? '…' : ''}
                </button>
              ))}
          </div>
        </Section>
      ))}
    </div>
  );
}

export const AdjustmentsPanel = () => <OpList kind="adjust" />;
export const FiltersPanel = () => <OpList kind="filter" />;

/* ---------- selection ---------- */

export function SelectionPanel() {
  const sel = useStore((s) => s.pixelSel);
  const layerOf = () => targetLayer();
  const withLayer = (f: (l: NonNullable<ReturnType<typeof layerOf>>) => void) => () => {
    const l = layerOf();
    if (l) f(l);
  };
  const fillSelection = () => {
    const layer = layerOf();
    const st = getState();
    if (!layer) return;
    const s = selectionFor(layer);
    const before = st.shapes;
    void Promise.resolve(workingCanvas(layer)).then((canvas) => {
      const ctx = canvas.getContext('2d')!;
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const [r, g, b] = parseColour(st.fill ?? '#000000');
      for (let i = 0; i < canvas.width * canvas.height; i++) {
        const k = s ? s.mask[i] / 255 : 1;
        if (!k) continue;
        img.data[i * 4] += (r - img.data[i * 4]) * k;
        img.data[i * 4 + 1] += (g - img.data[i * 4 + 1]) * k;
        img.data[i * 4 + 2] += (b - img.data[i * 4 + 2]) * k;
        img.data[i * 4 + 3] += (255 - img.data[i * 4 + 3]) * k;
      }
      ctx.putImageData(img, 0, 0);
      commitPixels(layer.id, canvas, before);
    });
  };
  return (
    <div className="panel-body">
      <Section title="Selection">
        <div className="btn-row">
          <button onClick={withLayer(selectAll)}>Select all</button>
          <button onClick={deselect} disabled={!sel}>Deselect</button>
          <button onClick={withLayer(invertSelection)}>Invert</button>
          <button onClick={fillSelection}>Fill</button>
        </div>
        <div className="row">
          <button className="mini wide" disabled={!sel} onClick={withLayer((l) => growSelection(l, 2))}>Grow 2px</button>
          <button className="mini wide" disabled={!sel} onClick={withLayer((l) => growSelection(l, -2))}>Shrink 2px</button>
        </div>
        <div className="row">
          <button className="mini wide" disabled={!sel} onClick={withLayer((l) => featherSelection(l, 6))}>Feather 6px</button>
          <button className="mini wide" disabled={!sel} onClick={withLayer((l) => smoothSelection(l, 4))}>Smooth</button>
        </div>
        <div className="row">
          <button className="mini wide" disabled={!sel} onClick={withLayer((l) => outlineSelection(l, 3))}>Outline 3px</button>
        </div>
        <div className="menu-head">Select by range</div>
        <div className="range-grid">
          {(Object.keys(RANGE_LABELS) as RangeKind[]).map((k) => (
            <button key={k} className="mini wide" title="Shift adds to the current selection" onClick={(e) => withLayer((l) => void selectRange(l, k, e.shiftKey ? 'add' : 'replace'))()}>
              {RANGE_LABELS[k]}
            </button>
          ))}
        </div>
        <p className="hint tight">{sel ? 'A selection is active: painting, filters and adjustments stay inside it.' : 'No selection. Use the Marquee, Freehand, Flood Select or Selection Brush.'}</p>
      </Section>
    </div>
  );
}

/* ---------- live-preview dialog ---------- */

export function RasterDialog() {
  const d = useStore((s) => s.rasterDialog);
  if (!d) return null;
  const op = rasterOp(d.opId);
  if (!op) return null;
  return (
    <div className="raster-dialog" onPointerDown={(e) => e.stopPropagation()}>
      <header>
        <b>{op.name}</b>
        <button className="ibtn" onClick={cancelRasterDialog} title="Cancel">×</button>
      </header>
      <div className="rd-body">
        {op.params.length === 0 && <p className="hint tight">This adjustment has no settings.</p>}
        {op.params.map((q) => (
          <div className="row" key={q.key}>
            <span className="lbl wide">{q.label}</span>
            <input type="range" min={q.min} max={q.max} step={q.step} value={d.params[q.key]} onChange={(e) => updateRasterParams({ [q.key]: Number(e.target.value) })} />
            <NumField label="" value={d.params[q.key]} min={q.min} step={q.step} onCommit={(v) => updateRasterParams({ [q.key]: Math.max(q.min, Math.min(q.max, v)) })} />
          </div>
        ))}
      </div>
      <footer>
        <label className="check">
          <input type="checkbox" checked={d.preview} onChange={(e) => setRasterPreview(e.target.checked)} /> Preview
        </label>
        <div className="grow" />
        <button className="btn ghost" onClick={cancelRasterDialog}>Cancel</button>
        <button className="btn primary" onClick={applyRasterDialog}>Apply</button>
      </footer>
    </div>
  );
}

/* ---------- macros ---------- */

export function MacroPanel() {
  const recording = useStore((s) => s.macroRecording);
  const count = useStore((s) => s.macroSteps);
  const [macros, setMacros] = useState<PixelMacro[]>(loadMacros);
  const [msg, setMsg] = useState('');
  const persist = (list: PixelMacro[]) => (setMacros(list), saveMacros(list));

  const stop = () => {
    const steps = stopRecording();
    if (!steps.length) return setMsg('Nothing was recorded. Apply a filter or adjustment while recording.');
    const name = window.prompt('Name this macro', 'Macro ' + (macros.length + 1));
    if (name) persist([...macros, { id: 'pm' + Date.now(), name, steps }]);
  };
  const play = async (m: PixelMacro) => {
    const n = await playMacro(m.steps);
    setMsg(n ? `Applied ${n} step${n === 1 ? '' : 's'} as one undo step.` : '');
  };
  const exportAll = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(macros, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vectoredit-macros.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  const importAll = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const raw = JSON.parse(await file.text());
        const incoming = (Array.isArray(raw) ? raw : []).filter((m) => m && typeof m.name === 'string' && Array.isArray(m.steps));
        persist([...macros, ...incoming.map((m: PixelMacro, i: number) => ({ id: 'pm' + Date.now() + i, name: m.name, steps: m.steps }))]);
        setMsg(`Imported ${incoming.length} macro(s).`);
      } catch {
        setMsg('That file is not a macro file.');
      }
    };
    input.click();
  };

  return (
    <div className="panel-body">
      <p className="hint">Record a sequence of filters and adjustments, then replay it on any pixel layer in one undo step.</p>
      <div className="pad row">
        {recording ? (
          <button className="btn primary" onClick={stop}>● Stop ({count})</button>
        ) : (
          <button className="btn" onClick={startRecording}>● Record</button>
        )}
        <div className="grow" />
        <button className="mini wide" onClick={importAll}>Import</button>
        <button className="mini wide" disabled={!macros.length} onClick={exportAll}>Export</button>
      </div>
      {msg && <p className="hint">{msg}</p>}
      <div className="slice-list">
        {macros.map((m) => (
          <div key={m.id} className="slice">
            <div className="slice-head">
              <b className="grow">{m.name}</b>
              <em className="dim">{m.steps.length} steps</em>
              <button className="mini wide" onClick={() => void play(m)}>Play</button>
              <button className="mini" onClick={() => persist(macros.filter((x) => x.id !== m.id))}>×</button>
            </div>
            <div className="dim">{m.steps.map((s) => rasterOp(s.op)?.name ?? s.op).join(' → ')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
