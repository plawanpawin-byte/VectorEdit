import { toPx, type Unit } from './units';

export interface DocPreset {
  id: string;
  label: string;
  group: 'Page sizes' | 'Photo' | 'Canvases' | 'Video and Web' | 'Devices';
  /** size in `unit`, portrait for paper */
  w: number;
  h: number;
  unit: Unit;
}

/** Size in pixels at 96 per inch, rounded to whole pixels. */
export const presetPx = (p: Pick<DocPreset, 'w' | 'h' | 'unit'>) => ({ w: Math.round(toPx(p.w, p.unit)), h: Math.round(toPx(p.h, p.unit)) });

const paper = (id: string, label: string, w: number, h: number, unit: Unit = 'mm'): DocPreset => ({ id, label, group: 'Page sizes', w, h, unit });
const photo = (id: string, label: string, w: number, h: number): DocPreset => ({ id, label, group: 'Photo', w, h, unit: 'in' });
const canvas = (id: string, label: string, w: number, h: number, unit: Unit = 'px'): DocPreset => ({ id, label, group: 'Canvases', w, h, unit });
const web = (id: string, label: string, w: number, h: number): DocPreset => ({ id, label, group: 'Video and Web', w, h, unit: 'px' });
const device = (id: string, label: string, w: number, h: number): DocPreset => ({ id, label, group: 'Devices', w, h, unit: 'pt' });

export const DOC_PRESETS: DocPreset[] = [
  // Page sizes
  paper('a0', 'A0', 841, 1189),
  paper('a1', 'A1', 594, 841),
  paper('a2', 'A2', 420, 594),
  paper('a3', 'A3', 297, 420),
  paper('a4', 'A4', 210, 297),
  paper('a5', 'A5', 148, 210),
  paper('a6', 'A6', 105, 148),
  paper('letter', 'Letter (ANSI A)', 8.5, 11, 'in'),
  paper('legal', 'Legal', 8.5, 14, 'in'),
  paper('ledger', 'Ledger (ANSI B)', 11, 17, 'in'),
  paper('trade', 'US Trade Paperback', 6, 9, 'in'),
  paper('half', 'Half Letter', 5.5, 8.5, 'in'),
  paper('oversize', 'Oversize Magazine', 9, 12, 'in'),
  // Photo prints (landscape size shown on each card)
  photo('p4r', '4R', 6, 4),
  photo('p5r', '5R', 7, 5),
  photo('p6r', '6R', 8, 6),
  photo('p8r', '8R', 10, 8),
  photo('p10r', '10R', 12, 10),
  photo('p11r', '11R', 14, 11),
  photo('p12r', '12R', 15, 12),
  photo('p16r', '16R', 20, 16),
  photo('p20r', '20R', 24, 20),
  photo('p24r', '24R', 31.5, 24),
  // Canvases and posters
  canvas('study', 'Study Canvas', 3000, 2000),
  canvas('illustration', 'Illustration Canvas', 4000, 3000),
  canvas('master', 'Master Canvas', 6000, 4000),
  canvas('us-poster-m', 'Medium US Poster', 18, 24, 'in'),
  canvas('us-poster-l', 'Large US Poster', 24, 36, 'in'),
  canvas('eu-poster-a1', 'Medium EU Poster (A1)', 594, 841, 'mm'),
  canvas('eu-poster-b1', 'Large EU Poster (B1)', 707, 1000, 'mm'),
  canvas('comic', 'Comic', 6, 9.5, 'in'),
  canvas('grid-1000', '1000-pixel grid (1:1)', 1000, 1000),
  canvas('grid-2000', '2000-pixel grid (1:1)', 2000, 2000),
  // Video and web
  web('social-portrait', 'Social Media Portrait Post', 1080, 1350),
  web('vertical-video', 'Vertical Video (9:16)', 1080, 1920),
  web('legacy-pc', 'Legacy PC (4:3)', 1024, 768),
  web('hd720', 'HD 720p', 1280, 720),
  web('laptop', 'Laptop', 1536, 864),
  web('fhd', 'FHD 1080p', 1920, 1080),
  web('qhd', 'QHD 1440p', 2560, 1440),
  web('uhd', 'UHD 4K', 3840, 2160),
  web('dci4k', 'DCI 4K', 4096, 2160),
  web('5k2k', '5K2K Video', 5120, 2160),
  // Devices (points, as iOS and iPadOS list them)
  device('iphone17pm', 'iPhone 17 Pro Max', 440, 956),
  device('iphone17', 'iPhone 17', 402, 874),
  device('iphone16e', 'iPhone 16e/17e', 390, 844),
  device('iphone15pm', 'iPhone 15 Pro Max/16 Plus', 430, 932),
  device('iphone15', 'iPhone 15/16', 393, 852),
  device('iphoneair', 'iPhone Air', 420, 912),
  device('ipad109', 'iPad 10.9"', 820, 1180),
  device('ipadpro13', 'iPad Pro 13"', 1032, 1376),
];

/** Largest page edge the editor accepts, in pixels. Bigger pages exhaust memory when exported. */
export const MAX_EDGE = 16000;

export function validSize(w: number, h: number): string | null {
  if (!Number.isFinite(w) || !Number.isFinite(h)) return 'Enter a width and a height.';
  if (w < 1 || h < 1) return 'The page must be at least 1 px on each side.';
  if (w > MAX_EDGE || h > MAX_EDGE) return `The page can be at most ${MAX_EDGE} px on each side.`;
  return null;
}
