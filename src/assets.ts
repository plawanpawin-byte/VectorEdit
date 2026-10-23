import { bbox, translate, unionBox } from './geometry';
import { activeBoard, commit, getState, makeShape } from './store';
import type { Shape } from './types';

const KEY = 'vectoredit:assets:v1';

export interface Asset {
  id: string;
  name: string;
  /** shapes positioned so the group's top-left corner is at the origin */
  shapes: Shape[];
  w: number;
  h: number;
}

export function loadAssets(): Asset[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function persist(list: Asset[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable or full */
  }
}

/** Save the current selection as a reusable asset. Returns the new list, or null if nothing is selected. */
export function saveSelectionAsAsset(name?: string): Asset[] | null {
  const st = getState();
  const sel = st.shapes.filter((s) => st.selection.includes(s.id));
  const box = unionBox(sel.map(bbox));
  if (!sel.length || !box) return null;
  const list = loadAssets();
  const asset: Asset = {
    id: `as${Date.now().toString(36)}`,
    name: name ?? `Asset ${list.length + 1}`,
    shapes: sel.map((s) => ({ ...translate(s, -box.x, -box.y), group: null })),
    w: box.w,
    h: box.h,
  };
  const next = [...list, asset];
  persist(next);
  return next;
}

export function deleteAsset(id: string): Asset[] {
  const next = loadAssets().filter((a) => a.id !== id);
  persist(next);
  return next;
}

/** Place an asset in the centre of the active page. */
export function insertAsset(asset: Asset) {
  const st = getState();
  const board = activeBoard(st);
  const ox = board.x + (board.w - asset.w) / 2;
  const oy = board.y + (board.h - asset.h) / 2;
  const copies = asset.shapes.map((s) => ({ ...translate(s, ox, oy), id: makeShape('rect').id }));
  commit([...st.shapes, ...copies], { selection: copies.map((c) => c.id) });
}
