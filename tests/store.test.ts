import { beforeEach, describe, expect, it } from 'vitest';
import {
  booleanOp,
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
    loadDocument([{ id: 's900', kind: 'rect', x: 0, y: 0, w: 5, h: 5 }, { nope: true }], { w: 10, h: 10 }, null);
    expect(getState().shapes).toHaveLength(1);
    const next = makeShape('rect');
    expect(next.id).not.toBe('s900');
    expect(Number(next.id.slice(1))).toBeGreaterThan(900);
  });
});
