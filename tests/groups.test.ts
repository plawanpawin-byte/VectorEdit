import { describe, expect, it } from 'vitest';
import { buildTree, inGroup, membersOf, topGroup, unwrapGroup, wrapGroup } from '../src/groups';
import { blankShape } from '../src/shape';
import { getState, groupSelected, newDocument, setState, ungroupSelected, commit, expandToGroups } from '../src/store';

const r = (id: string, group: string | null = null) => blankShape(id, 'rect', { w: 10, h: 10, group });

describe('nested groups', () => {
  it('path helpers', () => {
    expect(topGroup('a/b')).toBe('a');
    expect(wrapGroup('b', 'a')).toBe('a/b');
    expect(wrapGroup(null, 'a')).toBe('a');
    expect(unwrapGroup('a/b')).toBe('b');
    expect(unwrapGroup('a')).toBeNull();
    expect(inGroup(r('x', 'a/b'), 'a')).toBe(true);
    expect(inGroup(r('x', 'ab'), 'a')).toBe(false);
  });
  it('builds a tree', () => {
    const tree = buildTree([r('1', 'a/b'), r('2', 'a'), r('3')]);
    expect(tree).toHaveLength(2);
    const a = tree[0];
    expect(a.kind === 'group' && a.children.map((c) => c.kind)).toEqual(['group', 'shape']);
    expect(a.kind === 'group' && membersOf(a).map((s) => s.id)).toEqual(['1', '2']);
  });
  it('groups groups and ungroups one level at a time', () => {
    newDocument();
    commit([r('1'), r('2'), r('3')]);
    setState({ selection: ['1', '2'] });
    groupSelected();
    const inner = getState().shapes[0].group!;
    setState({ selection: ['1', '2', '3'] });
    groupSelected();
    expect(getState().shapes.every((s) => topGroup(s.group) === topGroup(getState().shapes[2].group))).toBe(true);
    expect(getState().shapes[0].group).toMatch(new RegExp('/' + inner + '$'));
    expect(expandToGroups(['3']).sort()).toEqual(['1', '2', '3']);
    setState({ selection: ['1'] });
    ungroupSelected();
    expect(getState().shapes[0].group).toBe(inner);
    expect(getState().shapes[2].group).toBeNull();
  });
});
