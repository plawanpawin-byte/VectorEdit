import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ShapeEl } from '../src/components/ShapeEl';
import { blankShape } from '../src/shape';
import type { Effect, Shape } from '../src/types';

const html = (s: Shape) => renderToStaticMarkup(createElement(ShapeEl, { shape: s }));
const rect = (p: Partial<Shape> = {}) => blankShape('r', 'rect', { x: 0, y: 0, w: 100, h: 60, fill: '#abcdef', ...p });
const line = (p: Partial<Shape> = {}) => blankShape('l', 'line', { stroke: '#000', strokeWidth: 3, pts: [{ x: 0, y: 0, hx: 0, hy: 0 }, { x: 80, y: 0, hx: 0, hy: 0 }], ...p });
const effect = (type: Effect['type']): Effect => ({ type, enabled: true, color: '#123456', opacity: 0.5, blur: 6, dx: 2, dy: 3 });

describe('shape rendering', () => {
  it('draws a plain filled rectangle with no wrapper or defs content', () => {
    const out = html(rect());
    expect(out).toContain('<rect');
    expect(out).toContain('fill="#abcdef"');
    expect(out).not.toContain('<filter');
    expect(out).not.toContain('<g');
  });

  it('wraps in a group when opacity or blend mode is set (once, not per element)', () => {
    const out = html(rect({ opacity: 0.4, stroke: '#000', strokeWidth: 2 }));
    expect(out).toContain('opacity="0.4"');
    expect(out.match(/opacity="0\.4"/g)).toHaveLength(1);
    expect(html(rect({ blend: 'multiply' }))).toContain('mix-blend-mode:multiply');
  });

  it('adds start and end markers to open paths', () => {
    const out = html(line({ arrowStart: 'circle', arrowEnd: 'arrow' }));
    expect(out).toContain('<marker');
    expect(out).toContain('marker-start');
    expect(out).toContain('marker-end');
    expect(out).toContain('auto-start-reverse');
  });

  it('does not add markers to closed shapes', () => {
    expect(html(rect({ stroke: '#000', arrowEnd: 'arrow' }))).not.toContain('<marker');
  });

  it('aligns strokes inside and outside with a clip or mask', () => {
    expect(html(rect({ stroke: '#000', strokeWidth: 4, strokeAlign: 'inside' }))).toContain('<clipPath');
    const outside = html(rect({ stroke: '#000', strokeWidth: 4, strokeAlign: 'outside' }));
    expect(outside).toContain('<mask');
    expect(outside).toContain('stroke-width="8"'); // doubled, half of it hidden
  });

  it('draws patterns over the base fill', () => {
    const out = html(rect({ pattern: { type: 'stripes', color: '#000', size: 10, angle: 45, weight: 0.4 } }));
    expect(out).toContain('<pattern');
    expect(out).toContain('rotate(45)');
    expect(out.match(/fill="url\(#pat-r\)"/g)).toHaveLength(1);
  });

  it('masks faded shapes with a gradient', () => {
    const out = html(rect({ fade: { p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 }, from: 1, to: 0 } }));
    expect(out).toContain('<mask');
    expect(out).toContain('stop-opacity="0"');
  });

  for (const type of ['shadow', 'glow', 'blur', 'innerShadow', 'innerGlow', 'outline', 'overlay', 'bevel'] as const) {
    it(`renders the ${type} effect as a valid filter chain`, () => {
      const out = html(rect({ effects: [effect(type)] }));
      expect(out).toContain('<filter');
      expect(out).toContain('filter="url(#fx-r)"');
      expect(out).not.toContain('NaN');
    });
  }

  it('stacks effects so each reads the previous result', () => {
    const out = html(rect({ effects: [effect('blur'), effect('shadow')] }));
    expect(out).toContain('result="e0"');
    expect(out).toContain('in="e0"');
  });

  it('skips disabled effects', () => {
    const out = html(rect({ effects: [{ ...effect('shadow'), enabled: false }] }));
    expect(out).not.toContain('<filter');
  });

  it('keeps gradient geometry in user space when set by the Fill tool', () => {
    const out = html(rect({ gradient: { type: 'linear', a: '#000', b: '#fff', angle: 0, p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 } } }));
    expect(out).toContain('gradientUnits="userSpaceOnUse"');
  });
});
