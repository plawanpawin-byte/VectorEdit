import { describe, expect, it } from 'vitest';
import { parseDoc, serializeDoc } from '../src/document';
import { masterOf, masterShapes } from '../src/master';
import { blankShape } from '../src/shape';
import type { Artboard } from '../src/types';

const boards: Artboard[] = [
  { id: 'm', name: 'Master', x: 0, y: 0, w: 100, h: 100, isMaster: true },
  { id: 'p', name: 'Page 2', x: 200, y: 0, w: 100, h: 100, master: 'm' },
  { id: 'q', name: 'Page 3', x: 400, y: 0, w: 100, h: 100 },
];
const logo = blankShape('logo', 'rect', { x: 10, y: 10, w: 20, h: 20 });
const body = blankShape('body', 'rect', { x: 210, y: 10, w: 20, h: 20 });

describe('master pages', () => {
  it('offsets master content onto the page that uses it', () => {
    const m = masterShapes(boards[1], boards, [logo, body])!;
    expect(m.shapes.map((s) => s.id)).toEqual(['logo']);
    expect(m.dx).toBe(200);
  });
  it('pages without a master get nothing; a master must be flagged', () => {
    expect(masterOf(boards[2], boards)).toBeNull();
    expect(masterOf({ ...boards[1], master: 'q' }, boards)).toBeNull();
    expect(masterOf({ ...boards[0], master: 'm' }, boards)).toBeNull();
  });
  it('survives save and load', () => {
    const back = parseDoc(serializeDoc({ shapes: [logo], artboards: boards, guides: [], slices: [], snapshots: [] }));
    expect(back.artboards[0].isMaster).toBe(true);
    expect(back.artboards[1].master).toBe('m');
    expect(back.artboards[2].master).toBeUndefined();
  });
});
