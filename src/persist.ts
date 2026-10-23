import type { Shape } from './types';
import { getState, loadDocument, setState } from './store';
import { normalizeShape } from './shape';

export const AUTOSAVE_KEY = 'vectoredit:autosave:v1';

interface Saved {
  artboard: { w: number; h: number };
  shapes: unknown[];
}

/** Restore the last autosaved document, if any. Never throws. */
export function restoreAutosave(): boolean {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return false;
    const doc = JSON.parse(raw) as Saved;
    if (!doc || !Array.isArray(doc.shapes) || !doc.artboard) return false;
    const shapes = doc.shapes.map(normalizeShape).filter((s): s is Shape => s !== null);
    loadDocument(shapes, doc.artboard, null);
    // loadDocument fits the artboard to a viewport that does not exist yet; the canvas refits on mount
    setState({ viewport: { w: 0, h: 0 } });
    return true;
  } catch {
    return false;
  }
}

export function clearAutosave() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Save the document shortly after it changes. Returns an unsubscribe function. */
export function startAutosave(delay = 600): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = getState().shapes;
  let lastBoard = getState().artboard;
  const tick = setInterval(() => {
    const { shapes, artboard } = getState();
    if (shapes === last && artboard === lastBoard) return;
    last = shapes;
    lastBoard = artboard;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ artboard, shapes }));
      } catch {
        /* quota exceeded or storage unavailable: keep working without autosave */
      }
    }, delay);
  }, 300);
  return () => {
    clearInterval(tick);
    clearTimeout(timer);
  };
}
