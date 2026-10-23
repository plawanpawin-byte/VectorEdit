import type { ReactNode } from 'react';
import { SHAPES, buildShape } from '../shapes';
import { blankShape } from '../shape';
import { pathD } from '../geometry';

/* 20x20 icons drawn on a half-pixel grid so 1.5px strokes stay sharp at 100% scale. */

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" shapeRendering="geometricPrecision">
    {children}
  </svg>
);

export const toolIcon: Record<string, ReactNode> = {
  select: svg(<path d="M5.5 3.5l9.5 7-4.2 1 2.4 4.6-1.9 1-2.4-4.6-3.4 3z" fill="currentColor" stroke="none" />),
  direct: svg(<path d="M5.5 3.5l9.5 7-4.2 1 2.4 4.6-1.9 1-2.4-4.6-3.4 3z" />),
  corner: svg(
    <>
      <path d="M3.5 16.5C5 9 9 4.5 16.5 4.5" />
      <rect x="2.5" y="15.5" width="3" height="3" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="4.5" r="1.8" fill="currentColor" stroke="none" />
    </>,
  ),
  rotate: svg(
    <>
      <path d="M16 10.5a6 6 0 11-2-4.5" />
      <path d="M14.5 2.5v3.8h-3.8" />
    </>,
  ),
  pen: svg(
    <>
      <path d="M10 2.5l5.5 6.8-2.5 4.7H7L4.5 9.3z" />
      <path d="M10 8.5v5M7.5 14l-1 3.5h7l-1-3.5" />
      <circle cx="10" cy="8" r="1" fill="currentColor" stroke="none" />
    </>,
  ),
  pencil: svg(<path d="M4 16l1.2-3.8 8.4-8.4a1.7 1.7 0 012.4 0l.4.4a1.7 1.7 0 010 2.4l-8.4 8.4zM12 5.5l2.5 2.5" />),
  vbrush: svg(
    <>
      <path d="M3 16c2.5-.5 3.5-2.5 4.5-4.5L14 4.5c.8-.8 2-.8 2.7 0 .8.8.8 1.9 0 2.700L9.5 13.700C7.5 14.5 5.5 15.5 3 16z" />
      <path d="M11.5 7l1.5 1.5" />
    </>,
  ),
  text: svg(<path d="M4.5 5.500V4h11v1.500M10 4v12M8 16h4" />),
  frametext: svg(
    <>
      <rect x="3.5" y="3.5" width="13" height="13" strokeDasharray="2 1.5" />
      <path d="M7 7.500h6M10 7.500v6M8.5 13.500h3" />
    </>,
  ),
  line: svg(<path d="M4 16L16 4" />),
  rect: svg(<rect x="3.5" y="5" width="13" height="10" />),
  rrect: svg(<rect x="3.5" y="5" width="13" height="10" rx="3.5" />),
  ellipse: svg(<ellipse cx="10" cy="10" rx="6.5" ry="5.2" />),
  knife: svg(
    <>
      <path d="M3 17L15.5 4.500l1 1L6.5 16z" />
      <path d="M3 17l3.5-1" />
    </>,
  ),
  scissors: svg(
    <>
      <circle cx="5.5" cy="14.5" r="2" />
      <circle cx="14.5" cy="14.5" r="2" />
      <path d="M7 13l7-9M13 13L6 4" />
    </>,
  ),
  fill: svg(
    <>
      <rect x="3.5" y="3.5" width="13" height="13" />
      <path d="M3.5 13.500l13-7M3.5 16.500l13-7" opacity=".6" />
    </>,
  ),
  eyedropper: svg(<path d="M12.6 3.400a2 2 0 012.8 2.800l-1.4 1.4-2.8-2.800zM10.4 5.600L4 12l-.5 3.500L7 15l6.4-6.400M4.8 12.800l2.4 2.4" />),
  measure: svg(
    <>
      <path d="M3 13.500l10.5-10.5 3.5 3.500L6.5 17z" />
      <path d="M6 10l1.5 1.500M8.5 7.500L10 9M11 5l1.5 1.5" />
    </>,
  ),
  hand: svg(
    <path d="M7 10V5.200a1.1 1.1 0 012.2 0V9m0-4.300a1.1 1.1 0 012.2 0V9m0-3a1.1 1.1 0 012.2 0v4.600c0 3-1.7 5-4.3 5-2 0-3.1-.9-4.3-2.700L3.8 11a1.1 1.1 0 011.8-1.200L7 11.5" />,
  ),
  zoom: svg(
    <>
      <circle cx="8.5" cy="8.5" r="4.8" />
      <path d="M12.2 12.200L16.5 16.500M6.4 8.500h4.200M8.5 6.400v4.2" />
    </>,
  ),
};

/** Icon for a registry shape, drawn from the shape itself. */
export function shapeIcon(id: string): ReactNode {
  const def = SHAPES.find((s) => s.id === id);
  if (!def) return null;
  const s = blankShape('icon', 'shape', { x: 3, y: 3, w: 14, h: 14, shapeId: id, params: Object.fromEntries(def.params.map((p) => [p.key, p.def])) });
  const built = buildShape(s);
  const d = pathD(s);
  void built;
  return svg(<path d={d} fillRule="evenodd" />);
}
