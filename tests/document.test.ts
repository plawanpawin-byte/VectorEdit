import { describe, expect, it } from 'vitest';
import { parseDoc, serializeDoc } from '../src/document';
import { blankShape } from '../src/shape';

describe('document files', () => {
  it('round-trips version 2', () => {
    const shape = blankShape('s1', 'rect', { x: 1, y: 2, w: 3, h: 4, fill: '#abc' });
    const text = serializeDoc({
      shapes: [shape],
      artboards: [{ id: 'a1', name: 'Cover', x: 0, y: 0, w: 100, h: 200 }],
      guides: [{ id: 'g1', axis: 'v', pos: 40 }],
      slices: [{ id: 'sl1', name: 'Hero', x: 5, y: 6, w: 70, h: 30, format: 'jpg', scale: 2 }],
      snapshots: [],
    });
    const back = parseDoc(text);
    expect(back.artboards[0].name).toBe('Cover');
    expect(back.guides).toEqual([{ id: 'g1', axis: 'v', pos: 40 }]);
    expect(back.shapes).toHaveLength(1);
    expect(back.slices[0]).toMatchObject({ name: 'Hero', format: 'jpg', scale: 2 });
  });

  it('repairs damaged slices', () => {
    const d = parseDoc(JSON.stringify({ app: 'vectoredit', shapes: [], slices: [{ x: 1, y: 2, w: -5, format: 'bmp', scale: 99 }, 'junk'] }));
    expect(d.slices).toHaveLength(1);
    expect(d.slices[0].format).toBe('png');
    expect(d.slices[0].w).toBeGreaterThanOrEqual(1);
    expect(d.slices[0].scale).toBe(8);
  });

  it('opens version 1 files with a single artboard', () => {
    const v1 = JSON.stringify({ app: 'vectoredit', version: 1, artboard: { w: 640, h: 480 }, shapes: [] });
    const d = parseDoc(v1);
    expect(d.artboards).toHaveLength(1);
    expect(d.artboards[0].w).toBe(640);
    expect(d.artboards[0].h).toBe(480);
  });

  it('rejects other JSON and bad input', () => {
    expect(() => parseDoc('{"hello":1}')).toThrow();
    expect(() => parseDoc('null')).toThrow();
    expect(() => parseDoc('not json')).toThrow();
  });

  it('repairs damaged artboards and guides instead of crashing', () => {
    const d = parseDoc(JSON.stringify({ app: 'vectoredit', shapes: [], artboards: [{ w: 'x' }, 7], guides: [{ axis: 'q', pos: 1 }, { axis: 'h', pos: 5 }] }));
    expect(d.artboards[0].w).toBe(800);
    expect(d.guides).toHaveLength(1);
  });
});

import { importSvgText } from '../src/fileio';
import { getState as stateNow, setState as patchState } from '../src/store';
describe('svg import into the document', () => {
  it('adds shapes centred on the active page and selects them', () => {
    patchState({ shapes: [], selection: [], past: [], future: [] });
    const r = importSvgText('<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#f00"/><circle cx="50" cy="50" r="10"/></svg>');
    expect(r?.count).toBe(2);
    const s = stateNow();
    expect(s.shapes).toHaveLength(2);
    expect(s.selection).toHaveLength(2);
    expect(new Set(s.shapes.map((x) => x.id)).size).toBe(2);
    expect(importSvgText('<svg></svg>')).toBeNull();
  });
});
