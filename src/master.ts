import type { Artboard, Shape } from './types';

const centreIn = (s: Shape, a: Artboard) => {
  const cx = s.x + s.w / 2;
  const cy = s.y + s.h / 2;
  return cx >= a.x && cx <= a.x + a.w && cy >= a.y && cy <= a.y + a.h;
};

/** The master page applied to `board`, with the offset that maps it onto `board`. */
export function masterOf(board: Artboard, boards: Artboard[]): { master: Artboard; dx: number; dy: number } | null {
  if (!board.master || board.master === board.id) return null;
  const master = boards.find((b) => b.id === board.master && b.isMaster);
  return master ? { master, dx: board.x - master.x, dy: board.y - master.y } : null;
}

/** Shapes of the master (path and text boxes are positioned by their x/y, so a translated group suffices). */
export function masterShapes(board: Artboard, boards: Artboard[], shapes: Shape[]): { shapes: Shape[]; dx: number; dy: number } | null {
  const m = masterOf(board, boards);
  if (!m) return null;
  return { shapes: shapes.filter((s) => s.visible && centreIn(s, m.master)), dx: m.dx, dy: m.dy };
}
