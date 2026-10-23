import { useEffect, useState } from 'react';

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
  const [text, setText] = useState(fmt(value));
  useEffect(() => setText(fmt(value)), [value]);
  const commit = () => {
    const n = parseFloat(text);
    if (Number.isFinite(n) && (min === undefined || n >= min)) onCommit(n);
    else setText(fmt(value));
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
            setText(fmt(v));
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
