import { useState } from 'react';
import type { Summary } from '../lib/api';
import { dayLabel, rupeesWhole } from '../lib/format';

/** Spend per day of the month; hover or tap a bar for the exact figure. */
export function DailyBars({ summary }: { summary: Summary }) {
  const [hover, setHover] = useState<number | null>(null);
  const [y, m] = summary.month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const byDay = new Map(summary.byDay.map((d) => [Number(d.day.slice(8, 10)), d.total]));
  const values = Array.from({ length: days }, (_, i) => Math.max(0, byDay.get(i + 1) ?? 0));
  const max = Math.max(...values, 1);
  const H = 64;
  const gap = 2;
  const w = 100 / days;

  const active = hover ?? null;
  const day = active !== null ? `${summary.month}-${String(active + 1).padStart(2, '0')}` : null;

  return (
    <div>
      <div className="mb-1 flex h-5 items-baseline justify-between text-xs text-muted">
        <span>Daily spend</span>
        {day && (
          <span className="text-ink">
            {dayLabel(day)} · <span className="font-medium">{rupeesWhole(values[active!])}</span>
          </span>
        )}
      </div>
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="h-16 w-full" onMouseLeave={() => setHover(null)} role="img" aria-label="Daily spend this month">
        {values.map((v, i) => {
          const h = v > 0 ? Math.max(2, (v / max) * (H - 2)) : 0;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onClick={() => setHover(hover === i ? null : i)}>
              <rect x={i * w} y={0} width={w} height={H} fill="transparent" />
              {h > 0 && (
                <rect
                  x={i * w + gap / 10}
                  y={H - h}
                  width={Math.max(0.4, w - gap / 5)}
                  height={h}
                  rx={0.6}
                  className={hover === null || hover === i ? 'fill-accent' : 'fill-accent opacity-40'}
                />
              )}
              <rect x={i * w} y={H - 0.5} width={w} height={0.5} className="fill-line" />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>1</span>
        <span>{Math.ceil(days / 2)}</span>
        <span>{days}</span>
      </div>
    </div>
  );
}
