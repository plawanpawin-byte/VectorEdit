import { useState } from 'react';
import { EXAMPLE_SCRIPT, loadScripts, runScript, saveScripts, type SavedScript } from '../scripting';

export function ScriptPanel() {
  const [code, setCode] = useState(EXAMPLE_SCRIPT);
  const [out, setOut] = useState<{ ok: boolean; text: string } | null>(null);
  const [saved, setSaved] = useState<SavedScript[]>(loadScripts);

  const run = () => {
    const r = runScript(code);
    setOut({ ok: r.ok, text: [...r.logs, ...(r.error ? [`Error: ${r.error}`] : [])].join('\n') || 'Done.' });
  };
  const persist = (list: SavedScript[]) => (setSaved(list), saveScripts(list));
  const save = () => {
    const name = window.prompt('Name this macro', 'Macro ' + (saved.length + 1));
    if (name) persist([...saved, { id: 'm' + Date.now(), name, code }]);
  };

  return (
    <div className="panel-body script-panel">
      <p className="hint">Scripts run with an <code>app</code> object (shapes, add, update, remove, group, select, addPage, undo, log). Only run code you trust.</p>
      <textarea className="code" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
      <div className="pad row">
        <button className="btn primary" onClick={run}>Run</button>
        <button className="btn" onClick={save}>Save as macro</button>
      </div>
      {out && <pre className={'script-out' + (out.ok ? '' : ' err')}>{out.text}</pre>}
      {saved.length > 0 && (
        <div className="slice-list">
          {saved.map((m) => (
            <div key={m.id} className="slice">
              <div className="slice-head">
                <b className="grow">{m.name}</b>
                <button className="mini wide" onClick={() => setCode(m.code)}>Edit</button>
                <button className="mini wide" onClick={() => setOut((r => ({ ok: r.ok, text: [...r.logs, ...(r.error ? [`Error: ${r.error}`] : [])].join('\n') || 'Done.' }))(runScript(m.code)))}>Run</button>
                <button className="mini" onClick={() => persist(saved.filter((s) => s.id !== m.id))}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
