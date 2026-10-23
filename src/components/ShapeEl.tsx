import type { CSSProperties } from 'react';
import type { Effect, Shape } from '../types';
import { pathD } from '../geometry';

const rad = (deg: number) => (deg * Math.PI) / 180;

function dashArray(s: Shape): string | undefined {
  const w = Math.max(1, s.strokeWidth);
  if (s.dash === 'dash') return `${w * 3} ${w * 2}`;
  if (s.dash === 'dot') return `0.01 ${w * 2}`;
  return undefined;
}

function Filter({ id, effects }: { id: string; effects: Effect[] }) {
  let prev = 'SourceGraphic';
  const nodes = effects.map((e, i) => {
    const result = `e${i}`;
    const el =
      e.type === 'blur' ? (
        <feGaussianBlur key={i} in={prev} stdDeviation={Math.max(0, e.blur / 2)} result={result} />
      ) : (
        <feDropShadow
          key={i}
          in={prev}
          dx={e.type === 'glow' ? 0 : e.dx}
          dy={e.type === 'glow' ? 0 : e.dy}
          stdDeviation={Math.max(0, e.blur / 2)}
          floodColor={e.color}
          floodOpacity={e.opacity}
          result={result}
        />
      );
    prev = result;
    return el;
  });
  return (
    <filter id={id} x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
      {nodes}
    </filter>
  );
}

export function ShapeEl({ shape: s }: { shape: Shape }) {
  if (!s.visible) return null;
  const gid = `grad-${s.id}`;
  const fid = `fx-${s.id}`;
  const fx = (s.effects ?? []).filter((e) => e.enabled);
  const g = s.gradient;
  const fill = g ? `url(#${gid})` : (s.fill ?? 'none');
  const style: CSSProperties | undefined = s.blend && s.blend !== 'normal' ? { mixBlendMode: s.blend as CSSProperties['mixBlendMode'] } : undefined;
  const common = {
    fill,
    stroke: s.stroke ?? 'none',
    strokeWidth: s.stroke ? s.strokeWidth : 0,
    strokeDasharray: dashArray(s),
    opacity: s.opacity,
    strokeLinejoin: s.join ?? 'round',
    strokeLinecap: (s.dash === 'dot' ? 'round' : (s.cap ?? 'round')) as 'butt' | 'round' | 'square',
    fillRule: 'evenodd' as const,
    filter: fx.length ? `url(#${fid})` : undefined,
    style,
  };

  let body: React.ReactNode;
  switch (s.kind) {
    case 'rect':
      body = <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.radius ?? 0} {...common} />;
      break;
    case 'ellipse':
      body = <ellipse cx={s.x + s.w / 2} cy={s.y + s.h / 2} rx={s.w / 2} ry={s.h / 2} {...common} />;
      break;
    case 'polygon':
    case 'star':
    case 'line':
    case 'path':
      body = <path d={pathD(s)} {...common} />;
      break;
    case 'text':
      body = (
        <text
          x={s.x}
          y={s.y + s.fontSize * 0.95}
          fontSize={s.fontSize}
          fontFamily="Georgia, 'Times New Roman', serif"
          fill={fill}
          opacity={s.opacity}
          filter={common.filter}
          style={{ userSelect: 'none', ...style }}
        >
          {s.text.split('\n').map((line, i) => (
            <tspan key={i} x={s.x} dy={i === 0 ? 0 : s.fontSize * 1.2}>
              {line || ' '}
            </tspan>
          ))}
        </text>
      );
  }

  const needsDefs = !!g || fx.length > 0;
  if (!needsDefs) return <>{body}</>;
  const a = rad(g?.angle ?? 0);
  return (
    <>
      <defs>
        {g?.type === 'linear' && (
          <linearGradient id={gid} x1={0.5 - Math.cos(a) / 2} y1={0.5 - Math.sin(a) / 2} x2={0.5 + Math.cos(a) / 2} y2={0.5 + Math.sin(a) / 2}>
            <stop offset="0" stopColor={g.a} />
            <stop offset="1" stopColor={g.b} />
          </linearGradient>
        )}
        {g?.type === 'radial' && (
          <radialGradient id={gid} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={g.a} />
            <stop offset="1" stopColor={g.b} />
          </radialGradient>
        )}
        {fx.length > 0 && <Filter id={fid} effects={fx} />}
      </defs>
      {body}
    </>
  );
}
