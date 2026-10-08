import { useEffect, useState } from 'react';
import { Glyph } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { TxnList, countedPaise } from '../components/TxnList';
import type { Txn } from '../lib/api';
import { capitalise, currentMonth, monthLabel, rupees, shiftMonth } from '../lib/format';
import { useApi, useStore } from '../lib/store';

const KINDS = [
  ['counted', 'Counted'],
  ['refund', 'Refunds'],
  ['excluded', 'Not counted'],
  ['duplicate', 'Duplicates'],
  ['all', 'Everything'],
] as const;

/** A pull-down button: a capsule showing the current choice, with the native picker on top. */
function Menu({ name, label, value, isDefault, onChange, children }: { name: string; label: string; value: string; isDefault: boolean; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="relative flex min-h-11 max-w-full min-w-0 items-center has-[:focus-visible]:rounded-full has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent">
      <span
        className={`flex h-8 max-w-full min-w-0 items-center gap-1 rounded-full pr-2.5 pl-3.5 text-subhead ${isDefault ? 'bg-card text-label' : 'bg-accent-soft font-semibold text-accent-text'}`}
      >
        <span className="truncate">{label}</span>
        <Glyph name="chevronUpDown" className="size-3.5 shrink-0 opacity-70" strokeWidth={2.25} />
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 w-full cursor-pointer opacity-0" aria-label={name}>
        {children}
      </select>
    </label>
  );
}

export function TransactionsPage() {
  const { search, categories, navigate } = useStore();
  const [q, setQ] = useState(search.get('q') ?? '');
  const month = search.get('m') ?? '';
  const kind = search.get('kind') ?? 'counted';
  const cat = search.get('c') ?? '';
  const source = search.get('s') ?? '';

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(search);
    if (value) next.set(key, value);
    else next.delete(key);
    navigate(`/transactions${next.size ? `?${next}` : ''}`, { replace: true });
  };

  useEffect(() => {
    const t = setTimeout(() => q !== (search.get('q') ?? '') && set('q', q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const params = new URLSearchParams({ kind });
  if (month) params.set('month', month);
  if (cat) params.set('category', cat);
  if (source) params.set('source', source);
  if (search.get('q')) params.set('q', search.get('q')!);
  const { data: txns } = useApi<Txn[]>(`/api/transactions?${params}`);

  const months = Array.from({ length: 18 }, (_, i) => shiftMonth(currentMonth(), -i));
  const total = (txns ?? []).reduce((s, t) => s + countedPaise(t), 0);
  const catName = cat === 'none' ? 'Uncategorised' : capitalise(categories.find((c) => String(c.id) === cat)?.name);

  return (
    <>
      <PageHeader title="Transactions" />
      <div className="mx-auto flex max-w-[42rem] flex-col gap-2 pt-1">
        <label className="flex h-9 items-center gap-1.5 rounded-[0.625rem] bg-fill px-2 text-label-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent">
          <Glyph name="search" className="size-[1.125rem] shrink-0" strokeWidth={2} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search merchant or note"
            aria-label="Search merchant or note"
            className="h-full min-w-0 flex-1 bg-transparent text-body text-label outline-none placeholder:text-label-2"
          />
        </label>

        <div className="flex flex-wrap gap-x-2">
          <Menu name="Month" label={month ? monthLabel(month) : 'All time'} value={month} isDefault={!month} onChange={(v) => set('m', v)}>
            <option value="">All time</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </Menu>
          <Menu name="Category" label={cat ? catName || 'Category' : 'All categories'} value={cat} isDefault={!cat} onChange={(v) => set('c', v)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {capitalise(c.name)}
              </option>
            ))}
            <option value="none">Uncategorised</option>
          </Menu>
          <Menu name="Type" label={KINDS.find(([v]) => v === kind)?.[1] ?? 'Counted'} value={kind} isDefault={kind === 'counted'} onChange={(v) => set('kind', v === 'counted' ? '' : v)}>
            {KINDS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Menu>
          <Menu name="Source" label={source === 'email' ? 'From email' : source === 'manual' ? 'Added by you' : 'Email + manual'} value={source} isDefault={!source} onChange={(v) => set('s', v)}>
            <option value="">Email + manual</option>
            <option value="email">From email</option>
            <option value="manual">Added by you</option>
          </Menu>
        </div>

        {txns && (
          <p className="px-4 text-footnote text-label-2">
            {txns.length} transaction{txns.length === 1 ? '' : 's'}
            {kind === 'counted' || kind === 'refund' ? ` · ${rupees(total)}` : ''}
          </p>
        )}
        <div className="pt-3">{txns && <TxnList txns={txns} empty="No matching transactions" />}</div>
      </div>
    </>
  );
}
