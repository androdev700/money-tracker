import { useState } from 'react';
import { OptionRow, Picker } from '../components/Picker';
import { Tile } from '../components/Tile';
import { CategoryChips } from '../components/TxnSheet';
import { Pill } from '../components/TxnList';
import { api, type Candidate, type EmailRow, type Order, type Txn } from '../lib/api';
import { capitalise, dayLabel, rupees, timeLabel } from '../lib/format';
import { useApi, useStore } from '../lib/store';

/** An order whose payment we couldn't find: add it as a spend, attach it to one, or drop it. */
function OrderCard({ o }: { o: Order }) {
  const { refresh, openEditor, categories, showToast } = useStore();
  const [linking, setLinking] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const cat = categories.find((c) => c.id === o.suggested?.categoryId);
  const store = o.store ?? capitalise(o.source);

  async function openLinking() {
    setLinking(true);
    setCandidates(await api.get<Candidate[]>(`/api/orders/${o.id}/candidates`));
  }

  async function link(c: Candidate) {
    await api.post(`/api/orders/${o.id}/link`, { txn_id: c.id });
    setLinking(false);
    refresh();
    showToast(`Linked to ${c.label ?? c.merchant}`);
  }

  return (
    <li className="card p-4">
      <div className="flex items-start gap-3">
        <Tile icon={cat?.icon} color={cat?.color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{o.suggested?.label ?? store}</span>
          <span className="block truncate text-xs text-muted">
            {store} · {dayLabel(o.ordered_at.slice(0, 10))} {timeLabel(o.ordered_at)}
          </span>
        </span>
        <span className="shrink-0 font-semibold">{rupees(o.total_paise)}</span>
      </div>
      <ul className="mt-2 ml-14 text-xs text-ink-2">
        {o.items.slice(0, 4).map((i) => (
          <li key={i.id} className="truncate">
            {i.name}
            {i.qty > 1 && ` ×${i.qty}`}
          </li>
        ))}
        {o.items.length > 4 && <li className="text-muted">+{o.items.length - 4} more</li>}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() =>
            openEditor({ amount_paise: o.total_paise, merchant: store, txn_at: o.ordered_at, category_id: o.suggested?.categoryId ?? null, order_id: o.id })
          }
          className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-on-accent"
        >
          Add as spend
        </button>
        <button onClick={openLinking} className="rounded-full border border-line px-3.5 py-1.5 text-sm font-medium">
          Link to a spend
        </button>
        <button
          onClick={async () => {
            await api.post(`/api/orders/${o.id}/dismiss`);
            refresh();
            showToast('Order ignored');
          }}
          className="px-2 py-1.5 text-sm text-ink-2"
        >
          Not mine
        </button>
      </div>
      {linking && (
        <Picker title="Which spend paid for it?" onClose={() => setLinking(false)}>
          {!candidates && <p className="py-6 text-center text-sm text-muted">Looking…</p>}
          {candidates?.length === 0 && <p className="py-6 text-center text-sm text-muted">No spend of {rupees(o.total_paise)} within a week of this order.</p>}
          <div className="flex flex-col gap-1">
            {candidates?.map((c) => (
              <OptionRow
                key={c.id}
                selected={false}
                title={`${c.label ?? c.merchant} · ${rupees(c.amount_paise)}`}
                detail={`${dayLabel(c.txn_at.slice(0, 10))} ${timeLabel(c.txn_at)} · ${capitalise(c.category_name) || 'Uncategorised'}`}
                leading={<Tile icon={c.category_icon} color={c.category_color} size="sm" />}
                onClick={() => link(c)}
              />
            ))}
          </div>
        </Picker>
      )}
    </li>
  );
}

function ReviewCard({ t }: { t: Txn }) {
  const { refresh, openEditor, categories, showToast } = useStore();
  const [busy, setBusy] = useState(false);
  const learnable = t.merchant_key !== 'unknown';

  const pick = async (categoryId: number) => {
    setBusy(true);
    await api.patch(`/api/transactions/${t.id}`, { category_id: categoryId, apply_to_merchant: learnable });
    refresh();
    const name = capitalise(categories.find((c) => c.id === categoryId)?.name);
    showToast(learnable ? `${t.merchant} → ${name}, now and in future` : `Filed under ${name}`);
  };

  return (
    <li className={`card p-4 ${busy ? 'opacity-50' : ''}`}>
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
    <li className="card p-4 text-sm">
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
  const { data: orders } = useApi<Order[]>('/api/orders?status=unmatched');

  const empty = txns?.length === 0 && emails?.length === 0 && orders?.length === 0;

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
      {!!orders?.length && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-2">Orders without a payment ({orders.length})</h2>
          <p className="mb-3 text-xs text-muted">Paid by cash, a wallet, or a card whose alerts don’t reach Gmail.</p>
          <ul className="flex flex-col gap-3">
            {orders.map((o) => (
              <OrderCard key={o.id} o={o} />
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
