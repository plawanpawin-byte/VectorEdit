import { commit, endLive, getState, live, makeShape, penFinish, setState, setTool } from '../store';
import { toolIcon } from './icons';
import type { ToolDef } from './types';

export const textTool: ToolDef = {
  id: 'text',
  label: 'Artistic Text',
  key: 't',
  icon: toolIcon.text,
  group: 'text',
  workspaces: ['vector', 'layout', 'typography'],
  cursor: 'text',
  hint: '**Click** on the page and type. **Double-click** existing text with the Move tool to edit it.',
  chrome: 'outline',
  down(c) {
    penFinish(false);
    const before = c.st.shapes;
    const t = makeShape('text', { x: c.p.x, y: c.p.y - 12, text: '', fill: c.st.fill ?? '#1c1c1c' });
    live([...before, t], [t.id]);
    endLive(before);
    setTool('select');
    setState({ editingText: t.id });
  },
};

export { commit, getState };
