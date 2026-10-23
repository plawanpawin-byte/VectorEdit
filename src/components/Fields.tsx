import { useState } from 'react';
import { useStore } from '../store';
import { fromPx, toPx } from '../units';

export function NumField({
  label,
  value,
  onCommit,
  suffix = '',
  min,
  disabled,
  step = 1,
}: {
  label: string;
  value: number | null;
  onCommit: (v: number) => void;
  suffix?: string;
  min?: number;
  disabled?: boolean;
  step?: number;
}) {
  const fmt = (v: number | null) => (v === null ? '' : String(Math.round(v * 100) / 100));
  // draft text only exists while the field is being edited; otherwise show the live value
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? fmt(value);
  const setText = (t: string) => setDraft(t);
  const commit = () => {
    const n = parseFloat(text);
    if (draft !== null && Number.isFinite(n) && (min === undefined || n >= min) && n !== value) onCommit(n);
    setDraft(null);
  };
  return (
    <label className={'num' + (disabled ? ' disabled' : '')}>
      <span>{label}</span>
      <input
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const n = parseFloat(text) || 0;
            const v = n + (e.key === 'ArrowUp' ? step : -step) * (e.shiftKey ? 10 : 1);
            setDraft(null);
            onCommit(v);
          }
        }}
      />
      {suffix && <em>{suffix}</em>}
    </label>
  );
}

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="section">
      <header onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 10 10" width="8" height="8" fill="currentColor" style={{ transform: open ? 'rotate(90deg)' : undefined }}>
          <path d="M3 1.5l4.5 3.5L3 8.5z" />
        </svg>
        <span>{title}</span>
        <div onClick={(e) => e.stopPropagation()}>{right}</div>
      </header>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}

/** A length field that shows and accepts the interface unit while the value stays in pixels. */
export function UnitField({ label, value, onCommit, min, disabled }: { label: string; value: number | null; onCommit: (px: number) => void; min?: number; disabled?: boolean }) {
  const unit = useStore((s) => s.units);
  const digits = unit === 'px' ? 2 : 3;
  const round = (v: number) => Math.round(v * 10 ** digits) / 10 ** digits;
  return (
    <NumField
      label={label}
      value={value === null ? null : round(fromPx(value, unit))}
      suffix={unit}
      min={min === undefined ? undefined : round(fromPx(min, unit))}
      disabled={disabled}
      onCommit={(v) => onCommit(toPx(v, unit))}
    />
  );
}
