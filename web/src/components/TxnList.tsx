import type { Txn } from '../lib/api';
import { capitalise, dayLabel, rupees, timeLabel } from '../lib/format';
import { useStore } from '../lib/store';
import { CategoryTile, useCategoryMap } from './CategoryTile';

export function TxnRow({ t }: { t: Txn }) {
  const { openEditor } = useStore();
  const categories = useCategoryMap();
  const muted = t.kind === 'excluded' || !!t.duplicate_of;
  const sub = [
    t.kind === 'excluded' ? t.exclude_reason : capitalise(t.category_name) || 'Uncategorised',
    timeLabel(t.txn_at),
    t.instrument && t.account_last4 ? `${t.instrument} ••${t.account_last4}` : t.source === 'manual' ? 'Added by you' : t.instrument,
  ].filter(Boolean);
  const category = t.category_id === null ? undefined : categories.get(t.category_id);

  return (
    <button onClick={() => openEditor(t)} className="cell tap">
      {t.kind === 'excluded' ? <CategoryTile glyph="transfer" /> : <CategoryTile icon={t.category_icon} color={category?.color} />}
      <span className="cell-body">
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={`truncate ${muted ? 'text-label-2 line-through decoration-1' : ''}`}>{t.merchant}</span>
            {t.kind === 'refund' && <Pill>Refund</Pill>}
            {t.duplicate_of && <Pill>Duplicate</Pill>}
            {!!t.needs_review && t.kind !== 'excluded' && !t.duplicate_of && <Pill tone="warn">Review</Pill>}
          </span>
          <span className="block truncate text-subhead text-label-2">{sub.join(' · ')}</span>
          {t.note && <span className="block truncate text-subhead">{t.note}</span>}
        </span>
        <span className={`shrink-0 text-right ${muted ? 'text-label-2' : ''}`}>
          {t.kind === 'refund' ? '−' : ''}
          {rupees(t.amount_paise)}
        </span>
      </span>
    </button>
  );
}

export function Pill({ children, tone }: { children: string; tone?: 'warn' }) {
  return (
    <span className={`shrink-0 rounded-[0.3125rem] px-1.5 text-caption2 leading-[1.125rem] font-semibold ${tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-fill text-label-2'}`}>
      {children}
    </span>
  );
}

export const countedPaise = (t: Txn) => (t.kind === 'excluded' || t.duplicate_of ? 0 : t.kind === 'refund' ? -t.amount_paise : t.amount_paise);

export function TxnList({ txns, empty = 'Nothing here' }: { txns: Txn[]; empty?: string }) {
  if (!txns.length) return <p className="py-12 text-center text-subhead text-label-2">{empty}</p>;

  const groups = new Map<string, Txn[]>();
  for (const t of txns) {
    const day = t.txn_at.slice(0, 10);
    groups.set(day, [...(groups.get(day) ?? []), t]);
  }

  return (
    <div className="flex flex-col gap-5">
      {[...groups].map(([day, list]) => (
        <section key={day}>
          <h3 className="flex justify-between gap-3 px-4 pb-1.5 text-footnote text-label-2">
            <span className="truncate">{dayLabel(day)}</span>
            <span className="shrink-0">{rupees(list.reduce((s, t) => s + countedPaise(t), 0))}</span>
          </h3>
          <div className="overflow-hidden rounded-xl bg-card">
            {list.map((t) => (
              <TxnRow key={t.id} t={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
