import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useBackDismiss } from '../lib/backDismiss';

/** Drag a sheet's top area down to dismiss it, like a native bottom sheet. */
export function useSwipeToClose(close: () => void) {
  const [dy, setDy] = useState(0);
  const start = useRef<number | null>(null);
  return {
    dy,
    style: dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined,
    handlers: {
      onPointerDown: (e: ReactPointerEvent) => {
        if (e.pointerType === 'mouse') return;
        start.current = e.clientY;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      },
      onPointerMove: (e: ReactPointerEvent) => start.current !== null && setDy(Math.max(0, e.clientY - start.current)),
      onPointerUp: () => {
        if (start.current === null) return;
        start.current = null;
        if (dy > 110) close();
        else setDy(0);
      },
      onPointerCancel: () => {
        start.current = null;
        setDy(0);
      },
    },
  };
}

/** In-app replacement for native <select> pop-ups: a bottom sheet on phones, a centred panel on desktop. */
export function Picker({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const swipe = useSwipeToClose(onClose);
  useBackDismiss(onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        style={swipe.style}
        className="pb-safe absolute inset-x-0 bottom-0 flex max-h-[85dvh] animate-sheet-up flex-col rounded-t-[1.75rem] bg-bg shadow-2xl transition-transform duration-200 md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[420px] md:-translate-x-1/2 md:-translate-y-1/2 md:animate-fade-in md:rounded-[1.75rem]"
      >
        <div {...swipe.handlers} className="touch-none px-5 pt-2.5 pb-2 select-none">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line md:hidden" aria-hidden />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-sunken text-ink-2">
              ✕
            </button>
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pt-1 pb-5">{children}</div>
      </div>
    </div>
  );
}

/** A tappable option row with a check mark, for single-choice lists. */
export function OptionRow({ selected, title, detail, onClick, leading }: { selected: boolean; title: string; detail?: string; onClick: () => void; leading?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${selected ? 'bg-accent/10' : 'hover:bg-sunken'}`}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className={`block ${selected ? 'font-semibold text-accent' : 'font-medium'}`}>{title}</span>
        {detail && <span className="block text-xs text-muted">{detail}</span>}
      </span>
      <span className={`grid size-6 shrink-0 place-items-center rounded-full text-sm ${selected ? 'bg-accent text-on-accent' : 'border border-line'}`} aria-hidden>
        {selected ? '✓' : ''}
      </span>
    </button>
  );
}
