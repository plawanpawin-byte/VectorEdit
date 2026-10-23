import type { ReactNode } from 'react';
import { activateTool, toolDef } from '../tools/registry';
import { useStore } from '../store';
import type { Tool } from '../types';

/**
 * The small floating palette Pixel shows beside the canvas: pick, mesh warp, perspective and push
 * warp. Each button drives the same tool as its entry in the Warp group, so the palette only adds
 * a quick way to reach them.
 */
const PALETTE: { tool: Tool; label: string; icon: ReactNode }[] = [
  { tool: 'select', label: 'Select', icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M5 3l10 6.5-4.5 1.2 2.6 5.1-2 1L8.6 11.8 5.5 14.5z" /></svg> },
  {
    tool: 'warp',
    label: 'Mesh warp',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M3 4h14M3 8h14M3 12h14M3 16h14M4 3v14M8 3v14M12 3v14M16 3v14" />
      </svg>
    ),
  },
  {
    tool: 'perspective',
    label: 'Perspective warp',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M5 3.5l10-1 1.5 15-11-1z" /><path d="M5 7.5h9.5M5.5 11.5h10M6 15.5h10M9 3.2l-.3 13.2M12.5 2.8l.2 13.6" />
      </svg>
    ),
  },
  {
    tool: 'pushwarp',
    label: 'Liquify push',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M5 9c0-3.2 2.7-5 5.6-5 3 0 4.4 2 4.4 4.2 0 2.6-2.3 3.2-2.3 5.2 0 1.6-1.6 2.6-3.6 2.6S5 14.4 5 11.4z" />
      </svg>
    ),
  },
];

export function FloatingTools() {
  const workspace = useStore((s) => s.workspace);
  const tool = useStore((s) => s.tool);
  if (workspace !== 'pixel') return null;
  return (
    <div className="float-tools" role="toolbar" aria-label="Warp tools">
      <span className="float-grip" />
      {PALETTE.map((p) =>
        toolDef(p.tool) ? (
          <button key={p.tool} className={tool === p.tool ? 'on' : ''} title={p.label} onClick={() => activateTool(p.tool)}>
            {p.icon}
          </button>
        ) : null,
      )}
    </div>
  );
}
