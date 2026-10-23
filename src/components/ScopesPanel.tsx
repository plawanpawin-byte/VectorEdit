import { useEffect, useRef, useState } from 'react';
import { histogram, vectorscope, waveform } from '../scopes';
import { activeBoard, useStore } from '../store';
import { renderBoardPixels } from './exporter';

type Mode = 'histogram' | 'waveform' | 'vectorscope';

/** Live colour scopes of the active page. */
export function ScopesPanel() {
  const shapes = useStore((s) => s.shapes);
  const boards = useStore((s) => s.artboards);
  const active = useStore((s) => s.activeArtboard);
  const [mode, setMode] = useState<Mode>('histogram');
  const [pixels, setPixels] = useState<ImageData | null>(null);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let dead = false;
    const t = setTimeout(() => {
      const board = boards.find((b) => b.id === active) ?? boards[0] ?? activeBoard();
      renderBoardPixels(shapes, board).then((p) => !dead && setPixels(p), () => undefined);
    }, 250);
    return () => {
      dead = true;
      clearTimeout(t);
    };
  }, [shapes, boards, active]);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const W = cv.width, H = cv.height;
    ctx.fillStyle = '#0d0d0f';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (H * i) / 4);
      ctx.lineTo(W, (H * i) / 4);
      ctx.stroke();
    }
    if (!pixels) return;
    if (mode === 'histogram') {
      const h = histogram(pixels);
      ctx.globalCompositeOperation = 'lighter';
      for (const [ch, col] of [[h.r, '#ff4b4b'], [h.g, '#3ddc6b'], [h.b, '#4b8bff']] as const) {
        ctx.fillStyle = col + '99';
        for (let i = 0; i < 256; i++) {
          const bar = Math.min(1, ch[i] / h.max) * (H - 4);
          ctx.fillRect((i / 256) * W, H - bar, Math.ceil(W / 256), bar);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    } else if (mode === 'waveform') {
      const cols = 128;
      const w = waveform(pixels, cols);
      const cw = W / cols;
      for (let c = 0; c < cols; c++)
        for (let l = 0; l < 256; l++) {
          const v = w[c * 256 + l];
          if (!v) continue;
          ctx.fillStyle = `rgba(95,255,150,${Math.min(1, v * 6 + 0.1)})`;
          ctx.fillRect(c * cw, H - (l / 255) * (H - 2) - 2, cw + 0.5, 2);
        }
    } else {
      const size = 96;
      const v = vectorscope(pixels, size);
      const max = Math.max(1, ...v);
      const s = Math.min(W, H) / size;
      const ox = (W - s * size) / 2;
      ctx.strokeStyle = 'rgba(255,255,255,.15)';
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, (s * size) / 2 - 1, 0, Math.PI * 2);
      ctx.stroke();
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const c = v[y * size + x];
          if (!c) continue;
          ctx.fillStyle = `rgba(120,200,255,${Math.min(1, 0.25 + (c / max) * 0.75)})`;
          ctx.fillRect(ox + x * s, y * s, Math.max(1.5, s), Math.max(1.5, s));
        }
    }
  }, [pixels, mode]);

  return (
    <div className="panel-body">
      <div className="pad row">
        {(['histogram', 'waveform', 'vectorscope'] as Mode[]).map((m) => (
          <button key={m} className={'mini wide' + (mode === m ? ' on' : '')} onClick={() => setMode(m)}>
            {m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>
      <canvas ref={ref} className="scope" width={440} height={200} />
      <p className="hint">Measured on the active page, updated as you edit.</p>
    </div>
  );
}
