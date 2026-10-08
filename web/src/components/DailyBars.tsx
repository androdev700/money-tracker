import { useRef } from 'react';
import type { Summary } from '../lib/api';
import { rupeesShort } from '../lib/format';

const niceCeil = (v: number) => {
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};

/** Spend per day of the month, Health-style. Hover, tap or arrow keys select a day; the parent shows its value. */
export function DailyBars({ summary, selected, onSelect }: { summary: Summary; selected: number | null; onSelect: (day: number | null) => void }) {
  const plot = useRef<HTMLDivElement>(null);
  const pointer = useRef('mouse');
  const [y, m] = summary.month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const byDay = new Map(summary.byDay.map((d) => [Number(d.day.slice(8, 10)), d.total]));
  const values = Array.from({ length: days }, (_, i) => Math.max(0, byDay.get(i + 1) ?? 0));
  const top = niceCeil(Math.max(...values, 100_00));

  const dayAt = (clientX: number) => {
    const r = plot.current!.getBoundingClientRect();
    return Math.min(days - 1, Math.max(0, Math.floor(((clientX - r.left) / r.width) * days)));
  };

  const ticks = [1, 8, 15, 22, 29].filter((d) => d <= days);

  return (
    <div
      role="group"
      aria-label="Daily spend. Use the arrow keys to read a day."
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const step = e.key === 'ArrowRight' ? 1 : -1;
          onSelect(selected === null ? (step > 0 ? 0 : days - 1) : Math.min(days - 1, Math.max(0, selected + step)));
        } else if (e.key === 'Escape') onSelect(null);
      }}
      className="rounded-lg select-none"
    >
      <div className="flex">
        <div
          ref={plot}
          className="relative h-32 min-w-0 flex-1 touch-pan-y"
          onPointerDown={(e) => (pointer.current = e.pointerType)}
          onPointerMove={(e) => e.pointerType === 'mouse' && onSelect(dayAt(e.clientX))}
          onPointerLeave={(e) => e.pointerType === 'mouse' && onSelect(null)}
          onClick={(e) => {
            const d = dayAt(e.clientX);
            onSelect(selected === d && pointer.current !== 'mouse' ? null : d);
          }}
        >
          {[0, 0.5, 1].map((f) => (
            <span key={f} className={`absolute inset-x-0 h-0 border-t ${f === 0 ? 'border-separator' : 'border-dashed border-separator/60'}`} style={{ bottom: `${f * 100}%` }} />
          ))}
          <div className="absolute inset-0 grid items-end" style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}>
            {values.map((v, i) => (
              <div key={i} className="flex h-full items-end justify-center px-[12%]">
                {v > 0 && (
                  <div
                    className={`w-full max-w-4 rounded-t-[0.1875rem] rounded-b-[0.0625rem] bg-accent transition-opacity duration-150 ${selected === null || selected === i ? '' : 'opacity-35'}`}
                    style={{ height: `max(0.1875rem, ${(v / top) * 100}%)` }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="relative w-10 shrink-0 text-caption2 text-label-2" aria-hidden>
          <span className="absolute top-0 right-0 -translate-y-1/2">{rupeesShort(top)}</span>
          <span className="absolute top-1/2 right-0 -translate-y-1/2">{rupeesShort(top / 2)}</span>
          <span className="absolute bottom-0 right-0 translate-y-1/2">0</span>
        </div>
      </div>
      <div className="relative mr-10 h-5 text-caption2 text-label-2" aria-hidden>
        {ticks.map((d) => (
          <span key={d} className="absolute top-1.5 -translate-x-1/2" style={{ left: `${((d - 0.5) / days) * 100}%` }}>
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}
