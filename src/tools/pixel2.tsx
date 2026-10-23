import { NumField } from '../components/Fields';
import { cloneCanvas } from '../raster/cache';
import { commitPixels, pixelScale, toPixel, workingCanvas } from '../raster/layer';
import { RASTER_OPS, applyOp, defaultOpParams, rasterOp } from '../raster/ops';
import { floodMask } from '../raster/pixels';
import { applySelection, deselect, maskFromDraw, modeFromKeys, selectionFor } from '../raster/selection';
import { getState, setState, useStore } from '../store';
import { toolIcon } from './icons';
import { RetouchOptions, activeLayerOrCreate, base, lazy, makePreview, paintDown, retouch, selLayer } from './pixel';
import type { PointerCtx, Session, ToolDef } from './types';

/* ---------- retouch-engine brushes ---------- */

export const medianBrushTool = retouch('medianbrush', 'Median Brush', undefined, 'retouch', 'median', '**Drag** to remove speckles and noise while keeping edges.');

function ColourBrushOptions() {
  const p = useStore((s) => s.pixel);
  return (
    <>
      <RetouchOptions />
      <NumField label="Tolerance" value={p.tolerance} min={0} onCommit={(v) => setState({ pixel: { ...p, tolerance: Math.max(0, Math.min(255, v)) } })} />
    </>
  );
}

export const colourReplaceTool: ToolDef = {
  ...retouch('colourreplace', 'Colour Replacement', undefined, 'paint', 'colourreplace', '**Drag** to recolour pixels similar to the first colour you click, using the current fill colour. Lightness is kept.'),
  Options: ColourBrushOptions,
};

export const backgroundEraserTool: ToolDef = {
  ...retouch('bgeraser', 'Background Eraser', undefined, 'erase', 'bgerase', '**Drag** to erase pixels similar to the first colour you click. Raise the tolerance to erase more shades.'),
  Options: ColourBrushOptions,
};

export const mixerBrushTool = retouch('mixer', 'Mixer Brush', undefined, 'paint', 'mixer', '**Drag** to smear existing paint while stirring in the current fill colour.');

/* ---------- pixel brush ---------- */

export const pixelBrushTool: ToolDef = {
  ...base,
  id: 'pixelbrush',
  label: 'Pixel Brush',
  key: undefined,
  icon: toolIcon.pixelbrush,
  group: 'paint',
  hint: '**Drag** to paint hard-edged pixels with no anti-aliasing. Size sets the pixel width.',
  down(c) {
    const st = getState();
    // always paint without soft edges, whatever the shared brush hardness is
    const prev = st.pbrush;
    setState({ pbrush: { ...prev, hardness: 1, spacing: Math.min(prev.spacing, 0.5) } });
    const session = paintDown('paint')(c);
    return {
      move: session.move,
      up(m) {
        session.up?.(m);
        setState({ pbrush: prev });
      },
    };
  },
};

/* ---------- flood erase ---------- */

export const floodEraseTool: ToolDef = {
  ...base,
  id: 'floderase',
  label: 'Flood Erase',
  key: undefined,
  icon: toolIcon.floderase,
  group: 'erase',
  hint: '**Click** to erase a whole area of similar colour. Set the tolerance in the context bar; untick Contiguous to erase every match.',
  Options: FloodEraseOptions,
  down(c) {
    const layer = activeLayerOrCreate();
    const { tolerance, contiguous } = getState().pixel;
    const p = toPixel(layer, c.raw.x, c.raw.y);
    const before = getState().shapes;
    void Promise.resolve(workingCanvas(layer)).then((canvas) => {
      const ctx = canvas.getContext('2d')!;
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hit = floodMask(img, p.x, p.y, tolerance, contiguous);
      const sel = selectionFor(layer)?.mask;
      for (let i = 0; i < hit.length; i++) {
        const k = (hit[i] / 255) * (sel ? sel[i] / 255 : 1);
        if (k) img.data[i * 4 + 3] = img.data[i * 4 + 3] * (1 - k);
      }
      ctx.putImageData(img, 0, 0);
      commitPixels(layer.id, canvas, before);
    });
  },
};

function FloodEraseOptions() {
  const p = useStore((s) => s.pixel);
  return (
    <>
      <NumField label="Tolerance" value={p.tolerance} min={0} onCommit={(v) => setState({ pixel: { ...p, tolerance: Math.max(0, Math.min(255, v)) } })} />
      <label className="check">
        <input type="checkbox" checked={p.contiguous} onChange={(e) => setState({ pixel: { ...p, contiguous: e.target.checked } })} /> Contiguous
      </label>
    </>
  );
}

/* ---------- single column / row marquees ---------- */

function lineMarquee(axis: 'col' | 'row') {
  return (c: PointerCtx): Session | void => {
    const layer = selLayer();
    const mode = modeFromKeys(c.shift, c.alt) ?? getState().pixel.selectMode;
    const p = toPixel(layer, c.raw.x, c.raw.y);
    if (p.x < 0 || p.y < 0 || p.x >= layer.rw || p.y >= layer.rh) {
      if (mode === 'replace') deselect();
      return;
    }
    const region = maskFromDraw(layer, (ctx) => {
      ctx.beginPath();
      if (axis === 'col') ctx.rect(Math.floor(p.x), 0, 1, layer.rh);
      else ctx.rect(0, Math.floor(p.y), layer.rw, 1);
      ctx.fillStyle = '#fff';
      ctx.fill();
    });
    applySelection(layer, region, mode);
  };
}

export const columnMarqueeTool: ToolDef = {
  ...base,
  id: 'colmarquee',
  label: 'Column Marquee',
  key: undefined,
  icon: toolIcon.colmarquee,
  group: 'marquee',
  hint: '**Click** to select a one-pixel-wide column. Shift adds, Alt subtracts.',
  down: lineMarquee('col'),
};

export const rowMarqueeTool: ToolDef = {
  ...base,
  id: 'rowmarquee',
  label: 'Row Marquee',
  key: undefined,
  icon: toolIcon.rowmarquee,
  group: 'marquee',
  hint: '**Click** to select a one-pixel-tall row. Shift adds, Alt subtracts.',
  down: lineMarquee('row'),
};

/* ---------- filter and adjustment brushes ---------- */

function OpBrushOptions({ kind }: { kind: 'filter' | 'adjust' }) {
  const b = useStore((s) => s.pbrush);
  const chosen = useStore((s) => s.opBrush[kind]);
  const all = useStore((s) => s.opBrush);
  const ops = RASTER_OPS.filter((o) => o.kind === kind);
  return (
    <>
      <span className="dim">{kind === 'filter' ? 'Filter' : 'Adjustment'}</span>
      <select value={chosen} onChange={(e) => setState({ opBrush: { ...all, [kind]: e.target.value } })}>
        {ops.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      <NumField label="Size" value={b.size} suffix="px" min={1} onCommit={(size) => setState({ pbrush: { ...b, size: Math.min(600, size) } })} />
      <NumField label="Hard" value={Math.round(b.hardness * 100)} suffix="%" min={0} onCommit={(v) => setState({ pbrush: { ...b, hardness: Math.max(0, Math.min(1, v / 100)) } })} />
    </>
  );
}

const soft = (d: number, hardness: number) => {
  if (d >= 1) return 0;
  const a = Math.min(1, Math.max(0, (1 - d) / Math.max(0.001, 1 - hardness)));
  return a * a * (3 - 2 * a);
};

/** Paint where an operation should apply; the result is previewed live and committed on release. */
function opBrush(kind: 'filter' | 'adjust') {
  return (c: PointerCtx): Session | void => {
    const layer = activeLayerOrCreate();
    const st = getState();
    const op = rasterOp(st.opBrush[kind]);
    if (!op) return;
    const before = st.shapes;
    const radius = Math.max(1, (st.pbrush.size * pixelScale(layer).sx) / 2);
    return lazy(workingCanvas(layer), (canvas) => {
      const original = cloneCanvas(canvas);
      const w = canvas.width;
      const h = canvas.height;
      const painted = new Uint8Array(w * h);
      const sel = selectionFor(layer)?.mask ?? null;
      const params = defaultOpParams(op);
      const result = () => {
        const out = cloneCanvas(original);
        const ctx = out.getContext('2d')!;
        const img = ctx.getImageData(0, 0, w, h);
        const mask = sel ? painted.map((v, i) => (v * sel[i]) / 255) : painted;
        applyOp(img, op, params, mask);
        ctx.putImageData(img, 0, 0);
        return out;
      };
      const preview = makePreview(layer.id, result);
      const stamp = (x: number, y: number) => {
        const x0 = Math.max(0, Math.floor(x - radius));
        const x1 = Math.min(w - 1, Math.ceil(x + radius));
        const y0 = Math.max(0, Math.floor(y - radius));
        const y1 = Math.min(h - 1, Math.ceil(y + radius));
        for (let py = y0; py <= y1; py++)
          for (let px = x0; px <= x1; px++) {
            const k = Math.round(soft(Math.hypot(px + 0.5 - x, py + 0.5 - y) / radius, st.pbrush.hardness) * 255);
            if (k > painted[py * w + px]) painted[py * w + px] = k;
          }
      };
      let last = toPixel(layer, c.raw.x, c.raw.y);
      stamp(last.x, last.y);
      if (w * h <= 1_000_000) preview.schedule();
      return {
        move(m) {
          const p = toPixel(layer, m.raw.x, m.raw.y);
          const dist = Math.hypot(p.x - last.x, p.y - last.y);
          const steps = Math.max(1, Math.ceil(dist / Math.max(1, radius * 0.4)));
          for (let i = 1; i <= steps; i++) stamp(last.x + ((p.x - last.x) * i) / steps, last.y + ((p.y - last.y) * i) / steps);
          last = p;
          if (w * h <= 1_000_000) preview.schedule();
        },
        up() {
          commitPixels(layer.id, result(), before);
        },
      };
    });
  };
}

export const filterBrushTool: ToolDef = {
  ...base,
  id: 'filterbrush',
  label: 'Filter Brush',
  key: undefined,
  icon: toolIcon.filterbrush,
  group: 'retouch',
  hint: '**Drag** to apply the chosen filter only where you paint. Pick the filter in the context bar.',
  Options: () => <OpBrushOptions kind="filter" />,
  down: opBrush('filter'),
};

export const adjustBrushTool: ToolDef = {
  ...base,
  id: 'adjustbrush',
  label: 'Adjustment Brush',
  key: undefined,
  icon: toolIcon.adjustbrush,
  group: 'tone',
  hint: '**Drag** to apply the chosen adjustment only where you paint. Pick the adjustment in the context bar.',
  Options: () => <OpBrushOptions kind="adjust" />,
  down: opBrush('adjust'),
};

export const pixelTools2: ToolDef[] = [medianBrushTool, colourReplaceTool, backgroundEraserTool, mixerBrushTool, pixelBrushTool, floodEraseTool, columnMarqueeTool, rowMarqueeTool, filterBrushTool, adjustBrushTool];
