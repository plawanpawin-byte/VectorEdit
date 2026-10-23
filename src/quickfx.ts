import type { Effect } from './types';

export interface QuickFx {
  id: string;
  label: string;
  effects: Effect[];
}

const fx = (type: Effect['type'], p: Partial<Effect>): Effect => ({ type, enabled: true, color: '#000000', opacity: 1, blur: 0, dx: 0, dy: 0, ...p });

/** One-click effect stacks for the Quick FX panel. Applying replaces the selection's effects. */
export const QUICK_FX: QuickFx[] = [
  { id: 'none', label: 'None', effects: [] },
  { id: 'drop', label: 'Drop shadow', effects: [fx('shadow', { color: '#000000', opacity: 0.45, blur: 10, dx: 4, dy: 6 })] },
  { id: 'soft', label: 'Soft shadow', effects: [fx('shadow', { color: '#000000', opacity: 0.3, blur: 24, dx: 0, dy: 10 })] },
  { id: 'glow', label: 'Glow', effects: [fx('glow', { color: '#ffd24a', opacity: 0.9, blur: 14 })] },
  { id: 'neon', label: 'Neon', effects: [fx('glow', { color: '#2fd3bd', opacity: 1, blur: 22 }), fx('glow', { color: '#2fd3bd', opacity: 0.8, blur: 6 })] },
  { id: 'emboss', label: 'Emboss', effects: [fx('bevel', { color: '#ffffff', opacity: 0.9, blur: 8 }), fx('innerShadow', { opacity: 0.4, blur: 6, dx: 2, dy: 3 })] },
  { id: 'inner', label: 'Inner shadow', effects: [fx('innerShadow', { opacity: 0.55, blur: 8, dx: 3, dy: 4 })] },
  { id: 'outline', label: 'Outline', effects: [fx('outline', { color: '#111111', blur: 6 })] },
  { id: 'blur', label: 'Blur', effects: [fx('blur', { blur: 6 })] },
];
