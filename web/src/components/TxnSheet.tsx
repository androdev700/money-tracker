import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api, type EmailRow, type Kind, type Txn, type TxnInput } from '../lib/api';
import { capitalise, nowLocal } from '../lib/format';
import { useStore } from '../lib/store';
import { CategoryTile } from './CategoryTile';
import { Section, Segmented } from './Grouped';
import { Glyph } from './Icons';

export function CategoryChips({ value, onChange, size = 'md' }: { value: number | null; onChange: (id: number) => void; size?: 'sm' | 'md' }) {
  const { categories } = useStore();
  return (
    <div className="flex flex-wrap gap-2">
      {categories
        .filter((c) => !c.archived)
        .map((c) => {
          const on = value === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
              aria-pressed={on}
              className={`inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full pr-3 pl-1 transition-colors ${
                size === 'sm' ? 'h-8 text-subhead' : 'h-9 text-body'
              } ${on ? 'bg-accent-soft font-semibold text-accent-text shadow-[inset_0_0_0_1.5px_var(--accent)]' : 'tap bg-fill'}`}
            >
              <span className="grid place-items-center overflow-hidden rounded-full">
                <CategoryTile icon={c.icon} color={c.color} size="sm" />
              </span>
              <span className="truncate">{capitalise(c.name)}</span>
            </button>
          );
        })}
    </div>
  );
}

export function TxnSheet() {
  const { editing, openEditor, refresh } = useStore();
  if (!editing) return null;
  return <Sheet key={editing.id ?? `new-${editing.email_id ?? ''}`} txn={editing} close={() => openEditor(null)} done={refresh} />;
}

function FieldRow({ label, children, wrap }: { label: string; children: ReactNode; wrap?: boolean }) {
  return (
    <label className="cell">
      <span className={`cell-body py-0 ${wrap ? 'flex-wrap gap-y-0' : ''}`}>
        <span className="w-[4.5rem] shrink-0">{label}</span>
        {children}
      </span>
    </label>
  );
}

const fieldInput = 'min-w-0 flex-1 self-stretch bg-transparent py-[0.6875rem] outline-none';
const datePill = 'max-w-full rounded-md bg-fill px-2 py-1.5 text-callout outline-none focus-visible:outline-2 focus-visible:outline-accent';

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
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      removeEventListener('keydown', onKey);
      root.style.overflow = overflow;
    };
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

  const kinds: [Kind, string][] = isNew
    ? [
        ['spend', 'Spend'],
        ['refund', 'Refund'],
      ]
    : [
        ['spend', 'Spend'],
        ['refund', 'Refund'],
        ['excluded', 'Not spend'],
      ];
  const title = isNew ? 'New spend' : 'Edit spend';
  const source =
    txn.source === 'manual' ? 'Added by you' : [txn.bank?.toUpperCase(), txn.instrument, txn.account_last4 && `••${txn.account_last4}`].filter(Boolean).join(' · ');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-8" role="dialog" aria-modal="true" aria-label={title}>
      <div className="anim-fade absolute inset-0 bg-[var(--backdrop)]" onClick={close} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="anim-sheet relative flex max-h-[calc(100dvh-max(env(safe-area-inset-top),1.25rem)-0.5rem)] w-full flex-col overflow-hidden rounded-t-[0.625rem] bg-sheet shadow-[0_-0.5rem_2.5rem_rgba(0,0,0,0.18)] md:max-h-[min(54rem,calc(100dvh-4rem))] md:max-w-[33.75rem] md:rounded-xl md:shadow-[0_1.5rem_5rem_rgba(0,0,0,0.3)]"
      >
        <div className="mx-auto mt-1.5 h-[0.3125rem] w-9 shrink-0 rounded-full bg-label-3 md:hidden" aria-hidden />
        <div className="grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-2">
          <button type="button" onClick={close} className="justify-self-start rounded-lg px-2 py-2.5 text-body text-accent-text">
            Cancel
          </button>
          <h2 className="truncate text-headline">{title}</h2>
          <button type="submit" disabled={busy} className="justify-self-end rounded-lg px-2 py-2.5 text-body font-semibold text-accent-text disabled:text-label-3">
            {isNew ? 'Add' : 'Done'}
          </button>
        </div>

        <div className="flex flex-col gap-6 overflow-y-auto overscroll-contain px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          {txn.duplicate_of && (
            <Section card="bg-sheet-card" footer="Hidden as a duplicate of another alert for the same spend.">
              <button type="button" onClick={notDuplicate} className="cell tap text-accent-text">
                <span className="cell-body">Not a duplicate</span>
              </button>
            </Section>
          )}

          <div className="flex flex-col items-center gap-4 pt-2">
            <label className="flex max-w-full min-w-0 items-baseline justify-center gap-1 font-rounded font-bold">
              <span className="text-[clamp(1.75rem,9vw,2.25rem)] text-label-2">₹</span>
              <input
                ref={amountRef}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                aria-label="Amount"
                style={{ width: `${Math.max(1, amount.length) + 0.4}ch` }}
                className="max-w-[calc(100%-2rem)] min-w-0 bg-transparent text-[clamp(2.5rem,13vw,3.25rem)] leading-tight tracking-tight outline-none"
              />
            </label>
            <div className="w-full max-w-[22rem]">
              <Segmented label="Type" value={kind} options={kinds} onChange={setKind} />
            </div>
            {kind === 'excluded' && <p className="-mt-1 text-center text-footnote text-label-2">Not counted: card bill payments, transfers to your own accounts, wallet top-ups.</p>}
          </div>

          <Section card="bg-sheet-card">
            <FieldRow label="Where">
              <input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Swiggy, Amazon…" className={fieldInput} />
            </FieldRow>
            <FieldRow label="When" wrap>
              <span className="ml-auto flex max-w-full flex-wrap justify-end gap-1.5 py-1.5">
                <input
                  type="date"
                  value={when.slice(0, 10)}
                  onChange={(e) => e.target.value && setWhen(`${e.target.value}T${when.slice(11, 16) || '12:00'}`)}
                  aria-label="Date"
                  className={datePill}
                />
                <input
                  type="time"
                  value={when.slice(11, 16)}
                  onChange={(e) => e.target.value && setWhen(`${when.slice(0, 10)}T${e.target.value}`)}
                  aria-label="Time"
                  className={datePill}
                />
              </span>
            </FieldRow>
            <FieldRow label="Note">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className={fieldInput} />
            </FieldRow>
          </Section>

          {kind !== 'excluded' && (
            <Section header="Category" card="bg-sheet-card" footer={canLearn && categoryChanged && applyAll ? 'Future spends here get this category too.' : undefined}>
              <div className="p-3">
                <CategoryChips value={categoryId} onChange={setCategoryId} />
              </div>
              {canLearn && categoryChanged && (
                <label className="cell">
                  <span className="cell-body hairline-t py-1.5">
                    <span className="min-w-0 flex-1 truncate">Always use for “{txn.merchant}”</span>
                    <input type="checkbox" role="switch" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} className="switch" />
                  </span>
                </label>
              )}
            </Section>
          )}

          {error && (
            <p role="alert" className="-mt-3 px-4 text-footnote text-danger">
              {error}
            </p>
          )}

          {!isNew && (
            <Section header="Details" card="bg-sheet-card">
              <div className="cell">
                <span className="cell-body">
                  <span className="shrink-0">From</span>
                  <span className="ml-auto min-w-0 truncate text-right text-label-2">{source || 'Email'}</span>
                </span>
              </div>
              {txn.ref_no && txn.source !== 'manual' && (
                <div className="cell">
                  <span className="cell-body">
                    <span className="shrink-0">Reference</span>
                    <span className="ml-auto min-w-0 truncate text-right text-label-2">{txn.ref_no}</span>
                  </span>
                </div>
              )}
              {txn.categorised_by && txn.source !== 'manual' && (
                <div className="cell">
                  <span className="cell-body">
                    <span className="shrink-0">Categorised by</span>
                    <span className="ml-auto min-w-0 truncate text-right text-label-2">{txn.categorised_by}</span>
                  </span>
                </div>
              )}
              {txn.email_id && (
                <details
                  className="cell block p-0"
                  onToggle={(e) => (e.target as HTMLDetailsElement).open && !email && api.get<EmailRow>(`/api/emails/${encodeURIComponent(txn.email_id!)}`).then(setEmail)}
                >
                  <summary className="tap flex min-h-11 items-center pl-4">
                    <span className="cell-body hairline-t">
                      <span className="flex-1">Original email</span>
                      <Glyph name="chevronRight" className="disclosure size-4 shrink-0 text-label-3 transition-transform duration-200" strokeWidth={2.5} />
                    </span>
                  </summary>
                  <div className="px-4 pb-3 text-footnote whitespace-pre-wrap text-label-2 [overflow-wrap:anywhere]">
                    {email ? (
                      <>
                        <strong className="mb-1 block text-subhead font-semibold text-label">{email.subject}</strong>
                        {email.body_text?.trim().slice(0, 1500)}
                      </>
                    ) : (
                      'Loading…'
                    )}
                  </div>
                </details>
              )}
            </Section>
          )}

          {!isNew && (
            <Section card="bg-sheet-card">
              <button type="button" onClick={remove} disabled={busy} className={`tap flex min-h-11 w-full items-center justify-center text-body text-danger ${confirmDelete ? 'font-semibold' : ''}`}>
                {confirmDelete ? 'Tap again to delete' : 'Delete spend'}
              </button>
            </Section>
          )}
        </div>
      </form>
    </div>
  );
}
