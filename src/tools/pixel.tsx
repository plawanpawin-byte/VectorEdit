import { NumField } from '../components/Fields';
import { BRUSH_PRESETS, Stroke, parseColour, presetById } from '../raster/brush';
import { makeCanvas, cloneCanvas } from '../raster/cache';
import { ensureLayer, commitPixels, pixelScale, previewCanvas, targetLayer, toPixel, workingCanvas } from '../raster/layer';
import { floodMask } from '../raster/pixels';
import { type RetouchKind, dab } from '../raster/retouch';
import { applySelection, deselect, maskFromDraw, modeFromKeys, selectionFor, setSelection } from '../raster/selection';
import { commit, getState, setColor, setState, useStore } from '../store';
import type { Shape } from '../types';
import { toolIcon } from './icons';
import type { PointerCtx, Session, ToolDef } from './types';

/* ---------- shared plumbing ---------- */

/** Run a session builder once the layer's pixels are available, queueing events until then. */
export function lazy(work: HTMLCanvasElement | Promise<HTMLCanvasElement>, build: (canvas: HTMLCanvasElement) => Session): Session {
  if (!(work instanceof Promise)) return build(work);
  let real: Session | null = null;
  const queue: ['move' | 'up', PointerCtx][] = [];
  void work.then((canvas) => {
    real = build(canvas);
    for (const [k, c] of queue) real[k]?.(c);
    queue.length = 0;
  });
  return {
    move: (c) => (real ? real.move?.(c) : queue.push(['move', c])),
    up: (c) => (real ? real.up?.(c) : queue.push(['up', c])),
  };
}

/** Show intermediate pixels at a modest rate; encoding a big canvas on every pointer move is slow. */
export function makePreview(layerId: string, canvas: () => HTMLCanvasElement) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => {
    timer = null;
    previewCanvas(layerId, canvas());
  };
  return {
    schedule() {
      if (!timer) timer = setTimeout(run, 40);
    },
    flush() {
      if (timer) clearTimeout(timer);
      run();
    },
  };
}

export const base = {
  workspaces: ['pixel'] as ToolDef['workspaces'],
  cursor: 'crosshair',
  chrome: 'none' as const,
};

export const activeLayerOrCreate = (): Shape => {
  const layer = ensureLayer();
  setState({ selection: [layer.id] });
  return getState().shapes.find((s) => s.id === layer.id) ?? layer;
};

const hex = (c: string | null) => c ?? '#000000';

/* ---------- paint and erase ---------- */

export function paintDown(mode: 'paint' | 'erase') {
  return (c: PointerCtx): Session => {
    const layer = activeLayerOrCreate();
    const st = getState();
    const before = st.shapes;
    const params = st.pbrush;
    const colour = parseColour(hex(st.fill));
    return lazy(workingCanvas(layer), (canvas) => {
      const mask = selectionFor(layer)?.mask ?? null;
      const stroke = new Stroke(canvas, params, pixelScale(layer).sx, colour, mode, mask);
      const preview = makePreview(layer.id, () => stroke.result);
      const p0 = toPixel(layer, c.raw.x, c.raw.y);
      stroke.begin(p0.x, p0.y);
      preview.schedule();
      return {
        move(m) {
          const p = toPixel(layer, m.raw.x, m.raw.y);
          stroke.lineTo(p.x, p.y);
          preview.schedule();
        },
        up() {
          preview.flush();
          commitPixels(layer.id, stroke.result, before);
        },
      };
    });
  };
}

export function BrushOptions() {
  const b = useStore((s) => s.pbrush);
  const set = (patch: Partial<typeof b>) => setState({ pbrush: { ...b, ...patch } });
  return (
    <>
      <span className="dim">Brush</span>
      <select
        value={b.preset}
        onChange={(e) => {
          const p = presetById(e.target.value);
          if (p) setState({ pbrush: { ...p.params, preset: p.id } });
        }}
      >
        {Array.from(new Set(BRUSH_PRESETS.map((p) => p.category))).map((cat) => (
          <optgroup key={cat} label={cat}>
            {BRUSH_PRESETS.filter((p) => p.category === cat).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <NumField label="Size" value={b.size} suffix="px" min={1} onCommit={(size) => set({ size: Math.min(1000, size) })} />
      <NumField label="Hard" value={Math.round(b.hardness * 100)} suffix="%" min={0} onCommit={(v) => set({ hardness: Math.max(0, Math.min(1, v / 100)) })} />
      <NumField label="Opacity" value={Math.round(b.opacity * 100)} suffix="%" min={1} onCommit={(v) => set({ opacity: Math.max(0.01, Math.min(1, v / 100)) })} />
      <NumField label="Flow" value={Math.round(b.flow * 100)} suffix="%" min={1} onCommit={(v) => set({ flow: Math.max(0.01, Math.min(1, v / 100)) })} />
    </>
  );
}

export const brushTool: ToolDef = {
  ...base,
  id: 'brush',
  label: 'Paint Brush',
  key: 'b',
  icon: toolIcon.brush,
  group: 'paint',
  hint: '**Drag** to paint with the fill colour. Pick a brush in the context bar; **[ ]** changes the size. Painting stays inside the selection.',
  Options: BrushOptions,
  down: paintDown('paint'),
};

export const eraserTool: ToolDef = {
  ...base,
  id: 'eraser',
  label: 'Eraser',
  key: 'e',
  icon: toolIcon.eraser,
  group: 'erase',
  hint: '**Drag** to erase pixels to transparency. It uses the same brush settings.',
  Options: BrushOptions,
  down: paintDown('erase'),
};

/* ---------- retouch brushes ---------- */

export function RetouchOptions() {
  const b = useStore((s) => s.pbrush);
  const p = useStore((s) => s.pixel);
  return (
    <>
      <NumField label="Size" value={b.size} suffix="px" min={1} onCommit={(size) => setState({ pbrush: { ...b, size: Math.min(600, size) } })} />
      <NumField label="Hard" value={Math.round(b.hardness * 100)} suffix="%" min={0} onCommit={(v) => setState({ pbrush: { ...b, hardness: Math.max(0, Math.min(1, v / 100)) } })} />
      <NumField label="Strength" value={Math.round(p.strength * 100)} suffix="%" min={1} onCommit={(v) => setState({ pixel: { ...p, strength: Math.max(0.01, Math.min(1, v / 100)) } })} />
    </>
  );
}

let cloneSource: { x: number; y: number } | null = null;

export function retouchDown(kind: RetouchKind) {
  return (c: PointerCtx): Session | void => {
    const layer = activeLayerOrCreate();
    const st = getState();
    // clone: Alt-click chooses the source point
    if ((kind === 'clone' || kind === 'heal') && c.alt) {
      cloneSource = toPixel(layer, c.raw.x, c.raw.y);
      return;
    }
    const start = toPixel(layer, c.raw.x, c.raw.y);
    if ((kind === 'clone' || kind === 'heal') && !cloneSource) {
      alert('Alt-click on the image first to choose where to copy from.');
      return;
    }
    const before = st.shapes;
    const radius = Math.max(1, (st.pbrush.size * pixelScale(layer).sx) / 2);
    const strength = kind === 'blemish' || kind === 'redeye' ? 1 : st.pixel.strength;
    const source = (kind === 'clone' || kind === 'heal') && cloneSource ? { dx: cloneSource.x - start.x, dy: cloneSource.y - start.y } : null;
    return lazy(workingCanvas(layer), (canvas) => {
      const ctx = canvas.getContext('2d')!;
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const mask = selectionFor(layer)?.mask ?? null;
      let carried: ReturnType<typeof dab>['carried'] = null;
      const sx = Math.min(canvas.width - 1, Math.max(0, Math.round(start.x)));
      const sy = Math.min(canvas.height - 1, Math.max(0, Math.round(start.y)));
      const here = (sy * canvas.width + sx) * 4;
      // colour-aware brushes remember the colour under the first click
      const target: [number, number, number] | null = kind === 'colourreplace' || kind === 'bgerase' ? [img.data[here], img.data[here + 1], img.data[here + 2]] : null;
      const replace = parseColour(st.fill ?? '#000000');
      const tolerance = st.pixel.tolerance;
      const flush = () => ctx.putImageData(img, 0, 0);
      const preview = makePreview(layer.id, () => (flush(), canvas));
      const stamp = (x: number, y: number) => {
        carried = dab(img, kind, x, y, radius, st.pbrush.hardness, strength, { mask, carried, source, target, tolerance, replace }).carried;
      };
      let last = start;
      let carry = 0;
      stamp(start.x, start.y);
      preview.schedule();
      return {
        move(m) {
          const p = toPixel(layer, m.raw.x, m.raw.y);
          if (kind === 'blemish' || kind === 'redeye') return; // one click, one fix
          const step = Math.max(1, radius * 0.5);
          let dist = Math.hypot(p.x - last.x, p.y - last.y);
          let lx = last.x;
          let ly = last.y;
          while (dist + carry >= step) {
            const t = (step - carry) / dist;
            lx += (p.x - lx) * t;
            ly += (p.y - ly) * t;
            stamp(lx, ly);
            dist = Math.hypot(p.x - lx, p.y - ly);
            carry = 0;
          }
          carry += dist;
          last = p;
          preview.schedule();
        },
        up() {
          flush();
          preview.flush();
          commitPixels(layer.id, canvas, before);
        },
      };
    });
  };
}

export const retouch = (id: ToolDef['id'], label: string, key: string | undefined, group: string, kind: RetouchKind, hint: string): ToolDef => ({
  ...base,
  id,
  label,
  key,
  icon: toolIcon[id as string],
  group,
  hint,
  Options: RetouchOptions,
  down: retouchDown(kind),
});

export const cloneTool = retouch('clone', 'Clone', 's', 'retouch', 'clone', '**Alt-click** to choose a source, then **drag** to paint a copy of it.');
export const smudgeTool = retouch('smudge', 'Smudge', 'u', 'retouch', 'smudge', '**Drag** to smear pixels along the stroke.');
export const blurBrushTool = retouch('blurbrush', 'Blur Brush', 'o', 'retouch', 'blur', '**Drag** to soften an area.');
export const sharpenBrushTool = retouch('sharpenbrush', 'Sharpen Brush', 'p', 'retouch', 'sharpen', '**Drag** to bring out detail.');
export const dodgeTool = retouch('dodge', 'Dodge', 'k', 'tone', 'dodge', '**Drag** to lighten areas.');
export const burnTool = retouch('burn', 'Burn', 'n', 'tone', 'burn', '**Drag** to darken areas.');
export const saturateTool = retouch('saturate', 'Saturate Brush', undefined, 'tone', 'saturate', '**Drag** to intensify colour.');
export const desaturateTool = retouch('desaturate', 'Desaturate Brush', undefined, 'tone', 'desaturate', '**Drag** to drain colour.');
export const healTool = retouch('heal', 'Healing Brush', undefined, 'heal', 'heal', '**Alt-click** to choose a source, then **drag**: texture comes from the source while tone and colour blend with the destination.');
export const blemishTool = retouch('blemish', 'Blemish Remover', 'j', 'heal', 'blemish', '**Click** a spot to replace it with the colour around it. Set the size to cover the blemish.');
export const redEyeTool = retouch('redeye', 'Red Eye Removal', 'y', 'heal', 'redeye', '**Click** a red pupil to neutralise it. Set the size to match the eye.');

/* ---------- selection tools ---------- */

export function SelectOptions() {
  const p = useStore((s) => s.pixel);
  const sel = useStore((s) => s.pixelSel);
  return (
    <>
      <span className="dim">Mode</span>
      <select value={p.selectMode} onChange={(e) => setState({ pixel: { ...p, selectMode: e.target.value as typeof p.selectMode } })}>
        <option value="replace">New</option>
        <option value="add">Add</option>
        <option value="subtract">Subtract</option>
        <option value="intersect">Intersect</option>
      </select>
      {sel && (
        <button className="mini wide" onClick={deselect}>
          Deselect
        </button>
      )}
    </>
  );
}

function WandOptions() {
  const p = useStore((s) => s.pixel);
  return (
    <>
      <SelectOptions />
      <NumField label="Tolerance" value={p.tolerance} min={0} onCommit={(v) => setState({ pixel: { ...p, tolerance: Math.max(0, Math.min(255, v)) } })} />
      <label className="check">
        <input type="checkbox" checked={p.contiguous} onChange={(e) => setState({ pixel: { ...p, contiguous: e.target.checked } })} /> Contiguous
      </label>
    </>
  );
}

export const selLayer = (): Shape => targetLayer() ?? activeLayerOrCreate();

function clearSelected(): boolean {
  const layer = targetLayer();
  const sel = layer && selectionFor(layer);
  if (!layer || !sel) return false;
  const before = getState().shapes;
  void Promise.resolve(workingCanvas(layer)).then((canvas) => {
    const ctx = canvas.getContext('2d')!;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < sel.mask.length; i++) img.data[i * 4 + 3] = (img.data[i * 4 + 3] * (255 - sel.mask[i])) / 255;
    ctx.putImageData(img, 0, 0);
    commitPixels(layer.id, canvas, before);
  });
  return true;
}

function shapeSelect(kind: 'rect' | 'ellipse') {
  return (c: PointerCtx): Session => {
    const layer = selLayer();
    const mode = modeFromKeys(c.shift, c.alt) ?? getState().pixel.selectMode;
    const start = c.raw;
    let box = { x: start.x, y: start.y, w: 0, h: 0 };
    return {
      move(m) {
        let dx = m.raw.x - start.x;
        let dy = m.raw.y - start.y;
        if (m.shift && !c.shift) {
          const k = Math.max(Math.abs(dx), Math.abs(dy));
          dx = Math.sign(dx || 1) * k;
          dy = Math.sign(dy || 1) * k;
        }
        const x0 = m.alt && !c.alt ? start.x - dx : start.x;
        const y0 = m.alt && !c.alt ? start.y - dy : start.y;
        box = { x: Math.min(x0, x0 + dx), y: Math.min(y0, y0 + dy), w: Math.abs(dx), h: Math.abs(dy) };
        const k = 1 / m.zoom;
        m.setOverlay(
          kind === 'rect' ? (
            <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="rgba(45,140,240,.12)" stroke="#fff" strokeWidth={k} strokeDasharray={`${4 * k} ${3 * k}`} pointerEvents="none" />
          ) : (
            <ellipse cx={box.x + box.w / 2} cy={box.y + box.h / 2} rx={box.w / 2} ry={box.h / 2} fill="rgba(45,140,240,.12)" stroke="#fff" strokeWidth={k} strokeDasharray={`${4 * k} ${3 * k}`} pointerEvents="none" />
          ),
        );
      },
      up(m) {
        m.setOverlay(null);
        if (box.w < 1 || box.h < 1) {
          if (mode === 'replace') deselect();
          return;
        }
        const a = toPixel(layer, box.x, box.y);
        const b = toPixel(layer, box.x + box.w, box.y + box.h);
        const region = maskFromDraw(layer, (ctx) => {
          ctx.beginPath();
          if (kind === 'rect') ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y);
          else ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, (b.x - a.x) / 2, (b.y - a.y) / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        });
        applySelection(layer, region, mode);
      },
    };
  };
}

export const marqueeTool: ToolDef = {
  ...base,
  id: 'marquee',
  label: 'Rectangular Marquee',
  key: 'm',
  icon: toolIcon.marquee,
  group: 'marquee',
  hint: '**Drag** to select a rectangle. **Shift** adds, **Alt** subtracts, **Shift+Alt** intersects. **Delete** clears the selected pixels.',
  Options: SelectOptions,
  down: shapeSelect('rect'),
  onDelete: clearSelected,
};

export const ellipseMarqueeTool: ToolDef = {
  ...base,
  id: 'marquee-ellipse',
  label: 'Elliptical Marquee',
  icon: toolIcon['marquee-ellipse'],
  group: 'marquee',
  hint: '**Drag** to select an ellipse. Hold **Shift** to constrain to a circle.',
  Options: SelectOptions,
  down: shapeSelect('ellipse'),
  onDelete: clearSelected,
};

export const lassoTool: ToolDef = {
  ...base,
  id: 'lasso',
  label: 'Freehand Selection',
  key: 'l',
  icon: toolIcon.lasso,
  group: 'lasso',
  hint: '**Drag** around the area to select. Modifier keys add, subtract or intersect.',
  Options: SelectOptions,
  onDelete: clearSelected,
  down(c) {
    const layer = selLayer();
    const mode = modeFromKeys(c.shift, c.alt) ?? getState().pixel.selectMode;
    const pts = [c.raw];
    return {
      move(m) {
        pts.push(m.raw);
        m.setOverlay(<path d={`M${pts.map((q) => `${q.x} ${q.y}`).join('L')}Z`} fill="rgba(45,140,240,.12)" stroke="#fff" strokeWidth={1 / m.zoom} strokeDasharray={`${4 / m.zoom} ${3 / m.zoom}`} pointerEvents="none" />);
      },
      up(m) {
        m.setOverlay(null);
        if (pts.length < 3) return mode === 'replace' ? deselect() : undefined;
        const region = maskFromDraw(layer, (ctx) => {
          ctx.beginPath();
          pts.forEach((q, i) => {
            const p = toPixel(layer, q.x, q.y);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.fill();
        });
        applySelection(layer, region, mode);
      },
    };
  },
};

export const wandTool: ToolDef = {
  ...base,
  id: 'wand',
  label: 'Flood Select',
  key: 'w',
  icon: toolIcon.wand,
  group: 'lasso',
  hint: '**Click** to select similar colours. Raise the tolerance to include more shades; untick Contiguous to select every match.',
  Options: WandOptions,
  onDelete: clearSelected,
  down(c) {
    const layer = selLayer();
    const mode = modeFromKeys(c.shift, c.alt) ?? getState().pixel.selectMode;
    const { tolerance, contiguous } = getState().pixel;
    const p = toPixel(layer, c.raw.x, c.raw.y);
    void Promise.resolve(workingCanvas(layer)).then((canvas) => {
      const img = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
      applySelection(layer, floodMask(img, p.x, p.y, tolerance, contiguous), mode);
    });
  },
};

export const selectionBrushTool: ToolDef = {
  ...base,
  id: 'selbrush',
  label: 'Selection Brush',
  key: 'q',
  icon: toolIcon.selbrush,
  group: 'lasso',
  hint: '**Drag** to paint a selection. **Alt** removes from the selection. The brush size is set in the context bar.',
  Options: RetouchOptions,
  onDelete: clearSelected,
  down(c) {
    const layer = selLayer();
    const st = getState();
    const sub = c.alt;
    const sc = pixelScale(layer).sx;
    const radius = Math.max(1, (st.pbrush.size * sc) / 2);
    const startMask = selectionFor(layer)?.mask ?? new Uint8Array(layer.rw * layer.rh);
    const paint = makeCanvas(layer.rw, layer.rh);
    const ctx = paint.getContext('2d')!;
    let last: { x: number; y: number } | null = null;
    const stamp = (x: number, y: number) => {
      const g = ctx.createRadialGradient(x, y, radius * st.pbrush.hardness, x, y, radius);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };
    const apply = () => {
      const img = ctx.getImageData(0, 0, paint.width, paint.height);
      const m = new Uint8Array(startMask.length);
      for (let i = 0; i < m.length; i++) {
        const a = img.data[i * 4 + 3];
        m[i] = sub ? Math.round((startMask[i] * (255 - a)) / 255) : Math.max(startMask[i], a);
      }
      setSelection(layer, m);
    };
    const move = (x: number, y: number) => {
      const p = toPixel(layer, x, y);
      if (!last) stamp(p.x, p.y);
      else {
        const d = Math.hypot(p.x - last.x, p.y - last.y);
        const n = Math.max(1, Math.ceil(d / Math.max(1, radius * 0.3)));
        for (let i = 1; i <= n; i++) stamp(last.x + ((p.x - last.x) * i) / n, last.y + ((p.y - last.y) * i) / n);
      }
      last = p;
      apply();
    };
    move(c.raw.x, c.raw.y);
    return { move: (m) => move(m.raw.x, m.raw.y) };
  },
};

/* ---------- fill and gradient ---------- */

export const bucketTool: ToolDef = {
  ...base,
  id: 'bucket',
  label: 'Flood Fill',
  key: 'g',
  icon: toolIcon.bucket,
  group: 'fillp',
  hint: '**Click** to fill a region of similar colour with the fill colour. Tolerance and Contiguous work like Flood Select.',
  Options: WandOptions,
  down(c) {
    const layer = activeLayerOrCreate();
    const st = getState();
    const before = st.shapes;
    const [r, g, b] = parseColour(hex(st.fill));
    const p = toPixel(layer, c.raw.x, c.raw.y);
    void Promise.resolve(workingCanvas(layer)).then((canvas) => {
      const ctx = canvas.getContext('2d')!;
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const region = floodMask(img, p.x, p.y, st.pixel.tolerance, st.pixel.contiguous);
      const sel = selectionFor(layer)?.mask;
      for (let i = 0; i < region.length; i++) {
        const k = (region[i] / 255) * (sel ? sel[i] / 255 : 1);
        if (!k) continue;
        const o = i * 4;
        img.data[o] += (r - img.data[o]) * k;
        img.data[o + 1] += (g - img.data[o + 1]) * k;
        img.data[o + 2] += (b - img.data[o + 2]) * k;
        img.data[o + 3] += (255 - img.data[o + 3]) * k;
      }
      ctx.putImageData(img, 0, 0);
      commitPixels(layer.id, canvas, before);
    });
  },
};

export const pixelGradientTool: ToolDef = {
  ...base,
  id: 'pgradient',
  label: 'Gradient',
  key: 'r',
  icon: toolIcon.pgradient,
  group: 'fillp',
  hint: '**Drag** to paint a gradient from the fill colour to the stroke colour (inside the selection). Linear or radial is set in the Fill tool options.',
  down(c) {
    const layer = activeLayerOrCreate();
    const st = getState();
    const before = st.shapes;
    const from = hex(st.fill);
    const to = hex(st.stroke);
    const a = toPixel(layer, c.raw.x, c.raw.y);
    return lazy(workingCanvas(layer), (canvas) => {
      const original = cloneCanvas(canvas);
      const result = cloneCanvas(canvas);
      const mask = selectionFor(layer)?.mask ?? null;
      const preview = makePreview(layer.id, () => result);
      const draw = (bx: number, by: number) => {
        const ctx = result.getContext('2d')!;
        ctx.clearRect(0, 0, result.width, result.height);
        ctx.drawImage(original, 0, 0);
        const over = makeCanvas(result.width, result.height);
        const oc = over.getContext('2d')!;
        const grad = getState().gradientType === 'radial' ? oc.createRadialGradient(a.x, a.y, 0, a.x, a.y, Math.max(1, Math.hypot(bx - a.x, by - a.y))) : oc.createLinearGradient(a.x, a.y, bx, by);
        grad.addColorStop(0, from);
        grad.addColorStop(1, to);
        oc.fillStyle = grad;
        oc.fillRect(0, 0, over.width, over.height);
        if (mask) {
          const img = oc.getImageData(0, 0, over.width, over.height);
          for (let i = 0; i < mask.length; i++) img.data[i * 4 + 3] = (img.data[i * 4 + 3] * mask[i]) / 255;
          oc.putImageData(img, 0, 0);
        }
        ctx.drawImage(over, 0, 0);
      };
      return {
        move(m) {
          const b = toPixel(layer, m.raw.x, m.raw.y);
          draw(b.x, b.y);
          preview.schedule();
        },
        up(m) {
          const b = toPixel(layer, m.raw.x, m.raw.y);
          if (Math.hypot(b.x - a.x, b.y - a.y) < 2) return;
          draw(b.x, b.y);
          preview.flush();
          commitPixels(layer.id, result, before);
        },
      };
    });
  },
};

/* ---------- crop and colour picker ---------- */

export const cropTool: ToolDef = {
  ...base,
  id: 'crop',
  label: 'Crop',
  key: 'c',
  icon: toolIcon.crop,
  group: 'crop',
  hint: '**Drag** a rectangle over the pixel layer to crop it to that area.',
  down(c) {
    const layer = targetLayer();
    if (!layer) return;
    const start = c.raw;
    let end = c.raw;
    return {
      move(m) {
        end = m.raw;
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        m.setOverlay(<rect x={x} y={y} width={Math.abs(end.x - start.x)} height={Math.abs(end.y - start.y)} fill="rgba(0,0,0,.15)" stroke="#fff" strokeWidth={1.5 / m.zoom} pointerEvents="none" />);
      },
      up(m) {
        m.setOverlay(null);
        const a = toPixel(layer, Math.min(start.x, end.x), Math.min(start.y, end.y));
        const b = toPixel(layer, Math.max(start.x, end.x), Math.max(start.y, end.y));
        const x0 = Math.max(0, Math.round(a.x));
        const y0 = Math.max(0, Math.round(a.y));
        const x1 = Math.min(layer.rw, Math.round(b.x));
        const y1 = Math.min(layer.rh, Math.round(b.y));
        if (x1 - x0 < 4 || y1 - y0 < 4) return;
        const before = getState().shapes;
        void Promise.resolve(workingCanvas(layer)).then((canvas) => {
          const out = makeCanvas(x1 - x0, y1 - y0);
          out.getContext('2d')!.drawImage(canvas, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
          const kx = layer.w / layer.rw;
          const ky = layer.h / layer.rh;
          const src = out.toDataURL('image/png');
          deselect();
          commit(
            getState().shapes.map((s) => (s.id === layer.id ? { ...s, src, rw: out.width, rh: out.height, x: layer.x + x0 * kx, y: layer.y + y0 * ky, w: out.width * kx, h: out.height * ky } : s)),
            { before },
          );
        });
      },
    };
  },
};

export const pickerTool: ToolDef = {
  ...base,
  id: 'picker',
  label: 'Colour Picker',
  key: 'i',
  icon: toolIcon.picker,
  group: 'pick',
  hint: '**Click** to take the colour under the cursor as the fill colour; **Alt-click** sets the stroke colour.',
  down(c) {
    const layer = targetLayer();
    if (!layer) return;
    const p = toPixel(layer, c.raw.x, c.raw.y);
    if (p.x < 0 || p.y < 0 || p.x >= layer.rw || p.y >= layer.rh) return;
    void Promise.resolve(workingCanvas(layer)).then((canvas) => {
      const d = canvas.getContext('2d')!.getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data;
      if (d[3] === 0) return;
      const h = '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
      setColor(c.alt ? 'stroke' : 'fill', h);
    });
  },
};

export const pixelTools: ToolDef[] = [
  marqueeTool,
  ellipseMarqueeTool,
  lassoTool,
  wandTool,
  selectionBrushTool,
  brushTool,
  eraserTool,
  bucketTool,
  pixelGradientTool,
  cloneTool,
  smudgeTool,
  blurBrushTool,
  sharpenBrushTool,
  dodgeTool,
  burnTool,
  saturateTool,
  desaturateTool,
  healTool,
  blemishTool,
  redEyeTool,
  cropTool,
  pickerTool,
];
