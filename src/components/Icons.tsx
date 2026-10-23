import type { ReactNode } from 'react';

export const Eye = ({ off }: { off?: boolean }) => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
    <circle cx="8" cy="8" r="1.8" />
    {off && <path d="M3 13L13 3" />}
  </svg>
);

export const Lock = ({ on }: { on?: boolean }) => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <rect x="3.5" y="7" width="9" height="6.5" />
    {on ? <path d="M5.5 7V5a2.5 2.5 0 015 0v2" /> : <path d="M5.5 7V5a2.5 2.5 0 014.6-1.3" />}
  </svg>
);

export const Chevron = ({ open }: { open?: boolean }) => (
  <svg viewBox="0 0 10 10" width="9" height="9" fill="currentColor" style={{ transform: open ? 'rotate(90deg)' : undefined }}>
    <path d="M3 1.5l4.5 3.5L3 8.5z" />
  </svg>
);

export const Trash = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />
  </svg>
);

export const Duplicate = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3">
    <rect x="2.5" y="5.5" width="8" height="8" />
    <path d="M5.5 5.5v-3h8v8h-3" />
  </svg>
);

export const SwapArrows = () => (
  <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4.5V2h2.5M2 2l3 3M10 7.5V10H7.5M10 10L7 7" />
  </svg>
);

export const Logo = () => (
  <svg viewBox="0 0 32 32" width="18" height="18">
    <rect width="32" height="32" rx="6" fill="#0e3b38" />
    <path d="M7 22C10 8 18 8 25 10" fill="none" stroke="#2fd3bd" strokeWidth="2.4" strokeLinecap="round" />
    <rect x="5" y="20" width="4" height="4" fill="#fff" />
    <rect x="23" y="8" width="4" height="4" fill="#fff" />
  </svg>
);

const ui = (children: ReactNode, size = 18) => (
  <svg viewBox="0 0 18 18" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const I: Record<string, React.ReactNode> = {
  vector: ui(<><path d="M3 14C5 5 12 4 15 6" /><rect x="1.5" y="12.5" width="3" height="3" fill="currentColor" /><rect x="13.5" y="4.5" width="3" height="3" fill="currentColor" /></>, 14),
  layout: ui(<><rect x="2.5" y="2.5" width="13" height="13" /><path d="M2.5 6.5h13M7 6.5v9" /></>, 14),
  pixel: ui(<><rect x="2.5" y="2.5" width="5" height="5" fill="currentColor" stroke="none" /><rect x="10.5" y="2.5" width="5" height="5" /><rect x="2.5" y="10.5" width="5" height="5" /><rect x="10.5" y="10.5" width="5" height="5" fill="currentColor" stroke="none" /></>, 14),
  retouch: ui(<><circle cx="9" cy="9" r="5.500" /><path d="M9 5.500v7M5.500 9h7" opacity=".6" /></>, 14),
  colour: ui(<><path d="M9 2.500l5 6.500a5 5 0 11-10 0z" /></>, 14),
  composite: ui(<><rect x="2.500" y="2.500" width="8" height="8" /><rect x="7.500" y="7.500" width="8" height="8" opacity=".7" /></>, 14),
  code: ui(<path d="M6.5 5L2.5 9l4 4M11.5 5l4 4-4 4M10.5 3.5l-3 11" />, 14),
  typo: ui(<path d="M3.5 4.5h11M9 4.5v10M6.5 14.5h5" />, 14),
  draw: ui(<path d="M3 15l1-3.5L12.5 3 15 5.5 6.5 14z M11 4.5l2.5 2.5" />, 14),
  more: ui(<g fill="currentColor" stroke="none"><circle cx="9" cy="4" r="1.3" /><circle cx="9" cy="9" r="1.3" /><circle cx="9" cy="14" r="1.3" /></g>),
  front: ui(<><rect x="2.5" y="2.5" width="8" height="8" opacity=".55" /><rect x="7.5" y="7.5" width="8" height="8" fill="currentColor" /></>),
  forward: ui(<><rect x="2.5" y="2.5" width="8" height="8" opacity=".55" /><rect x="7.5" y="7.5" width="8" height="8" /><path d="M11.5 9.5v4M9.5 11.5h4" /></>),
  backward: ui(<><rect x="7.5" y="7.5" width="8" height="8" opacity=".55" /><rect x="2.5" y="2.5" width="8" height="8" /><path d="M4.5 6.5h4" /></>),
  back: ui(<><rect x="7.5" y="7.5" width="8" height="8" fill="currentColor" opacity=".55" /><rect x="2.5" y="2.5" width="8" height="8" fill="currentColor" /></>),
  flipH: ui(<><path d="M9 2v14" strokeDasharray="1.5 1.5" /><path d="M7 4L2.5 13H7zM11 4l4.5 9H11z" /></>),
  flipV: ui(<><path d="M2 9h14" strokeDasharray="1.5 1.5" /><path d="M4 7L13 2.5V7zM4 11l9 4.5V11z" /></>),
  alignL: ui(<><path d="M2.5 2v14" /><rect x="4.5" y="4" width="10" height="3.5" /><rect x="4.5" y="10.5" width="6" height="3.5" /></>),
  alignC: ui(<><path d="M9 2v14" /><rect x="3.5" y="4" width="11" height="3.5" /><rect x="5.5" y="10.5" width="7" height="3.5" /></>),
  alignR: ui(<><path d="M15.5 2v14" /><rect x="3.5" y="4" width="10" height="3.5" /><rect x="7.5" y="10.5" width="6" height="3.5" /></>),
  alignT: ui(<><path d="M2 2.5h14" /><rect x="4" y="4.5" width="3.5" height="10" /><rect x="10.5" y="4.5" width="3.5" height="6" /></>),
  alignM: ui(<><path d="M2 9h14" /><rect x="4" y="3.5" width="3.5" height="11" /><rect x="10.5" y="5.5" width="3.5" height="7" /></>),
  alignB: ui(<><path d="M2 15.5h14" /><rect x="4" y="3.5" width="3.5" height="10" /><rect x="10.5" y="7.5" width="3.5" height="6" /></>),
  grid: ui(<><rect x="2.5" y="2.5" width="13" height="13" /><path d="M7 2.5v13M11 2.5v13M2.5 7h13M2.5 11h13" /></>),
  magnet: ui(<path d="M4 3v6a5 5 0 0010 0V3h-3v6a2 2 0 01-4 0V3zM4 6h3M11 6h3" />),
  undo: ui(<path d="M6 4L3 7l3 3M3 7h7.5a4.5 4.5 0 010 9H8" />),
  redo: ui(<path d="M12 4l3 3-3 3M15 7H7.5a4.5 4.5 0 000 9H10" />),
  help: ui(<><circle cx="9" cy="9" r="7" /><path d="M7 7.2a2 2 0 113 1.7c-.7.4-1 .8-1 1.6M9 12.8v.2" /></>),
  gear: ui(<><circle cx="9" cy="9" r="2.3" /><path d="M9 1.8v2M9 14.2v2M1.8 9h2M14.2 9h2M3.9 3.9l1.4 1.4M12.7 12.7l1.4 1.4M3.9 14.1l1.4-1.4M12.7 5.3l1.4-1.4" /></>),
  caret: ui(<path d="M5 7l4 4 4-4" />, 12),
  close: ui(<path d="M5 5l8 8M13 5l-8 8" />, 12),
  plusRect: ui(<><rect x="2.5" y="2.5" width="13" height="13" /><path d="M9 6v6M6 9h6" /></>, 16),
};

I.union = ui(<path d="M3 3h8v4h4v8H7v-4H3z" />);
I.subtract = ui(<><path d="M3 3h8v4H7v4H3z" /><path d="M7 7h8v8H7z" strokeDasharray="1.8 1.6" opacity=".6" /></>);
I.intersect = ui(<><path d="M3 3h8v8H3z" opacity=".5" /><path d="M7 7h8v8H7z" opacity=".5" /><path d="M7 7h4v4H7z" fill="currentColor" /></>);
I.xor = ui(<><path d="M3 3h8v4H7v4H3z" /><path d="M15 15H7v-4h4V7h4z" /></>);
I.group = ui(<><rect x="2.5" y="2.5" width="13" height="13" strokeDasharray="2 1.6" /><rect x="5" y="5" width="4" height="4" /><rect x="9" y="9" width="4" height="4" /></>);
I.ungroup = ui(<><rect x="2.5" y="2.5" width="5.5" height="5.5" /><rect x="10" y="10" width="5.5" height="5.5" /></>);

const lf = (body: ReactNode) => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
    {body}
  </svg>
);

/** Icons for the row under the Layers list. */
export const LayerIcons = {
  pixel: lf(<><rect x="2.5" y="2.5" width="11" height="11" /><path d="M2.5 8h11M8 2.5v11" /><path d="M2.5 2.5h5.5v5.5H2.5zM8 8h5.5v5.5H8z" fill="currentColor" stroke="none" /></>),
  adjust: lf(<><circle cx="8" cy="8" r="5.5" /><path d="M8 2.5a5.5 5.5 0 010 11z" fill="currentColor" stroke="none" /></>),
  mask: lf(<><rect x="2.5" y="2.5" width="11" height="11" rx="1" /><circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" /></>),
  release: lf(<><rect x="2.5" y="2.5" width="11" height="11" rx="1" /><circle cx="8" cy="8" r="3" /><path d="M11 5l3-3" /></>),
};
