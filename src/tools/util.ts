import { hitTest } from '../geometry';
import type { State } from '../store';
import type { Shape } from '../types';
import type { XY } from './types';

/** Top-most unlocked shape under a point. */
export function shapeAt(st: State, p: XY, tol: number): Shape | undefined {
  for (let i = st.shapes.length - 1; i >= 0; i--) {
    const s = st.shapes[i];
    if (!s.locked && hitTest(s, p.x, p.y, tol)) return s;
  }
  return undefined;
}

/** Selected shapes, minus locked ones. */
export function editableSelection(st: State): Shape[] {
  return st.shapes.filter((s) => st.selection.includes(s.id) && !s.locked);
}
