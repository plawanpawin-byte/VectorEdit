import type { CSSProperties } from 'react';
import type { Effect, Shape } from '../types';
import { bbox as bboxOf, pathD, toPath } from '../geometry';
import { layoutText } from '../textlayout';

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

/** Clip an image to the shape's outline, or draw the picture-frame placeholder. */
function withImage(s: Shape, body: React.ReactNode, common: Record<string, unknown>): React.ReactNode {
  if (s.kind === 'text') return body;
  const d = pathD(toPath(s));
  const box = bboxOf(s);
  const cid = `clip-${s.id}`;
  if (!s.src) {
    return (
      <>
        {body}
        <g opacity={s.opacity} pointerEvents="none" stroke="#9a9a9a" strokeWidth={1} fill="none">
          <defs>
            <clipPath id={cid}>
              <path d={d} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${cid})`}>
            <line x1={box.x} y1={box.y} x2={box.x + box.w} y2={box.y + box.h} />
            <line x1={box.x + box.w} y1={box.y} x2={box.x} y2={box.y + box.h} />
          </g>
        </g>
      </>
    );
  }
  return (
    <>
      <defs>
        <clipPath id={cid}>
          <path d={d} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${cid})`} opacity={s.opacity} style={common.style as React.CSSProperties}>
        <image href={s.src} x={box.x} y={box.y} width={box.w} height={box.h} preserveAspectRatio={s.raster ? 'none' : s.fit === 'fit' ? 'xMidYMid meet' : 'xMidYMid slice'} />
      </g>
      {s.stroke ? <path d={d} fill="none" stroke={s.stroke} strokeWidth={s.strokeWidth} strokeLinejoin="round" /> : null}
    </>
  );
}

/** Renders one shape. `all` lets text find the path it runs along. */
export function ShapeEl({ shape: s, all }: { shape: Shape; all?: Shape[] }) {
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
    case 'shape':
    case 'line':
    case 'path':
      body = <path d={pathD(s)} {...common} />;
      break;
    case 'text': {
      const path = s.pathId ? all?.find((q) => q.id === s.pathId && q.kind !== 'text') : undefined;
      const textProps = {
        fontFamily: `${s.fontFamily}, serif`,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        fontStyle: s.italic ? ('italic' as const) : ('normal' as const),
        letterSpacing: s.letterSpacing || undefined,
        textDecoration: s.underline ? 'underline' : undefined,
        fill,
        opacity: s.opacity,
        filter: common.filter,
        style: { userSelect: 'none' as const, ...style },
      };
      if (path) {
        body = (
          <>
            <defs>
              <path id={`tp-${s.id}`} d={pathD(toPath(path))} />
            </defs>
            <text {...textProps}>
              <textPath href={`#tp-${s.id}`}>{s.text.replace(/\n/g, ' ')}</textPath>
            </text>
          </>
        );
        break;
      }
      const lay = layoutText(s);
      const lh = s.fontSize * (s.lineHeight || 1.2);
      const baseline = (lh - s.fontSize) / 2 + s.fontSize * 0.85;
      body = (
        <text {...textProps} textAnchor={s.align === 'center' ? 'middle' : s.align === 'right' ? 'end' : 'start'}>
          {lay.lines.map((l, i) => {
            const justify = s.align === 'justify' && s.frameW > 0 && !l.last && l.text.includes(' ');
            return (
              <tspan key={i} x={l.x} y={l.y + baseline} {...(justify ? { textLength: s.frameW, lengthAdjust: 'spacing' as const } : {})}>
                {l.text || '\u00a0'}
              </tspan>
            );
          })}
        </text>
      );
    }
  }

  if (s.src || s.frame) body = withImage(s, body, common);

  const needsDefs = !!g || fx.length > 0;
  if (!needsDefs) return <>{body}</>;
  const a = rad(g?.angle ?? 0);
  return (
    <>
      <defs>
        {g?.type === 'linear' && g.p1 && g.p2 && (
          <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={g.p1.x} y1={g.p1.y} x2={g.p2.x} y2={g.p2.y}>
            <stop offset="0" stopColor={g.a} />
            <stop offset="1" stopColor={g.b} />
          </linearGradient>
        )}
        {g?.type === 'radial' && g.p1 && g.p2 && (
          <radialGradient id={gid} gradientUnits="userSpaceOnUse" cx={g.p1.x} cy={g.p1.y} fx={g.p1.x} fy={g.p1.y} r={Math.max(0.001, Math.hypot(g.p2.x - g.p1.x, g.p2.y - g.p1.y))}>
            <stop offset="0" stopColor={g.a} />
            <stop offset="1" stopColor={g.b} />
          </radialGradient>
        )}
        {g?.type === 'linear' && !g.p1 && (
          <linearGradient id={gid} x1={0.5 - Math.cos(a) / 2} y1={0.5 - Math.sin(a) / 2} x2={0.5 + Math.cos(a) / 2} y2={0.5 + Math.sin(a) / 2}>
            <stop offset="0" stopColor={g.a} />
            <stop offset="1" stopColor={g.b} />
          </linearGradient>
        )}
        {g?.type === 'radial' && !g.p1 && (
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
