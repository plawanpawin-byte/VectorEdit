import { useEffect, useRef, useState } from 'react';
import { resetColors, setState, swapColors, useStore } from '../store';
import { type ToolGroup, activateTool, groupsFor } from '../tools/registry';
import type { ToolDef } from '../tools/types';
import { SwapArrows } from './Icons';

function Slot({ group }: { group: ToolGroup }) {
  const tool = useStore((s) => s.tool);
  const last = useStore((s) => s.lastTool[group.id]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hold = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const active = group.tools.find((t) => t.id === tool);
  const current: ToolDef = active ?? group.tools.find((t) => t.id === last) ?? group.tools[0];
  const many = group.tools.length > 1;
  const wide = group.tools.length > 8;

  return (
    <div className="slot" ref={ref} data-group={group.id}>
      <button
        className={'tool' + (active ? ' on' : '')}
        title={`${current.label}${current.key ? ` (${current.key.toUpperCase()})` : ''}`}
        onClick={() => (setOpen(false), activateTool(current.id))}
        onContextMenu={(e) => (e.preventDefault(), many && setOpen(true))}
        onPointerDown={() => many && (hold.current = setTimeout(() => setOpen(true), 380))}
        onPointerUp={() => clearTimeout(hold.current)}
        onPointerLeave={() => clearTimeout(hold.current)}
      >
        {current.icon}
        {many && <i className="more" />}
      </button>
      {open && (
        <div className={'flyout' + (wide ? ' wide' : '')}>
          {group.tools.map((t) => (
            <button key={t.id} className={t.id === tool ? 'on' : ''} onClick={() => (setOpen(false), activateTool(t.id))}>
              <span className="fi">{t.icon}</span>
              <span className="fl">{t.label}</span>
              <span className="fk">{t.key?.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Toolbar() {
  const workspace = useStore((s) => s.workspace);
  const fill = useStore((s) => s.fill);
  const stroke = useStore((s) => s.stroke);
  const target = useStore((s) => s.colorTarget);
  return (
    <nav className="toolbar">
      {groupsFor(workspace).map((g) => (
        <Slot key={g.id} group={g} />
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
