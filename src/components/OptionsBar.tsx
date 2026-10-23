import { bbox, unionBox } from '../geometry';
import { setColor, setState, setTransform, useStore } from '../store';
import { NumField } from './Fields';

const HINTS: Record<string, string> = {
  select: 'Click to select · drag to move or marquee · Shift to add · drag handles to scale',
  direct: 'Select a path to edit its anchor points and handles',
  pen: 'Click to add points · drag for curves · click the first point to close · Enter or double-click to finish',
  rect: 'Drag to draw a rectangle · Shift for a square',
  ellipse: 'Drag to draw an ellipse · Shift for a circle',
  line: 'Drag to draw a line · Shift snaps to 45°',
  text: 'Click on the artboard to place text',
  hand: 'Drag to pan the canvas',
  zoom: 'Click to zoom in · Alt-click to zoom out',
};

export function OptionsBar() {
  const tool = useStore((s) => s.tool);
  const shapes = useStore((s) => s.shapes);
  const selection = useStore((s) => s.selection);
  const fill = useStore((s) => s.fill);
  const stroke = useStore((s) => s.stroke);
  const strokeWidth = useStore((s) => s.strokeWidth);
  const sel = shapes.filter((s) => selection.includes(s.id));
  const box = unionBox(sel.map(bbox));

  return (
    <div className="optionsbar">
      <span className="ctx">{sel.length === 0 ? 'No Selection' : sel.length === 1 ? sel[0].name : `${sel.length} Objects`}</span>
      <i className="vr" />
      <label className="mini-color" title="Fill">
        <span>Fill</span>
        <b style={{ background: fill ?? undefined }} data-none={fill === null} />
        <input type="color" value={fill ?? '#000000'} onChange={(e) => setColor('fill', e.target.value)} />
      </label>
      <label className="mini-color" title="Stroke">
        <span>Stroke</span>
        <b style={{ background: stroke ?? undefined }} data-none={stroke === null} />
        <input type="color" value={stroke ?? '#000000'} onChange={(e) => setColor('stroke', e.target.value)} />
      </label>
      <NumField label="" value={strokeWidth} suffix="pt" min={0} step={0.5} onCommit={(v) => setState({ strokeWidth: v })} />
      {box && (
        <>
          <i className="vr" />
          <NumField label="X" value={box.x} onCommit={(x) => setTransform(box, { x })} />
          <NumField label="Y" value={box.y} onCommit={(y) => setTransform(box, { y })} />
          <NumField label="W" value={box.w} min={0.01} onCommit={(w) => setTransform(box, { w })} />
          <NumField label="H" value={box.h} min={0.01} onCommit={(h) => setTransform(box, { h })} />
        </>
      )}
      <div className="grow" />
      <span className="hint-line">{HINTS[tool]}</span>
    </div>
  );
}
