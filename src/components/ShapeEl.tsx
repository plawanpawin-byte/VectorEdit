import type { Shape } from '../types';
import { pathD } from '../geometry';

export function ShapeEl({ shape: s }: { shape: Shape }) {
  if (!s.visible) return null;
  const common = {
    fill: s.fill ?? 'none',
    stroke: s.stroke ?? 'none',
    strokeWidth: s.stroke ? s.strokeWidth : 0,
    opacity: s.opacity,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  };
  switch (s.kind) {
    case 'rect':
      return <rect x={s.x} y={s.y} width={s.w} height={s.h} {...common} />;
    case 'ellipse':
      return <ellipse cx={s.x + s.w / 2} cy={s.y + s.h / 2} rx={s.w / 2} ry={s.h / 2} {...common} />;
    case 'line':
    case 'path':
      return <path d={pathD(s)} {...common} />;
    case 'text':
      return (
        <text
          x={s.x}
          y={s.y + s.fontSize * 0.95}
          fontSize={s.fontSize}
          fontFamily="Georgia, 'Times New Roman', serif"
          fill={s.fill ?? 'none'}
          opacity={s.opacity}
          style={{ userSelect: 'none' }}
        >
          {s.text.split('\n').map((line, i) => (
            <tspan key={i} x={s.x} dy={i === 0 ? 0 : s.fontSize * 1.2}>
              {line || ' '}
            </tspan>
          ))}
        </text>
      );
  }
}
