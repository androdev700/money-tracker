import type { Summary } from '../lib/api';
import { capitalise, rupees, rupeesWhole } from '../lib/format';
import { Tile } from './Tile';

/** One series (spend) across categories: a single hue, sorted, every bar direct-labelled. */
export function CategoryBars({ summary, selected, onSelect }: { summary: Summary; selected: number | 'none' | null; onSelect: (id: number | 'none' | null) => void }) {
  const rows = summary.byCategory.filter((c) => c.total > 0);
  const max = Math.max(...rows.map((r) => r.total), 1);
  const positive = rows.reduce((s, r) => s + r.total, 0) || 1;

  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">No spends this month yet.</p>;

  return (
    <ul className="flex flex-col gap-1">
      {rows.map((r) => {
        const id = r.category_id ?? 'none';
        const active = selected === id;
        const dimmed = selected !== null && !active;
        return (
          <li key={String(id)}>
            <button
              onClick={() => onSelect(active ? null : id)}
              aria-pressed={active}
              className={`group w-full rounded-xl px-2 py-2 text-left transition hover:bg-sunken ${active ? 'bg-sunken' : ''} ${dimmed ? 'opacity-45' : ''}`}
              title={`${capitalise(r.name) || 'Uncategorised'}: ${rupees(r.total)} · ${r.count} transaction${r.count === 1 ? '' : 's'}`}
            >
              <div className="flex items-center gap-3">
                <Tile icon={r.icon} color={r.color} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-baseline gap-2 text-sm">
                    <span className="truncate font-medium">{capitalise(r.name) || 'Uncategorised'}</span>
                    <span className="text-xs text-muted">{Math.round((r.total / positive) * 100)}%</span>
                    <span className="ml-auto font-semibold">{rupeesWhole(r.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-sunken">
                    <div className="h-1.5 rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.max(2, (r.total / max) * 100)}%` }} />
                  </div>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
