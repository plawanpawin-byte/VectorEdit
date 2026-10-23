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
      snapshots: [],
    });
    const back = parseDoc(text);
    expect(back.artboards[0].name).toBe('Cover');
    expect(back.guides).toEqual([{ id: 'g1', axis: 'v', pos: 40 }]);
    expect(back.shapes).toHaveLength(1);
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
