import { bbox, unionBox } from '../geometry';
import { fitArtboard, setColor, setState, setTransform, useStore } from '../store';
import { NumField } from './Fields';
import { Popover } from './TopBar';

const PRESETS: [string, number, number][] = [
  ['A4 (72 dpi)', 595, 842],
  ['Letter', 612, 792],
  ['1080 × 1080 Post', 1080, 1080],
  ['1920 × 1080 HD', 1920, 1080],
  ['800 × 600', 800, 600],
  ['App icon 1024', 1024, 1024],
];

export function ContextBar() {
  const shapes = useStore((s) => s.shapes);
  const selection = useStore((s) => s.selection);
  const fill = useStore((s) => s.fill);
  const stroke = useStore((s) => s.stroke);
  const strokeWidth = useStore((s) => s.strokeWidth);
  const artboard = useStore((s) => s.artboard);
  const tool = useStore((s) => s.tool);
  const sides = useStore((s) => s.sides);
  const starPoints = useStore((s) => s.starPoints);
  const sel = shapes.filter((s) => selection.includes(s.id));
  const box = unionBox(sel.map(bbox));

  return (
    <div className="contextbar">
      <span className="ctx">{sel.length === 0 ? 'No Selection' : sel.length === 1 ? sel[0].name : `${sel.length} Objects`}</span>
      {sel.length === 0 ? (
        <>
          <Popover button={<span className="txtbtn">Document Setup…</span>} className="left wide">
            {(close) => (
              <div className="doc-setup">
                <h4>Document Setup</h4>
                <div className="grid2">
                  <NumField label="W" value={artboard.w} suffix="px" min={1} onCommit={(w) => setState({ artboard: { ...artboard, w } })} />
                  <NumField label="H" value={artboard.h} suffix="px" min={1} onCommit={(h) => setState({ artboard: { ...artboard, h } })} />
                </div>
                <h5>Presets</h5>
                <div className="presets">
                  {PRESETS.map(([name, w, h]) => (
                    <button
                      key={name}
                      className={artboard.w === w && artboard.h === h ? 'on' : ''}
                      onClick={() => {
                        setState({ artboard: { w, h } });
                        fitArtboard();
                        close();
                      }}
                    >
                      <span>{name}</span>
                      <em>
                        {w} × {h}
                      </em>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Popover>
          <span className="dim">
            {artboard.w} × {artboard.h} px
          </span>
        </>
      ) : null}
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
      {tool === 'polygon' && (
        <NumField label="Sides" value={sides} min={3} onCommit={(v) => setState({ sides: Math.max(3, Math.min(60, Math.round(v))) })} />
      )}
      {tool === 'star' && (
        <NumField label="Points" value={starPoints} min={3} onCommit={(v) => setState({ starPoints: Math.max(3, Math.min(60, Math.round(v))) })} />
      )}
      {box && (
        <>
          <i className="vr" />
          <NumField label="X" value={box.x} onCommit={(x) => setTransform(box, { x })} />
          <NumField label="Y" value={box.y} onCommit={(y) => setTransform(box, { y })} />
          <NumField label="W" value={box.w} min={0.01} onCommit={(w) => setTransform(box, { w })} />
          <NumField label="H" value={box.h} min={0.01} onCommit={(h) => setTransform(box, { h })} />
        </>
      )}
    </div>
  );
}
