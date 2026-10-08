import { currentMonth, monthLabel, shiftMonth } from '../lib/format';

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const atCurrent = month >= currentMonth();
  const btn = 'grid size-10 place-items-center rounded-full text-ink-2 hover:bg-sunken disabled:opacity-30';
  return (
    <div className="flex items-center justify-between">
      <button className={btn} onClick={() => onChange(shiftMonth(month, -1))} aria-label="Previous month">
        ‹
      </button>
      <button className="text-base font-medium" onClick={() => onChange(currentMonth())} title="Jump to this month">
        {monthLabel(month)}
      </button>
      <button className={btn} onClick={() => onChange(shiftMonth(month, 1))} disabled={atCurrent} aria-label="Next month">
        ›
      </button>
    </div>
  );
}
