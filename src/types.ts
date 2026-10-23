export type Tool =
  | 'select'
  | 'direct'
  | 'pen'
  | 'pencil'
  | 'text'
  | 'line'
  | 'rect'
  | 'rrect'
  | 'ellipse'
  | 'polygon'
  | 'star'
  | 'rotate'
  | 'eyedropper'
  | 'hand'
  | 'zoom';

export type Mode = 'vector' | 'layout' | 'draw';

/** Anchor point; (hx, hy) is the outgoing handle offset, the incoming handle is its mirror. */
export interface Pt {
  x: number;
  y: number;
  hx: number;
  hy: number;
}

/** rect/ellipse/polygon/star are parametric shapes defined by their box (x, y, w, h) plus parameters. */
export type ShapeKind = 'rect' | 'ellipse' | 'polygon' | 'star' | 'line' | 'path' | 'text';

export interface Gradient {
  type: 'linear' | 'radial';
  a: string;
  b: string;
  /** degrees, 0 = left to right (linear only) */
  angle: number;
}

export interface Effect {
  type: 'shadow' | 'glow' | 'blur';
  enabled: boolean;
  color: string;
  opacity: number;
  /** blur radius in px */
  blur: number;
  dx: number;
  dy: number;
}

export type Dash = 'solid' | 'dash' | 'dot';
export type Cap = 'butt' | 'round' | 'square';
export type Join = 'miter' | 'round' | 'bevel';

export interface Shape {
  id: string;
  kind: ShapeKind;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** rect corner radius */
  radius: number;
  /** polygon sides / star points */
  sides: number;
  /** star inner radius as a fraction of the outer radius */
  inner: number;
  pts: Pt[];
  /** extra closed contours (holes or islands) drawn with even-odd fill, used by boolean results */
  extra: Pt[][];
  closed: boolean;
  text: string;
  fontSize: number;
  fill: string | null;
  gradient: Gradient | null;
  stroke: string | null;
  strokeWidth: number;
  dash: Dash;
  cap: Cap;
  join: Join;
  opacity: number;
  blend: string;
  effects: Effect[];
  group: string | null;
  visible: boolean;
  locked: boolean;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
