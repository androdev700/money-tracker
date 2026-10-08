import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../lib/store';
import { Glyph } from './Icons';

/**
 * iOS navigation bar with a large title. The bar is clear until the large title scrolls under it,
 * then it turns to material and shows the title inline.
 */
export function PageHeader({ title, inlineTitle, eyebrow, accessory, onTitleClick, titleHint, add = true, wide = false }: {
  title: string;
  inlineTitle?: string;
  eyebrow?: ReactNode;
  accessory?: ReactNode;
  onTitleClick?: () => void;
  titleHint?: string;
  add?: boolean;
  wide?: boolean;
}) {
  const { openEditor } = useStore();
  const bar = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!bar.current || !heading.current) return;
    const io = new IntersectionObserver(([e]) => setCollapsed(!e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 0) + 1), {
      rootMargin: `-${bar.current.offsetHeight}px 0px 0px 0px`,
    });
    io.observe(heading.current);
    return () => io.disconnect();
  }, []);

  const width = wide ? 'max-w-[64rem]' : 'max-w-[42rem]';

  return (
    <>
      <div
        ref={bar}
        className={`bleed sticky top-0 z-20 pt-[env(safe-area-inset-top)] transition-[background-color,backdrop-filter,box-shadow] duration-200 ${collapsed ? 'material hairline-b' : ''}`}
      >
        <div className={`mx-auto grid h-11 grid-cols-[minmax(2.75rem,1fr)_minmax(0,auto)_minmax(2.75rem,1fr)] items-center ${width}`}>
          <span />
          <span className={`truncate text-headline transition-opacity duration-200 ${collapsed ? 'opacity-100' : 'opacity-0'}`} aria-hidden>
            {inlineTitle ?? title}
          </span>
          <span className="flex justify-end">
            {add && (
              <button onClick={() => openEditor({})} aria-label="Add spend" title="Add spend" className="-mr-2.5 grid size-11 place-items-center rounded-full text-accent-text">
                <Glyph name="plus" className="size-[1.4rem]" strokeWidth={2} />
              </button>
            )}
          </span>
        </div>
      </div>
      <div className={`mx-auto flex items-end justify-between gap-3 pb-2 ${width}`}>
        <div className="min-w-0">
          {eyebrow && <p className="text-footnote font-semibold text-label-2 uppercase">{eyebrow}</p>}
          <h1 ref={heading} className="truncate text-large font-bold tracking-[0.01em]">
            {onTitleClick ? (
              <button onClick={onTitleClick} title={titleHint} className="max-w-full truncate text-left">
                {title}
              </button>
            ) : (
              title
            )}
          </h1>
        </div>
        {accessory}
      </div>
    </>
  );
}
