import { useState } from 'react';
import { PATH_BRUSHES } from '../brushpresets';
import { QUICK_FX } from '../quickfx';
import { applyLook, loadStyles, lookOf, saveStyles, type SavedStyle } from '../stylepresets';
import { getState, setState, updateSelected, useStore } from '../store';

/** Path Brushes: presets for the Vector Brush tool. */
export function PathBrushesPanel() {
  const brush = useStore((s) => s.brush);
  return (
    <div className="panel-body">
      <div className="preset-list">
        {PATH_BRUSHES.map((p) => {
          const on = brush.profile === p.brush.profile && brush.size === p.brush.size && brush.taper === p.brush.taper;
          return (
            <button key={p.id} className={on ? 'on' : ''} title={`${p.label}: ${p.brush.profile}, ${p.brush.size} px`} onClick={() => setState({ brush: { ...p.brush } })}>
              <svg viewBox="0 0 120 22" width="100%" height="22" aria-hidden>
                <path d="M6 14 C 30 2, 50 20, 74 9 S 106 6, 114 12" fill="none" stroke="currentColor" strokeWidth={Math.max(1, Math.min(9, p.brush.size / 2.5))} strokeLinecap="round" />
              </svg>
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Quick FX: one-click effect stacks applied to the selected objects. */
export function QuickFxPanel() {
  const selection = useStore((s) => s.selection);
  const none = selection.length === 0;
  return (
    <div className="panel-body">
      {none && <p className="hint pad">Select objects to apply an effect.</p>}
      <div className="preset-list">
        {QUICK_FX.map((q) => (
          <button
            key={q.id}
            disabled={none}
            title={q.effects.length ? q.effects.map((e) => e.type).join(' + ') : 'Remove all effects'}
            onClick={() => updateSelected((s) => ({ ...s, effects: q.effects.map((e) => ({ ...e })) }), 'quickfx' + q.id)}
          >
            <span className="fx-swatch" data-fx={q.id} />
            <span>{q.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Styles: save the selected object's look and re-apply it to other objects. */
export function StylesPanel() {
  const [styles, setStyles] = useState<SavedStyle[]>(loadStyles);
  const selection = useStore((s) => s.selection);
  const shapes = useStore((s) => s.shapes);
  const first = shapes.find((s) => s.id === selection[0]);
  const save = (next: SavedStyle[]) => {
    setStyles(next);
    saveStyles(next);
  };
  return (
    <div className="panel-body">
      <div className="pad style-save">
        <button
          className="mini wide"
          disabled={!first}
          onClick={() => {
            if (!first) return;
            const name = `Style ${styles.length + 1}`;
            save([...styles, { id: String(Date.now()), name, look: lookOf(first) }]);
          }}
        >
          Save selected as style
        </button>
      </div>
      {styles.length === 0 && <p className="hint pad">Saved styles appear here. They stay in this browser.</p>}
      <div className="preset-list">
        {styles.map((st) => (
          <div key={st.id} className="style-row">
            <button
              disabled={selection.length === 0}
              title="Apply to the selection"
              onClick={() => {
                const look = st.look;
                const ids = new Set(getState().selection);
                updateSelected((s) => (ids.has(s.id) ? applyLook(s, look) : s), 'style' + st.id);
              }}
            >
              <span className="fx-swatch" style={{ background: st.look.fill ?? st.look.gradient?.a ?? 'transparent', borderColor: st.look.stroke ?? undefined }} />
              <span>{st.name}</span>
            </button>
            <button className="mini" title="Delete style" onClick={() => save(styles.filter((x) => x.id !== st.id))}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
