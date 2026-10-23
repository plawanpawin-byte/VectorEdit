import type { ReactNode } from 'react';
import type { Tool } from '../types';

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const toolIcons: Record<Tool, ReactNode> = {
  select: svg(<path d="M5 3l10 7.2-4.4 1 2.6 4.8-2 1.1-2.6-4.8L5 15.6z" fill="currentColor" stroke="none" />),
  direct: svg(<path d="M5 3l10 7.2-4.4 1 2.6 4.8-2 1.1-2.6-4.8L5 15.6z" />),
  pen: svg(
    <>
      <path d="M10 2.5l5.2 6.6-2.4 4.4H7.2L4.8 9.1z" />
      <path d="M10 8.4v5.1M7.2 13.5L6 17.5h8l-1.2-4" />
      <circle cx="10" cy="8" r="1" fill="currentColor" />
    </>,
  ),
  rect: svg(<rect x="3.5" y="5" width="13" height="10" />),
  ellipse: svg(<ellipse cx="10" cy="10" rx="6.5" ry="5.2" />),
  line: svg(<path d="M4 16L16 4" />),
  text: svg(<path d="M4.5 5.5V4h11v1.5M10 4v12M8 16h4" />),
  hand: svg(
    <path d="M7 10V5.2a1.1 1.1 0 012.2 0V9m0-4.3a1.1 1.1 0 012.2 0V9m0-3a1.1 1.1 0 012.2 0v4.6c0 3-1.7 5-4.3 5-2 0-3.1-.9-4.3-2.7L3.8 11a1.1 1.1 0 011.8-1.2L7 11.5" />,
  ),
  zoom: svg(
    <>
      <circle cx="8.5" cy="8.5" r="4.8" />
      <path d="M12.2 12.2L16.5 16.5M6.4 8.5h4.2M8.5 6.4v4.2" />
    </>,
  ),
};

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
