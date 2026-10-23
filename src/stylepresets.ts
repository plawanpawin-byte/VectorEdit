import type { Effect, Gradient, Shape } from './types';

/** The look of a shape that a saved style remembers. */
export interface Look {
  fill: string | null;
  gradient: Gradient | null;
  stroke: string | null;
  strokeWidth: number;
  opacity: number;
  blend: string;
  effects: Effect[];
}

export interface SavedStyle {
  id: string;
  name: string;
  look: Look;
}

export const lookOf = (s: Shape): Look => ({
  fill: s.fill,
  gradient: s.gradient,
  stroke: s.stroke,
  strokeWidth: s.strokeWidth,
  opacity: s.opacity,
  blend: s.blend,
  effects: s.effects.map((e) => ({ ...e })),
});

export const applyLook = (s: Shape, look: Look): Shape => ({ ...s, ...look, effects: look.effects.map((e) => ({ ...e })) });

const KEY = 'vectoredit.styles';

/** Saved styles live in this browser only. Storage can be blocked, so every access is guarded. */
export function loadStyles(): SavedStyle[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedStyle[]) : [];
  } catch {
    return [];
  }
}

export function saveStyles(styles: SavedStyle[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(styles));
  } catch {
    /* storage unavailable: the styles last for this session only */
  }
}
