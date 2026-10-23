import type { Workspace } from '../types';

/** Workspaces whose documents edit pixel layers (they share the pixel panels and menus). */
export const isPixelWorkspace = (ws: Workspace) => ws === 'pixel' || ws === 'retouching' || ws === 'colour' || ws === 'compositing';
