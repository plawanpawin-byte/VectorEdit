import { exportAllSlices, exportSlice } from '../slices';
import { removeSlice, setState, slicesFromArtboards, sliceFromSelection, updateSlice, useStore } from '../store';
import { NumField } from './Fields';

export function SlicesPanel() {
  const slices = useStore((s) => s.slices);
  const active = useStore((s) => s.activeSlice);
  const shapes = useStore((s) => s.shapes);
  return (
    <div className="panel-body">
      <div className="pages-bar">
        <span className="dim">{slices.length} {slices.length === 1 ? 'slice' : 'slices'}</span>
        <div className="grow" />
        <button className="mini wide" title="One slice per page" onClick={slicesFromArtboards}>From pages</button>
        <button className="mini wide" title="Slice around the selected objects" onClick={sliceFromSelection}>From selection</button>
      </div>
      <div className="slice-list">
        {slices.length === 0 && <p className="hint">Draw slices with the Slice tool, or create them from pages or the selection.</p>}
        {slices.map((s) => (
          <div key={s.id} className={'slice' + (s.id === active ? ' on' : '')} onClick={() => setState({ activeSlice: s.id })}>
            <div className="slice-head">
              <input className="rename" value={s.name} onChange={(e) => updateSlice(s.id, { name: e.target.value }, `sn${s.id}`)} onClick={(e) => e.stopPropagation()} />
              <button className="mini" title="Delete slice" onClick={(e) => (e.stopPropagation(), removeSlice(s.id))}>×</button>
            </div>
            <div className="slice-row" onClick={(e) => e.stopPropagation()}>
              <em>{s.w} × {s.h}</em>
              <select value={s.format} onChange={(e) => updateSlice(s.id, { format: e.target.value as typeof s.format })}>
                <option value="png">PNG</option>
                <option value="jpg">JPEG</option>
                <option value="svg">SVG</option>
              </select>
              <NumField label="" value={s.scale} suffix="×" min={0.1} step={0.5} onCommit={(scale) => updateSlice(s.id, { scale: Math.max(0.1, Math.min(8, scale)) })} />
              <button className="mini wide" onClick={() => void exportSlice(shapes, s)}>Export</button>
            </div>
          </div>
        ))}
      </div>
      <div className="pad">
        <button className="btn primary wide-btn" disabled={!slices.length} onClick={() => void exportAllSlices(shapes, slices)}>
          Export all slices
        </button>
      </div>
    </div>
  );
}
