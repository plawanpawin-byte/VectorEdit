import type { Shape } from './types';

/* A shape's `group` is a path of group ids, outermost first ("g1/g2"), so groups can nest. */

export const topGroup = (g: string | null): string | null => (g ? g.split('/')[0] : null);

/** Wrap a shape's existing group (if any) inside a new outer group. */
export const wrapGroup = (g: string | null, outer: string): string => (g ? `${outer}/${g}` : outer);

/** Remove the outermost level of a group path. */
export const unwrapGroup = (g: string | null): string | null => {
  if (!g) return null;
  const i = g.indexOf('/');
  return i < 0 ? null : g.slice(i + 1);
};

export const inGroup = (s: Shape, path: string): boolean => s.group === path || (!!s.group && s.group.startsWith(path + '/'));

export type TreeNode = { kind: 'shape'; shape: Shape } | { kind: 'group'; path: string; children: TreeNode[] };

/** Arrange shapes (in the order given) into a nested tree; a group appears where its first member does. */
export function buildTree(shapes: Shape[]): TreeNode[] {
  const root: TreeNode[] = [];
  const groups = new Map<string, Extract<TreeNode, { kind: 'group' }>>();
  for (const s of shapes) {
    const segs = s.group ? s.group.split('/') : [];
    let level = root;
    segs.forEach((_, i) => {
      const path = segs.slice(0, i + 1).join('/');
      let node = groups.get(path);
      if (!node) {
        node = { kind: 'group', path, children: [] };
        groups.set(path, node);
        level.push(node);
      }
      level = node.children;
    });
    level.push({ kind: 'shape', shape: s });
  }
  return root;
}

export const membersOf = (node: Extract<TreeNode, { kind: 'group' }>): Shape[] =>
  node.children.flatMap((c) => (c.kind === 'shape' ? [c.shape] : membersOf(c)));
