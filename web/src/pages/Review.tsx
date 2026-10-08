import { useState } from 'react';
import { CategoryTile, useCategoryMap } from '../components/CategoryTile';
import { Section } from '../components/Grouped';
import { Glyph } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { Pill } from '../components/TxnList';
import { CategoryChips } from '../components/TxnSheet';
import { api, type EmailRow, type Txn } from '../lib/api';
import { capitalise, dayLabel, rupees } from '../lib/format';
import { useApi, useStore } from '../lib/store';

function ReviewCard({ t }: { t: Txn }) {
  const { refresh, openEditor } = useStore();
  const categories = useCategoryMap();
  const [busy, setBusy] = useState(false);
  const learnable = t.merchant_key !== 'unknown';
  const guess = t.category_id === null ? undefined : categories.get(t.category_id);

  const pick = async (categoryId: number) => {
    setBusy(true);
    await api.patch(`/api/transactions/${t.id}`, { category_id: categoryId, apply_to_merchant: learnable });
    refresh();
  };

  return (
    <li className={`overflow-hidden rounded-xl bg-card transition-opacity ${busy ? 'opacity-50' : ''}`}>
      <button onClick={() => openEditor(t)} className="cell tap">
        <CategoryTile icon={t.category_icon} color={guess?.color} />
        <span className="cell-body">
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-headline [overflow-wrap:anywhere]">{t.merchant}</span>
            <span className="block truncate text-subhead text-label-2">
              {[dayLabel(t.txn_at.slice(0, 10)), [t.bank?.toUpperCase(), t.instrument].filter(Boolean).join(' '), t.category_name && `Guessed ${capitalise(t.category_name)}`]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {t.kind === 'refund' && <Pill>Refund</Pill>}
            {rupees(t.amount_paise)}
          </span>
        </span>
      </button>
      <div className="px-4 pt-1 pb-3.5">
        <CategoryChips value={t.category_id} onChange={pick} size="sm" />
        {learnable && <p className="mt-2.5 truncate text-footnote text-label-2">Your pick is remembered for “{t.merchant}”</p>}
      </div>
    </li>
  );
}

function UnparsedCard({ e }: { e: EmailRow }) {
  const { refresh, openEditor } = useStore();
  return (
    <li className="overflow-hidden rounded-xl bg-card">
      <div className="px-4 pt-3 pb-3">
        <p className="truncate text-headline">{e.subject || '(no subject)'}</p>
        <p className="truncate text-footnote text-label-2">
          {e.from_addr} · {dayLabel(e.received_at.slice(0, 10))}
        </p>
        {e.snippet && <p className="mt-1.5 line-clamp-3 text-subhead [overflow-wrap:anywhere] text-label-2">{e.snippet}</p>}
      </div>
      <div className="hairline-t grid grid-cols-2">
        <button onClick={() => openEditor({ email_id: e.id, txn_at: e.received_at })} className="tap min-h-11 px-2 text-body font-semibold text-accent-text">
          Add as spend
        </button>
        <button
          onClick={async () => {
            await api.post(`/api/emails/${encodeURIComponent(e.id)}/dismiss`);
            refresh();
          }}
          className="tap min-h-11 px-2 text-body text-accent-text shadow-[inset_var(--hairline)_0_0_var(--separator)]"
        >
          Not a spend
        </button>
      </div>
    </li>
  );
}

export function ReviewPage() {
  const { data: txns } = useApi<Txn[]>('/api/transactions?review=1&kind=all');
  const { data: emails } = useApi<EmailRow[]>('/api/emails?status=unparsed');

  const empty = txns?.length === 0 && emails?.length === 0;

  return (
    <>
      <PageHeader title="Review" />
      <div className="mx-auto flex max-w-[42rem] flex-col gap-7">
        <p className="-mt-1 text-subhead text-label-2">Pick a category once and every future spend at that merchant gets it automatically.</p>
        {empty && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Glyph name="checkCircle" className="size-14 text-label-3" strokeWidth={1.5} />
            <p className="mt-2 text-title3 font-semibold">All caught up</p>
            <p className="max-w-[18rem] text-subhead text-label-2">Spends that need a category will show up here.</p>
          </div>
        )}
        {!!txns?.length && (
          <Section header="Needs a category" aside={txns.length} card={null}>
            <ul className="flex flex-col gap-3">
              {txns.map((t) => (
                <ReviewCard key={t.id} t={t} />
              ))}
            </ul>
          </Section>
        )}
        {!!emails?.length && (
          <Section header="Emails we couldn’t read" aside={emails.length} card={null}>
            <ul className="flex flex-col gap-3">
              {emails.map((e) => (
                <UnparsedCard key={e.id} e={e} />
              ))}
            </ul>
          </Section>
        )}
      </div>
    </>
  );
}
