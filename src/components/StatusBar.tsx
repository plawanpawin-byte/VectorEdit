import { Fragment } from 'react';
import { fitArtboard, useStore, zoomTo } from '../store';
import { toolDef } from '../tools/registry';

// hints come from the active tool; **word** renders bold

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
        <Rich text={toolDef(tool)?.hint ?? ''} />
      </span>
      <div className="grow" />
      <span className="mono">
        {cursor.x}, {cursor.y} px
      </span>
    </footer>
  );
}
