import { useEffect, useRef } from 'react';

let afterClose: (() => void) | null = null;

/**
 * Run `fn` once the open sheet has closed and its history entry is gone. A URL change made while the
 * sheet's entry is still on top would be undone when that entry is popped.
 */
export function afterSheetCloses(fn: () => void) {
  afterClose = fn;
}

/**
 * While a sheet is mounted, the hardware/gesture Back closes it instead of leaving the page: opening pushes a
 * history entry, Back pops it and calls `onDismiss`, and closing any other way removes the entry again.
 */
export function useBackDismiss(onDismiss: () => void) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    const id = `${Date.now()}-${Math.random()}`;
    history.pushState({ ...(history.state ?? {}), sheetId: id }, '');
    const onPop = () => dismiss.current();
    addEventListener('popstate', onPop);

    return () => {
      removeEventListener('popstate', onPop);
      const run = () => {
        const fn = afterClose;
        afterClose = null;
        fn?.();
      };
      if (history.state?.sheetId === id) {
        addEventListener('popstate', run, { once: true });
        history.back();
      } else {
        run();
      }
    };
  }, []);
}
