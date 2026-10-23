import { useMemo, useState } from 'react';
import { parseCsv, placeholders } from '../datamerge';
import { mergeRows, shapesOn, activeBoard, useStore } from '../store';

const SAMPLE = 'Name,Role\nAda Lovelace,Mathematician\nGrace Hopper,Computer scientist';

export function DataPanel() {
  const shapes = useStore((s) => s.shapes);
  useStore((s) => s.activeArtboard);
  const [csv, setCsv] = useState(SAMPLE);
  const [msg, setMsg] = useState('');
  const parsed = useMemo(() => parseCsv(csv), [csv]);
  const used = placeholders(shapesOn(activeBoard(), shapes).filter((s) => s.kind === 'text').map((s) => s.text));
  const missing = used.filter((u) => !parsed.fields.some((f) => f.toLowerCase() === u.toLowerCase()));

  const load = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.tsv,.txt,text/csv';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (f) setCsv(await f.text());
    };
    input.click();
  };
  const run = () => {
    const n = mergeRows(parsed.rows);
    setMsg(n ? `Created ${n} page${n === 1 ? '' : 's'}.` : 'Nothing to merge: add text with {{Field}} placeholders to the active page and some rows of data.');
  };

  return (
    <div className="panel-body script-panel">
      <p className="hint">Type <code>{'{{Field}}'}</code> in text on the active page, paste a table (CSV, first row = field names), then merge: every row becomes a new page.</p>
      <textarea className="code" spellCheck={false} value={csv} onChange={(e) => setCsv(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
      <div className="pad row">
        <button className="btn primary" disabled={!parsed.rows.length} onClick={run}>Merge {parsed.rows.length || ''} {parsed.rows.length === 1 ? 'row' : 'rows'}</button>
        <button className="btn" onClick={load}>Load file…</button>
      </div>
      <p className="hint tight">Fields: {parsed.fields.join(', ') || 'none'}<br />On this page: {used.length ? used.map((u) => `{{${u}}}`).join(' ') : 'no placeholders yet'}</p>
      {missing.length > 0 && <p className="menu-msg">No column for: {missing.join(', ')}</p>}
      {msg && <p className="hint">{msg}</p>}
    </div>
  );
}
