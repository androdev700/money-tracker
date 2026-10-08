import type { Txn } from '../lib/api';
import { capitalise, dayLabel, rupees, timeLabel } from '../lib/format';
import { useStore } from '../lib/store';

export function TxnRow({ t }: { t: Txn }) {
  const { openEditor } = useStore();
  const sub = [
    t.kind === 'excluded' ? t.exclude_reason : capitalise(t.category_name) || 'Uncategorised',
    timeLabel(t.txn_at),
    t.instrument && t.account_last4 ? `${t.instrument} ••${t.account_last4}` : t.source === 'manual' ? 'Added by you' : t.instrument,
  ].filter(Boolean);

  return (
    <button onClick={() => openEditor(t)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-sunken">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sunken text-lg" aria-hidden>
        {t.kind === 'excluded' ? '⇄' : (t.category_icon ?? '❔')}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={`truncate font-medium ${t.kind === 'excluded' || t.duplicate_of ? 'text-muted line-through decoration-1' : ''}`}>{t.merchant}</span>
          {t.kind === 'refund' && <Pill>refund</Pill>}
          {t.duplicate_of && <Pill>duplicate</Pill>}
          {!!t.needs_review && t.kind !== 'excluded' && !t.duplicate_of && <Pill tone="warn">review</Pill>}
        </span>
        <span className="block truncate text-xs text-muted">{sub.join(' · ')}</span>
        {t.note && <span className="block truncate text-xs text-ink-2">{t.note}</span>}
      </span>
      <span className={`shrink-0 text-right font-medium ${t.kind === 'excluded' || t.duplicate_of ? 'text-muted' : ''}`}>
        {t.kind === 'refund' ? '−' : ''}
        {rupees(t.amount_paise)}
      </span>
    </button>
  );
}

export function Pill({ children, tone }: { children: string; tone?: 'warn' }) {
  return (
    <span className={`shrink-0 rounded-full border px-1.5 text-[10px] leading-4 ${tone === 'warn' ? 'border-warn text-warn' : 'border-line text-ink-2'}`}>
      {children}
    </span>
  );
}

export function TxnList({ txns, empty = 'Nothing here.' }: { txns: Txn[]; empty?: string }) {
  if (!txns.length) return <p className="py-10 text-center text-sm text-muted">{empty}</p>;

  const groups = new Map<string, Txn[]>();
  for (const t of txns) {
    const day = t.txn_at.slice(0, 10);
    groups.set(day, [...(groups.get(day) ?? []), t]);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...groups].map(([day, list]) => {
        const total = list.reduce((s, t) => s + (t.kind === 'excluded' || t.duplicate_of ? 0 : t.kind === 'refund' ? -t.amount_paise : t.amount_paise), 0);
        return (
          <section key={day}>
            <h3 className="sticky top-0 z-10 flex justify-between bg-bg/95 px-2 py-1.5 text-xs font-medium text-muted backdrop-blur">
              <span>{dayLabel(day)}</span>
              <span>{rupees(total)}</span>
            </h3>
            <div className="flex flex-col">
              {list.map((t) => (
                <TxnRow key={t.id} t={t} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
