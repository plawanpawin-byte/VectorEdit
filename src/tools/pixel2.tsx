import { NumField } from '../components/Fields';
import { Stroke } from '../raster/brush';
import { cloneCanvas, encodeCanvas, makeCanvas } from '../raster/cache';
import { commitPixels, pixelScale, toPixel, workingCanvas } from '../raster/layer';
import { RASTER_OPS, applyOp, defaultOpParams, rasterOp } from '../raster/ops';
import { type Buf, floodMask, sample } from '../raster/pixels';
import { applySelection, deselect, maskFromDraw, modeFromKeys, selectionFor } from '../raster/selection';
import { commit, getState, setState, useStore } from '../store';
import { toolIcon } from './icons';
import { BrushOptions, RetouchOptions, activeLayerOrCreate, base, lazy, makePreview, paintDown, retouch, selLayer } from './pixel';
import type { Shape } from '../types';
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

/**
 * Paint a soft mask with the brush and show `compose(original, mask)` live; the result is committed on release.
 * `prepare` runs once per stroke and may return null to cancel it.
 */
function maskedBrush(prepare: (layer: Shape, original: HTMLCanvasElement) => Promise<null | ((img: ImageData, mask: Uint8Array) => void)> | null | ((img: ImageData, mask: Uint8Array) => void)) {
  return (c: PointerCtx): Session | void => {
    const layer = activeLayerOrCreate();
    const st = getState();
    const before = st.shapes;
    const radius = Math.max(1, (st.pbrush.size * pixelScale(layer).sx) / 2);
    let live: Session | null = null;
    const queued: ['move' | 'up', PointerCtx][] = [];
    void Promise.resolve(workingCanvas(layer)).then(async (canvas) => {
      const original = cloneCanvas(canvas);
      const compose = await prepare(layer, original);
      if (!compose) {
        queued.length = 0;
        return;
      }
      const w = canvas.width;
      const h = canvas.height;
      const painted = new Uint8Array(w * h);
      const sel = selectionFor(layer)?.mask ?? null;
      const result = () => {
        const out = cloneCanvas(original);
        const ctx = out.getContext('2d')!;
        const img = ctx.getImageData(0, 0, w, h);
        compose(img, sel ? painted.map((v, i) => (v * sel[i]) / 255) : painted);
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
      const small = w * h <= 1_000_000;
      if (small) preview.schedule();
      live = {
        move(m) {
          const p = toPixel(layer, m.raw.x, m.raw.y);
          const steps = Math.max(1, Math.ceil(Math.hypot(p.x - last.x, p.y - last.y) / Math.max(1, radius * 0.4)));
          for (let i = 1; i <= steps; i++) stamp(last.x + ((p.x - last.x) * i) / steps, last.y + ((p.y - last.y) * i) / steps);
          last = p;
          if (small) preview.schedule();
        },
        up() {
          commitPixels(layer.id, result(), before);
        },
      };
      for (const [k, ctx] of queued) live[k]?.(ctx);
      queued.length = 0;
    });
    return {
      move: (m) => (live ? live.move?.(m) : queued.push(['move', m])),
      up: (m) => (live ? live.up?.(m) : queued.push(['up', m])),
    };
  };
}

const opBrush = (kind: 'filter' | 'adjust') =>
  maskedBrush((_layer, _original) => {
    const op = rasterOp(getState().opBrush[kind]);
    if (!op) return null;
    const params = defaultOpParams(op);
    return (img, mask) => applyOp(img, op, params, mask);
  });

/** Paint back what the layer looked like before its most recent change. */
const undoBrush = maskedBrush(async (layer) => {
  const past = getState().past;
  const earlier = [...past].reverse().map((d) => d.shapes.find((s) => s.id === layer.id)).find((s) => s && s.src !== layer.src);
  if (!earlier) return null;
  const old = await workingCanvas(earlier);
  const oldImg = old.getContext('2d')!.getImageData(0, 0, old.width, old.height);
  return (img, mask) => {
    if (oldImg.width !== img.width || oldImg.height !== img.height) return;
    for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
      const k = mask[p] / 255;
      if (!k) continue;
      for (let c = 0; c < 4; c++) img.data[i + c] += (oldImg.data[i + c] - img.data[i + c]) * k;
    }
  };
});

export const undoBrushTool: ToolDef = {
  ...base,
  id: 'undobrush',
  label: 'Undo Brush',
  key: undefined,
  icon: toolIcon.undobrush,
  group: 'tone',
  hint: '**Drag** to paint back what the layer looked like before its last change.',
  Options: RetouchOptions,
  down: undoBrush,
};

/* ---------- push warp (free-form deform) ---------- */

export const pushWarpTool: ToolDef = {
  ...base,
  id: 'pushwarp',
  label: 'Push Warp',
  key: undefined,
  icon: toolIcon.pushwarp,
  group: 'edit',
  hint: '**Drag** to push pixels along the stroke, like melting the image. Size sets the reach, hardness how sharply it falls off.',
  Options: RetouchOptions,
  down(c): Session | void {
    const layer = activeLayerOrCreate();
    const st = getState();
    const before = st.shapes;
    const radius = Math.max(2, (st.pbrush.size * pixelScale(layer).sx) / 2);
    const strength = st.pixel.strength;
    return lazy(workingCanvas(layer), (canvas) => {
      const ctx = canvas.getContext('2d')!;
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;
      const preview = makePreview(layer.id, () => (ctx.putImageData(img, 0, 0), canvas));
      let last = toPixel(layer, c.raw.x, c.raw.y);
      const push = (cx: number, cy: number, dx: number, dy: number) => {
        const snap = new Uint8ClampedArray(img.data);
        const src: Buf = { width: w, height: h, data: snap };
        const x0 = Math.max(0, Math.floor(cx - radius));
        const x1 = Math.min(w - 1, Math.ceil(cx + radius));
        const y0 = Math.max(0, Math.floor(cy - radius));
        const y1 = Math.min(h - 1, Math.ceil(cy + radius));
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++) {
            const k = soft(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / radius, st.pbrush.hardness) * strength;
            if (k <= 0) continue;
            const i = (y * w + x) * 4;
            for (let ch = 0; ch < 4; ch++) img.data[i + ch] = sample(src, x - dx * k, y - dy * k, ch);
          }
      };
      return {
        move(m) {
          const p = toPixel(layer, m.raw.x, m.raw.y);
          const dx = p.x - last.x;
          const dy = p.y - last.y;
          if (Math.hypot(dx, dy) < 0.5) return;
          push(p.x, p.y, dx, dy);
          last = p;
          preview.schedule();
        },
        up() {
          ctx.putImageData(img, 0, 0);
          preview.flush();
          commitPixels(layer.id, canvas, before);
        },
      };
    });
  },
};

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

/* ---------- mask brush (layer masks) ---------- */

/** Paint the layer's mask: drag hides what you touch, Alt-drag reveals it again. */
export const maskBrushTool: ToolDef = {
  ...base,
  id: 'maskbrush',
  label: 'Mask Brush',
  key: undefined,
  icon: toolIcon.maskbrush,
  group: 'paint',
  hint: '**Drag** to hide parts of the layer without erasing them; **Alt-drag** reveals them again. Remove the mask from the layer options.',
  Options: BrushOptions,
  down(c): Session | void {
    const layer = activeLayerOrCreate();
    const st = getState();
    const before = st.shapes;
    const reveal = c.alt;
    const work = layer.mask ? workingCanvas({ ...layer, src: layer.mask }) : null;
    return lazy(Promise.resolve(work).then((existing) => {
      if (existing) return existing;
      const fresh = makeCanvas(layer.rw, layer.rh); // a new mask starts fully visible
      const g = fresh.getContext('2d')!;
      g.fillStyle = '#fff';
      g.fillRect(0, 0, fresh.width, fresh.height);
      return fresh;
    }), (canvas) => {
      const stroke = new Stroke(canvas, st.pbrush, pixelScale(layer).sx, [255, 255, 255], reveal ? 'paint' : 'erase', null);
      const p0 = toPixel(layer, c.raw.x, c.raw.y);
      stroke.begin(p0.x, p0.y, c.pressure, c.tilt);
      const commitMask = () => {
        const src = encodeCanvas(stroke.result);
        commit(getState().shapes.map((s) => (s.id === layer.id ? { ...s, mask: src } : s)), { before });
      };
      // encoding the whole mask as a PNG is slow, so the preview updates at most about 10 times a second
      let timer: ReturnType<typeof setTimeout> | undefined;
      return {
        move(m) {
          const p = toPixel(layer, m.raw.x, m.raw.y);
          stroke.lineTo(p.x, p.y, m.pressure, m.tilt);
          if (!timer)
            timer = setTimeout(() => {
              timer = undefined;
              setState({ shapes: getState().shapes.map((s) => (s.id === layer.id ? { ...s, mask: stroke.result.toDataURL('image/png') } : s)) });
            }, 90);
        },
        up() {
          clearTimeout(timer);
          commitMask();
        },
      };
    });
  },
};

/* ---------- patch ---------- */

let patch: { layerId: string; poly: { x: number; y: number }[] } | null = null;

const inPoly = (poly: { x: number; y: number }[], x: number, y: number) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (poly[i].y > y !== poly[j].y > y && x < ((poly[j].x - poly[i].x) * (y - poly[i].y)) / (poly[j].y - poly[i].y) + poly[i].x) inside = !inside;
  }
  return inside;
};

const patchOverlay = (poly: { x: number; y: number }[], dx: number, dy: number, zoom: number) => {
  const k = 1 / zoom;
  const d = poly.map((p, i) => `${i ? 'L' : 'M'}${p.x + dx} ${p.y + dy}`).join('') + 'Z';
  return (
    <g pointerEvents="none">
      <path d={d} fill="rgba(74,163,255,.12)" stroke="#000" strokeOpacity=".6" strokeWidth={3 * k} />
      <path d={d} fill="none" stroke="#fff" strokeWidth={1.5 * k} strokeDasharray={`${5 * k} ${3 * k}`} />
    </g>
  );
};

export const patchTool: ToolDef = {
  ...base,
  id: 'patch',
  label: 'Patch',
  key: undefined,
  icon: toolIcon.patch,
  group: 'heal',
  hint: '**Drag** around a flaw to outline it, then **drag the outline** onto clean pixels: the flaw takes the texture of that area but keeps its own tone.',
  down(c): Session | void {
    const layer = activeLayerOrCreate();
    // second gesture: carry the outline to the source area
    if (patch && patch.layerId === layer.id && inPoly(patch.poly, c.raw.x, c.raw.y)) {
      const outline = patch.poly;
      const start = c.raw;
      let off = { x: 0, y: 0 };
      return {
        move(m) {
          off = { x: m.raw.x - start.x, y: m.raw.y - start.y };
          m.setOverlay(patchOverlay(outline, off.x, off.y, m.zoom));
        },
        up(m) {
          m.setOverlay(null);
          patch = null;
          if (Math.hypot(off.x, off.y) < 2 / m.zoom) return;
          const before = getState().shapes;
          const sc = pixelScale(layer);
          const dx = off.x * sc.sx;
          const dy = off.y * sc.sy;
          void Promise.resolve(workingCanvas(layer)).then((canvas) => {
            const ctx = canvas.getContext('2d')!;
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const w = canvas.width;
            const h = canvas.height;
            const src: Buf = { width: w, height: h, data: new Uint8ClampedArray(img.data) };
            const region = maskFromDraw(layer, (g) => {
              g.beginPath();
              outline.forEach((p, i) => {
                const q = toPixel(layer, p.x, p.y);
                if (i) g.lineTo(q.x, q.y);
                else g.moveTo(q.x, q.y);
              });
              g.closePath();
              g.fillStyle = '#fff';
              g.fill();
            });
            const sel = selectionFor(layer)?.mask ?? null;
            const low = (x: number, y: number, c: number, ox: number, oy: number) => {
              let a = 0;
              for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) a += sample(src, x + i + ox, y + j + oy, c);
              return a / 25;
            };
            for (let y = 0; y < h; y++)
              for (let x = 0; x < w; x++) {
                const k = (region[y * w + x] / 255) * (sel ? sel[y * w + x] / 255 : 1);
                if (!k) continue;
                const i = (y * w + x) * 4;
                for (let ch = 0; ch < 3; ch++) {
                  const v = low(x, y, ch, 0, 0) + sample(src, x + dx, y + dy, ch) - low(x, y, ch, dx, dy);
                  img.data[i + ch] = img.data[i + ch] + (Math.min(255, Math.max(0, v)) - img.data[i + ch]) * k;
                }
              }
            ctx.putImageData(img, 0, 0);
            commitPixels(layer.id, canvas, before);
          });
        },
      };
    }
    // first gesture: outline the flaw
    patch = null;
    const pts = [{ x: c.raw.x, y: c.raw.y }];
    return {
      move(m) {
        pts.push({ x: m.raw.x, y: m.raw.y });
        m.setOverlay(patchOverlay(pts, 0, 0, m.zoom));
      },
      up(m) {
        if (pts.length < 3) return m.setOverlay(null);
        patch = { layerId: layer.id, poly: pts };
        m.setOverlay(patchOverlay(pts, 0, 0, m.zoom));
      },
    };
  },
};

export const pixelTools2: ToolDef[] = [medianBrushTool, colourReplaceTool, backgroundEraserTool, mixerBrushTool, pixelBrushTool, floodEraseTool, columnMarqueeTool, rowMarqueeTool, filterBrushTool, adjustBrushTool, undoBrushTool, pushWarpTool, patchTool, maskBrushTool];
