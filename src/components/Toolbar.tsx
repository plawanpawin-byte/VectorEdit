import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { resetColors, setState, swapColors, useStore } from '../store';
import { type ToolGroup, activateTool, groupsFor } from '../tools/registry';
import type { Workspace } from '../types';
import type { ToolDef } from '../tools/types';
import { SwapArrows } from './Icons';

/**
 * Display order for studios whose tool groups hold many tools: main tools get their own button and
 * related ones share a flyout, like a desktop design app's toolbox. `g:<id>` takes a whole group,
 * '|' draws a divider. Tools a studio has but the list misses land in a final slot, so none go missing.
 */
const ARRANGE: Partial<Record<Workspace, (string[] | '|')[]>> = {
  vector: [
    ['select'], ['direct', 'corner'], ['rotate'], '|',
    ['pen'], ['pencil'], ['vbrush'], ['fill', 'transparency', 'meshedit', 'vflood'],
    ['g:shapes'], ['shapebuilder', 'contour', 'blend'], ['g:text'], ['g:layout'],
    ['vcrop'], ['knife', 'scissors', 'perspective', 'warp'], ['measure', 'areameasure'], ['eyedropper', 'colourpicker'], '|',
    ['hand'], ['zoom'], ['artboard'],
  ],
  layout: [
    ['select'], ['direct'], '|',
    ['frametext', 'text'], ['table'], ['pen', 'pencil'], ['g:shapes'], ['frame-rect'], ['frame-ellipse'], ['image'],
    ['vcrop'], ['fill', 'transparency', 'meshedit', 'rotate', 'measure', 'areameasure'], ['eyedropper', 'colourpicker'], '|',
    ['hand'], ['zoom'], ['artboard'],
  ],
};

type Entry = ToolGroup | '|';

export function slotsFor(ws: Workspace): Entry[] {
  const groups = groupsFor(ws);
  const plan = ARRANGE[ws];
  if (!plan) return groups;
  const all = groups.flatMap((g) => g.tools);
  const used = new Set<string>();
  const out: Entry[] = [];
  for (const row of plan) {
    if (row === '|') {
      out.push('|');
      continue;
    }
    const tools = row
      .flatMap((id) => (id.startsWith('g:') ? groups.find((g) => g.id === id.slice(2))?.tools ?? [] : all.filter((t) => t.id === id)))
      .filter((t) => !used.has(t.id));
    tools.forEach((t) => used.add(t.id));
    if (tools.length) out.push({ id: tools[0].group, tools });
  }
  const rest = all.filter((t) => !used.has(t.id));
  if (rest.length) out.push({ id: rest[0].group, tools: rest });
  return out;
}

const SLOT_H = 36; // 34px button + 2px gap
const SEP_H = 11;
const MORE_ID = 'toolbar-more';

/**
 * Fits the toolbox into `room` px: entries that don't fit are folded into one trailing "•••" slot
 * (with a dividing rule kept off the end), so a short window never hides tools or the colour well.
 */
export function fitSlots(entries: Entry[], room: number): Entry[] {
  const height = (e: Entry) => (e === '|' ? SEP_H : SLOT_H);
  if (entries.reduce((n, e) => n + height(e), 0) <= room) return entries;
  const out: Entry[] = [];
  let used = SLOT_H; // the "•••" slot itself
  let i = 0;
  for (; i < entries.length && used + height(entries[i]) <= room; i++) {
    out.push(entries[i]);
    used += height(entries[i]);
  }
  while (out[out.length - 1] === '|') out.pop();
  const rest = entries.slice(i).flatMap((e) => (e === '|' ? [] : e.tools));
  if (rest.length) out.push({ id: MORE_ID, tools: rest });
  return out;
}

const Dots = () => (
  <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor">
    <circle cx="4.5" cy="10" r="1.6" />
    <circle cx="10" cy="10" r="1.6" />
    <circle cx="15.5" cy="10" r="1.6" />
  </svg>
);

function Slot({ group, arranged }: { group: ToolGroup; arranged?: boolean }) {
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
  const overflow = group.id === MORE_ID;
  const many = group.tools.length > 1 || overflow;
  const wide = group.tools.length > 8;

  return (
    <div className="slot" ref={ref} data-group={arranged ? undefined : group.id}>
      <button
        className={'tool' + (active ? ' on' : '')}
        title={overflow ? 'More tools' : `${current.label}${current.key ? ` (${current.key.toUpperCase()})` : ''}`}
        onClick={() => (overflow ? setOpen(!open) : (setOpen(false), activateTool(current.id)))}
        onContextMenu={(e) => (e.preventDefault(), many && setOpen(true))}
        onPointerDown={() => many && (hold.current = setTimeout(() => setOpen(true), 380))}
        onPointerUp={() => clearTimeout(hold.current)}
        onPointerLeave={() => clearTimeout(hold.current)}
      >
        {overflow && !active ? <Dots /> : current.icon}
        {many && !overflow && <i className="more" />}
      </button>
      {open && (
        <div className={'flyout' + (wide ? ' wide' : '') + (overflow ? ' up' : '')}>
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
  const tools = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(Infinity);
  useLayoutEffect(() => {
    const el = tools.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRoom(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <nav className="toolbar">
      <div className="toolbar-tools" ref={tools}>
      {fitSlots(slotsFor(workspace), room).map((g, i) =>
        g === '|' ? <hr key={'sep' + i} className="tsep" /> : <Slot key={g.tools[0].id} group={g} arranged={workspace in ARRANGE} />,
      )}
      </div>
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
