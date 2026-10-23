export type BaseTool =
  | 'select'
  | 'direct'
  | 'corner'
  | 'pen'
  | 'pencil'
  | 'text'
  | 'frametext'
  | 'vbrush'
  | 'knife'
  | 'scissors'
  | 'fill'
  | 'measure'
  | 'line'
  | 'rect'
  | 'rrect'
  | 'ellipse'
  | 'rotate'
  | 'eyedropper'
  | 'hand'
  | 'zoom';

/** Base tools plus one tool per registered parametric shape, e.g. `shape:cloud`. */
export type Tool = BaseTool | `shape:${string}`;

export type Workspace = 'vector' | 'layout' | 'typography';

/**
 * Anchor point. (hx, hy) is the outgoing handle offset. The incoming handle is its mirror unless
 * (ix, iy) is set, which makes the node a cusp with an independent incoming handle offset
 * (so {ix: 0, iy: 0} means "no incoming handle").
 */
export interface Pt {
  x: number;
  y: number;
  hx: number;
  hy: number;
  ix?: number;
  iy?: number;
}

/** rect, ellipse and registry shapes are parametric: defined by their box (x, y, w, h) plus parameters. */
export type ShapeKind = 'rect' | 'ellipse' | 'shape' | 'line' | 'path' | 'text';

export interface Gradient {
  type: 'linear' | 'radial';
  a: string;
  b: string;
  /** degrees, 0 = left to right (linear without explicit geometry) */
  angle: number;
  /** explicit gradient axis in document units (set by the Fill tool); radial uses p1 as centre */
  p1?: { x: number; y: number };
  p2?: { x: number; y: number };
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
  /** id of the entry in the shape registry (kind 'shape') */
  shapeId: string;
  /** parameter values for that shape */
  params: Record<string, number>;
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
