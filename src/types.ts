export type Tool =
  | 'select'
  | 'direct'
  | 'pen'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'text'
  | 'hand'
  | 'zoom'
  | 'pencil'
  | 'rrect'
  | 'polygon'
  | 'star'
  | 'rotate'
  | 'eyedropper';

/** Anchor point; (hx, hy) is the outgoing handle offset, the incoming handle is its mirror. */
export interface Pt {
  x: number;
  y: number;
  hx: number;
  hy: number;
}

export type Mode = 'vector' | 'layout' | 'draw';

export type ShapeKind = 'rect' | 'ellipse' | 'line' | 'path' | 'text';

export interface Shape {
  id: string;
  kind: ShapeKind;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  pts: Pt[];
  closed: boolean;
  text: string;
  fontSize: number;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  opacity: number;
  blend: string;
  visible: boolean;
  locked: boolean;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
