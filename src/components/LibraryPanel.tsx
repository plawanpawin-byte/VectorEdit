import { useEffect, useMemo, useRef, useState } from 'react';
import { loadMacros, playMacro, type MacroStep } from '../raster/macro';
import { applyOp, rasterOp } from '../raster/ops';
import { QUICK_PRESETS } from '../raster/presets';
import { activeBoard, useStore } from '../store';
import { renderBoardPixels } from './exporter';

function Preview({ base, steps }: { base: ImageData; steps: MacroStep[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const img = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height);
    for (const s of steps) {
      const op = rasterOp(s.op);
      if (op) applyOp(img, op, s.params);
    }
    cv.width = img.width;
    cv.height = img.height;
    ctx.putImageData(img, 0, 0);
  }, [base, steps]);
  return <canvas ref={ref} />;
}

/** Looks you can preview on the current page and apply to a pixel layer with one click. */
export function LibraryPanel() {
  const shapes = useStore((s) => s.shapes);
  const [base, setBase] = useState<ImageData | null>(null);
  const [saved] = useState(loadMacros);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let dead = false;
    const t = setTimeout(() => {
      renderBoardPixels(shapes, activeBoard(), 120).then((p) => !dead && setBase(p), () => undefined);
    }, 300);
    return () => {
      dead = true;
      clearTimeout(t);
    };
  }, [shapes]);

  const items = useMemo(() => [...QUICK_PRESETS.map((q) => ({ id: q.id, name: q.name, steps: q.steps, own: false })), ...saved.map((m) => ({ id: m.id, name: m.name, steps: m.steps, own: true }))], [saved]);

  return (
    <div className="panel-body">
      <p className="hint">Previews use the current page. Click a look to apply it to the selected pixel layer.</p>
      <div className="library-grid">
        {items.map((it) => (
          <button
            key={it.id}
            className="library-card"
            title={it.steps.map((s) => rasterOp(s.op)?.name ?? s.op).join(' → ')}
            onClick={async () => {
              const n = await playMacro(it.steps);
              setMsg(n ? `${it.name}: ${n} step${n === 1 ? '' : 's'} applied.` : '');
            }}
          >
            {base ? <Preview base={base} steps={it.steps} /> : <div className="ph" />}
            <span>{it.name}{it.own ? ' ★' : ''}</span>
          </button>
        ))}
      </div>
      {msg && <p className="hint">{msg}</p>}
    </div>
  );
}
