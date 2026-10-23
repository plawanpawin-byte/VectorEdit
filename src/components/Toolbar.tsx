import type { Tool } from '../types';
import { MODE_TOOLS, resetColors, setState, setTool, swapColors, useStore } from '../store';
import { SwapArrows, toolIcons } from './Icons';

const TOOLS: { id: Tool; label: string; key: string; gap?: boolean }[] = [
  { id: 'select', label: 'Selection Tool', key: 'V' },
  { id: 'direct', label: 'Direct Selection Tool', key: 'A' },
  { id: 'pen', label: 'Pen Tool', key: 'P', gap: true },
  { id: 'text', label: 'Type Tool', key: 'T' },
  { id: 'line', label: 'Line Segment Tool', key: '\\' },
  { id: 'rect', label: 'Rectangle Tool', key: 'M' },
  { id: 'ellipse', label: 'Ellipse Tool', key: 'L' },
  { id: 'hand', label: 'Hand Tool', key: 'H', gap: true },
  { id: 'zoom', label: 'Zoom Tool', key: 'Z' },
];

export function Toolbar() {
  const tool = useStore((s) => s.tool);
  const fill = useStore((s) => s.fill);
  const stroke = useStore((s) => s.stroke);
  const target = useStore((s) => s.colorTarget);
  const mode = useStore((s) => s.mode);
  const allowed = MODE_TOOLS[mode];
  return (
    <nav className="toolbar">
      {TOOLS.filter((t) => allowed.includes(t.id)).map((t) => (
        <button
          key={t.id}
          className={'tool' + (tool === t.id ? ' on' : '') + (t.gap ? ' gap' : '')}
          title={`${t.label} (${t.key})`}
          onClick={() => setTool(t.id)}
        >
          {toolIcons[t.id]}
        </button>
      ))}
      <div className="spacer" />
      <div className="fillstroke">
        <button
          className={'fs stroke' + (target === 'stroke' ? ' front' : '')}
          title="Stroke"
          onClick={() => setState({ colorTarget: 'stroke' })}
          style={{ ['--c' as string]: stroke ?? 'transparent' }}
          data-none={stroke === null}
        />
        <button
          className={'fs fill' + (target === 'fill' ? ' front' : '')}
          title="Fill"
          onClick={() => setState({ colorTarget: 'fill' })}
          style={{ background: fill ?? '#2a2a2a' }}
          data-none={fill === null}
        />
        <button className="swap" title="Swap fill and stroke (Shift+X)" onClick={swapColors}>
          <SwapArrows />
        </button>
        <button className="reset" title="Default fill and stroke (D)" onClick={resetColors}>
          <i />
          <b />
        </button>
      </div>
    </nav>
  );
}
