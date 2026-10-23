import { parseDoc, serializeDoc } from './document';
import { preloadRasters } from './raster/cache';
import { normalizeShape } from './shape';
import { getState, loadDocument, setState } from './store';
import type { Shape } from './types';

const DB = 'vectoredit';
const STORE = 'kv';
const KEY = 'autosave:v2';
const LEGACY_KEYS = ['vectoredit:autosave:v2', 'vectoredit:autosave:v1'];

/* Autosave lives in IndexedDB so documents with images fit; localStorage is the fallback. */

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(): Promise<string | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const r = db.transaction(STORE).objectStore(STORE).get(KEY);
      r.onsuccess = () => resolve(typeof r.result === 'string' ? r.result : null);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(value: string): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function idbClear() {
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(KEY);
  } catch {
    /* ignore */
  }
}

function localGet(): string | null {
  try {
    for (const k of LEGACY_KEYS) {
      const v = localStorage.getItem(k);
      if (v) return v;
    }
  } catch {
    /* storage unavailable */
  }
  return null;
}

/** Restore the last autosaved document, if any. Never throws. */
export async function restoreAutosave(): Promise<boolean> {
  try {
    const raw = (await idbGet()) ?? localGet();
    if (!raw) return false;
    const d = parseDoc(raw);
    // an empty page is not work worth restoring
    if (!d.shapes.length) return false;
    await preloadRasters(d.shapes.map(normalizeShape).filter((x): x is Shape => x !== null));
    loadDocument(d.shapes, d.artboards, null, { guides: d.guides, slices: d.slices, snapshots: d.snapshots });
    // the canvas refits once it knows its size; the restored work has no file yet, so it counts as unsaved
    setState({ viewport: { w: 0, h: 0 }, cleanMark: -1 });
    return true;
  } catch {
    return false;
  }
}

export async function clearAutosave() {
  await idbClear();
  try {
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
  } catch {
    /* storage unavailable */
  }
}

/** Save the document shortly after it changes. Returns an unsubscribe function. */
export function startAutosave(delay = 700): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = getState();
  const tick = setInterval(() => {
    const s = getState();
    if (s.shapes === last.shapes && s.artboards === last.artboards && s.guides === last.guides && s.snapshots === last.snapshots) return;
    last = s;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const text = serializeDoc(getState());
      if (await idbSet(text)) return;
      try {
        localStorage.setItem(LEGACY_KEYS[0], text);
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
