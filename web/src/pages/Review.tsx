import { useState } from 'react';
import { CategoryChips } from '../components/TxnSheet';
import { Pill } from '../components/TxnList';
import { api, type EmailRow, type Txn } from '../lib/api';
import { capitalise, dayLabel, rupees } from '../lib/format';
import { useApi, useStore } from '../lib/store';

function ReviewCard({ t }: { t: Txn }) {
  const { refresh, openEditor } = useStore();
  const [busy, setBusy] = useState(false);
  const learnable = t.merchant_key !== 'unknown';

  const pick = async (categoryId: number) => {
    setBusy(true);
    await api.patch(`/api/transactions/${t.id}`, { category_id: categoryId, apply_to_merchant: learnable });
    refresh();
  };

  return (
    <li className={`rounded-2xl bg-card p-4 ${busy ? 'opacity-50' : ''}`}>
      <button onClick={() => openEditor(t)} className="mb-3 flex w-full items-start justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="block truncate font-medium">{t.merchant}</span>
          <span className="block text-xs text-muted">
            {dayLabel(t.txn_at.slice(0, 10))} · {[t.bank?.toUpperCase(), t.instrument].filter(Boolean).join(' ')}
            {t.category_name && ` · guessed ${capitalise(t.category_name)}`}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 font-medium">
          {t.kind === 'refund' && <Pill>refund</Pill>}
          {rupees(t.amount_paise)}
        </span>
      </button>
      <CategoryChips value={t.category_id} onChange={pick} size="sm" />
      {learnable && <p className="mt-2 text-[11px] text-muted">Your pick is remembered for “{t.merchant}”.</p>}
    </li>
  );
}

function UnparsedCard({ e }: { e: EmailRow }) {
  const { refresh, openEditor } = useStore();
  return (
    <li className="rounded-2xl bg-card p-4 text-sm">
      <p className="font-medium">{e.subject || '(no subject)'}</p>
      <p className="text-xs text-muted">
        {e.from_addr} · {dayLabel(e.received_at.slice(0, 10))}
      </p>
      <p className="mt-2 line-clamp-3 text-ink-2">{e.snippet}</p>
      <div className="mt-3 flex gap-4">
        <button onClick={() => openEditor({ email_id: e.id, txn_at: e.received_at })} className="font-medium text-accent">
          Add as spend
        </button>
        <button
          onClick={async () => {
            await api.post(`/api/emails/${encodeURIComponent(e.id)}/dismiss`);
            refresh();
          }}
          className="text-ink-2"
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
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Review</h1>
        <p className="text-sm text-ink-2">Pick a category once and every future spend at that merchant gets it automatically.</p>
      </div>
      {empty && <p className="py-16 text-center text-muted">All caught up ✓</p>}
      {!!txns?.length && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-2">Needs a category ({txns.length})</h2>
          <ul className="flex flex-col gap-3">
            {txns.map((t) => (
              <ReviewCard key={t.id} t={t} />
            ))}
          </ul>
        </section>
      )}
      {!!emails?.length && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-2">Emails we couldn’t read ({emails.length})</h2>
          <ul className="flex flex-col gap-3">
            {emails.map((e) => (
              <UnparsedCard key={e.id} e={e} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
