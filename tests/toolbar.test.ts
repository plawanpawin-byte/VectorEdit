import { describe, expect, it } from 'vitest';
import { WORKSPACES, groupsFor } from '../src/tools/registry';
import { slotsFor } from '../src/components/Toolbar';

describe('toolbar arrangement', () => {
  it('shows every tool of every studio exactly once', () => {
    for (const ws of WORKSPACES.map((w) => w.id)) {
      const want = groupsFor(ws).flatMap((g) => g.tools.map((t) => t.id)).sort();
      const got = slotsFor(ws).flatMap((s) => (s === '|' ? [] : s.tools.map((t) => t.id))).sort();
      expect(got, ws).toEqual(want);
    }
  });

  it('gives the main vector tools their own buttons', () => {
    const solo = slotsFor('vector').filter((s) => s !== '|' && s.tools.length === 1).map((s) => s !== '|' && s.tools[0].id);
    expect(solo).toEqual(expect.arrayContaining(['select', 'pen', 'pencil', 'vbrush', 'hand', 'zoom']));
  });
});
