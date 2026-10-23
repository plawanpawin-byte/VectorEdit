import type { Tool, Workspace } from '../types';
import { penFinish, setState, getState } from '../store';
import { artboardTool } from './artboard';
import { brushTool, penTool, pencilTool } from './draw';
import { frameEllipseTool, frameRectTool, imageTool, tableTool } from './layout';
import { knifeTool, scissorsTool } from './edit';
import { eyedropperTool, fillTool, rotateTool } from './paint';
import { cornerTool, nodeTool, selectTool } from './select';
import { ellipseTool, lineTool, rectTool, rrectTool, shapeTools } from './shapes';
import { frameTextTool, textTool } from './text';
import type { ToolDef } from './types';
import { handTool, measureTool, zoomTool } from './view';

/** Every tool, in toolbar order. To add a tool, define a ToolDef and list it here. */
export const TOOLS: ToolDef[] = [
  selectTool,
  nodeTool,
  cornerTool,
  rotateTool,
  penTool,
  pencilTool,
  brushTool,
  textTool,
  frameTextTool,
  rectTool,
  rrectTool,
  ellipseTool,
  lineTool,
  ...shapeTools,
  knifeTool,
  scissorsTool,
  fillTool,
  eyedropperTool,
  artboardTool,
  imageTool,
  frameRectTool,
  frameEllipseTool,
  tableTool,
  handTool,
  zoomTool,
  measureTool,
];

const BY_ID = new Map<string, ToolDef>(TOOLS.map((t) => [t.id, t]));
export const toolDef = (id: Tool): ToolDef | undefined => BY_ID.get(id);

export const toolInWorkspace = (id: Tool, ws: Workspace) => !!toolDef(id)?.workspaces.includes(ws);

export interface ToolGroup {
  id: string;
  tools: ToolDef[];
}

/** Toolbar groups for a workspace, in order of first appearance. */
export function groupsFor(ws: Workspace): ToolGroup[] {
  const groups: ToolGroup[] = [];
  for (const t of TOOLS) {
    if (!t.workspaces.includes(ws)) continue;
    let g = groups.find((x) => x.id === t.group);
    if (!g) groups.push((g = { id: t.group, tools: [] }));
    g.tools.push(t);
  }
  return groups;
}

export function activateTool(id: Tool) {
  const def = toolDef(id);
  if (!def) return;
  const st = getState();
  if (st.tool === 'pen' && id !== 'pen') penFinish(false);
  setState({ tool: id, lastTool: { ...st.lastTool, [def.group]: id }, nodeSel: id === 'direct' || id === 'corner' ? st.nodeSel : [] });
}

export interface WorkspaceDef {
  id: Workspace;
  label: string;
  description: string;
}

export const WORKSPACES: WorkspaceDef[] = [
  { id: 'vector', label: 'Vector', description: 'Illustration and graphic design' },
  { id: 'layout', label: 'Layout', description: 'Pages, text frames and structured layout' },
  { id: 'typography', label: 'Typography', description: 'Text tools and character/paragraph controls' },
];

export function setWorkspace(ws: Workspace) {
  const st = getState();
  setState({ workspace: ws, grid: ws === 'layout' ? true : st.grid });
  if (!toolInWorkspace(getState().tool, ws)) activateTool('select');
}
