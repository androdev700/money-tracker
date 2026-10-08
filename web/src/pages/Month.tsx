import { useState } from 'react';
import { CategoryBars } from '../components/CategoryBars';
import { CategoryTile } from '../components/CategoryTile';
import { DailyBars } from '../components/DailyBars';
import { SectionTitle } from '../components/Grouped';
import { Glyph } from '../components/Icons';
import { MonthSwitcher } from '../components/MonthSwitcher';
import { PageHeader } from '../components/PageHeader';
import { TxnList } from '../components/TxnList';
import type { Summary, Txn } from '../lib/api';
import { capitalise, currentMonth, dayLabel, monthLabel, rupeesWhole } from '../lib/format';
import { useApi, useStore } from '../lib/store';

const pct = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

function SpendHero({ summary }: { summary: Summary }) {
  const [day, setDay] = useState<number | null>(null);
  const base = summary.prevToDate ?? summary.prevTotal;
  const delta = base > 0 ? (summary.total - base) / base : null;
  const dayValue = day === null ? 0 : (summary.byDay.find((d) => Number(d.day.slice(8, 10)) === day + 1)?.total ?? 0);

  return (
    <section className="overflow-hidden rounded-xl bg-card p-4 pb-2">
      <div aria-live="polite" className="min-h-[6.25rem]">
        {day === null ? (
          <>
            <p className="text-footnote font-semibold text-label-2 uppercase">Spent</p>
            <p className="font-rounded text-[clamp(2.125rem,10.5vw,2.75rem)] leading-[1.15] font-bold tracking-tight whitespace-nowrap">{rupeesWhole(summary.total)}</p>
            <p className="mt-0.5 flex items-start gap-1 text-footnote text-label-2">
              {delta === null ? (
                'Nothing last month to compare with'
              ) : (
                <>
                  {delta !== 0 && <Glyph name={delta > 0 ? 'arrowUp' : 'arrowDown'} className="mt-[0.1875rem] size-3 shrink-0" strokeWidth={2.5} />}
                  <span>
                    {delta === 0 ? 'Same as' : `${pct.format(Math.abs(delta * 100))}% ${delta > 0 ? 'more than' : 'less than'}`} {summary.prevToDate !== null ? 'this point last month' : 'last month'} ({rupeesWhole(base)})
                  </span>
                </>
              )}
            </p>
          </>
        ) : (
          <>
            <p className="text-footnote font-semibold text-label-2 uppercase">{dayLabel(`${summary.month}-${String(day + 1).padStart(2, '0')}`)}</p>
            <p className="font-rounded text-[clamp(2.125rem,10.5vw,2.75rem)] leading-[1.15] font-bold tracking-tight whitespace-nowrap">{rupeesWhole(dayValue)}</p>
            <p className="mt-0.5 text-footnote text-label-2">
              {summary.total > 0 ? `${pct.format((dayValue / summary.total) * 100)}% of ${rupeesWhole(summary.total)} this month` : 'No spends this month'}
            </p>
          </>
        )}
      </div>
      <div className="mt-4">
        <DailyBars summary={summary} selected={day} onSelect={setDay} />
      </div>
    </section>
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
    navigate(`/${q.size ? `?${q}` : ''}`);
  };

  const [y, mo] = month.split('-').map(Number);
  const monthName = new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long' });
  const selectedName = selected === null ? null : selected === 'none' ? 'Uncategorised' : capitalise(summary?.byCategory.find((c) => c.category_id === selected)?.name);

  return (
    <>
      <PageHeader
        wide
        eyebrow={String(y)}
        title={monthName}
        inlineTitle={monthLabel(month)}
        onTitleClick={month === currentMonth() ? undefined : () => go(currentMonth(), null)}
        titleHint="Jump to this month"
        accessory={<MonthSwitcher month={month} onChange={(m) => go(m, null)} />}
      />

      <div className="mx-auto grid max-w-[64rem] grid-cols-1 gap-x-8 gap-y-6 pt-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {summary ? <SpendHero key={month} summary={summary} /> : <div className="h-[16.5rem] rounded-xl bg-card" />}

          {summary && summary.reviewCount > 0 && (
            <button onClick={() => navigate('/review')} className="cell tap rounded-xl bg-card">
              <CategoryTile glyph="tray" color="var(--warn-fill)" />
              <span className="cell-body">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-headline">{summary.reviewCount} to review</span>
                  <span className="block truncate text-subhead text-label-2">Uncategorised or auto-guessed</span>
                </span>
                <Glyph name="chevronRight" className="size-4 shrink-0 text-label-3" strokeWidth={2.5} />
              </span>
            </button>
          )}

          {summary && (
            <section>
              <SectionTitle>Categories</SectionTitle>
              <div className="overflow-hidden rounded-xl bg-card">
                <CategoryBars summary={summary} selected={selected} onSelect={(c) => go(month, c)} />
              </div>
            </section>
          )}
        </div>

        <section className="min-w-0">
          <SectionTitle
            action={
              selectedName && (
                <button onClick={() => go(month, null)} className="-mr-2 min-h-11 shrink-0 px-2 text-body text-accent-text">
                  Show all
                </button>
              )
            }
          >
            {selectedName ?? 'Spends'}
          </SectionTitle>
          {txns && <TxnList txns={txns} empty={selectedName ? `No ${selectedName.toLowerCase()} spends this month` : 'No spends yet'} />}
          {summary && summary.excludedCount > 0 && (
            <button
              onClick={() => navigate(`/transactions?kind=excluded&m=${month}`)}
              className="mx-auto mt-3 flex min-h-11 items-center gap-1 px-4 text-footnote text-accent-text"
            >
              {summary.excludedCount} not counted: card bills, own transfers
              <Glyph name="chevronRight" className="size-3" strokeWidth={2.5} />
            </button>
          )}
        </section>
      </div>
    </>
  );
}
