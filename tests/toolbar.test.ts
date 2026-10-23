import { describe, expect, it } from 'vitest';
import { WORKSPACES, groupsFor } from '../src/tools/registry';
import { fitSlots, slotsFor } from '../src/components/Toolbar';

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

describe('toolbar fitting', () => {
  const slots = slotsFor('vector');
  const count = (xs: ReturnType<typeof fitSlots>) => xs.flatMap((s) => (s === '|' ? [] : s.tools)).length;

  it('leaves the toolbox alone when it fits', () => {
    expect(fitSlots(slots, 5000)).toEqual(slots);
  });

  it('folds what does not fit into one last slot without losing tools', () => {
    const fitted = fitSlots(slots, 300);
    const height = fitted.reduce((n, s) => n + (s === '|' ? 11 : 36), 0);
    expect(height).toBeLessThanOrEqual(300);
    expect(count(fitted)).toBe(count(slots));
    const last = fitted[fitted.length - 1];
    expect(last !== '|' && last.id).toBe('toolbar-more');
  });
});
