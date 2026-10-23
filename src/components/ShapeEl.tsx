import type { CSSProperties } from 'react';
import type { ArrowKind, Effect, Pattern, Shape } from '../types';
import { bbox as bboxOf, isClosed, pathD, toPath } from '../geometry';
import { layoutText } from '../textlayout';

const rad = (deg: number) => (deg * Math.PI) / 180;

function dashArray(s: Shape): string | undefined {
  const w = Math.max(1, s.strokeWidth);
  if (s.dash === 'dash') return `${w * 3} ${w * 2}`;
  if (s.dash === 'dot') return `0.01 ${w * 2}`;
  return undefined;
}

const FILTER_ATTRS = { x: '-60%', y: '-60%', width: '220%', height: '220%', colorInterpolationFilters: 'sRGB' as const };

/** SVG filter chain for a list of effects. Each step reads the previous result so effects stack. */
function Filter({ id, effects }: { id: string; effects: Effect[] }) {
  let prev = 'SourceGraphic';
  const nodes: React.ReactNode[] = [];
  effects.forEach((e, i) => {
    const out = `e${i}`;
    const k = (n: string) => `${n}${i}`;
    switch (e.type) {
      case 'blur':
        nodes.push(<feGaussianBlur key={i} in={prev} stdDeviation={Math.max(0, e.blur / 2)} result={out} />);
        break;
      case 'shadow':
      case 'glow':
        nodes.push(
          <feDropShadow key={i} in={prev} dx={e.type === 'glow' ? 0 : e.dx} dy={e.type === 'glow' ? 0 : e.dy} stdDeviation={Math.max(0, e.blur / 2)} floodColor={e.color} floodOpacity={e.opacity} result={out} />,
        );
        break;
      case 'innerShadow':
      case 'innerGlow': {
        const dx = e.type === 'innerGlow' ? 0 : e.dx;
        const dy = e.type === 'innerGlow' ? 0 : e.dy;
        nodes.push(
          <g key={i}>
            <feComponentTransfer in="SourceAlpha" result={k('inv')}>
              <feFuncA type="table" tableValues="1 0" />
            </feComponentTransfer>
            <feGaussianBlur in={k('inv')} stdDeviation={Math.max(0, e.blur / 2)} result={k('blur')} />
            <feOffset in={k('blur')} dx={dx} dy={dy} result={k('off')} />
            <feFlood floodColor={e.color} floodOpacity={e.opacity} result={k('col')} />
            <feComposite in={k('col')} in2={k('off')} operator="in" result={k('sh')} />
            <feComposite in={k('sh')} in2="SourceAlpha" operator="in" result={k('clip')} />
            <feMerge result={out}>
              <feMergeNode in={prev} />
              <feMergeNode in={k('clip')} />
            </feMerge>
          </g>,
        );
        break;
      }
      case 'outline':
        nodes.push(
          <g key={i}>
            <feMorphology in="SourceAlpha" operator="dilate" radius={Math.max(0.1, e.blur / 2)} result={k('dil')} />
            <feFlood floodColor={e.color} floodOpacity={e.opacity} result={k('col')} />
            <feComposite in={k('col')} in2={k('dil')} operator="in" result={k('ring')} />
            <feMerge result={out}>
              <feMergeNode in={k('ring')} />
              <feMergeNode in={prev} />
            </feMerge>
          </g>,
        );
        break;
      case 'overlay':
        nodes.push(
          <g key={i}>
            <feFlood floodColor={e.color} floodOpacity={e.opacity} result={k('col')} />
            <feComposite in={k('col')} in2="SourceAlpha" operator="in" result={k('tint')} />
            <feMerge result={out}>
              <feMergeNode in={prev} />
              <feMergeNode in={k('tint')} />
            </feMerge>
          </g>,
        );
        break;
      case 'bevel':
        nodes.push(
          <g key={i}>
            <feGaussianBlur in="SourceAlpha" stdDeviation={Math.max(0.5, e.blur / 4)} result={k('b')} />
            <feSpecularLighting in={k('b')} surfaceScale={Math.max(1, e.blur / 2)} specularConstant="0.9" specularExponent="22" lightingColor={e.color} result={k('spec')}>
              <feDistantLight azimuth={225 + (e.dx || 0) * 5} elevation="45" />
            </feSpecularLighting>
            <feComposite in={k('spec')} in2="SourceAlpha" operator="in" result={k('specIn')} />
            <feComposite in={prev} in2={k('specIn')} operator="arithmetic" k1="0" k2="1" k3={e.opacity} k4="0" result={out} />
          </g>,
        );
        break;
    }
    prev = out;
  });
  return (
    <filter id={id} {...FILTER_ATTRS}>
      {nodes}
    </filter>
  );
}

/** Clip an image to the shape's outline, or draw the picture-frame placeholder. */
function withImage(s: Shape, body: React.ReactNode, _common?: Record<string, unknown>): React.ReactNode {
  void _common;
  if (s.kind === 'text') return body;
  const d = pathD(toPath(s));
  const box = bboxOf(s);
  const cid = `clip-${s.id}`;
  if (!s.src) {
    return (
      <>
        {body}
        <g pointerEvents="none" stroke="#9a9a9a" strokeWidth={1} fill="none">
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
      <g clipPath={`url(#${cid})`}>
        <image href={s.src} x={box.x} y={box.y} width={box.w} height={box.h} preserveAspectRatio={s.raster ? 'none' : s.fit === 'fit' ? 'xMidYMid meet' : 'xMidYMid slice'} />
      </g>
      {s.stroke ? <path d={d} fill="none" stroke={s.stroke} strokeWidth={s.strokeWidth} strokeLinejoin="round" /> : null}
    </>
  );
}

const ARROW_PATH: Record<Exclude<ArrowKind, ''>, { d: string; fill: boolean; ref: number }> = {
  arrow: { d: 'M0 0L10 5L0 10z', fill: true, ref: 9 },
  open: { d: 'M1 1L9 5L1 9', fill: false, ref: 9 },
  circle: { d: 'M5 1a4 4 0 100 8a4 4 0 100-8z', fill: true, ref: 5 },
  square: { d: 'M1 1H9V9H1z', fill: true, ref: 5 },
  diamond: { d: 'M5 0L10 5L5 10L0 5z', fill: true, ref: 5 },
  bar: { d: 'M4.2 0H5.8V10H4.2z', fill: true, ref: 5 },
};

function Marker({ id, kind, color, size, start }: { id: string; kind: Exclude<ArrowKind, ''>; color: string; size: number; start: boolean }) {
  const a = ARROW_PATH[kind];
  return (
    <marker id={id} viewBox="0 0 10 10" refX={a.ref} refY={5} markerWidth={size} markerHeight={size} markerUnits="userSpaceOnUse" orient={start ? 'auto-start-reverse' : 'auto'}>
      <path d={a.d} fill={a.fill ? color : 'none'} stroke={a.fill ? 'none' : color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </marker>
  );
}

function PatternDef({ id, p }: { id: string; p: Pattern }) {
  const sz = Math.max(2, p.size);
  const w = Math.max(0.2, p.weight) * sz;
  let art: React.ReactNode;
  switch (p.type) {
    case 'stripes':
      art = <rect x={0} y={0} width={sz} height={w} fill={p.color} />;
      break;
    case 'dots':
      art = <circle cx={sz / 2} cy={sz / 2} r={w / 2} fill={p.color} />;
      break;
    case 'grid':
      art = (
        <>
          <rect x={0} y={0} width={sz} height={Math.max(0.5, w / 3)} fill={p.color} />
          <rect x={0} y={0} width={Math.max(0.5, w / 3)} height={sz} fill={p.color} />
        </>
      );
      break;
    case 'cross':
      art = <path d={`M0 0L${sz} ${sz}M${sz} 0L0 ${sz}`} stroke={p.color} strokeWidth={Math.max(0.5, w / 3)} />;
      break;
    case 'checker':
      art = (
        <>
          <rect x={0} y={0} width={sz / 2} height={sz / 2} fill={p.color} />
          <rect x={sz / 2} y={sz / 2} width={sz / 2} height={sz / 2} fill={p.color} />
        </>
      );
      break;
  }
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={sz} height={sz} patternTransform={`rotate(${p.angle})`}>
      {art}
    </pattern>
  );
}

/** Renders one shape. `all` lets text find the path it runs along. */
export function ShapeEl({ shape: s, all }: { shape: Shape; all?: Shape[] }) {
  if (!s.visible) return null;
  const id = { grad: `grad-${s.id}`, fx: `fx-${s.id}`, pat: `pat-${s.id}`, fade: `fade-${s.id}`, fadeG: `fadeg-${s.id}`, clip: `sclip-${s.id}`, omask: `omask-${s.id}`, mkS: `mks-${s.id}`, mkE: `mke-${s.id}` };
  const fx = (s.effects ?? []).filter((e) => e.enabled);
  const g = s.gradient;
  const fillRef = g ? `url(#${id.grad})` : (s.fill ?? 'none');
  const style: CSSProperties | undefined = s.blend && s.blend !== 'normal' ? { mixBlendMode: s.blend as CSSProperties['mixBlendMode'] } : undefined;
  const closedGeom = s.kind === 'rect' || s.kind === 'ellipse' || (s.kind === 'shape' ? isClosed(s) : s.kind === 'path' && s.closed);
  const hasStroke = !!s.stroke && s.strokeWidth > 0;
  const align = closedGeom && hasStroke ? (s.strokeAlign ?? 'center') : 'center';
  const wantsMarkers = !closedGeom && (s.kind === 'path' || s.kind === 'line' || s.kind === 'shape') && (s.arrowStart || s.arrowEnd);
  const markerSize = Math.max(8, s.strokeWidth * 4);

  const strokeBase = {
    strokeDasharray: dashArray(s),
    strokeLinejoin: s.join ?? 'round',
    strokeLinecap: (s.dash === 'dot' ? 'round' : (s.cap ?? 'round')) as 'butt' | 'round' | 'square',
  };

  const geom = (extra: Record<string, unknown>, key?: string): React.ReactNode => {
    switch (s.kind) {
      case 'rect':
        return <rect key={key} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.radius ?? 0} {...extra} />;
      case 'ellipse':
        return <ellipse key={key} cx={s.x + s.w / 2} cy={s.y + s.h / 2} rx={s.w / 2} ry={s.h / 2} {...extra} />;
      default:
        return <path key={key} d={pathD(s)} fillRule="evenodd" {...extra} />;
    }
  };

  let body: React.ReactNode;
  if (s.kind === 'text') {
    const path = s.pathId ? all?.find((q) => q.id === s.pathId && q.kind !== 'text') : undefined;
    const textProps = {
      fontFamily: `${s.fontFamily}, serif`,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      fontStyle: s.italic ? ('italic' as const) : ('normal' as const),
      letterSpacing: s.letterSpacing || undefined,
      textDecoration: s.underline ? 'underline' : undefined,
      fill: fillRef,
      style: { userSelect: 'none' as const },
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
    } else {
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
  } else {
    const fillOnly = geom({ fill: fillRef, stroke: 'none' }, 'fill');
    const pattern = s.pattern ? geom({ fill: `url(#${id.pat})`, stroke: 'none' }, 'pattern') : null;
    const strokeProps = { fill: 'none', stroke: s.stroke ?? 'none', ...strokeBase };
    let stroke: React.ReactNode = null;
    if (hasStroke) {
      if (align === 'inside') {
        stroke = (
          <g key="stroke" clipPath={`url(#${id.clip})`}>
            {geom({ ...strokeProps, strokeWidth: s.strokeWidth * 2 })}
          </g>
        );
      } else if (align === 'outside') {
        stroke = (
          <g key="stroke" mask={`url(#${id.omask})`}>
            {geom({ ...strokeProps, strokeWidth: s.strokeWidth * 2 })}
          </g>
        );
      } else {
        stroke = geom({ ...strokeProps, strokeWidth: s.strokeWidth, ...(wantsMarkers ? { markerStart: s.arrowStart ? `url(#${id.mkS})` : undefined, markerEnd: s.arrowEnd ? `url(#${id.mkE})` : undefined } : {}) }, 'stroke');
      }
    }
    body = (
      <>
        {fillOnly}
        {pattern}
        {stroke}
      </>
    );
    if (s.src || s.frame) body = withImage(s, body, { style });
  }

  const f = s.fade;
  const needsWrap = s.opacity < 1 || !!style || fx.length > 0 || !!f;
  const defs = (
    <defs>
      {g?.type === 'linear' && g.p1 && g.p2 && (
        <linearGradient id={id.grad} gradientUnits="userSpaceOnUse" x1={g.p1.x} y1={g.p1.y} x2={g.p2.x} y2={g.p2.y}>
          <stop offset="0" stopColor={g.a} />
          <stop offset="1" stopColor={g.b} />
        </linearGradient>
      )}
      {g?.type === 'radial' && g.p1 && g.p2 && (
        <radialGradient id={id.grad} gradientUnits="userSpaceOnUse" cx={g.p1.x} cy={g.p1.y} fx={g.p1.x} fy={g.p1.y} r={Math.max(0.001, Math.hypot(g.p2.x - g.p1.x, g.p2.y - g.p1.y))}>
          <stop offset="0" stopColor={g.a} />
          <stop offset="1" stopColor={g.b} />
        </radialGradient>
      )}
      {g?.type === 'linear' && !g.p1 && (
        <linearGradient id={id.grad} x1={0.5 - Math.cos(rad(g.angle)) / 2} y1={0.5 - Math.sin(rad(g.angle)) / 2} x2={0.5 + Math.cos(rad(g.angle)) / 2} y2={0.5 + Math.sin(rad(g.angle)) / 2}>
          <stop offset="0" stopColor={g.a} />
          <stop offset="1" stopColor={g.b} />
        </linearGradient>
      )}
      {g?.type === 'radial' && !g.p1 && (
        <radialGradient id={id.grad} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={g.a} />
          <stop offset="1" stopColor={g.b} />
        </radialGradient>
      )}
      {s.pattern && <PatternDef id={id.pat} p={s.pattern} />}
      {fx.length > 0 && <Filter id={id.fx} effects={fx} />}
      {f && (
        <>
          <linearGradient id={id.fadeG} gradientUnits="userSpaceOnUse" x1={f.p1.x} y1={f.p1.y} x2={f.p2.x} y2={f.p2.y}>
            <stop offset="0" stopColor="#fff" stopOpacity={f.from} />
            <stop offset="1" stopColor="#fff" stopOpacity={f.to} />
          </linearGradient>
          <mask id={id.fade} maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">
            <rect x="-100000" y="-100000" width="200000" height="200000" fill={`url(#${id.fadeG})`} />
          </mask>
        </>
      )}
      {wantsMarkers && s.arrowStart && <Marker id={id.mkS} kind={s.arrowStart as Exclude<ArrowKind, ''>} color={s.stroke ?? '#000'} size={markerSize} start />}
      {wantsMarkers && s.arrowEnd && <Marker id={id.mkE} kind={s.arrowEnd as Exclude<ArrowKind, ''>} color={s.stroke ?? '#000'} size={markerSize} start={false} />}
      {align !== 'center' && s.kind !== 'text' && (
        <>
          <clipPath id={id.clip}>{geom({ fill: '#000' })}</clipPath>
          <mask id={id.omask} maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">
            <rect x="-100000" y="-100000" width="200000" height="200000" fill="#fff" />
            {geom({ fill: '#000', stroke: 'none' })}
          </mask>
        </>
      )}
    </defs>
  );

  const content = needsWrap ? (
    <g opacity={s.opacity < 1 ? s.opacity : undefined} style={style} filter={fx.length ? `url(#${id.fx})` : undefined} mask={f ? `url(#${id.fade})` : undefined}>
      {body}
    </g>
  ) : (
    body
  );
  return (
    <>
      {defs}
      {content}
    </>
  );
}
