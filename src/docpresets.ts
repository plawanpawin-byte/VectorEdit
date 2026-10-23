import { toPx, type Unit } from './units';

export interface DocPreset {
  id: string;
  label: string;
  group: 'Paper' | 'Screen' | 'Social' | 'Photo';
  /** size in `unit`, portrait for paper */
  w: number;
  h: number;
  unit: Unit;
}

/** Size in pixels at 96 per inch, rounded to whole pixels. */
export const presetPx = (p: Pick<DocPreset, 'w' | 'h' | 'unit'>) => ({ w: Math.round(toPx(p.w, p.unit)), h: Math.round(toPx(p.h, p.unit)) });

const paper = (id: string, label: string, w: number, h: number): DocPreset => ({ id, label, group: 'Paper', w, h, unit: 'mm' });

export const DOC_PRESETS: DocPreset[] = [
  paper('a0', 'A0', 841, 1189),
  paper('a1', 'A1', 594, 841),
  paper('a2', 'A2', 420, 594),
  paper('a3', 'A3', 297, 420),
  paper('a4', 'A4', 210, 297),
  paper('a5', 'A5', 148, 210),
  paper('a6', 'A6', 105, 148),
  { id: 'letter', label: 'US Letter', group: 'Paper', w: 8.5, h: 11, unit: 'in' },
  { id: 'legal', label: 'US Legal', group: 'Paper', w: 8.5, h: 14, unit: 'in' },
  { id: 'tabloid', label: 'Tabloid', group: 'Paper', w: 11, h: 17, unit: 'in' },
  { id: 'hd', label: 'Full HD', group: 'Screen', w: 1920, h: 1080, unit: 'px' },
  { id: 'qhd', label: 'QHD', group: 'Screen', w: 2560, h: 1440, unit: 'px' },
  { id: '4k', label: '4K', group: 'Screen', w: 3840, h: 2160, unit: 'px' },
  { id: 'web', label: 'Web page', group: 'Screen', w: 1440, h: 900, unit: 'px' },
  { id: 'phone', label: 'Phone', group: 'Screen', w: 390, h: 844, unit: 'px' },
  { id: 'square', label: 'Square post', group: 'Social', w: 1080, h: 1080, unit: 'px' },
  { id: 'portrait', label: 'Portrait post', group: 'Social', w: 1080, h: 1350, unit: 'px' },
  { id: 'story', label: 'Story', group: 'Social', w: 1080, h: 1920, unit: 'px' },
  { id: 'banner', label: 'Banner', group: 'Social', w: 1500, h: 500, unit: 'px' },
  { id: 'p4x6', label: 'Photo 4 × 6', group: 'Photo', w: 4, h: 6, unit: 'in' },
  { id: 'p5x7', label: 'Photo 5 × 7', group: 'Photo', w: 5, h: 7, unit: 'in' },
  { id: 'p8x10', label: 'Photo 8 × 10', group: 'Photo', w: 8, h: 10, unit: 'in' },
];

/** Largest page edge the editor accepts, in pixels. Bigger pages exhaust memory when exported. */
export const MAX_EDGE = 16000;

export function validSize(w: number, h: number): string | null {
  if (!Number.isFinite(w) || !Number.isFinite(h)) return 'Enter a width and a height.';
  if (w < 1 || h < 1) return 'The page must be at least 1 px on each side.';
  if (w > MAX_EDGE || h > MAX_EDGE) return `The page can be at most ${MAX_EDGE} px on each side.`;
  return null;
}
