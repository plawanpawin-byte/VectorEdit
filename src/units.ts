/** Length units for the interface. Documents always store pixels (96 per inch); units only change what is shown and typed. */

export type Unit = 'px' | 'mm' | 'cm' | 'pt' | 'in';

export const UNITS: Unit[] = ['px', 'mm', 'cm', 'pt', 'in'];

/** How many of the unit make one pixel. */
const PER_PX: Record<Unit, number> = { px: 1, mm: 25.4 / 96, cm: 2.54 / 96, pt: 72 / 96, in: 1 / 96 };

export const fromPx = (px: number, unit: Unit) => px * PER_PX[unit];
export const toPx = (v: number, unit: Unit) => v / PER_PX[unit];
