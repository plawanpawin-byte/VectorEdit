import { Fragment } from 'react';
import { fitArtboard, useStore, zoomTo } from '../store';

// **word** renders bold
const HINTS: Record<string, string> = {
  select: '**Drag** to marquee select. **Click** an object to select it. **Shift** adds to the selection. **Drag** a handle to scale.',
  direct: '**Click** a path to show its nodes. **Drag** a node or handle to reshape.',
  pen: '**Click** to add a node. **Drag** to pull curve handles. **Click** the first node to close. **Enter** to finish.',
  rect: '**Drag** to draw a rectangle. **Shift** constrains to a square.',
  ellipse: '**Drag** to draw an ellipse. **Shift** constrains to a circle.',
  line: '**Drag** to draw a line. **Shift** snaps to 45°.',
  text: '**Click** on the page to place text, then type in the Appearance panel.',
  hand: '**Drag** to pan. **Space** gives the Hand tool from any tool.',
  zoom: '**Click** to zoom in. **Alt-click** to zoom out. **Ctrl+wheel** zooms at the cursor.',
};

function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('**').map((part, i) => (
        <Fragment key={i}>{i % 2 ? <b>{part}</b> : part}</Fragment>
      ))}
    </>
  );
}

export function StatusBar() {
  const zoom = useStore((s) => s.zoom);
  const cursor = useStore((s) => s.cursor);
  const tool = useStore((s) => s.tool);
  const count = useStore((s) => s.shapes.length);
  return (
    <footer className="statusbar">
      <select
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'fit') fitArtboard();
          else if (v) zoomTo(Number(v));
        }}
      >
        <option value="">{Math.round(zoom * 100)}%</option>
        <option value="fit">Fit</option>
        {[0.25, 0.5, 1, 2, 4].map((z) => (
          <option key={z} value={z}>
            {z * 100}%
          </option>
        ))}
      </select>
      <span className="dim">{count} objects</span>
      <span className="sep" />
      <span className="hint-text">
        <Rich text={HINTS[tool]} />
      </span>
      <div className="grow" />
      <span className="mono">
        {cursor.x}, {cursor.y} px
      </span>
    </footer>
  );
}
