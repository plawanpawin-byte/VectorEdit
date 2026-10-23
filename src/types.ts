export type BaseTool =
  | 'select'
  | 'direct'
  | 'corner'
  | 'artboard'
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
  | 'image'
  | 'table'
  | 'frame-rect'
  | 'slice'
  | 'transparency'
  | 'contour'
  | 'perspective'
  | 'warp'
  | 'brush'
  | 'eraser'
  | 'bucket'
  | 'pgradient'
  | 'marquee'
  | 'marquee-ellipse'
  | 'lasso'
  | 'wand'
  | 'selbrush'
  | 'clone'
  | 'smudge'
  | 'blurbrush'
  | 'sharpenbrush'
  | 'dodge'
  | 'burn'
  | 'saturate'
  | 'desaturate'
  | 'blemish'
  | 'redeye'
  | 'crop'
  | 'picker'
  | 'frame-ellipse'
  | 'hand'
  | 'zoom';

/** Base tools plus one tool per registered parametric shape, e.g. `shape:cloud`. */
export type Tool = BaseTool | `shape:${string}`;

export type Workspace = 'vector' | 'pixel' | 'layout' | 'typography' | 'slice' | 'scripting';

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

export type ArrowKind = '' | 'arrow' | 'open' | 'circle' | 'square' | 'diamond' | 'bar';
export type StrokeAlign = 'center' | 'inside' | 'outside';

export type AdjustType = 'brightness' | 'huesat' | 'invert' | 'grayscale' | 'sepia' | 'blur' | 'posterize' | 'threshold';

/** A non-destructive adjustment layer: filters everything stacked below it. */
export interface Adjust {
  type: AdjustType;
  a: number;
  b: number;
  /** limit the effect to the layer's own outline instead of the whole page */
  region?: boolean;
}

export interface Pattern {
  type: 'stripes' | 'dots' | 'grid' | 'cross' | 'checker' | 'waves' | 'bricks' | 'diamonds' | 'zigzag';
  color: string;
  /** cell size in px */
  size: number;
  /** degrees */
  angle: number;
  /** line weight (or dot size) as a fraction of the cell */
  weight: number;
}

/** A transparency gradient: opacity runs from `from` at p1 to `to` at p2. */
export interface Fade {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  from: number;
  to: number;
}

export interface Effect {
  type: 'shadow' | 'glow' | 'blur' | 'innerShadow' | 'innerGlow' | 'outline' | 'overlay' | 'bevel';
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
  fontFamily: string;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right' | 'justify';
  /** line height as a multiple of the font size */
  lineHeight: number;
  /** extra space between characters, in px */
  letterSpacing: number;
  /** width of a text frame in px; 0 means artistic (unwrapped) text */
  frameW: number;
  /** id of a path shape the text runs along, or null */
  pathId: string | null;
  /** image shown inside the shape (a data URL), or empty */
  src: string;
  /** how the image fills the shape: cover ('fill') or contain ('fit') */
  fit: 'fill' | 'fit';
  /** picture frame: shows a placeholder until an image is placed */
  frame: boolean;
  /** pixel layer: `src` holds editable pixels of size rw x rh */
  raster: boolean;
  rw: number;
  rh: number;
  fill: string | null;
  gradient: Gradient | null;
  pattern: Pattern | null;
  fade: Fade | null;
  /** set on adjustment layers */
  adjust: Adjust | null;
  /** id of the shape whose outline clips this one (clipping mask) */
  clip: string | null;
  stroke: string | null;
  strokeWidth: number;
  strokeAlign: StrokeAlign;
  arrowStart: ArrowKind;
  arrowEnd: ArrowKind;
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

export interface Artboard {
  id: string;
  name: string;
  /** this page is a master: its content repeats behind every page that picks it */
  isMaster?: boolean;
  /** id of the master page applied to this page */
  master?: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Guide {
  id: string;
  axis: 'h' | 'v';
  pos: number;
}

export interface Slice {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  format: 'png' | 'jpg' | 'svg';
  /** export scale: 1 = actual size */
  scale: number;
}

/** The undoable part of a document. */
export interface Doc {
  shapes: Shape[];
  artboards: Artboard[];
  guides: Guide[];
  slices: Slice[];
}

export interface Snapshot extends Doc {
  id: string;
  name: string;
  time: number;
}
