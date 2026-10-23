import { describe, expect, it } from 'vitest';
import { TOOLS, WORKSPACES, groupsFor, toolInWorkspace } from '../src/tools/registry';

describe('tool registry', () => {
  it('has unique tool ids and a toolbox for every workspace', () => {
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
    for (const ws of WORKSPACES) expect(groupsFor(ws.id).flatMap((g) => g.tools).length, ws.id).toBeGreaterThan(1);
  });
  it('every tool has an icon, a hint and a cursor', () => {
    for (const t of TOOLS) {
      expect(t.icon, t.id).toBeTruthy();
      expect(t.hint.length, t.id).toBeGreaterThan(10);
      expect(t.workspaces.length, t.id).toBeGreaterThan(0);
    }
  });
  it('studios share pixel tools and keep Move, Hand and Zoom', () => {
    expect(toolInWorkspace('adjustbrush', 'retouching')).toBe(true);
    expect(toolInWorkspace('colourreplace', 'colour')).toBe(true);
    expect(toolInWorkspace('perspective', 'compositing')).toBe(true);
    for (const ws of WORKSPACES) for (const id of ['select', 'hand', 'zoom'] as const) expect(toolInWorkspace(id, ws.id), `${id} in ${ws.id}`).toBe(true);
  });
  it('no two tools in a workspace share a shortcut key', () => {
    for (const ws of WORKSPACES) {
      const keys = TOOLS.filter((t) => t.key && t.workspaces.includes(ws.id)).map((t) => t.key);
      expect(new Set(keys).size, ws.id).toBe(keys.length);
    }
  });
});
