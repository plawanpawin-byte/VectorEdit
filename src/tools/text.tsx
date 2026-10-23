import { endLive, live, makeShape, penFinish, setState, setTool } from '../store';
import { toolIcon } from './icons';
import type { ToolDef } from './types';
import { shapeAt } from './util';

function beginEditing(id: string) {
  setTool('select');
  setState({ editingText: id });
}

export const textTool: ToolDef = {
  id: 'text',
  label: 'Artistic Text',
  key: 't',
  icon: toolIcon.text,
  group: 'text',
  workspaces: ['vector', 'layout', 'typography'],
  cursor: 'text',
  hint: '**Click** on the page and type. **Click on a path** to set text along it. **Double-click** text with the Move tool to edit.',
  chrome: 'outline',
  down(c) {
    penFinish(false);
    const before = c.st.shapes;
    // clicking an existing text edits it
    const hit = shapeAt(c.st, c.raw, c.tol);
    if (hit?.kind === 'text') {
      setState({ selection: [hit.id] });
      return beginEditing(hit.id);
    }
    // clicking the outline of a shape sets the text on that outline
    const onPath = hit && (hit.stroke || hit.kind === 'path' || hit.kind === 'line') ? hit : undefined;
    const t = makeShape('text', {
      x: c.p.x,
      y: c.p.y - 12,
      text: '',
      fill: '#1c1c1c',
      pathId: onPath ? onPath.id : null,
    });
    live([...before, t], [t.id]);
    endLive(before);
    beginEditing(t.id);
  },
};

export const frameTextTool: ToolDef = {
  id: 'frametext',
  label: 'Frame Text',
  key: 'f',
  icon: toolIcon.frametext,
  group: 'text',
  workspaces: ['vector', 'layout', 'typography'],
  cursor: 'text',
  hint: '**Drag** a frame, then type: text wraps to the frame width. Set alignment and spacing in Paragraph.',
  chrome: 'outline',
  down(c) {
    penFinish(false);
    const before = c.st.shapes;
    const start = c.p;
    const t = makeShape('text', { x: start.x, y: start.y, text: '', frameW: 1, fill: '#1c1c1c' });
    live([...before, t], [t.id]);
    return {
      move(m) {
        const w = Math.max(1, Math.abs(m.p.x - start.x));
        live(m.st.shapes.map((s) => (s.id === t.id ? { ...s, x: Math.min(start.x, m.p.x), y: Math.min(start.y, m.p.y), frameW: w } : s)));
      },
      up(m) {
        const cur = m.st.shapes.find((s) => s.id === t.id);
        if (!cur || cur.frameW < 24) {
          // a click without a drag: make a sensible default frame
          live(m.st.shapes.map((s) => (s.id === t.id ? { ...s, frameW: 240 } : s)));
        }
        endLive(before);
        beginEditing(t.id);
      },
    };
  },
};
