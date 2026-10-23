import { renderToStaticMarkup } from 'react-dom/server';
import { ShapeEl } from '../components/ShapeEl';
import { bbox } from '../geometry';
import { commit, getState } from '../store';
import type { Shape } from '../types';
import { cloneCanvas, encodeCanvas, makeCanvas } from './cache';
import { rasteriseShapeToLayer, workingCanvas } from './layer';

/** Turn the selected vector shapes into pixel layers (one each), keeping their position and size. */
export async function rasteriseSelection() {
  const st = getState();
  const targets = st.shapes.filter((s) => st.selection.includes(s.id) && !s.raster && !s.locked && s.kind !== 'text');
  if (!targets.length) {
    alert('Select one or more vector shapes to rasterise.');
    return;
  }
  const results = new Map<string, Shape>();
  for (const s of targets) {
    const b = bbox(s);
    const pad = Math.max(2, s.stroke ? s.strokeWidth : 0) + 40; // room for strokes and effects
    const box = { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${box.w}" height="${box.h}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}">${renderToStaticMarkup(<ShapeEl shape={s} all={st.shapes} />)}</svg>`;
    const frame = { ...s, x: box.x, y: box.y, w: box.w, h: box.h };
    try {
      results.set(s.id, { ...(await rasteriseShapeToLayer(frame, markup)), id: s.id, name: `${s.name} (pixels)`, group: s.group });
    } catch (e) {
      alert(`Could not rasterise ${s.name}: ${(e as Error).message}`);
    }
  }
  if (!results.size) return;
  commit(getState().shapes.map((s) => results.get(s.id) ?? s));
}

/** Composite the selected pixel layer onto the pixel layer directly below it. */
export async function mergeDown() {
  const st = getState();
  const idx = st.shapes.findIndex((s) => s.raster && st.selection.includes(s.id));
  if (idx < 0) return alert('Select a pixel layer to merge down.');
  let below = -1;
  for (let i = idx - 1; i >= 0; i--) if (st.shapes[i].raster) (below = i, (i = -1));
  if (below < 0) return alert('There is no pixel layer below the selected one.');
  const top = st.shapes[idx];
  const bottom = st.shapes[below];
  const ca = await workingCanvas(bottom);
  const cb = await workingCanvas(top);
  const x0 = Math.min(top.x, bottom.x);
  const y0 = Math.min(top.y, bottom.y);
  const x1 = Math.max(top.x + top.w, bottom.x + bottom.w);
  const y1 = Math.max(top.y + top.h, bottom.y + bottom.h);
  const density = Math.max(top.rw / top.w, bottom.rw / bottom.w);
  const k = Math.min(density, 2048 / Math.max(x1 - x0, y1 - y0));
  const out = makeCanvas((x1 - x0) * k, (y1 - y0) * k);
  const ctx = out.getContext('2d')!;
  const draw = (l: Shape, c: HTMLCanvasElement) => {
    ctx.globalAlpha = l.opacity;
    ctx.globalCompositeOperation = l.blend && l.blend !== 'normal' ? (l.blend as GlobalCompositeOperation) : 'source-over';
    ctx.drawImage(c, (l.x - x0) * k, (l.y - y0) * k, l.w * k, l.h * k);
  };
  draw({ ...bottom, opacity: bottom.opacity }, ca);
  draw(top, cb);
  const merged: Shape = { ...bottom, x: x0, y: y0, w: x1 - x0, h: y1 - y0, src: encodeCanvas(out), rw: out.width, rh: out.height, opacity: 1, blend: 'normal', name: `${bottom.name} + ${top.name}` };
  commit(
    st.shapes.filter((s) => s.id !== top.id).map((s) => (s.id === bottom.id ? merged : s)),
    { selection: [merged.id] },
  );
  void cloneCanvas;
}
