import { useEffect, useRef, useState } from 'react';
import { api, type EmailRow, type Kind, type Txn, type TxnInput } from '../lib/api';
import { capitalise, nowLocal } from '../lib/format';
import { useStore } from '../lib/store';

export function CategoryChips({ value, onChange, size = 'md' }: { value: number | null; onChange: (id: number) => void; size?: 'sm' | 'md' }) {
  const { categories } = useStore();
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories
        .filter((c) => !c.archived)
        .map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            aria-pressed={value === c.id}
            className={`rounded-full border ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${
              value === c.id ? 'border-accent bg-accent text-on-accent' : 'border-line bg-card text-ink hover:bg-sunken'
            }`}
          >
            <span aria-hidden>{c.icon}</span> {capitalise(c.name)}
          </button>
        ))}
    </div>
  );
}

const field = 'w-full rounded-xl border border-line bg-card px-3 py-2.5 text-ink outline-none focus:border-accent';

export function TxnSheet() {
  const { editing, openEditor, refresh } = useStore();
  if (!editing) return null;
  return <Sheet key={editing.id ?? `new-${editing.email_id ?? ''}`} txn={editing} close={() => openEditor(null)} done={refresh} />;
}

function Sheet({ txn, close, done }: { txn: Partial<Txn>; close: () => void; done: () => void }) {
  const isNew = !txn.id;
  const [amount, setAmount] = useState(txn.amount_paise ? String(txn.amount_paise / 100) : '');
  const [merchant, setMerchant] = useState(txn.merchant ?? '');
  const [when, setWhen] = useState(txn.txn_at?.slice(0, 16) ?? nowLocal());
  const [categoryId, setCategoryId] = useState<number | null>(txn.category_id ?? null);
  const [kind, setKind] = useState<Kind>(txn.kind ?? 'spend');
  const [note, setNote] = useState(txn.note ?? '');
  const [applyAll, setApplyAll] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<EmailRow | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew) amountRef.current?.focus();
  }, [isNew]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [close]);

  const categoryChanged = categoryId !== null && categoryId !== (txn.category_id ?? null);
  const canLearn = !isNew && txn.merchant_key !== 'unknown' && kind !== 'excluded';

  async function save() {
    const paise = Math.round(parseFloat(amount.replace(/,/g, '')) * 100);
    if (!(paise > 0)) return setError('Enter an amount');
    if (!merchant.trim()) return setError('Enter where you spent it');
    setBusy(true);
    setError(null);
    const body: TxnInput = { amount_paise: paise, merchant: merchant.trim(), txn_at: when, category_id: categoryId, note: note.trim() || null, kind };
    try {
      if (isNew) await api.post('/api/transactions', { ...body, email_id: txn.email_id ?? undefined });
      else await api.patch(`/api/transactions/${txn.id}`, { ...body, apply_to_merchant: canLearn && categoryChanged && applyAll });
      done();
      close();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    await api.del(`/api/transactions/${txn.id}`);
    done();
    close();
  }

  async function notDuplicate() {
    await api.patch(`/api/transactions/${txn.id}`, { not_duplicate: true });
    done();
    close();
  }

  const kinds: Kind[] = isNew ? ['spend', 'refund'] : ['spend', 'refund', 'excluded'];

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal aria-label={isNew ? 'Add spend' : 'Edit spend'}>
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="pb-safe absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-3xl bg-bg shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[440px] md:rounded-none md:rounded-l-3xl"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button type="button" onClick={close} className="text-sm text-ink-2">
            Cancel
          </button>
          <h2 className="font-semibold">{isNew ? 'Add spend' : 'Edit'}</h2>
          <button type="submit" disabled={busy} className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-on-accent disabled:opacity-50">
            Save
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 pt-2 pb-6">
          {txn.duplicate_of && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card p-3 text-sm">
              <span className="text-ink-2">Hidden as a duplicate of another alert for the same spend.</span>
              <button type="button" onClick={notDuplicate} className="shrink-0 font-medium text-accent">
                Not a duplicate
              </button>
            </div>
          )}

          <label className="flex items-baseline justify-center gap-1 py-2">
            <span className="text-3xl text-muted">₹</span>
            <input
              ref={amountRef}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              aria-label="Amount"
              style={{ width: `${Math.max(1, amount.length) + 0.5}ch` }}
              className="max-w-[70vw] bg-transparent text-5xl font-semibold outline-none placeholder:text-line"
            />
          </label>

          <div className={`grid ${kinds.length === 2 ? 'grid-cols-2' : 'grid-cols-3'} rounded-xl bg-sunken p-1 text-sm`} role="radiogroup" aria-label="Type">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`rounded-lg py-1.5 ${kind === k ? 'bg-card font-medium shadow-sm' : 'text-ink-2'}`}
              >
                {k === 'excluded' ? 'Not spend' : capitalise(k)}
              </button>
            ))}
          </div>
          {kind === 'excluded' && <p className="-mt-2 text-xs text-muted">Not counted: card bill payments, transfers to your own accounts, wallet top-ups.</p>}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink-2">Where</span>
            <input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Swiggy, petrol pump, …" className={field} />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink-2">When</span>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={field} />
          </label>

          {kind !== 'excluded' && (
            <div className="flex flex-col gap-2 text-sm">
              <span className="text-ink-2">Category</span>
              <CategoryChips value={categoryId} onChange={setCategoryId} />
              {canLearn && categoryChanged && (
                <label className="mt-1 flex items-center gap-2 text-ink-2">
                  <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} className="size-4 accent-[var(--accent)]" />
                  Always use this for “{txn.merchant}”
                </label>
              )}
            </div>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink-2">Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className={field} />
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          {!isNew && (
            <div className="flex flex-col gap-3 border-t border-line pt-4 text-xs text-muted">
              <p>
                {txn.source === 'manual'
                  ? 'Added by you'
                  : [txn.bank?.toUpperCase(), txn.instrument, txn.account_last4 && `••${txn.account_last4}`, txn.ref_no && `ref ${txn.ref_no}`]
                      .filter(Boolean)
                      .join(' · ')}
                {txn.categorised_by && txn.source !== 'manual' && ` · categorised by ${txn.categorised_by}`}
              </p>
              {txn.email_id && (
                <details onToggle={(e) => (e.target as HTMLDetailsElement).open && !email && api.get<EmailRow>(`/api/emails/${encodeURIComponent(txn.email_id!)}`).then(setEmail)}>
                  <summary className="cursor-pointer text-ink-2">Show original email</summary>
                  <div className="mt-2 rounded-xl bg-sunken p-3 whitespace-pre-wrap text-ink-2">
                    {email ? (
                      <>
                        <strong className="block text-ink">{email.subject}</strong>
                        {email.body_text?.trim().slice(0, 1500)}
                      </>
                    ) : (
                      'Loading…'
                    )}
                  </div>
                </details>
              )}
              <button type="button" onClick={remove} disabled={busy} className={`self-start font-medium ${confirmDelete ? 'text-danger' : 'text-danger/80'}`}>
                {confirmDelete ? 'Tap again to delete' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
