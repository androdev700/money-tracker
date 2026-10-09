import { useEffect, useState, type ReactNode } from 'react';
import { OptionRow, Picker } from '../components/Picker';
import { Tile } from '../components/Tile';
import { TxnList } from '../components/TxnList';
import type { MonthTotal, Txn } from '../lib/api';
import { capitalise, currentMonth, monthLabel, rupees, rupeesShort } from '../lib/format';
import { afterSheetCloses } from '../lib/backDismiss';
import { useApi, useStore } from '../lib/store';

const KINDS = [
  { value: 'counted', title: 'Counted', detail: 'Spends and refunds in your totals' },
  { value: 'refund', title: 'Refunds', detail: 'Money back that nets off spend' },
  { value: 'excluded', title: 'Not counted', detail: 'Card bills, own transfers, wallet top-ups' },
  { value: 'duplicate', title: 'Duplicates', detail: 'Second alerts for a spend already counted' },
  { value: 'all', title: 'Everything', detail: 'All of the above' },
] as const;

const SOURCES = [
  { value: '', title: 'Email + You', detail: 'Everything' },
  { value: 'email', title: 'Email', detail: 'Read from your bank and payment emails' },
  { value: 'manual', title: 'You', detail: 'Added by hand' },
] as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Open = 'time' | 'category' | 'type' | 'source' | null;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors ${
        active ? 'border-accent bg-accent/10 font-semibold text-accent' : 'border-line bg-card text-ink'
      }`}
    >
      {children}
      <span className="text-[10px] opacity-60" aria-hidden>
        ▼
      </span>
    </button>
  );
}

function MonthPicker({ value, onPick }: { value: string; onPick: (month: string) => void }) {
  const { data: totals } = useApi<MonthTotal[]>('/api/months');
  const now = currentMonth();
  const [year, setYear] = useState(Number((value || now).slice(0, 4)));
  const byMonth = new Map((totals ?? []).map((t) => [t.month, t]));
  const years = (totals ?? []).map((t) => Number(t.month.slice(0, 4)));
  const minYear = Math.min(Number(now.slice(0, 4)), ...years);

  return (
    <div className="flex flex-col gap-4">
      <OptionRow selected={!value} title="All time" detail="Every month" onClick={() => onPick('')} />
      <div className="flex items-center justify-between px-1">
        <button type="button" onClick={() => setYear(year - 1)} disabled={year <= minYear} aria-label="Previous year" className="grid size-10 place-items-center rounded-full bg-sunken text-lg disabled:opacity-30">
          ‹
        </button>
        <span className="text-lg font-semibold">{year}</span>
        <button type="button" onClick={() => setYear(year + 1)} disabled={`${year + 1}-01` > now} aria-label="Next year" className="grid size-10 place-items-center rounded-full bg-sunken text-lg disabled:opacity-30">
          ›
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {MONTHS.map((name, i) => {
          const month = `${year}-${String(i + 1).padStart(2, '0')}`;
          const total = byMonth.get(month);
          const future = month > now;
          const selected = month === value;
          return (
            <button
              key={month}
              type="button"
              disabled={future}
              onClick={() => onPick(month)}
              aria-pressed={selected}
              className={`flex flex-col items-center rounded-2xl border py-3 transition-colors disabled:opacity-30 ${
                selected ? 'border-accent bg-accent text-on-accent' : month === now ? 'border-accent/50 bg-card' : 'border-line bg-card hover:bg-sunken'
              }`}
            >
              <span className="font-semibold">{name}</span>
              <span className={`text-xs ${selected ? 'opacity-90' : 'text-muted'}`}>{total ? rupeesShort(total.total) : future ? '' : '—'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TransactionsPage() {
  const { search, categories, navigate } = useStore();
  const [q, setQ] = useState(search.get('q') ?? '');
  const [open, setOpen] = useState<Open>(null);
  const month = search.get('m') ?? '';
  const kind = search.get('kind') ?? 'counted';
  const cat = search.get('c') ?? '';
  const source = search.get('s') ?? '';

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(search);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const to = `/transactions${next.size ? `?${next}` : ''}`;
    if (open) {
      afterSheetCloses(() => navigate(to, { replace: true }));
      setOpen(null);
    } else {
      navigate(to, { replace: true });
    }
  };

  useEffect(() => {
    const t = setTimeout(() => q !== (search.get('q') ?? '') && update({ q }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const params = new URLSearchParams({ kind });
  if (month) params.set('month', month);
  if (cat) params.set('category', cat);
  if (source) params.set('source', source);
  if (search.get('q')) params.set('q', search.get('q')!);
  const { data: txns } = useApi<Txn[]>(`/api/transactions?${params}`);

  const category = categories.find((c) => String(c.id) === cat);
  const kindInfo = KINDS.find((k) => k.value === kind) ?? KINDS[0];
  const sourceInfo = SOURCES.find((s) => s.value === source) ?? SOURCES[0];
  const anyActive = Boolean(month || cat || kind !== 'counted' || source || q);
  const total = (txns ?? []).reduce((s, t) => s + (t.kind === 'excluded' || t.duplicate_of ? 0 : t.kind === 'refund' ? -t.amount_paise : t.amount_paise), 0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>

      <div className="relative">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search merchant or note"
          className="w-full rounded-2xl border border-line bg-card py-3 pr-4 pl-10 outline-none focus:border-accent [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="absolute top-1/2 right-3 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-sunken text-xs text-ink-2">
            ✕
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip active={Boolean(month)} onClick={() => setOpen('time')}>
          🗓 {month ? monthLabel(month) : 'All time'}
        </Chip>
        <Chip active={Boolean(cat)} onClick={() => setOpen('category')}>
          {cat === 'none' ? '❔ Uncategorised' : category ? `${category.icon} ${capitalise(category.name)}` : 'All categories'}
        </Chip>
        <Chip active={kind !== 'counted'} onClick={() => setOpen('type')}>
          {kindInfo.title}
        </Chip>
        <Chip active={Boolean(source)} onClick={() => setOpen('source')}>
          {source ? `Added by ${sourceInfo.title}` : 'Email + You'}
        </Chip>
      </div>

      <div className="flex min-h-8 items-center justify-between gap-3 px-1">
        <p className="text-sm text-ink-2">
          {txns ? (
            <>
              {txns.length} transaction{txns.length === 1 ? '' : 's'}
              {kind === 'counted' || kind === 'refund' ? <span className="font-semibold text-ink"> · {rupees(total)}</span> : ''}
            </>
          ) : (
            ' '
          )}
        </p>
        {anyActive && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              update({ m: '', c: '', kind: '', s: '', q: '' });
            }}
            className="shrink-0 rounded-full bg-sunken px-3 py-1.5 text-sm font-semibold text-accent"
          >
            Clear all ✕
          </button>
        )}
      </div>
      <section className="card p-2">
        {txns && (
          <TxnList
            txns={txns}
            empty={anyActive ? 'Nothing matches these filters.' : 'No transactions yet.'}
          />
        )}
      </section>

      {open === 'time' && (
        <Picker title="Time" onClose={() => setOpen(null)}>
          <MonthPicker value={month} onPick={(m) => update({ m })} />
        </Picker>
      )}
      {open === 'category' && (
        <Picker title="Category" onClose={() => setOpen(null)}>
          <div className="flex flex-col gap-1">
            <OptionRow selected={!cat} title="All categories" onClick={() => update({ c: '' })} />
            {categories
              .filter((c) => !c.archived)
              .map((c) => (
                <OptionRow
                  key={c.id}
                  selected={cat === String(c.id)}
                  title={capitalise(c.name)}
                  leading={<Tile icon={c.icon} color={c.color} size="sm" />}
                  onClick={() => update({ c: String(c.id) })}
                />
              ))}
            <OptionRow selected={cat === 'none'} title="Uncategorised" leading={<Tile icon="❔" color={null} size="sm" />} onClick={() => update({ c: 'none' })} />
          </div>
        </Picker>
      )}
      {open === 'type' && (
        <Picker title="Type" onClose={() => setOpen(null)}>
          <div className="flex flex-col gap-1">
            {KINDS.map((k) => (
              <OptionRow key={k.value} selected={kind === k.value} title={k.title} detail={k.detail} onClick={() => update({ kind: k.value === 'counted' ? '' : k.value })} />
            ))}
          </div>
        </Picker>
      )}
      {open === 'source' && (
        <Picker title="Added by" onClose={() => setOpen(null)}>
          <div className="flex flex-col gap-1">
            {SOURCES.map((s) => (
              <OptionRow key={s.title} selected={source === s.value} title={s.title} detail={s.detail} onClick={() => update({ s: s.value })} />
            ))}
          </div>
        </Picker>
      )}
    </div>
  );
}
