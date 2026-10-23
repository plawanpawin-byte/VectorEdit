import { useStore } from '../store';

const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
export const RULER = 20;

function Ruler({ horizontal }: { horizontal: boolean }) {
  const zoom = useStore((s) => s.zoom);
  const pan = useStore((s) => (horizontal ? s.panX : s.panY));
  const viewport = useStore((s) => s.viewport);
  const length = horizontal ? viewport.w : viewport.h;
  const major = STEPS.find((s) => s * zoom >= 64) ?? 5000;
  const minor = major / 5;
  const start = Math.floor(-pan / zoom / minor) * minor;
  let d = '';
  const labels: { at: number; text: string }[] = [];
  for (let v = start; v * zoom + pan < length; v += minor) {
    const at = Math.round(v * zoom + pan) + 0.5;
    const isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
    const size = isMajor ? RULER : v / minor % 5 === 0 ? 10 : 6;
    d += horizontal ? `M${at} ${RULER}v${-size}` : `M${RULER} ${at}h${-size}`;
    if (isMajor) labels.push({ at, text: String(Math.round(v)) });
  }
  return (
    <svg className={horizontal ? 'ruler ruler-h' : 'ruler ruler-v'} width={horizontal ? length : RULER} height={horizontal ? RULER : length}>
      <path d={d} stroke="#6b6b6b" strokeWidth="1" />
      {labels.map((l) =>
        horizontal ? (
          <text key={l.at} x={l.at + 3} y={10}>
            {l.text}
          </text>
        ) : (
          <text key={l.at} transform={`translate(10 ${l.at + 3}) rotate(-90)`} textAnchor="end">
            {l.text}
          </text>
        ),
      )}
    </svg>
  );
}

export function RulerH() {
  return <Ruler horizontal />;
}
export function RulerV() {
  return <Ruler horizontal={false} />;
}
