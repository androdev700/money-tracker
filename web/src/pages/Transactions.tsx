import { useEffect, useState } from 'react';
import { TxnList } from '../components/TxnList';
import type { Txn } from '../lib/api';
import { capitalise, monthLabel, rupees, shiftMonth, currentMonth } from '../lib/format';
import { useApi, useStore } from '../lib/store';

const KINDS = [
  ['counted', 'Counted'],
  ['refund', 'Refunds'],
  ['excluded', 'Not counted'],
  ['duplicate', 'Duplicates'],
  ['all', 'Everything'],
] as const;

const select = 'rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink';

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
  const total = (txns ?? []).reduce((s, t) => s + (t.kind === 'excluded' || t.duplicate_of ? 0 : t.kind === 'refund' ? -t.amount_paise : t.amount_paise), 0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Transactions</h1>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search merchant or note"
        className="w-full rounded-xl border border-line bg-card px-4 py-2.5 outline-none focus:border-accent"
      />
      <div className="flex flex-wrap gap-2">
        <select value={month} onChange={(e) => set('m', e.target.value)} className={select} aria-label="Month">
          <option value="">All time</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <select value={cat} onChange={(e) => set('c', e.target.value)} className={select} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {capitalise(c.name)}
            </option>
          ))}
          <option value="none">Uncategorised</option>
        </select>
        <select value={kind} onChange={(e) => set('kind', e.target.value === 'counted' ? '' : e.target.value)} className={select} aria-label="Type">
          {KINDS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select value={source} onChange={(e) => set('s', e.target.value)} className={select} aria-label="Source">
          <option value="">Email + manual</option>
          <option value="email">From email</option>
          <option value="manual">Added by you</option>
        </select>
      </div>
      {txns && (
        <p className="px-2 text-sm text-ink-2">
          {txns.length} transaction{txns.length === 1 ? '' : 's'}
          {kind === 'counted' || kind === 'refund' ? ` · ${rupees(total)}` : ''}
        </p>
      )}
      <section className="rounded-2xl bg-card p-2">{txns && <TxnList txns={txns} empty="No matching transactions." />}</section>
    </div>
  );
}
