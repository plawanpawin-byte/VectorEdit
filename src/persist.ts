import { parseDoc, serializeDoc } from './document';
import { getState, loadDocument, setState } from './store';

export const AUTOSAVE_KEY = 'vectoredit:autosave:v2';
const LEGACY_KEY = 'vectoredit:autosave:v1';

/** Restore the last autosaved document, if any. Never throws. */
export function restoreAutosave(): boolean {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return false;
    const d = parseDoc(raw);
    loadDocument(d.shapes, d.artboards, null, { guides: d.guides, snapshots: d.snapshots });
    // the canvas refits once it knows its size
    setState({ viewport: { w: 0, h: 0 } });
    return true;
  } catch {
    return false;
  }
}

export function clearAutosave() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Save the document shortly after it changes. Returns an unsubscribe function. */
export function startAutosave(delay = 600): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = getState();
  const tick = setInterval(() => {
    const s = getState();
    if (s.shapes === last.shapes && s.artboards === last.artboards && s.guides === last.guides && s.snapshots === last.snapshots) return;
    last = s;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, serializeDoc(getState()));
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
