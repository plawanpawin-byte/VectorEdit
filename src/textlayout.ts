import type { Shape } from './types';

export interface TextLine {
  text: string;
  /** x of the line's anchor inside the frame (left, centre or right edge depending on alignment) */
  x: number;
  y: number;
  width: number;
  /** true for the last line of a paragraph (not justified) */
  last: boolean;
}

export interface TextLayout {
  lines: TextLine[];
  width: number;
  height: number;
}

export const fontString = (s: Pick<Shape, 'fontSize' | 'fontFamily' | 'fontWeight' | 'italic'>) =>
  `${s.italic ? 'italic ' : ''}${s.fontWeight} ${s.fontSize}px ${s.fontFamily}, serif`;

let ctx: CanvasRenderingContext2D | null | undefined;

function measureCtx(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx;
  try {
    ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Width of a string in px. Uses the canvas when available and a width estimate otherwise (tests, SSR). */
export function measureText(text: string, s: Pick<Shape, 'fontSize' | 'fontFamily' | 'fontWeight' | 'italic' | 'letterSpacing'>): number {
  const c = measureCtx();
  let w: number;
  if (c) {
    c.font = fontString(s);
    w = c.measureText(text).width;
  } else {
    w = text.length * s.fontSize * (s.fontWeight >= 700 ? 0.6 : 0.54);
  }
  return w + text.length * (s.letterSpacing ?? 0);
}

/** Break one paragraph into lines no wider than `max`. A word wider than the frame is split by character. */
function wrap(paragraph: string, s: Shape, max: number): string[] {
  if (max <= 0) return [paragraph];
  const out: string[] = [];
  let line = '';
  const splitLong = (word: string): string => {
    let rest = word;
    while (rest.length > 1 && measureText(rest, s) > max) {
      let cut = rest.length - 1;
      while (cut > 1 && measureText(rest.slice(0, cut), s) > max) cut--;
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    return rest;
  };
  for (const token of paragraph.split(/(\s+)/)) {
    if (!token) continue;
    if (/^\s+$/.test(token)) {
      line += token;
      continue;
    }
    const attempt = line + token;
    if (measureText(attempt.trimEnd(), s) <= max) {
      line = attempt;
      continue;
    }
    if (line.trim()) out.push(line.trimEnd());
    line = measureText(token, s) > max ? splitLong(token) : token;
  }
  out.push(line.trimEnd());
  return out;
}

const cache = new WeakMap<Shape, TextLayout>();

export function layoutText(s: Shape): TextLayout {
  const hit = cache.get(s);
  if (hit) return hit;
  const lh = s.fontSize * (s.lineHeight || 1.2);
  const lines: { text: string; last: boolean }[] = [];
  for (const para of s.text.split('\n')) {
    const parts = s.frameW > 0 ? wrap(para, s, s.frameW) : [para];
    parts.forEach((t, i) => lines.push({ text: t, last: i === parts.length - 1 }));
  }
  const widths = lines.map((l) => measureText(l.text, s));
  const width = s.frameW > 0 ? s.frameW : Math.max(1, ...widths);
  const result: TextLayout = {
    width,
    height: Math.max(1, lines.length) * lh,
    lines: lines.map((l, i) => ({
      text: l.text,
      last: l.last,
      width: widths[i],
      y: s.y + i * lh,
      x: s.align === 'center' ? s.x + width / 2 : s.align === 'right' ? s.x + width : s.x,
    })),
  };
  cache.set(s, result);
  return result;
}
