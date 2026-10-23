import { createElement, type ReactNode } from 'react';
import { filterPrimitives } from '../adjustments';
import type { Shape } from '../types';
import { ShapeEl } from './ShapeEl';

function AdjustFilter({ shape }: { shape: Shape }) {
  const { nodes } = filterPrimitives(shape.adjust!);
  return (
    <filter id={`adj-${shape.id}`} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
      {nodes.map((n, i) => createElement(n.tag, { key: i, ...n.attrs }, n.children?.map((c, j) => createElement(c.tag, { key: j, ...c.attrs }))))}
    </filter>
  );
}

/**
 * Renders shapes in z-order. An adjustment layer wraps everything stacked beneath it in a filtered group,
 * so the effect is non-destructive and follows later edits to the layers below.
 */
export function Artwork({ shapes, all, hide }: { shapes: Shape[]; all?: Shape[]; hide?: string | null }) {
  let below: ReactNode[] = [];
  for (const s of shapes) {
    if (s.id === hide) continue;
    if (s.adjust) {
      if (!s.visible) continue;
      below = [
        <g key={`adj-${s.id}`} filter={`url(#adj-${s.id})`} opacity={s.opacity}>
          {below}
        </g>,
        <defs key={`def-${s.id}`}>
          <AdjustFilter shape={s} />
        </defs>,
      ];
      continue;
    }
    below.push(<ShapeEl key={s.id} shape={s} all={all ?? shapes} />);
  }
  return <>{below}</>;
}
