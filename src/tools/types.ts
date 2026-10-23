import type { ComponentType, ReactNode } from 'react';
import type { State } from '../store';
import type { Tool, Workspace } from '../types';

export interface XY {
  x: number;
  y: number;
}

/** Everything a tool needs to react to a pointer event. Coordinates are document units. */
export interface PointerCtx {
  /** document position, snapped when snapping is on */
  p: XY;
  /** document position, never snapped */
  raw: XY;
  /** position inside the canvas viewport, in screen pixels */
  screen: XY;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
  /** the element that received the event (selection handles carry data attributes) */
  target: Element;
  st: State;
  zoom: number;
  /** hit-test tolerance in document units (about 5 screen pixels) */
  tol: number;
  /** draw an overlay (in document coordinates) above the artwork; null clears it */
  setOverlay(node: ReactNode | null): void;
}

/** What a tool returns from `down`: callbacks for the rest of the gesture. */
export interface Session {
  move?(c: PointerCtx): void;
  up?(c: PointerCtx): void;
}

/** Which selection chrome the canvas draws for the active tool. */
export type Chrome = 'transform' | 'nodes' | 'outline' | 'artboard' | 'none';

export interface ToolDef {
  id: Tool;
  label: string;
  /** single-key shortcut (lower case) */
  key?: string;
  icon: ReactNode;
  /** tools of one group share a toolbar slot (the slot shows the last used one) */
  group: string;
  workspaces: Workspace[];
  cursor: string;
  /** one-line help shown in the status bar; **bold** marks key words */
  hint: string;
  chrome: Chrome;
  down?(c: PointerCtx): Session | void;
  dblclick?(c: PointerCtx): void;
  /** called for Delete/Backspace before the default delete; return true when handled */
  onDelete?(): boolean;
  /** extra controls in the context bar while this tool is active */
  Options?: ComponentType;
}
