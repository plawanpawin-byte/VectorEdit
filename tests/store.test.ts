import { beforeEach, describe, expect, it } from 'vitest';
import {
  addArtboard,
  addSlice,
  beginBatch,
  endBatch,
  removeSlice,
  updateSlice,
  addGuide,
  booleanOp,
  deleteArtboard,
  duplicateArtboard,
  restoreSnapshot,
  takeSnapshot,
  updateArtboard,
  commit,
  convertToCurves,
  expandToGroups,
  getState,
  groupSelected,
  loadDocument,
  makeShape,
  redo,
  setState,
  undo,
  ungroupSelected,
} from '../src/store';

function reset() {
  setState({ shapes: [], selection: [], past: [], future: [], pen: null, editingText: null });
}
const add = (x: number, w = 100) => {
  const s = makeShape('rect', { x, y: 0, w, h: 100 });
  commit([...getState().shapes, s], { selection: [...getState().selection, s.id] });
  return s;
};

describe('history', () => {
  beforeEach(reset);

  it('undoes and redoes', () => {
    add(0);
    add(200);
    expect(getState().shapes).toHaveLength(2);
    undo();
    expect(getState().shapes).toHaveLength(1);
    redo();
    expect(getState().shapes).toHaveLength(2);
  });

  it('drops redo history after a new change', () => {
    add(0);
    undo();
    add(50);
    expect(getState().future).toHaveLength(0);
  });

  it('keeps the selection valid after undo', () => {
    const s = add(0);
    undo();
    expect(getState().selection).not.toContain(s.id);
  });
});

describe('groups', () => {
  beforeEach(reset);

  it('groups, expands the selection and ungroups', () => {
    const a = add(0);
    const b = add(200);
    add(400);
    setState({ selection: [a.id, b.id] });
    groupSelected();
    const grouped = getState().shapes.filter((s) => s.group);
    expect(grouped).toHaveLength(2);
    expect(expandToGroups([a.id])).toEqual(expect.arrayContaining([a.id, b.id]));
    ungroupSelected();
    expect(getState().shapes.every((s) => !s.group)).toBe(true);
  });

  it('keeps group members adjacent in the stack', () => {
    const a = add(0);
    add(100);
    const c = add(200);
    setState({ selection: [a.id, c.id] });
    groupSelected();
    const idx = getState().shapes.map((s) => s.group !== null);
    expect(idx.join()).toMatch(/true,true/);
  });
});

describe('boolean and curves', () => {
  beforeEach(reset);

  it('replaces the operands with the result', () => {
    const a = add(0);
    const b = add(50);
    setState({ selection: [a.id, b.id] });
    expect(booleanOp('union')).toBe(true);
    expect(getState().shapes).toHaveLength(1);
    expect(getState().shapes[0].kind).toBe('path');
    undo();
    expect(getState().shapes).toHaveLength(2);
  });

  it('needs two shapes', () => {
    const a = add(0);
    setState({ selection: [a.id] });
    expect(booleanOp('union')).toBe(false);
  });

  it('converts parametric shapes to curves', () => {
    const a = add(0);
    setState({ selection: [a.id] });
    convertToCurves();
    expect(getState().shapes[0].kind).toBe('path');
    expect(getState().shapes[0].pts).toHaveLength(4);
  });
});

describe('loading documents', () => {
  it('normalises old files and keeps ids unique', () => {
    loadDocument([{ id: 's900', kind: 'rect', x: 0, y: 0, w: 5, h: 5 }, { nope: true }], [{ id: 'a1', name: 'Page 1', x: 0, y: 0, w: 10, h: 10 }], null);
    expect(getState().shapes).toHaveLength(1);
    const next = makeShape('rect');
    expect(next.id).not.toBe('s900');
    expect(Number(next.id.slice(1))).toBeGreaterThan(900);
  });
});

describe('artboards, guides and snapshots', () => {
  beforeEach(() => {
    setState({
      shapes: [],
      selection: [],
      past: [],
      future: [],
      artboards: [{ id: 'a1', name: 'Page 1', x: 0, y: 0, w: 800, h: 600 }],
      activeArtboard: 'a1',
      guides: [],
      slices: [],
      snapshots: [],
    });
  });

  it('adds pages beside the last one and makes them active', () => {
    const b = addArtboard();
    expect(b.x).toBeGreaterThanOrEqual(800);
    expect(getState().activeArtboard).toBe(b.id);
    undo();
    expect(getState().artboards).toHaveLength(1);
    expect(getState().activeArtboard).toBe('a1');
  });

  it('duplicates a page with its content', () => {
    add(100, 50);
    duplicateArtboard('a1');
    expect(getState().artboards).toHaveLength(2);
    expect(getState().shapes).toHaveLength(2);
  });

  it('deletes a page together with its shapes, but never the last page', () => {
    const b = addArtboard();
    const s = makeShape('rect', { x: b.x + 10, y: 10, w: 20, h: 20 });
    commit([...getState().shapes, s]);
    deleteArtboard(b.id);
    expect(getState().artboards).toHaveLength(1);
    expect(getState().shapes).toHaveLength(0);
    deleteArtboard('a1');
    expect(getState().artboards).toHaveLength(1);
  });

  it('undoes page resizing together with other edits', () => {
    updateArtboard('a1', { w: 1000 });
    expect(getState().artboards[0].w).toBe(1000);
    undo();
    expect(getState().artboards[0].w).toBe(800);
  });

  it('records guides in history', () => {
    addGuide('v', 120);
    expect(getState().guides).toHaveLength(1);
    undo();
    expect(getState().guides).toHaveLength(0);
  });

  it('restores a snapshot and can undo the restore', () => {
    add(0);
    takeSnapshot('one');
    add(200);
    expect(getState().shapes).toHaveLength(2);
    restoreSnapshot(getState().snapshots[0].id);
    expect(getState().shapes).toHaveLength(1);
    undo();
    expect(getState().shapes).toHaveLength(2);
  });
});

describe('layout helpers', () => {
  it('builds a table as a group of cells and text', async () => {
    const { tableShapes } = await import('../src/tools/layout');
    const cells = tableShapes(0, 0, 300, 120, 4, 3, 'gt');
    expect(cells.filter((s) => s.kind === 'rect')).toHaveLength(12);
    expect(cells.filter((s) => s.kind === 'text')).toHaveLength(12);
    expect(cells.every((s) => s.group === 'gt')).toBe(true);
    expect(cells.find((s) => s.name === 'Text 1,2')!.text).toBe('Column 2');
  });

  it('places an image into the selected empty frame', async () => {
    const { placeImage } = await import('../src/images');
    reset();
    const frame = makeShape('rect', { x: 0, y: 0, w: 100, h: 100, frame: true });
    commit([frame], { selection: [frame.id] });
    placeImage({ src: 'data:image/png;base64,AAAA', w: 10, h: 10 });
    expect(getState().shapes).toHaveLength(1);
    expect(getState().shapes[0].src).toContain('data:image/png');
  });

  it('places an image as a new rectangle when no frame is selected', async () => {
    const { placeImage } = await import('../src/images');
    reset();
    placeImage({ src: 'data:image/png;base64,AAAA', w: 4000, h: 1000 }, { x: 400, y: 300 });
    const s = getState().shapes[0];
    expect(s.src).not.toBe('');
    expect(s.w).toBeLessThanOrEqual(800 * 0.8 + 1);
    expect(s.w / s.h).toBeCloseTo(4, 0);
  });
});

describe('history memory', () => {
  it('drops the oldest steps when pixel layers exceed the budget', async () => {
    const { trimHistory } = await import('../src/store');
    const layer = (src: string) => makeShape('rect', { src, raster: true, rw: 1, rh: 1, w: 1, h: 1 });
    const docs = ['a'.repeat(100), 'b'.repeat(100), 'c'.repeat(100), 'd'.repeat(100)].map((src) => ({ shapes: [layer(src)], artboards: [], guides: [], slices: [] }));
    const kept = trimHistory(docs.slice(0, 3), docs[3], 250);
    expect(kept.length).toBeLessThan(3);
    expect(kept.length).toBeGreaterThanOrEqual(1);
  });

  it('keeps everything when under the budget and counts shared pixels once', async () => {
    const { trimHistory } = await import('../src/store');
    const shared = makeShape('rect', { src: 'x'.repeat(100), raster: true });
    const docs = [1, 2, 3].map(() => ({ shapes: [shared], artboards: [], guides: [], slices: [] }));
    expect(trimHistory(docs, docs[0], 150)).toHaveLength(3);
  });
});

describe('slices and batches', () => {
  beforeEach(reset);

  it('adds, edits and removes slices with undo', () => {
    const sl = addSlice({ x: 10.4, y: 20.6, w: 100, h: 50 });
    expect(getState().slices[0]).toMatchObject({ x: 10, y: 21, w: 100, h: 50, format: 'png' });
    updateSlice(sl.id, { format: 'jpg', scale: 2 });
    expect(getState().slices[0].scale).toBe(2);
    undo();
    expect(getState().slices[0].scale).toBe(1);
    removeSlice(sl.id);
    expect(getState().slices).toHaveLength(0);
    undo();
    expect(getState().slices).toHaveLength(1);
  });

  it('collapses a batch of edits into one undo step', () => {
    beginBatch();
    add(0);
    add(100);
    add(200);
    endBatch();
    expect(getState().shapes).toHaveLength(3);
    undo();
    expect(getState().shapes).toHaveLength(0);
    redo();
    expect(getState().shapes).toHaveLength(3);
  });

  it('an empty batch leaves no history', () => {
    const before = getState().past.length;
    beginBatch();
    endBatch();
    expect(getState().past.length).toBe(before);
  });
});

import { mergeRows } from '../src/store';
describe('data merge', () => {
  it('creates one page per row with filled text and fresh ids', () => {
    reset();
    const t = makeShape('text', { x: 20, y: 20, w: 200, h: 30, text: 'Hello {{Name}}' });
    commit([t]);
    expect(mergeRows([{ Name: 'Ada' }, { Name: 'Grace' }])).toBe(2);
    const s = getState();
    expect(s.artboards).toHaveLength(3);
    const texts = s.shapes.filter((x) => x.kind === 'text').map((x) => x.text);
    expect(texts).toEqual(['Hello {{Name}}', 'Hello Ada', 'Hello Grace']);
    expect(new Set(s.shapes.map((x) => x.id)).size).toBe(3);
    expect(s.shapes[2].x).toBeGreaterThan(s.shapes[1].x);
    expect(mergeRows([])).toBe(0);
  });
});

import { setTransform as applyBox } from '../src/store';
describe('transform with a reference point', () => {
  it('keeps the chosen edge fixed when the size changes', () => {
    reset();
    const r = makeShape('rect', { x: 100, y: 50, w: 40, h: 20 });
    commit([r], { selection: [r.id] });
    const box = { x: 100, y: 50, w: 40, h: 20 };
    applyBox(box, { w: 80, x: box.x + (box.w - 80) * 1 }); // anchor on the right edge
    const s = getState().shapes[0];
    expect(s.x + s.w).toBeCloseTo(140);
    expect(s.w).toBeCloseTo(80);
  });
});
