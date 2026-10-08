import { currentMonth, shiftMonth } from '../lib/format';
import { Glyph } from './Icons';

/** Previous/next month buttons that sit beside the large title. */
export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const atCurrent = month >= currentMonth();
  const btn = 'tap grid size-11 place-items-center rounded-full text-accent-text disabled:text-label-3';
  return (
    <div className="-mr-2.5 flex shrink-0 items-center pb-0.5">
      <button className={btn} onClick={() => onChange(shiftMonth(month, -1))} aria-label="Previous month">
        <Glyph name="chevronLeft" className="size-[1.375rem]" strokeWidth={2.25} />
      </button>
      <button className={btn} onClick={() => onChange(shiftMonth(month, 1))} disabled={atCurrent} aria-label="Next month">
        <Glyph name="chevronRight" className="size-[1.375rem]" strokeWidth={2.25} />
      </button>
    </div>
  );
}
