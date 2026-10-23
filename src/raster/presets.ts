import type { MacroStep } from './macro';

export interface QuickPreset {
  id: string;
  name: string;
  steps: MacroStep[];
}

/** One-click looks built from the adjustments and filters (each is just a short macro). */
export const QUICK_PRESETS: QuickPreset[] = [
  { id: 'warm', name: 'Warm', steps: [{ op: 'white-balance', params: { temperature: 28, tint: 4 } }, { op: 'vibrance', params: { amount: 15 } }] },
  { id: 'cool', name: 'Cool', steps: [{ op: 'white-balance', params: { temperature: -28, tint: -4 } }, { op: 'brightness-contrast', params: { brightness: 0, contrast: 8 } }] },
  { id: 'faded', name: 'Faded film', steps: [{ op: 'tone-compression', params: { amount: 30, mid: 140 } }, { op: 'hsl', params: { hue: 0, sat: -18, light: 4 } }] },
  { id: 'punchy', name: 'Punchy', steps: [{ op: 'brightness-contrast', params: { brightness: 2, contrast: 28 } }, { op: 'vibrance', params: { amount: 35 } }] },
  { id: 'cinematic', name: 'Cinematic', steps: [{ op: 'split-toning', params: { shadowHue: 200, highlightHue: 38, amount: 40, balance: 0 } }, { op: 'brightness-contrast', params: { brightness: -4, contrast: 14 } }, { op: 'vignette', params: { amount: 35, size: 70 } }] },
  { id: 'mono', name: 'Black & white contrast', steps: [{ op: 'black-white', params: {} }, { op: 'brightness-contrast', params: { brightness: 0, contrast: 22 } }] },
  { id: 'glow', name: 'Soft glow', steps: [{ op: 'diffuse-glow', params: { radius: 18, amount: 45 } }, { op: 'vibrance', params: { amount: 10 } }] },
];
