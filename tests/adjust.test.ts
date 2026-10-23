import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defaultAdjust } from '../src/adjustments';
import { Artwork } from '../src/components/Artwork';
import { blankShape, normalizeShape } from '../src/shape';

const base = blankShape('a', 'rect', { w: 10, h: 10, fill: '#f00' });
const adj = (type: Parameters<typeof defaultAdjust>[0]) => blankShape('j', 'rect', { w: 10, h: 10, adjust: defaultAdjust(type) });
const out = (shapes: ReturnType<typeof blankShape>[]) => renderToStaticMarkup(createElement(Artwork, { shapes }));

describe('adjustment layers', () => {
  it('wraps the layers below in a filter', () => {
    const html = out([base, adj('grayscale')]);
    expect(html).toContain('filter="url(#adj-j)"');
    expect(html).toContain('<filter id="adj-j"');
    expect(html.indexOf('<g filter')).toBeLessThan(html.indexOf('#f00'));
  });
  it('leaves layers above the adjustment alone', () => {
    const top = blankShape('t', 'rect', { w: 5, h: 5, fill: '#0f0' });
    const html = out([base, adj('invert'), top]);
    expect(html.indexOf('#0f0')).toBeGreaterThan(html.indexOf('</g>'));
  });
  it('hidden adjustments do nothing', () => {
    expect(out([base, { ...adj('blur'), visible: false }])).not.toContain('filter');
  });
  it('survives a save and load', () => {
    const back = normalizeShape(JSON.parse(JSON.stringify(adj('huesat'))));
    expect(back?.adjust?.type).toBe('huesat');
    expect(normalizeShape({ ...base, adjust: 'junk' })?.adjust).toBeNull();
  });
});
