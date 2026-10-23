import { createElement, type ReactNode } from 'react';
import { filterPrimitives } from '../adjustments';
import { bbox, pathD, toPath } from '../geometry';
import { masterShapes } from '../master';
import type { Artboard, Shape } from '../types';
import { ShapeEl } from './ShapeEl';

function AdjustFilter({ shape }: { shape: Shape }) {
  const { nodes } = filterPrimitives(shape.adjust!);
  return (
    <filter id={`adj-${shape.id}`} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
      {nodes.map((n, i) => createElement(n.tag, { key: i, ...n.attrs }, n.children?.map((c, j) => createElement(c.tag, { key: j, ...c.attrs }))))}
    </filter>
  );
}

/** Outline of a shape as a clip path (text clips by its box). */
function ClipDef({ id, shape }: { id: string; shape: Shape }) {
  if (shape.kind === 'text') {
    const b = bbox(shape);
    return (
      <clipPath id={id}>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} />
      </clipPath>
    );
  }
  return (
    <clipPath id={id}>
      <path d={pathD(toPath(shape))} clipRule="evenodd" />
    </clipPath>
  );
}

/**
 * Renders shapes in z-order. An adjustment layer wraps everything stacked beneath it in a filtered group,
 * so the effect is non-destructive and follows later edits to the layers below. A shape with `clip`
 * is cut to the outline of the shape it points at, which itself is not drawn.
 */
export function Artwork({ shapes, all, hide }: { shapes: Shape[]; all?: Shape[]; hide?: string | null }) {
  const pool = all ?? shapes;
  const byId = new Map(pool.map((s) => [s.id, s]));
  const clippers = new Set(pool.filter((s) => s.clip && byId.has(s.clip)).map((s) => s.clip!));
  let below: ReactNode[] = [];
  for (const s of shapes) {
    if (s.id === hide) continue;
    if (s.adjust) {
      if (!s.visible) continue;
      const filtered = (
        <g key={`adj-${s.id}`} filter={`url(#adj-${s.id})`} opacity={s.opacity}>
          {below}
        </g>
      );
      const defs = (
        <defs key={`def-${s.id}`}>
          <AdjustFilter shape={s} />
          {s.adjust.region && <ClipDef id={`adjclip-${s.id}`} shape={s} />}
        </defs>
      );
      below = s.adjust.region
        ? [<g key={`base-${s.id}`}>{below}</g>, <g key={`reg-${s.id}`} clipPath={`url(#adjclip-${s.id})`}>{filtered}</g>, defs]
        : [filtered, defs];
      continue;
    }
    if (clippers.has(s.id)) continue;
    const clipper = s.clip ? byId.get(s.clip) : undefined;
    const el = <ShapeEl key={s.id} shape={s} all={pool} />;
    below.push(
      clipper ? (
        <g key={`c-${s.id}`}>
          <defs>
            <ClipDef id={`clip-${s.id}`} shape={clipper} />
          </defs>
          <g clipPath={`url(#clip-${s.id})`}>{el}</g>
        </g>
      ) : (
        el
      ),
    );
  }
  return <>{below}</>;
}

/** A page's master content, drawn behind the page's own layers. */
export function MasterArtwork({ board, boards, shapes }: { board: Artboard; boards: Artboard[]; shapes: Shape[] }) {
  const m = masterShapes(board, boards, shapes);
  if (!m || !m.shapes.length) return null;
  return (
    <g pointerEvents="none">
      <defs>
        <clipPath id={`mclip-${board.id}`}>
          <rect x={board.x} y={board.y} width={board.w} height={board.h} />
        </clipPath>
      </defs>
      <g clipPath={`url(#mclip-${board.id})`}>
        <g transform={`translate(${m.dx} ${m.dy})`}>
          <Artwork shapes={m.shapes} all={shapes} />
        </g>
      </g>
    </g>
  );
}
