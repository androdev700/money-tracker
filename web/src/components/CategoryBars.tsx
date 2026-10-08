import type { Summary } from '../lib/api';
import { capitalise, rupees, rupeesWhole } from '../lib/format';
import { CategoryTile, useCategoryMap } from './CategoryTile';

/** One series (spend) across categories: Screen Time–style rows, one accent hue, sorted, direct-labelled. */
export function CategoryBars({ summary, selected, onSelect }: { summary: Summary; selected: number | 'none' | null; onSelect: (id: number | 'none' | null) => void }) {
  const categories = useCategoryMap();
  const rows = summary.byCategory.filter((c) => c.total > 0);
  const max = Math.max(...rows.map((r) => r.total), 1);
  const positive = rows.reduce((s, r) => s + r.total, 0) || 1;

  if (!rows.length) return <p className="px-4 py-6 text-center text-subhead text-label-2">No spends yet</p>;

  return (
    <div>
      {rows.map((r) => {
        const id = r.category_id ?? 'none';
        const active = selected === id;
        const dimmed = selected !== null && !active;
        const name = capitalise(r.name) || 'Uncategorised';
        return (
          <button
            key={String(id)}
            onClick={() => onSelect(active ? null : id)}
            aria-pressed={active}
            title={`${name}: ${rupees(r.total)} · ${r.count} transaction${r.count === 1 ? '' : 's'}`}
            className={`cell tap ${active ? 'bg-fill' : ''}`}
          >
            <span className={`transition-opacity ${dimmed ? 'opacity-40' : ''}`}>
              <CategoryTile icon={r.icon} color={r.category_id === null ? null : categories.get(r.category_id)?.color} />
            </span>
            <span className={`cell-body flex-col items-stretch gap-1.5 transition-opacity ${dimmed ? 'opacity-40' : ''}`}>
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate">{name}</span>
                <span className="shrink-0 text-footnote text-label-2">{Math.round((r.total / positive) * 100)}%</span>
                <span className="ml-auto shrink-0">{rupeesWhole(r.total)}</span>
              </span>
              <span className="block h-1.5 rounded-full bg-accent" style={{ width: `max(0.375rem, ${(r.total / max) * 100}%)` }} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
