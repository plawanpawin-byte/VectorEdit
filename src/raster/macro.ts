import { beginBatch, endBatch, getState, setState } from '../store';
import { cloneCanvas } from './cache';
import { commitPixels, targetLayer, workingCanvas } from './layer';
import { applyOp, rasterOp } from './ops';
import { selectionFor } from './selection';

/** One recorded filter or adjustment. */
export interface MacroStep {
  op: string;
  params: Record<string, number>;
}

export interface PixelMacro {
  id: string;
  name: string;
  steps: MacroStep[];
}

let steps: MacroStep[] = [];

export const isRecording = () => getState().macroRecording;

export function startRecording() {
  steps = [];
  setState({ macroRecording: true, macroSteps: 0 });
}

/** Stops recording and returns the captured steps. */
export function stopRecording(): MacroStep[] {
  const out = steps;
  steps = [];
  setState({ macroRecording: false, macroSteps: 0 });
  return out;
}

/** Called whenever a filter or adjustment is applied. No-op unless recording. */
export function recordStep(op: string, params: Record<string, number>) {
  if (!getState().macroRecording) return;
  steps.push({ op, params: { ...params } });
  setState({ macroSteps: steps.length });
}

/** Replays steps on the active pixel layer as a single undo step. Returns the number applied. */
export async function playMacro(list: MacroStep[]): Promise<number> {
  const layer = targetLayer();
  if (!layer) {
    alert('Select a pixel layer first (or add one in the Layers panel).');
    return 0;
  }
  let done = 0;
  beginBatch();
  try {
    for (const step of list) {
      const op = rasterOp(step.op);
      if (!op) continue;
      const current = getState().shapes.find((s) => s.id === layer.id) ?? layer;
      const canvas = cloneCanvas(await workingCanvas(current));
      const ctx = canvas.getContext('2d')!;
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      applyOp(img, op, step.params, selectionFor(current)?.mask ?? null);
      ctx.putImageData(img, 0, 0);
      commitPixels(layer.id, canvas, getState().shapes);
      done++;
    }
  } finally {
    endBatch();
  }
  return done;
}

const KEY = 'vectoredit.pixel-macros';

export function loadMacros(): PixelMacro[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw)
      ? raw.filter((m) => m && typeof m.name === 'string' && Array.isArray(m.steps)).map((m) => ({ id: String(m.id ?? m.name), name: m.name, steps: m.steps.filter((s: MacroStep) => s && typeof s.op === 'string') }))
      : [];
  } catch {
    return [];
  }
}

export function saveMacros(list: PixelMacro[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* macros stay in memory for this session */
  }
}
