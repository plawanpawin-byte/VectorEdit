import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DOC_PRESETS, validSize, type DocPreset } from '../docpresets';
import { confirmDiscard, newDocument, setState, useStore } from '../store';
import { fromPx, toPx, UNITS, type Unit } from '../units';
import { importFilesDialog } from '../importer';
import { openDoc } from '../fileio';
import { I } from './Icons';

const GROUPS: DocPreset['group'][] = ['Page sizes', 'Photo', 'Canvases', 'Video and Web', 'Devices'];
const round = (n: number) => Math.round(n * 100) / 100;

/** New Document dialog: page size presets (A-series, screens, social), custom size and orientation. */
export function NewDocument() {
  const open = useStore((s) => s.newDocOpen);
  const [presetId, setPresetId] = useState('a3');
  const [unit, setUnit] = useState<Unit>('mm');
  const [w, setW] = useState('297');
  const [h, setH] = useState('420');
  const [error, setError] = useState<string | null>(null);

  const close = () => setState({ newDocOpen: false });
  const apply = (p: DocPreset) => {
    setPresetId(p.id);
    setUnit(p.unit);
    setW(String(p.w));
    setH(String(p.h));
    setError(null);
  };
  const orient = (landscape: boolean) => {
    const a = Number(w);
    const b = Number(h);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    setW(String(landscape ? hi : lo));
    setH(String(landscape ? lo : hi));
  };
  const changeUnit = (u: Unit) => {
    const pw = toPx(Number(w), unit);
    const ph = toPx(Number(h), unit);
    setUnit(u);
    if (Number.isFinite(pw) && Number.isFinite(ph)) {
      setW(String(round(fromPx(pw, u))));
      setH(String(round(fromPx(ph, u))));
    }
  };
  const create = () => {
    const pw = Math.round(toPx(Number(w), unit));
    const ph = Math.round(toPx(Number(h), unit));
    const bad = w.trim() === '' || h.trim() === '' ? 'Enter a width and a height.' : validSize(pw, ph);
    if (bad) return setError(bad);
    if (!confirmDiscard()) return;
    const preset = DOC_PRESETS.find((p) => p.id === presetId);
    newDocument({ w: pw, h: ph, name: preset && Math.round(toPx(preset.w, preset.unit)) === pw ? preset.label : 'Page 1' });
  };

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter' && !/BUTTON|SELECT/.test((e.target as HTMLElement).tagName)) create();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  if (!open) return null;
  const landscape = Number(w) > Number(h);
  // on document.body so it stays above the start page
  return createPortal(
    <div className="modal-back" onMouseDown={close}>
      <div className="modal newdoc" role="dialog" aria-label="New Document" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <span>New Document</span>
          <button className="ibtn" title="Close" onClick={close}>{I.close}</button>
        </header>
        <div className="newdoc-body">
          <div className="newdoc-presets">
            {GROUPS.map((g) => (
              <section key={g}>
                <h4>{g}</h4>
                <div>
                  {DOC_PRESETS.filter((p) => p.group === g).map((p) => (
                    <button key={p.id} className={presetId === p.id ? 'on' : ''} onClick={() => apply(p)} onDoubleClick={create}>
                      <span>{p.label}</span>
                      <small>{p.w} × {p.h} {p.unit}</small>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div className="newdoc-size">
            <h4>Size</h4>
            <label>
              Width
              <input value={w} inputMode="decimal" onChange={(e) => (setW(e.target.value), setPresetId('custom'), setError(null))} />
            </label>
            <label>
              Height
              <input value={h} inputMode="decimal" onChange={(e) => (setH(e.target.value), setPresetId('custom'), setError(null))} />
            </label>
            <label>
              Units
              <select value={unit} onChange={(e) => changeUnit(e.target.value as Unit)}>
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
            <div className="newdoc-orient">
              <button className={!landscape ? 'on' : ''} onClick={() => orient(false)}>Portrait</button>
              <button className={landscape ? 'on' : ''} onClick={() => orient(true)}>Landscape</button>
            </div>
            <p className="dim">{Math.round(toPx(Number(w) || 0, unit))} × {Math.round(toPx(Number(h) || 0, unit))} px</p>
            {error && <p className="newdoc-error" role="alert">{error}</p>}
          </div>
        </div>
        <footer className="newdoc-foot">
          <button className="mini wide" onClick={() => (close(), void openDoc())}>Open…</button>
          <button className="mini wide" onClick={() => (close(), void importFilesDialog())}>Import images…</button>
          <div className="grow" />
          <button className="mini wide" onClick={close}>Cancel</button>
          <button className="mini wide primary" onClick={create}>Create</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
