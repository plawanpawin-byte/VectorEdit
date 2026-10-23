import { fitArtboard, useStore, zoomTo } from '../store';

export function StatusBar() {
  const zoom = useStore((s) => s.zoom);
  const cursor = useStore((s) => s.cursor);
  const tool = useStore((s) => s.tool);
  const NAMES: Record<string, string> = {
    select: 'Selection',
    direct: 'Direct Selection',
    pen: 'Pen',
    rect: 'Rectangle',
    ellipse: 'Ellipse',
    line: 'Line Segment',
    text: 'Type',
    hand: 'Hand',
    zoom: 'Zoom',
  };
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
        <option value="fit">Fit Artboard</option>
        {[0.25, 0.5, 1, 2, 4].map((z) => (
          <option key={z} value={z}>
            {z * 100}%
          </option>
        ))}
      </select>
      <span className="sep" />
      <span>{NAMES[tool]}</span>
      <div className="grow" />
      <span className="mono">
        X {cursor.x} · Y {cursor.y} px
      </span>
    </footer>
  );
}
