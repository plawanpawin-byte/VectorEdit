import { describe, expect, it } from 'vitest';
import { DOC_PRESETS, MAX_EDGE, presetPx, validSize } from '../src/docpresets';
import { kindOf, looksLikeSvg } from '../src/importer';
import { getState, isDirty, markClean, newDocument, openNewDocument, setState, makeShape, commit } from '../src/store';

describe('document presets', () => {
  it('have unique ids and positive sizes', () => {
    expect(new Set(DOC_PRESETS.map((p) => p.id)).size).toBe(DOC_PRESETS.length);
    for (const p of DOC_PRESETS) {
      const px = presetPx(p);
      expect(px.w).toBeGreaterThan(0);
      expect(px.h).toBeGreaterThan(0);
      expect(px.w).toBeLessThanOrEqual(MAX_EDGE);
    }
  });

  it('turns A4 into 96-dpi pixels', () => {
    expect(presetPx(DOC_PRESETS.find((p) => p.id === 'a4')!)).toEqual({ w: 794, h: 1123 });
    expect(presetPx(DOC_PRESETS.find((p) => p.id === 'letter')!)).toEqual({ w: 816, h: 1056 });
  });

  it('rejects empty, tiny and huge pages', () => {
    expect(validSize(Number.NaN, 10)).not.toBeNull();
    expect(validSize(0, 10)).not.toBeNull();
    expect(validSize(MAX_EDGE + 1, 10)).not.toBeNull();
    expect(validSize(800, 600)).toBeNull();
  });
});

describe('new document', () => {
  it('creates a page of the requested size, clears state and closes the dialog', () => {
    openNewDocument();
    expect(getState().newDocOpen).toBe(true);
    setState({ editingText: 'x', nodeSel: [{ id: "s1", i: 0 }] });
    newDocument({ w: 794, h: 1123, name: 'A4' });
    const st = getState();
    expect(st.newDocOpen).toBe(false);
    expect(st.artboards).toEqual([{ id: 'a1', name: 'A4', x: 0, y: 0, w: 794, h: 1123 }]);
    expect(st.shapes).toHaveLength(0);
    expect(st.editingText).toBeNull();
    expect(st.nodeSel).toEqual([]);
  });

  it('is called with no argument when wired straight to a click handler', () => {
    newDocument();
    expect(getState().artboards[0]).toMatchObject({ w: 800, h: 600 });
  });

  it('tracks unsaved changes', () => {
    newDocument();
    expect(isDirty()).toBe(false);
    commit([makeShape('rect', { w: 10, h: 10 })]);
    expect(isDirty()).toBe(true);
    markClean();
    expect(isDirty()).toBe(false);
  });
});

describe('import file kinds', () => {
  it('classifies by type, then by extension for typeless dropped files', () => {
    expect(kindOf('a.svg', '')).toBe('svg');
    expect(kindOf('a', 'image/svg+xml')).toBe('svg');
    expect(kindOf('photo.JPG', '')).toBe('raster');
    expect(kindOf('x.webp', 'image/webp')).toBe('raster');
    expect(kindOf('notes.txt', 'text/plain')).toBe('other');
    expect(kindOf('doc.vedit', '')).toBe('other');
  });

  it('recognises pasted SVG text, with or without a prolog', () => {
    expect(looksLikeSvg('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBe(true);
    expect(looksLikeSvg('<?xml version="1.0"?>\n<!-- c -->\n<svg width="1"></svg>')).toBe(true);
    expect(looksLikeSvg('hello <svg>')).toBe(false);
    expect(looksLikeSvg('<div></div>')).toBe(false);
  });
});
