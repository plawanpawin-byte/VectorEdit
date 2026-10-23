import type { BrushOptions } from './brush';

export interface PathBrushPreset {
  id: string;
  label: string;
  brush: BrushOptions;
}

/** Ready-made settings for the Vector Brush tool. Picking one sets the tool's profile and size. */
export const PATH_BRUSHES: PathBrushPreset[] = [
  { id: 'ink', label: 'Ink pen', brush: { size: 6, profile: 'taper', taper: 0.7 } },
  { id: 'brush', label: 'Round brush', brush: { size: 16, profile: 'taper', taper: 0.4 } },
  { id: 'calli', label: 'Calligraphy', brush: { size: 18, profile: 'calligraphic', taper: 0.7 } },
  { id: 'marker', label: 'Marker', brush: { size: 22, profile: 'uniform', taper: 0.7 } },
  { id: 'liner', label: 'Fine liner', brush: { size: 2, profile: 'uniform', taper: 0.7 } },
  { id: 'pencil', label: 'Soft pencil', brush: { size: 3, profile: 'taper', taper: 0.9 } },
];
