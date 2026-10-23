import { useState } from 'react';
import { setColor, updateSelected, useStore } from '../store';
import type { Shape } from '../types';
import { NumField, Section } from './Fields';

/** Web-safe families first; the browser falls back when one is not installed. */
export const FONT_FAMILIES = [
  'Georgia',
  'Times New Roman',
  'Palatino Linotype',
  'Garamond',
  'Arial',
  'Helvetica',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Segoe UI',
  'Calibri',
  'Impact',
  'Courier New',
  'Consolas',
  'Lucida Console',
  'Comic Sans MS',
  'system-ui',
  'serif',
  'sans-serif',
  'monospace',
];

const useTexts = () => {
  const shapes = useStore((s) => s.shapes);
  const selection = useStore((s) => s.selection);
  return shapes.filter((s) => selection.includes(s.id) && s.kind === 'text');
};

const setText = (patch: Partial<Shape>, key?: string) => updateSelected((s) => (s.kind === 'text' ? { ...s, ...patch } : s), key);

export function CharacterPanel() {
  const texts = useTexts();
  const t = texts[0];
  if (!t) return <p className="hint pad">Select text to change its font, size and spacing.</p>;
  const families = FONT_FAMILIES.includes(t.fontFamily) ? FONT_FAMILIES : [t.fontFamily, ...FONT_FAMILIES];
  return (
    <div className="panel-body">
      <Section title="Font">
        <select className="wide-select" value={t.fontFamily} style={{ fontFamily: t.fontFamily }} onChange={(e) => setText({ fontFamily: e.target.value })}>
          {families.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f}
            </option>
          ))}
        </select>
        <div className="row">
          <NumField label="Size" value={t.fontSize} suffix="px" min={1} onCommit={(fontSize) => setText({ fontSize }, 'fs')} />
          <select value={t.fontWeight} onChange={(e) => setText({ fontWeight: Number(e.target.value) })}>
            <option value={300}>Light</option>
            <option value={400}>Regular</option>
            <option value={500}>Medium</option>
            <option value={600}>Semibold</option>
            <option value={700}>Bold</option>
            <option value={900}>Black</option>
          </select>
        </div>
        <div className="row">
          <button className={'tgl' + (t.italic ? ' on' : '')} title="Italic" onClick={() => setText({ italic: !t.italic })}>
            <i>I</i>
          </button>
          <button className={'tgl' + (t.underline ? ' on' : '')} title="Underline" onClick={() => setText({ underline: !t.underline })}>
            <u>U</u>
          </button>
          <label className="swatch-input" title="Text colour" style={{ background: t.fill ?? undefined }}>
            <input type="color" value={t.fill ?? '#000000'} onChange={(e) => setColor('fill', e.target.value)} />
          </label>
        </div>
      </Section>
      <Section title="Spacing">
        <div className="row">
          <span className="lbl">Tracking</span>
          <input type="range" min={-5} max={40} step={0.5} value={t.letterSpacing} onChange={(e) => setText({ letterSpacing: Number(e.target.value) }, 'ls')} />
          <span className="val">{t.letterSpacing}</span>
        </div>
        <div className="row">
          <span className="lbl">Leading</span>
          <input type="range" min={0.8} max={3} step={0.05} value={t.lineHeight} onChange={(e) => setText({ lineHeight: Number(e.target.value) }, 'lh')} />
          <span className="val">{t.lineHeight.toFixed(2)}</span>
        </div>
      </Section>
    </div>
  );
}

export function ParagraphPanel() {
  const texts = useTexts();
  const t = texts[0];
  if (!t) return <p className="hint pad">Select text to set alignment and frame width.</p>;
  const aligns: [Shape['align'], string][] = [['left', 'Left'], ['center', 'Centre'], ['right', 'Right'], ['justify', 'Justify']];
  return (
    <div className="panel-body">
      <Section title="Alignment">
        <div className="segpick">
          {aligns.map(([v, label]) => (
            <button key={v} className={t.align === v ? 'on' : ''} onClick={() => setText({ align: v })}>
              {label}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Frame">
        <div className="row">
          <NumField label="Width" value={t.frameW || null} suffix="px" min={10} onCommit={(frameW) => setText({ frameW })} />
          <button className="mini wide" title="Unwrapped artistic text" onClick={() => setText({ frameW: 0 })} disabled={!t.frameW}>
            Auto
          </button>
        </div>
        {t.pathId && (
          <div className="row">
            <span className="dim">Runs along a path</span>
            <button className="mini wide" onClick={() => setText({ pathId: null })}>Detach</button>
          </div>
        )}
      </Section>
    </div>
  );
}

/* ---------- text styles (a personal library kept in this browser) ---------- */

const KEY = 'vectoredit:textstyles:v1';
type Style = { id: string; name: string } & Pick<Shape, 'fontFamily' | 'fontSize' | 'fontWeight' | 'italic' | 'underline' | 'align' | 'lineHeight' | 'letterSpacing'>;

const defaults = (): Style[] => [
  { id: 'body', name: 'Body', fontFamily: 'Georgia', fontSize: 16, fontWeight: 400, italic: false, underline: false, align: 'left', lineHeight: 1.5, letterSpacing: 0 },
  { id: 'title', name: 'Title', fontFamily: 'Arial', fontSize: 48, fontWeight: 700, italic: false, underline: false, align: 'left', lineHeight: 1.1, letterSpacing: -1 },
  { id: 'caption', name: 'Caption', fontFamily: 'Arial', fontSize: 11, fontWeight: 400, italic: true, underline: false, align: 'left', lineHeight: 1.3, letterSpacing: 0.5 },
];

function load(): Style[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return Array.isArray(raw) && raw.length ? raw : defaults();
  } catch {
    return defaults();
  }
}

export function TextStylesPanel() {
  const [styles, setStyles] = useState<Style[]>(load);
  const t = useTexts()[0];
  const save = (next: Style[]) => {
    setStyles(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <div className="panel-body">
      <div className="asset-head">
        Styles
        <button
          className="mini wide"
          disabled={!t}
          title="Save the selected text's look as a style"
          onClick={() => t && save([...styles, { id: `st${Date.now().toString(36)}`, name: `Style ${styles.length + 1}`, fontFamily: t.fontFamily, fontSize: t.fontSize, fontWeight: t.fontWeight, italic: t.italic, underline: t.underline, align: t.align, lineHeight: t.lineHeight, letterSpacing: t.letterSpacing }])}
        >
          + From selection
        </button>
      </div>
      <div className="style-list">
        {styles.map((st) => (
          <div key={st.id} className="style">
            <button
              disabled={!t}
              title={t ? 'Apply to the selected text' : 'Select text first'}
              onClick={() => {
                const { id, name, ...look } = st;
                void id;
                void name;
                setText(look);
              }}
            >
              <span style={{ fontFamily: st.fontFamily, fontWeight: st.fontWeight, fontStyle: st.italic ? 'italic' : 'normal', fontSize: Math.min(20, st.fontSize) }}>{st.name}</span>
              <em>
                {st.fontFamily} · {st.fontSize}px
              </em>
            </button>
            <i title="Delete style" onClick={() => save(styles.filter((x) => x.id !== st.id))}>×</i>
          </div>
        ))}
      </div>
    </div>
  );
}
