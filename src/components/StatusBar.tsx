import { Fragment } from 'react';
import { fitArtboard, setActiveArtboard, useStore, zoomTo } from '../store';
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
  const notice = useStore((s) => s.notice);
  const boards = useStore((s) => s.artboards);
  const active = useStore((s) => s.activeArtboard);
  const idx = Math.max(0, boards.findIndex((b) => b.id === active));
  const go = (i: number) => boards[i] && setActiveArtboard(boards[Math.max(0, Math.min(boards.length - 1, i))].id, true);
  return (
    <footer className="statusbar">
      <div className="pagenav">
        <button title="First page" disabled={idx === 0} onClick={() => go(0)}>⏮</button>
        <button title="Previous page" disabled={idx === 0} onClick={() => go(idx - 1)}>◀</button>
        <span>{idx + 1} of {boards.length}</span>
        <button title="Next page" disabled={idx >= boards.length - 1} onClick={() => go(idx + 1)}>▶</button>
        <button title="Last page" disabled={idx >= boards.length - 1} onClick={() => go(boards.length - 1)}>⏭</button>
      </div>
      <span className="sep" />
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
      <span className={'hint-text' + (notice ? ' notice' : '')} role={notice ? 'alert' : undefined}>
        {notice ?? <Rich text={toolDef(tool)?.hint ?? ''} />}
      </span>
      <div className="grow" />
      <span className="mono">
        {cursor.x}, {cursor.y} px
      </span>
    </footer>
  );
}
