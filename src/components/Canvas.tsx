import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { Box } from '../types';
import { bbox, inCtl, outCtl, pathD, unionBox } from '../geometry';
import { commit, endLiveDoc, fitArtboard, getState, liveDoc, docOf, removeGuide, setState, snapV, updateShape, useStore, zoomAt } from '../store';
import { toolDef } from '../tools/registry';
import type { PointerCtx } from '../tools/types';
import { panSession } from '../tools/view';
import type { Session } from '../tools/types';
import { ShapeEl } from './ShapeEl';
import { blankShape } from '../shape';
import { layoutText } from '../textlayout';
import { placeFiles } from '../images';

const HANDLE_CURSOR: Record<string, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
};

function handleList(b: Box): [string, number, number][] {
  const { x, y, w, h } = b;
  return [
    ['nw', x, y],
    ['n', x + w / 2, y],
    ['ne', x + w, y],
    ['e', x + w, y + h / 2],
    ['se', x + w, y + h],
    ['s', x + w / 2, y + h],
    ['sw', x, y + h],
    ['w', x, y + h / 2],
  ];
}

const BLUE = '#2d8cf0';

export function Canvas() {
  const ref = useRef<HTMLDivElement>(null);
  const session = useRef<Session | null>(null);
  const space = useRef(false);
  const [overlay, setOverlay] = useState<ReactNode | null>(null);
  const [panning, setPanning] = useState(false);

  const shapes = useStore((s) => s.shapes);
  const selection = useStore((s) => s.selection);
  const nodeSel = useStore((s) => s.nodeSel);
  const tool = useStore((s) => s.tool);
  const zoom = useStore((s) => s.zoom);
  const panX = useStore((s) => s.panX);
  const panY = useStore((s) => s.panY);
  const artboards = useStore((s) => s.artboards);
  const activeId = useStore((s) => s.activeArtboard);
  const guides = useStore((s) => s.guides);
  const guidesVisible = useStore((s) => s.guidesVisible);
  const viewport = useStore((s) => s.viewport);
  const grid = useStore((s) => s.grid);
  const pen = useStore((s) => s.pen);
  const penCursor = useStore((s) => (s.tool === 'pen' && s.pen ? s.cursor : null));
  const editingText = useStore((s) => s.editingText);
  const editShape = shapes.find((s) => s.id === editingText);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const def = toolDef(tool);

  // a tool's overlay belongs to that tool
  useEffect(() => setOverlay(null), [tool]);

  useEffect(() => {
    if (!editingText) return;
    const id = requestAnimationFrame(() => {
      textRef.current?.focus();
      textRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [editingText]);

  // viewport size and first fit
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let first = true;
    const ro = new ResizeObserver(() => {
      setState({ viewport: { w: el.clientWidth, h: el.clientHeight } });
      if (first) {
        first = false;
        fitArtboard();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // wheel: pan; ctrl/alt = zoom at the cursor
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey || e.altKey) zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - rect.left, e.clientY - rect.top);
      else {
        const st = getState();
        setState({ panX: st.panX - (e.shiftKey ? e.deltaY : e.deltaX), panY: st.panY - (e.shiftKey ? 0 : e.deltaY) });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // space = temporary hand tool
  useEffect(() => {
    const typing = (e: KeyboardEvent) => /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName);
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !typing(e)) {
        space.current = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => e.code === 'Space' && (space.current = false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  function ctxFor(e: { clientX: number; clientY: number; shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean; target: EventTarget }): PointerCtx {
    const rect = ref.current!.getBoundingClientRect();
    const st = getState();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const raw = { x: (sx - st.panX) / st.zoom, y: (sy - st.panY) / st.zoom };
    return {
      p: { x: snapV(raw.x, 'x', st.zoom), y: snapV(raw.y, 'y', st.zoom) },
      raw,
      screen: { x: sx, y: sy },
      shift: e.shiftKey,
      alt: e.altKey,
      ctrl: e.ctrlKey || e.metaKey,
      target: e.target as Element,
      st,
      zoom: st.zoom,
      tol: 5 / st.zoom,
      setOverlay,
    };
  }

  function onDown(e: React.PointerEvent) {
    if (e.button === 2) return;
    ref.current!.setPointerCapture(e.pointerId);
    const c = ctxFor(e);
    if (e.button === 1 || space.current) {
      session.current = panSession(c);
      setPanning(true);
      return;
    }
    const guideId = c.target.getAttribute?.('data-guide');
    if (guideId) {
      session.current = guideDrag(guideId, c);
      return;
    }
    // clicking inside a page makes it the active one
    if (c.st.artboards.length > 1) {
      const hit = c.st.artboards.find((a) => c.raw.x >= a.x && c.raw.x <= a.x + a.w && c.raw.y >= a.y && c.raw.y <= a.y + a.h);
      if (hit && hit.id !== c.st.activeArtboard) setState({ activeArtboard: hit.id });
    }
    session.current = toolDef(c.st.tool)?.down?.(c) ?? null;
  }

  function guideDrag(id: string, c: PointerCtx): Session {
    const before = docOf(c.st);
    const g = c.st.guides.find((x) => x.id === id)!;
    return {
      move(m) {
        const pos = g.axis === 'v' ? m.p.x : m.p.y;
        liveDoc({ guides: m.st.guides.map((x) => (x.id === id ? { ...x, pos } : x)) });
      },
      up(m) {
        const outside = m.screen.x < 0 || m.screen.y < 0 || m.screen.x > viewport.w || m.screen.y > viewport.h;
        if (outside) {
          liveDoc({ guides: before.guides });
          removeGuide(id);
        } else endLiveDoc(before);
      },
    };
  }

  function onMove(e: React.PointerEvent) {
    const c = ctxFor(e);
    setState({ cursor: { x: Math.round(c.raw.x), y: Math.round(c.raw.y) } });
    session.current?.move?.(c);
  }

  function onUp(e: React.PointerEvent) {
    const s = session.current;
    session.current = null;
    setPanning(false);
    s?.up?.(ctxFor(e));
  }

  const k = 1 / zoom;
  const selShapes = shapes.filter((s) => selection.includes(s.id));
  const box = unionBox(selShapes.map(bbox));
  const chrome = def?.chrome ?? 'none';

  return (
    <div
      ref={ref}
      className="canvas"
      style={{ cursor: panning ? 'grabbing' : space.current ? 'grab' : (def?.cursor ?? 'default') }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onDoubleClick={(e) => toolDef(getState().tool)?.dblclick?.(ctxFor(e))}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
      onDrop={(e) => {
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
        if (!files.length) return;
        e.preventDefault();
        void placeFiles(files, ctxFor(e).raw);
      }}
    >
      <svg width="100%" height="100%" style={{ display: 'block' }}>
        <g transform={`translate(${panX} ${panY}) scale(${zoom})`}>
          {artboards.map((a) => (
            <g key={a.id}>
              <rect x={a.x} y={a.y} width={a.w} height={a.h} fill="#fff" stroke={artboards.length > 1 && a.id === activeId ? BLUE : '#000'} strokeWidth={k} filter="url(#shadow)" />
              {grid && <rect x={a.x} y={a.y} width={a.w} height={a.h} fill="url(#grid)" pointerEvents="none" />}
              <text x={a.x} y={a.y - 6 * k} fontSize={11 * k} fill={a.id === activeId ? '#cfe3ff' : '#9a9a9a'} fontFamily="Segoe UI, sans-serif" pointerEvents="none" style={{ userSelect: 'none' }}>
                {a.name}
              </text>
            </g>
          ))}
          <g>{shapes.map((s) => (s.id === editingText ? null : <ShapeEl key={s.id} shape={s} all={shapes} />))}</g>

          {/* selection outlines */}
          {chrome !== 'none' &&
            selShapes.map((s) => (
              <g key={s.id} pointerEvents="none">
                {s.kind === 'rect' || s.kind === 'ellipse' || s.kind === 'text' ? (
                  <rect x={bbox(s).x} y={bbox(s).y} width={bbox(s).w} height={bbox(s).h} fill="none" stroke={BLUE} strokeWidth={1.5 * k} />
                ) : (
                  <path d={pathD(s)} fill="none" stroke={BLUE} strokeWidth={1.5 * k} fillRule="evenodd" />
                )}
              </g>
            ))}

          {/* node editing chrome */}
          {chrome === 'nodes' &&
            selShapes
              .filter((s) => s.kind === 'path' || s.kind === 'line')
              .map((s) => (
                <g key={`n${s.id}`}>
                  {s.pts.map((pt, i) => {
                    const selected = nodeSel.some((n) => n.id === s.id && n.i === i);
                    const o = outCtl(pt);
                    const inn = inCtl(pt);
                    const hasOut = !!(pt.hx || pt.hy);
                    const hasIn = inn.x !== pt.x || inn.y !== pt.y;
                    return (
                      <g key={i}>
                        {s.kind === 'path' && (hasOut || hasIn) && (
                          <>
                            <path d={`M${inn.x} ${inn.y}L${pt.x} ${pt.y}L${o.x} ${o.y}`} stroke={BLUE} strokeWidth={k} fill="none" pointerEvents="none" />
                            {hasOut && <circle data-a={`${s.id}:${i}:out`} cx={o.x} cy={o.y} r={3.5 * k} fill="#fff" stroke={BLUE} strokeWidth={k} style={{ cursor: 'pointer' }} />}
                            {hasIn && <circle data-a={`${s.id}:${i}:in`} cx={inn.x} cy={inn.y} r={3.5 * k} fill="#fff" stroke={BLUE} strokeWidth={k} style={{ cursor: 'pointer' }} />}
                          </>
                        )}
                        <rect
                          data-a={`${s.id}:${i}:p`}
                          x={pt.x - 4 * k}
                          y={pt.y - 4 * k}
                          width={8 * k}
                          height={8 * k}
                          fill={selected ? BLUE : '#fff'}
                          stroke={BLUE}
                          strokeWidth={1.2 * k}
                          style={{ cursor: 'pointer' }}
                        />
                      </g>
                    );
                  })}
                </g>
              ))}

          {/* transform handles */}
          {chrome === 'transform' && box && (
            <g>
              <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="none" stroke={BLUE} strokeWidth={k} pointerEvents="none" />
              {handleList(box).map(([h, hx, hy]) => (
                <rect key={h} data-h={h} x={hx - 3.5 * k} y={hy - 3.5 * k} width={7 * k} height={7 * k} fill="#fff" stroke={BLUE} strokeWidth={k} style={{ cursor: HANDLE_CURSOR[h] }} />
              ))}
            </g>
          )}

          {guidesVisible &&
            guides.map((g) => (
              <g key={g.id}>
                <line
                  x1={g.axis === 'v' ? g.pos : -1e5}
                  x2={g.axis === 'v' ? g.pos : 1e5}
                  y1={g.axis === 'h' ? g.pos : -1e5}
                  y2={g.axis === 'h' ? g.pos : 1e5}
                  stroke="#26c6da"
                  strokeWidth={k}
                  pointerEvents="none"
                />
                <line
                  data-guide={g.id}
                  x1={g.axis === 'v' ? g.pos : -1e5}
                  x2={g.axis === 'v' ? g.pos : 1e5}
                  y1={g.axis === 'h' ? g.pos : -1e5}
                  y2={g.axis === 'h' ? g.pos : 1e5}
                  stroke="transparent"
                  strokeWidth={8 * k}
                  style={{ cursor: g.axis === 'v' ? 'ew-resize' : 'ns-resize' }}
                />
              </g>
            ))}

          {chrome === 'artboard' &&
            (() => {
              const a = artboards.find((x) => x.id === activeId);
              return a
                ? handleList({ x: a.x, y: a.y, w: a.w, h: a.h }).map(([h, hx, hy]) => (
                    <rect key={h} data-ab={h} x={hx - 4 * k} y={hy - 4 * k} width={8 * k} height={8 * k} fill="#fff" stroke={BLUE} strokeWidth={k} style={{ cursor: HANDLE_CURSOR[h] }} />
                  ))
                : null;
            })()}

          {/* pen draft */}
          {pen && pen.length > 0 && (
            <g pointerEvents="none">
              <path
                d={pathD(blankShape('pen', 'path', { pts: penCursor ? [...pen, { x: penCursor.x, y: penCursor.y, hx: 0, hy: 0 }] : pen }))}
                fill="none"
                stroke={BLUE}
                strokeWidth={1.5 * k}
              />
              {pen.map((pt, i) => (
                <rect key={i} x={pt.x - 3 * k} y={pt.y - 3 * k} width={6 * k} height={6 * k} fill={i === 0 ? '#fff' : BLUE} stroke={BLUE} strokeWidth={k} />
              ))}
            </g>
          )}

          {overlay}
        </g>
        <defs>
          <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">
            <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#000" floodOpacity="0.55" />
          </filter>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" fill="none" stroke="#9aa0a6" strokeWidth={0.3} opacity={0.5} />
          </pattern>
        </defs>
      </svg>
      {editShape && (
        <textarea
          ref={textRef}
          className="text-edit"
          placeholder="Type…"
          value={editShape.text}
          spellCheck={false}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => updateShape(editShape.id, { text: e.target.value }, 'text-edit')}
          onKeyDown={(e) => e.key === 'Escape' && (e.target as HTMLTextAreaElement).blur()}
          onBlur={() => {
            const st = getState();
            const cur = st.shapes.find((s) => s.id === editShape.id);
            setState({ editingText: null });
            if (cur && !cur.text.trim()) commit(st.shapes.filter((s) => s.id !== cur.id), { selection: [], key: 'text-edit' });
          }}
          style={(() => {
            const lay = layoutText(editShape);
            const lh = editShape.fontSize * (editShape.lineHeight || 1.2) * zoom;
            return {
              left: panX + editShape.x * zoom,
              top: panY + editShape.y * zoom,
              fontFamily: `${editShape.fontFamily}, serif`,
              fontSize: editShape.fontSize * zoom,
              fontWeight: editShape.fontWeight,
              fontStyle: editShape.italic ? 'italic' : 'normal',
              textDecoration: editShape.underline ? 'underline' : 'none',
              letterSpacing: editShape.letterSpacing * zoom,
              lineHeight: `${lh}px`,
              textAlign: editShape.align,
              color: editShape.fill ?? '#1c1c1c',
              whiteSpace: editShape.frameW > 0 ? 'pre-wrap' : 'pre',
              width: editShape.frameW > 0 ? editShape.frameW * zoom : Math.max(120, lay.width * zoom + 60),
              height: Math.max(lh, lay.height * zoom) + lh,
            } as React.CSSProperties;
          })()}
        />
      )}
    </div>
  );
}
