import { CategoryBars } from '../components/CategoryBars';
import { DailyBars } from '../components/DailyBars';
import { MonthSwitcher } from '../components/MonthSwitcher';
import { TxnList } from '../components/TxnList';
import type { Summary, Txn } from '../lib/api';
import { capitalise, currentMonth, rupeesWhole } from '../lib/format';
import { useApi, useStore } from '../lib/store';

function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 p-2" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton size-11 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-1/2" />
            <div className="skeleton h-2.5 w-1/3" />
          </div>
          <div className="skeleton h-3 w-14" />
        </div>
      ))}
    </div>
  );
}

export function MonthPage() {
  const { search, navigate } = useStore();
  const month = search.get('m') ?? currentMonth();
  const cat = search.get('c');
  const selected = cat === null ? null : cat === 'none' ? 'none' : Number(cat);

  const { data: summary } = useApi<Summary>(`/api/summary?month=${month}`);
  const { data: txns } = useApi<Txn[]>(`/api/transactions?month=${month}${cat ? `&category=${cat}` : ''}`);

  const go = (m: string, c: number | 'none' | null) => {
    const q = new URLSearchParams();
    if (m !== currentMonth()) q.set('m', m);
    if (c !== null) q.set('c', String(c));
    navigate(`/${q.size ? `?${q}` : ''}`, { replace: m === month });
  };

  const base = summary?.prevToDate ?? summary?.prevTotal ?? 0;
  const delta = summary && base > 0 ? (summary.total - base) / base : null;
  const selectedName = selected === null ? null : selected === 'none' ? 'Uncategorised' : capitalise(summary?.byCategory.find((c) => c.category_id === selected)?.name);

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-20 -mx-4 bg-bg/80 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1 backdrop-blur-xl">
        <MonthSwitcher month={month} onChange={(m) => go(m, null)} />
      </div>

      <section
        className="card overflow-hidden p-5"
        style={{ backgroundImage: 'radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 65%)' }}
      >
        <p className="text-sm font-medium text-ink-2">Spent this month</p>
        {summary ? (
          <p className="mt-1 text-[clamp(2.25rem,11vw,3rem)] leading-none font-bold tracking-tight">{rupeesWhole(summary.total)}</p>
        ) : (
          <div className="skeleton mt-2 h-10 w-48" />
        )}
        {summary && (
          <p className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-sunken px-3 py-1 text-xs text-ink-2">
            {delta === null ? (
              'Nothing last month to compare'
            ) : (
              <>
                <span className="shrink-0 font-semibold whitespace-nowrap text-ink">
                  {delta >= 0 ? '↑' : '↓'} {Math.abs(Math.round(delta * 100))}%
                </span>
                <span className="truncate">
                  vs {summary.prevToDate !== null ? 'same day last month' : 'last month'} · {rupeesWhole(base)}
                </span>
              </>
            )}
          </p>
        )}
        <div className="mt-5">{summary ? <DailyBars summary={summary} /> : <div className="skeleton h-24" />}</div>
      </section>

      {summary && summary.reviewCount > 0 && (
        <button onClick={() => navigate('/review')} className="card flex items-center gap-3 px-4 py-3 text-left">
          <span className="tile size-10 text-lg" style={{ '--tile': 'var(--warn)' } as React.CSSProperties} aria-hidden>
            ✦
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{summary.reviewCount} to review</span>
            <span className="block truncate text-xs text-ink-2">New merchants waiting for a category</span>
          </span>
          <span className="text-muted">›</span>
        </button>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <section className="card p-2">
          <h2 className="px-2 pt-2 pb-1 font-semibold">Categories</h2>
          {summary ? <CategoryBars summary={summary} selected={selected} onSelect={(c) => go(month, c)} /> : <Skeleton rows={5} />}
        </section>

        <section className="card p-2">
          <div className="flex items-center justify-between px-2 pt-2 pb-2">
            <h2 className="truncate font-semibold">{selectedName ? `${selectedName}` : 'Spends'}</h2>
            {selectedName && (
              <button onClick={() => go(month, null)} className="shrink-0 rounded-full bg-sunken px-3 py-1 text-xs font-medium text-ink">
                Clear ✕
              </button>
            )}
          </div>
          {txns ? <TxnList txns={txns} empty="No spends yet this month." /> : <Skeleton />}
          {summary && summary.excludedCount > 0 && (
            <button onClick={() => navigate(`/transactions?kind=excluded&m=${month}`)} className="w-full px-2 py-3 text-center text-xs text-muted">
              {summary.excludedCount} not counted (card bills, own transfers) ›
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
