import { useEffect, useRef, useState } from 'react';
import type { Box, Pt, Shape } from '../types';
import { bbox, boxesIntersect, hitTest, pathD, scaleAbout, translate, unionBox } from '../geometry';
import {
  commit,
  endLive,
  fitArtboard,
  getState,
  live,
  makeShape,
  penAdd,
  penDragLast,
  penDropLast,
  penFinish,
  setState,
  setTool,
  snapV,
  updateShape,
  useStore,
  zoomAt,
} from '../store';
import { ShapeEl } from './ShapeEl';

type XY = { x: number; y: number };

type Drag =
  | { k: 'pan'; sx: number; sy: number; px: number; py: number }
  | { k: 'move'; start: XY; orig: Map<string, Shape>; before: Shape[] }
  | { k: 'resize'; h: string; box: Box; orig: Map<string, Shape>; before: Shape[] }
  | { k: 'marquee'; start: XY; base: string[] }
  | { k: 'create'; kind: 'rect' | 'ellipse' | 'line'; start: XY; id: string; before: Shape[] }
  | { k: 'anchor'; id: string; i: number; part: 'p' | 'out' | 'in'; before: Shape[] }
  | { k: 'pen' };

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

const CURSORS: Record<string, string> = {
  select: 'default',
  direct: 'default',
  pen: 'crosshair',
  rect: 'crosshair',
  ellipse: 'crosshair',
  line: 'crosshair',
  text: 'text',
  hand: 'grab',
  zoom: 'zoom-in',
};

export function Canvas() {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const space = useRef(false);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [panning, setPanning] = useState(false);

  const shapes = useStore((s) => s.shapes);
  const selection = useStore((s) => s.selection);
  const tool = useStore((s) => s.tool);
  const zoom = useStore((s) => s.zoom);
  const panX = useStore((s) => s.panX);
  const panY = useStore((s) => s.panY);
  const artboard = useStore((s) => s.artboard);
  const grid = useStore((s) => s.grid);
  const pen = useStore((s) => s.pen);
  const penCursor = useStore((s) => (s.tool === 'pen' && s.pen ? s.cursor : null));
  const editingText = useStore((s) => s.editingText);
  const editShape = shapes.find((s) => s.id === editingText);
  const textRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    // focus after the click that created the text has finished moving focus
    if (!editingText) return;
    const id = requestAnimationFrame(() => {
      textRef.current?.focus();
      textRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [editingText]);

  // viewport size + initial fit
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

  // wheel: pan, ctrl/alt = zoom at cursor
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey || e.altKey) {
        zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - rect.left, e.clientY - rect.top);
      } else {
        const st = getState();
        setState({ panX: st.panX - (e.shiftKey ? e.deltaY : e.deltaX), panY: st.panY - (e.shiftKey ? 0 : e.deltaY) });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // space = temporary hand
  useEffect(() => {
    const typing = (e: KeyboardEvent) => /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName);
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !typing(e)) {
        space.current = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') space.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const toDoc = (e: { clientX: number; clientY: number }): XY => {
    const rect = ref.current!.getBoundingClientRect();
    const st = getState();
    return { x: (e.clientX - rect.left - st.panX) / st.zoom, y: (e.clientY - rect.top - st.panY) / st.zoom };
  };
  const toDocSnap = (e: { clientX: number; clientY: number }): XY => {
    const p = toDoc(e);
    return { x: snapV(p.x), y: snapV(p.y) };
  };

  const toScreen = (e: { clientX: number; clientY: number }): XY => {
    const rect = ref.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  function onDown(e: React.PointerEvent) {
    if (e.button === 2) return;
    const st = getState();
    const p = toDocSnap(e);
    const target = e.target as SVGElement;
    ref.current!.setPointerCapture(e.pointerId);

    if (e.button === 1 || space.current || st.tool === 'hand') {
      drag.current = { k: 'pan', sx: e.clientX, sy: e.clientY, px: st.panX, py: st.panY };
      setPanning(true);
      return;
    }

    const tol = 5 / st.zoom;

    if (st.tool === 'zoom') {
      const s = toScreen(e);
      zoomAt(e.altKey ? 1 / 1.5 : 1.5, s.x, s.y);
      return;
    }

    if (st.tool === 'pen') {
      const first = st.pen?.[0];
      if (first && st.pen!.length >= 2 && Math.hypot(p.x - first.x, p.y - first.y) <= 8 / st.zoom) {
        penFinish(true);
        return;
      }
      penAdd({ x: p.x, y: p.y, hx: 0, hy: 0 });
      drag.current = { k: 'pen' };
      return;
    }

    if (st.tool === 'text') {
      const before = st.shapes;
      const t = makeShape('text', { x: p.x, y: p.y - 12, text: '', fill: st.fill ?? '#1c1c1c' });
      live([...before, t], [t.id]);
      endLive(before);
      setTool('select');
      setState({ editingText: t.id });
      return;
    }

    if (st.tool === 'rect' || st.tool === 'ellipse' || st.tool === 'line') {
      const before = st.shapes;
      const shape =
        st.tool === 'line'
          ? makeShape('line', { pts: [{ x: p.x, y: p.y, hx: 0, hy: 0 }, { x: p.x, y: p.y, hx: 0, hy: 0 }] })
          : makeShape(st.tool, { x: p.x, y: p.y });
      live([...before, shape], [shape.id]);
      drag.current = { k: 'create', kind: st.tool, start: p, id: shape.id, before };
      return;
    }

    // select / direct ----------------------------------------------------
    const hAttr = target.getAttribute?.('data-h');
    if (hAttr) {
      const sel = st.shapes.filter((s) => st.selection.includes(s.id));
      const box = unionBox(sel.map(bbox));
      if (box) {
        drag.current = { k: 'resize', h: hAttr, box, orig: new Map(sel.map((s) => [s.id, s])), before: st.shapes };
        return;
      }
    }
    const aAttr = target.getAttribute?.('data-a');
    if (aAttr) {
      const [id, i, part] = aAttr.split(':');
      drag.current = { k: 'anchor', id, i: Number(i), part: part as 'p' | 'out' | 'in', before: st.shapes };
      return;
    }

    let hit: Shape | undefined;
    for (let i = st.shapes.length - 1; i >= 0; i--) {
      const s = st.shapes[i];
      if (!s.locked && hitTest(s, p.x, p.y, tol)) {
        hit = s;
        break;
      }
    }
    if (hit) {
      let sel = st.selection;
      if (e.shiftKey) sel = sel.includes(hit.id) ? sel.filter((i) => i !== hit!.id) : [...sel, hit.id];
      else if (!sel.includes(hit.id)) sel = [hit.id];
      setState({ selection: sel });
      const moving = st.shapes.filter((s) => sel.includes(s.id) && !s.locked);
      drag.current = { k: 'move', start: p, orig: new Map(moving.map((s) => [s.id, s])), before: st.shapes };
    } else {
      const base = e.shiftKey ? st.selection : [];
      setState({ selection: base });
      drag.current = { k: 'marquee', start: p, base };
      setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
    }
  }

  function onMove(e: React.PointerEvent) {
    const st = getState();
    const p = toDocSnap(e);
    setState({ cursor: { x: Math.round(p.x), y: Math.round(p.y) } });
    const d = drag.current;
    if (!d) return;

    if (d.k === 'pan') {
      setState({ panX: d.px + e.clientX - d.sx, panY: d.py + e.clientY - d.sy });
    } else if (d.k === 'pen') {
      const pts = st.pen;
      if (pts?.length) {
        const last = pts[pts.length - 1];
        const dx = p.x - last.x;
        const dy = p.y - last.y;
        if (Math.hypot(dx, dy) > 3 / st.zoom) penDragLast(dx, dy);
      }
    } else if (d.k === 'move') {
      let dx = p.x - d.start.x;
      let dy = p.y - d.start.y;
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      live(st.shapes.map((s) => (d.orig.has(s.id) ? translate(d.orig.get(s.id)!, dx, dy) : s)));
    } else if (d.k === 'resize') {
      const { box, h } = d;
      const dragX = h.includes('e') ? box.x + box.w : h.includes('w') ? box.x : null;
      const dragY = h.includes('s') ? box.y + box.h : h.includes('n') ? box.y : null;
      const ax = dragX === null ? box.x : dragX === box.x ? box.x + box.w : box.x;
      const ay = dragY === null ? box.y : dragY === box.y ? box.y + box.h : box.y;
      let sx = dragX === null || dragX === ax ? 1 : (p.x - ax) / (dragX - ax);
      let sy = dragY === null || dragY === ay ? 1 : (p.y - ay) / (dragY - ay);
      if (e.shiftKey && dragX !== null && dragY !== null) {
        const m = Math.max(Math.abs(sx), Math.abs(sy));
        sx = Math.sign(sx || 1) * m;
        sy = Math.sign(sy || 1) * m;
      }
      live(st.shapes.map((s) => (d.orig.has(s.id) ? scaleAbout(d.orig.get(s.id)!, sx, sy, ax, ay) : s)));
    } else if (d.k === 'create') {
      let x1 = p.x;
      let y1 = p.y;
      const { start } = d;
      if (e.shiftKey) {
        if (d.kind === 'line') {
          const ang = Math.round(Math.atan2(y1 - start.y, x1 - start.x) / (Math.PI / 4)) * (Math.PI / 4);
          const len = Math.hypot(x1 - start.x, y1 - start.y);
          x1 = start.x + Math.cos(ang) * len;
          y1 = start.y + Math.sin(ang) * len;
        } else {
          const m = Math.max(Math.abs(x1 - start.x), Math.abs(y1 - start.y));
          x1 = start.x + Math.sign(x1 - start.x || 1) * m;
          y1 = start.y + Math.sign(y1 - start.y || 1) * m;
        }
      }
      live(
        st.shapes.map((s) => {
          if (s.id !== d.id) return s;
          if (d.kind === 'line') return { ...s, pts: [s.pts[0], { x: x1, y: y1, hx: 0, hy: 0 }] };
          return { ...s, x: Math.min(start.x, x1), y: Math.min(start.y, y1), w: Math.abs(x1 - start.x), h: Math.abs(y1 - start.y) };
        }),
      );
    } else if (d.k === 'anchor') {
      live(
        st.shapes.map((s) => {
          if (s.id !== d.id) return s;
          const pts = s.pts.slice();
          const pt = pts[d.i];
          if (d.part === 'p') {
            const o = d.before.find((q) => q.id === d.id)!.pts[d.i];
            pts[d.i] = { ...pt, x: p.x, y: p.y, hx: o.hx, hy: o.hy };
          } else if (d.part === 'out') {
            pts[d.i] = { ...pt, hx: p.x - pt.x, hy: p.y - pt.y };
          } else {
            pts[d.i] = { ...pt, hx: pt.x - p.x, hy: pt.y - p.y };
          }
          return { ...s, pts };
        }),
      );
    } else if (d.k === 'marquee') {
      const box = {
        x: Math.min(d.start.x, p.x),
        y: Math.min(d.start.y, p.y),
        w: Math.abs(p.x - d.start.x),
        h: Math.abs(p.y - d.start.y),
      };
      setMarquee(box);
      const ids = st.shapes.filter((s) => s.visible && !s.locked && boxesIntersect(box, bbox(s))).map((s) => s.id);
      setState({ selection: Array.from(new Set([...d.base, ...ids])) });
    }
  }

  function onUp() {
    const d = drag.current;
    drag.current = null;
    setPanning(false);
    if (!d) return;
    const st = getState();
    if (d.k === 'move' || d.k === 'resize' || d.k === 'anchor') endLive(d.before);
    if (d.k === 'create') {
      const made = st.shapes.find((s) => s.id === d.id);
      const b = made ? bbox(made) : null;
      if (!made || !b || (b.w < 2 && b.h < 2)) {
        live(d.before, []);
      } else {
        endLive(d.before);
      }
    }
    if (d.k === 'marquee') setMarquee(null);
  }

  function onDouble(e: React.MouseEvent) {
    const st = getState();
    if (st.tool === 'pen' && st.pen) {
      // the double click already added a duplicate anchor
      penDropLast();
      penFinish(false);
    } else if (st.tool === 'select' || st.tool === 'direct') {
      const p = toDoc(e);
      const t = [...st.shapes].reverse().find((s) => s.kind === 'text' && hitTest(s, p.x, p.y, 4 / st.zoom));
      if (t) setState({ selection: [t.id], editingText: t.id });
    }
  }

  const k = 1 / zoom;
  const selShapes = shapes.filter((s) => selection.includes(s.id));
  const box = unionBox(selShapes.map(bbox));
  const showAnchors = tool === 'direct';

  return (
    <div
      ref={ref}
      className="canvas"
      style={{ cursor: panning ? 'grabbing' : space.current ? 'grab' : CURSORS[tool] }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onDoubleClick={onDouble}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg width="100%" height="100%" style={{ display: 'block' }}>
        <g transform={`translate(${panX} ${panY}) scale(${zoom})`}>
          <rect x={0} y={0} width={artboard.w} height={artboard.h} fill="#fff" stroke="#111" strokeWidth={k} filter="url(#shadow)" />
          {grid && <rect x={0} y={0} width={artboard.w} height={artboard.h} fill="url(#grid)" pointerEvents="none" />}
          <g>
            {shapes.map((s) => (s.id === editingText ? null : <ShapeEl key={s.id} shape={s} />))}
          </g>

          {/* selection chrome */}
          {selShapes.map((s) => {
            const b = bbox(s);
            return (
              <g key={s.id} pointerEvents="none">
                {s.kind === 'path' || s.kind === 'line' ? (
                  <path d={pathD(s)} fill="none" stroke="#2d8cf0" strokeWidth={1.5 * k} />
                ) : (
                  <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke="#2d8cf0" strokeWidth={1.5 * k} />
                )}
              </g>
            );
          })}
          {showAnchors &&
            selShapes
              .filter((s) => s.kind === 'path' || s.kind === 'line')
              .map((s) => (
                <g key={`a${s.id}`}>
                  {s.pts.map((pt, i) => (
                    <g key={i}>
                      {s.kind === 'path' && (pt.hx || pt.hy) ? (
                        <>
                          <path d={`M${pt.x - pt.hx} ${pt.y - pt.hy}L${pt.x + pt.hx} ${pt.y + pt.hy}`} stroke="#2d8cf0" strokeWidth={k} pointerEvents="none" />
                          {(['out', 'in'] as const).map((part) => (
                            <circle
                              key={part}
                              data-a={`${s.id}:${i}:${part}`}
                              cx={part === 'out' ? pt.x + pt.hx : pt.x - pt.hx}
                              cy={part === 'out' ? pt.y + pt.hy : pt.y - pt.hy}
                              r={3.5 * k}
                              fill="#fff"
                              stroke="#2d8cf0"
                              strokeWidth={k}
                              style={{ cursor: 'pointer' }}
                            />
                          ))}
                        </>
                      ) : null}
                      <rect
                        data-a={`${s.id}:${i}:p`}
                        x={pt.x - 3.5 * k}
                        y={pt.y - 3.5 * k}
                        width={7 * k}
                        height={7 * k}
                        fill="#2d8cf0"
                        stroke="#fff"
                        strokeWidth={k}
                        style={{ cursor: 'pointer' }}
                      />
                    </g>
                  ))}
                </g>
              ))}
          {!showAnchors && box && (
            <g>
              <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="none" stroke="#2d8cf0" strokeWidth={k} pointerEvents="none" />
              {tool === 'select' &&
                handleList(box).map(([h, hx, hy]) => (
                  <rect
                    key={h}
                    data-h={h}
                    x={hx - 3.5 * k}
                    y={hy - 3.5 * k}
                    width={7 * k}
                    height={7 * k}
                    fill="#fff"
                    stroke="#2d8cf0"
                    strokeWidth={k}
                    style={{ cursor: HANDLE_CURSOR[h] }}
                  />
                ))}
            </g>
          )}

          {/* pen draft */}
          {pen && pen.length > 0 && (
            <g pointerEvents="none">
              <path
                d={pathD({ ...makeShape('path'), pts: penCursor ? [...pen, { x: penCursor.x, y: penCursor.y, hx: 0, hy: 0 }] : pen })}
                fill="none"
                stroke="#2d8cf0"
                strokeWidth={1.5 * k}
              />
              {pen.map((pt: Pt, i) => (
                <rect key={i} x={pt.x - 3 * k} y={pt.y - 3 * k} width={6 * k} height={6 * k} fill={i === 0 ? '#fff' : '#2d8cf0'} stroke="#2d8cf0" strokeWidth={k} />
              ))}
            </g>
          )}

          {marquee && (
            <rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill="rgba(45,140,240,.12)" stroke="#2d8cf0" strokeWidth={k} strokeDasharray={`${4 * k} ${3 * k}`} pointerEvents="none" />
          )}
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
          style={{
            left: panX + editShape.x * zoom,
            top: panY + editShape.y * zoom,
            fontSize: editShape.fontSize * zoom,
            color: editShape.fill ?? '#1c1c1c',
            width: Math.max(120, (Math.max(4, ...editShape.text.split('\n').map((l) => l.length)) + 2) * editShape.fontSize * 0.58 * zoom),
            height: (editShape.text.split('\n').length * 1.2 + 0.3) * editShape.fontSize * zoom,
          }}
        />
      )}
    </div>
  );
}
