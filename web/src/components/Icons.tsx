import { useId, type ReactNode } from 'react';

/** SF Symbols–style line glyphs on a 24px grid: 1.75 stroke, round caps and joins. */
const GLYPHS = {
  plus: <path d="M12 5v14M5 12h14" />,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  chevronUpDown: <path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L20 20" />
    </>
  ),
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  tray: (
    <>
      <path d="M3 13l2.4-6.9A2 2 0 0 1 7.3 4.8h9.4a2 2 0 0 1 1.9 1.3L21 13v4.7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 13h5.2l1.3 2.4h5l1.3-2.4H21" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.3l2.8 2.7L16 9.5" />
    </>
  ),
  // Category glyphs
  food: <path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17.5 21V3c-2.2 1.2-3.5 3.6-3.5 7v3.5h3.5" />,
  cart: (
    <>
      <path d="M2.5 3.5h2.2l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.2L21 7.5H5.6" />
      <circle cx="9" cy="20" r="1.2" />
      <circle cx="17.5" cy="20" r="1.2" />
    </>
  ),
  home: (
    <>
      <path d="M3.5 10.5L12 3.5l8.5 7" />
      <path d="M5.5 9v10a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V9" />
      <path d="M10 20.5v-5.5h4v5.5" />
    </>
  ),
  car: (
    <>
      <path d="M5 16.5H3.5v-4.2c0-.5.2-1 .5-1.4L6.2 6.6A2 2 0 0 1 8 5.5h8a2 2 0 0 1 1.8 1.1l2.2 4.3c.3.4.5.9.5 1.4v4.2H19" />
      <path d="M9 16.5h6M4 11h16" />
      <circle cx="7" cy="16.5" r="2" />
      <circle cx="17" cy="16.5" r="2" />
    </>
  ),
  fuel: (
    <>
      <path d="M4.5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h6.5A1.5 1.5 0 0 1 14 5v15.5M3 20.5h12.5M4.5 10h9.5" />
      <path d="M14 12.5h1.5a1.5 1.5 0 0 1 1.5 1.5v2.5a1.5 1.5 0 0 0 3 0V8.5L17.5 6" />
    </>
  ),
  bag: (
    <>
      <path d="M5 7.5h14l-1 12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19.5z" />
      <path d="M9 10V6.5a3 3 0 0 1 6 0V10" />
    </>
  ),
  pill: (
    <>
      <path d="M10.4 20.1a4.5 4.5 0 0 1-6.4-6.4l9.7-9.7a4.5 4.5 0 0 1 6.4 6.4z" />
      <path d="M8.8 8.9l6.3 6.3" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  mug: (
    <>
      <path d="M5 7.5h10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM15 10h1.5a2.5 2.5 0 0 1 0 5H15" />
      <path d="M5 7.5a2.5 2.5 0 0 1 2.4-3 3 3 0 0 1 5.2 0 2.5 2.5 0 0 1 2.4 3M8.5 11v6M11.5 11v6" />
    </>
  ),
  wine: <path d="M8 21h8M12 15v6M7.5 3h9l.5 5a5 5 0 0 1-10 0z" />,
  question: (
    <>
      <path d="M9 9a3 3 0 1 1 4.3 2.7c-.8.4-1.3 1.1-1.3 2v.8" />
      <path d="M12 18.5h.01" />
    </>
  ),
  transfer: <path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4" />,
} satisfies Record<string, ReactNode>;

export type GlyphName = keyof typeof GLYPHS;

export function Glyph({ name, className = 'size-6', strokeWidth = 1.75 }: { name: GlyphName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {GLYPHS[name]}
    </svg>
  );
}

/** Tab bar symbols: a line variant, and a filled variant for the selected tab (knock-outs via a mask). */
const GEAR = (() => {
  const pts: string[] = [];
  const teeth = 8;
  const half = (Math.PI / teeth) * 0.55;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * 2 * Math.PI;
    for (const [r, da] of [[7.6, -half * 1.3], [9.7, -half * 0.75], [9.7, half * 0.75], [7.6, half * 1.3]]) {
      pts.push(`${(12 + r * Math.cos(a + da)).toFixed(2)} ${(12 + r * Math.sin(a + da)).toFixed(2)}`);
    }
  }
  return `M${pts.join('L')}Z`;
})();

export type TabSymbol = 'month' | 'list' | 'review' | 'settings';

export function TabIcon({ name, filled, className = 'size-[1.625rem]' }: { name: TabSymbol; filled: boolean; className?: string }) {
  const id = `tab-${useId().replace(/[^\w-]/g, '')}`;
  const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  const knock = { fill: 'none', stroke: 'black', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

  let shape: ReactNode;
  let cut: ReactNode = null;
  switch (name) {
    case 'month':
      shape = (
        <>
          <rect x="3.5" y="12" width="4.5" height="8.5" rx="1.4" />
          <rect x="9.75" y="3.5" width="4.5" height="17" rx="1.4" />
          <rect x="16" y="8" width="4.5" height="12.5" rx="1.4" />
        </>
      );
      break;
    case 'list':
      shape = <rect x="3" y="4" width="18" height="16" rx="3.5" />;
      cut = <path d="M10 9h7M10 12h7M10 15h7M7 9h.01M7 12h.01M7 15h.01" />;
      break;
    case 'review':
      shape = <path d="M3 13l2.4-6.9A2 2 0 0 1 7.3 4.8h9.4a2 2 0 0 1 1.9 1.3L21 13v4.7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />;
      cut = <path d="M3 13h5.2l1.3 2.4h5l1.3-2.4H21" />;
      break;
    case 'settings':
      shape = <path d={GEAR} />;
      cut = <circle cx="12" cy="12" r="2.8" />;
      break;
  }

  if (!filled) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <g {...line}>
          {shape}
          {cut}
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <mask id={id}>
        <rect width="24" height="24" fill="white" />
        <g {...knock}>{cut}</g>
      </mask>
      <g fill="currentColor" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" mask={`url(#${id})`}>
        {shape}
      </g>
    </svg>
  );
}
