import { commit, getState, notify, setState } from '../store';
import type { Shape } from '../types';
import { cloneCanvas } from './cache';
import { commitPixels, previewCanvas, targetLayer, workingCanvas } from './layer';
import { applyOp, defaultOpParams, rasterOp } from './ops';
import { recordStep } from './macro';
import { selectionFor } from './selection';

/** Live-preview session of a filter or adjustment on one layer. */
interface Session {
  layerId: string;
  before: Shape[];
  original: HTMLCanvasElement;
  mask: Uint8Array | null;
  timer: ReturnType<typeof setTimeout> | null;
}

let session: Session | null = null;
const BIG = 1_000_000; // pixels; above this, preview is opt-in

export interface RasterDialogState {
  opId: string;
  params: Record<string, number>;
  preview: boolean;
  busy: boolean;
}

export async function openRasterOp(opId: string) {
  const op = rasterOp(opId);
  const layer = targetLayer();
  if (!op) return;
  if (!layer) {
    notify('Select a pixel layer first (or add one in the Layers panel).');
    return;
  }
  cancelRasterDialog();
  const original = await workingCanvas(layer);
  session = { layerId: layer.id, before: getState().shapes, original, mask: selectionFor(layer)?.mask ?? null, timer: null };
  const preview = layer.rw * layer.rh <= BIG;
  setState({ rasterDialog: { opId, params: defaultOpParams(op), preview, busy: false } });
  if (preview) runPreview();
}

function runPreview() {
  const d = getState().rasterDialog;
  if (!d || !session) return;
  const op = rasterOp(d.opId);
  if (!op) return;
  const s = session;
  const canvas = cloneCanvas(s.original);
  const ctx = canvas.getContext('2d')!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyOp(img, op, d.params, s.mask);
  ctx.putImageData(img, 0, 0);
  previewCanvas(s.layerId, canvas);
}

export function updateRasterParams(patch: Record<string, number>) {
  const d = getState().rasterDialog;
  if (!d || !session) return;
  setState({ rasterDialog: { ...d, params: { ...d.params, ...patch } } });
  if (!d.preview) return;
  if (session.timer) clearTimeout(session.timer);
  session.timer = setTimeout(runPreview, 70);
}

export function setRasterPreview(on: boolean) {
  const d = getState().rasterDialog;
  if (!d || !session) return;
  setState({ rasterDialog: { ...d, preview: on } });
  if (on) runPreview();
  else setState({ shapes: session.before }); // show the untouched layer again
}

/** Commit the previewed (or freshly computed) result as one undo step. */
export function applyRasterDialog() {
  const d = getState().rasterDialog;
  const s = session;
  if (!d || !s) return;
  const op = rasterOp(d.opId);
  if (!op) return;
  if (s.timer) clearTimeout(s.timer);
  const canvas = cloneCanvas(s.original);
  const ctx = canvas.getContext('2d')!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyOp(img, op, d.params, s.mask);
  ctx.putImageData(img, 0, 0);
  setState({ shapes: s.before, rasterDialog: null });
  session = null;
  recordStep(d.opId, d.params);
  commitPixels(s.layerId, canvas, s.before);
}

export function cancelRasterDialog() {
  if (session) {
    if (session.timer) clearTimeout(session.timer);
    setState({ shapes: session.before });
  }
  session = null;
  if (getState().rasterDialog) setState({ rasterDialog: null });
}

void commit;
