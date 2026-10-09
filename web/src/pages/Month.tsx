import { CategoryBars } from '../components/CategoryBars';
import { DailyBars } from '../components/DailyBars';
import { MonthSwitcher } from '../components/MonthSwitcher';
import { TxnList } from '../components/TxnList';
import type { Summary, Txn } from '../lib/api';
import { capitalise, currentMonth, rupeesWhole } from '../lib/format';
import { useApi, useStore } from '../lib/store';

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
    navigate(`/${q.size ? `?${q}` : ''}`);
  };

  const base = summary?.prevToDate ?? summary?.prevTotal ?? 0;
  const delta = summary && base > 0 ? (summary.total - base) / base : null;
  const selectedName = selected === null ? null : selected === 'none' ? 'Uncategorised' : capitalise(summary?.byCategory.find((c) => c.category_id === selected)?.name);

  return (
    <div className="flex flex-col gap-5">
      <MonthSwitcher month={month} onChange={(m) => go(m, null)} />

      <section className="text-center">
        <p className="text-sm text-muted">Spent</p>
        <p className="text-[clamp(2.25rem,12vw,3rem)] leading-tight font-semibold tracking-tight">{summary ? rupeesWhole(summary.total) : '—'}</p>
        {summary && (
          <p className="mt-1 text-sm text-ink-2">
            {delta === null
              ? 'No spends last month to compare'
              : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(delta * 100))}% vs ${summary.prevToDate !== null ? 'this point last month' : 'last month'} (${rupeesWhole(base)})`}
          </p>
        )}
      </section>

      {summary && summary.reviewCount > 0 && (
        <button onClick={() => navigate('/review')} className="flex items-center justify-between rounded-2xl border border-warn/50 bg-card px-4 py-3 text-left text-sm">
          <span>
            <span className="font-medium">{summary.reviewCount} to review</span>
            <span className="text-ink-2"> — uncategorised or auto-guessed</span>
          </span>
          <span className="text-ink-2">›</span>
        </button>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <div className="flex flex-col gap-5">
          {summary && (
            <section className="rounded-2xl bg-card p-4">
              <DailyBars summary={summary} />
            </section>
          )}
          {summary && (
            <section className="rounded-2xl bg-card p-2">
              <h2 className="px-2 pt-2 pb-1 text-sm font-medium text-ink-2">By category</h2>
              <CategoryBars summary={summary} selected={selected} onSelect={(c) => go(month, c)} />
            </section>
          )}
        </div>

        <section className="rounded-2xl bg-card p-2">
          <div className="flex items-center justify-between px-2 pt-2 pb-1">
            <h2 className="text-sm font-medium text-ink-2">{selectedName ? `${selectedName} spends` : 'All spends'}</h2>
            {selectedName && (
              <button onClick={() => go(month, null)} className="text-xs text-accent">
                Clear filter
              </button>
            )}
          </div>
          {txns && <TxnList txns={txns} empty="No spends yet this month." />}
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
