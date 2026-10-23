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
  brush: svg(<><path d="M4 16.5c2.5-.3 3.5-2 3.8-3.6l.2-.7 2.8 2.8-.7.2c-1.6.4-3.3 1.4-6.1 1.300z" /><path d="M9.5 12.500l6.2-8.200a1.3 1.3 0 011.8 1.800l-8.2 6.2" /></>),
  eraser: svg(<><path d="M8 16.500L3.7 12.200a1.3 1.3 0 010-1.800L10.5 3.600a1.3 1.3 0 011.8 0l4.1 4.100a1.3 1.3 0 010 1.800L11 16.500z" /><path d="M6.5 9l5.5 5.500M8 16.500h9" /></>),
  bucket: svg(<><path d="M4.5 10.500l5-5.5 5.5 5.5-5 5.500z" /><path d="M9.5 5V3.500M15.5 12.500c1 1.2 1.5 2 1.5 2.800a1.5 1.5 0 01-3 0c0-.8.5-1.6 1.5-2.800z" /></>),
  pgradient: svg(<><rect x="3.5" y="3.5" width="13" height="13" /><path d="M3.5 8.500h13M3.5 12.500h13" opacity=".35" /><path d="M6 14l8-8" /></>),
  marquee: svg(<rect x="3.5" y="4.5" width="13" height="11" strokeDasharray="2.5 2" />),
  'marquee-ellipse': svg(<ellipse cx="10" cy="10" rx="6.5" ry="5.5" strokeDasharray="2.5 2" />),
  lasso: svg(<><path d="M10 4.500c4 0 6.5 1.5 6.5 3.500s-2.5 3.5-6.5 3.5-6.5-1.5-6.5-3.500S6 4.5 10 4.500z" strokeDasharray="2.5 2" /><path d="M7.5 11.500c-1 2 0 3.5 1.5 4s2.5-.5 2.5-1.5" /></>),
  wand: svg(<><path d="M4 16l8-8" /><path d="M11.5 4.500v2.500M10.2 5.700h2.600M15.5 8v2M14.5 9h2M15 4l.5.5M7 4.500l.5.5" /></>),
  selbrush: svg(<><circle cx="10" cy="10" r="5.5" strokeDasharray="2.5 2" /><path d="M7.5 12.500l5-5" /></>),
  clone: svg(<><path d="M7 4.500h6v4H7z" /><path d="M5 8.500h10l1 3H4z" /><path d="M5 14.500h10v2H5z" /></>),
  smudge: svg(<><path d="M5 14c1.5-4 4-6.5 8-7" /><path d="M10.5 11.500l3.5-1.5 2 2.5-3 3z" /><path d="M4 7h4" opacity=".5" /></>),
  blurbrush: svg(<><path d="M10 3.500c2.5 3.2 4.5 5.5 4.5 8a4.5 4.5 0 01-9 0c0-2.5 2-4.8 4.5-8z" /><path d="M7.5 12.500c.4 1.2 1.3 1.8 2.5 1.8" opacity=".6" /></>),
  sharpenbrush: svg(<><path d="M10 3.500l6 11.500H4z" /><path d="M10 8l2.5 4.500h-5z" opacity=".6" /></>),
  dodge: svg(<><circle cx="10" cy="8" r="3.8" /><path d="M10 12v5M7.5 17h5" /></>),
  burn: svg(<><circle cx="10" cy="8" r="3.8" fill="currentColor" stroke="none" opacity=".5" /><circle cx="10" cy="8" r="3.8" /><path d="M10 12v5M7.5 17h5" /></>),
  saturate: svg(<><path d="M10 3.500c2.5 3.2 4.5 5.5 4.5 8a4.5 4.5 0 01-9 0c0-2.5 2-4.8 4.5-8z" fill="currentColor" stroke="none" opacity=".4" /><path d="M10 3.500c2.5 3.2 4.5 5.5 4.5 8a4.5 4.5 0 01-9 0c0-2.5 2-4.8 4.5-8z" /></>),
  desaturate: svg(<><path d="M10 3.500c2.5 3.2 4.5 5.5 4.5 8a4.5 4.5 0 01-9 0c0-2.5 2-4.8 4.5-8z" /><path d="M10 3.500v12" /><path d="M10 6.500h2M10 9h3.500M10 11.500h4" opacity=".6" /></>),
  blemish: svg(<><rect x="3.5" y="7.5" width="13" height="5" rx="2.5" transform="rotate(-35 10 10)" /><path d="M8.5 10h.1M11.5 10h.1M10 8.500h.1M10 11.500h.1" strokeWidth="1.8" /></>),
  redeye: svg(<><path d="M2.5 10S5.5 5 10 5s7.5 5 7.5 5-3 5-7.5 5-7.5-5-7.5-5z" /><circle cx="10" cy="10" r="2.5" /><circle cx="10" cy="10" r=".9" fill="currentColor" stroke="none" /></>),
  crop: svg(<><path d="M6 2.500v11.500h11.500M2.5 6H14v11.5" /></>),
  picker: svg(<><path d="M12.6 3.400a2 2 0 012.8 2.800l-1.4 1.4-2.8-2.800zM10.4 5.600L4 12l-.5 3.500L7 15l6.4-6.4" /><rect x="14" y="13.5" width="3.5" height="3.5" fill="currentColor" stroke="none" /></>),
  transparency: svg(<><rect x="3.5" y="3.5" width="13" height="13" /><path d="M3.5 7.5h13M3.5 11.5h13M3.5 15.5h13" strokeDasharray="1.5 1.5" opacity=".55" /><path d="M3.5 3.5v13" strokeWidth="3" opacity=".5" /></>),
  contour: svg(<><rect x="6" y="6" width="8" height="8" /><rect x="3.5" y="3.5" width="13" height="13" opacity=".55" /><rect x="1.5" y="1.5" width="17" height="17" opacity=".3" /></>),
  perspective: svg(<><path d="M6 4h8l3.5 12h-15z" /><path d="M4.3 10h11.4" opacity=".45" /></>),
  warp: svg(<><path d="M2.5 6c3-3 5 3 7.5 0s4.500-3 7.500 0M2.500 14c3-3 5 3 7.500 0s4.500-3 7.500 0" /><path d="M2.500 6v8M17.500 6v8" opacity=".45" /></>),
  blend: svg(<><rect x="2" y="6" width="5" height="8" /><rect x="8" y="6.500" width="4" height="7" opacity=".6" /><circle cx="15.500" cy="10" r="2.500" /></>),
  shapebuilder: svg(<><circle cx="7.500" cy="10" r="5" /><circle cx="12.500" cy="10" r="5" opacity=".6" /></>),
  vflood: svg(<><path d="M4 9l5-5 7 7-5 5z" /><path d="M16.500 13.500c0 1.300-.8 2-1.500 2s-1.500-.7-1.500-2l1.500-2z" /></>),
  areameasure: svg(<><path d="M3.500 14l3-9 8 2 2 7z" /><path d="M3.500 17.500h13" opacity=".5" /></>),
  colourpicker: svg(<><path d="M13.500 3.500l3 3-2 2-3-3z" /><path d="M11 6l-6.500 6.500V16H8l6.500-6.500" /><circle cx="15.500" cy="15.500" r="1.500" opacity=".7" /></>),
  patch: svg(<><rect x="3" y="3" width="9" height="9" rx="1.500" strokeDasharray="2 1.500" /><rect x="8" y="8" width="9" height="9" rx="1.500" /></>),
  undobrush: svg(<><path d="M5 8h7a3.500 3.500 0 010 7H7" /><path d="M7.500 5.500L5 8l2.500 2.500" /></>),
  pushwarp: svg(<><path d="M3 13c3-5 6 1 9-3s3-3 5-4" /><path d="M14 4h3v3" opacity=".6" /></>),
  heal: svg(<><rect x="3" y="3" width="14" height="14" rx="3" /><path d="M10 6.500v7M6.500 10h7" /></>),
  medianbrush: svg(<><circle cx="10" cy="10" r="6" /><path d="M7 10h6M10 7v6" opacity=".6" /></>),
  colourreplace: svg(<><path d="M4 13l6-9 6 9a6 6 0 01-12 0z" /><path d="M7 14.500c1 1 3 1 4 0" opacity=".6" /></>),
  bgeraser: svg(<><path d="M4 12l6-7 6 6-4 4H7z" /><path d="M2.500 17.500h15" opacity=".5" strokeDasharray="2 2" /></>),
  mixer: svg(<><path d="M5 15c0-5 3-9 10-10-1 7-5 10-10 10z" /><path d="M5 15l4-4" opacity=".6" /></>),
  pixelbrush: svg(<><rect x="4" y="4" width="4" height="4" /><rect x="8" y="8" width="4" height="4" /><rect x="12" y="12" width="4" height="4" /></>),
  floderase: svg(<><path d="M4 10l5-6 7 7-5 5z" /><path d="M3 17h5" opacity=".6" /></>),
  colmarquee: svg(<><path d="M10 2.500v15" strokeDasharray="2 2" /><path d="M7 2.500h6M7 17.500h6" opacity=".6" /></>),
  rowmarquee: svg(<><path d="M2.500 10h15" strokeDasharray="2 2" /><path d="M2.500 7v6M17.500 7v6" opacity=".6" /></>),
  filterbrush: svg(<><path d="M3 4h14l-5 6v6l-4-2v-4z" /></>),
  adjustbrush: svg(<><circle cx="10" cy="10" r="6.500" /><path d="M10 3.500a6.500 6.500 0 010 13z" fill="currentColor" /></>),
  slice: svg(<><path d="M2.5 6.5h15M2.5 13.5h15M6.5 2.5v15M13.5 2.5v15" opacity=".45" /><rect x="6.5" y="6.5" width="7" height="7" /></>),
  artboard: svg(
    <>
      <path d="M6.5 2.5v15M13.5 2.5v15M2.5 6.5h15M2.5 13.5h15" />
      <rect x="6.5" y="6.5" width="7" height="7" fill="currentColor" stroke="none" opacity=".35" />
    </>,
  ),
  image: svg(
    <>
      <rect x="3.5" y="4.5" width="13" height="11" />
      <circle cx="7.5" cy="8.5" r="1.4" />
      <path d="M3.5 14l4-3.5 3 2.5 2.5-2 3 3" />
    </>,
  ),
  table: svg(<path d="M3.5 4.5h13v11h-13zM3.5 8.5h13M3.5 12h13M8 4.5v11M12.5 4.5v11" />),
  frameRect: svg(
    <>
      <rect x="3.5" y="4.5" width="13" height="11" />
      <path d="M3.5 4.5l13 11M16.5 4.5l-13 11" opacity=".6" />
    </>,
  ),
  frameEllipse: svg(
    <>
      <ellipse cx="10" cy="10" rx="6.5" ry="5.5" />
      <path d="M5.5 6l9 8M14.5 6l-9 8" opacity=".6" />
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
