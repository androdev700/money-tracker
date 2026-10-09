import { useEffect, useRef, useState } from 'react';
import { api, type EmailRow, type Kind, type MerchantSuggestion, type Txn, type TxnInput } from '../lib/api';
import { amountToPaise, capitalise, groupAmountInput, nowLocal, rupees } from '../lib/format';
import { useStore } from '../lib/store';
import { useSwipeToClose } from './Picker';

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
              className={`flex items-center gap-1.5 rounded-full border transition-colors ${size === 'sm' ? 'py-1 pr-3 pl-1 text-xs' : 'py-1 pr-3.5 pl-1 text-sm'} ${
                on ? 'border-accent bg-accent text-on-accent' : 'border-line bg-card text-ink hover:bg-sunken'
              }`}
            >
              <span
                className={`tile rounded-full ${size === 'sm' ? 'size-6 text-xs' : 'size-7 text-sm'}`}
                style={{ '--tile': on ? '#ffffff' : c.color } as React.CSSProperties}
                aria-hidden
              >
                {c.icon}
              </span>
              {capitalise(c.name)}
            </button>
          );
        })}
    </div>
  );
}

const field = 'w-full rounded-2xl border border-line bg-card px-4 py-3 text-ink outline-none transition-colors focus:border-accent';
const label = 'text-xs font-medium tracking-wide text-muted uppercase';

export function TxnSheet() {
  const { editing, openEditor, refresh } = useStore();
  if (!editing) return null;
  return <Sheet key={editing.id ?? `new-${editing.email_id ?? ''}`} txn={editing} close={() => openEditor(null)} done={refresh} />;
}

const dayPart = (iso: string) => iso.slice(0, 10);
function shiftDays(localIso: string, days: number) {
  const d = new Date(`${localIso}:00`);
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}${localIso.slice(10)}`;
}

function Sheet({ txn, close, done }: { txn: Partial<Txn>; close: () => void; done: () => void }) {
  const { categories, showToast, refresh } = useStore();
  const isNew = !txn.id;
  const [amount, setAmount] = useState(txn.amount_paise ? groupAmountInput(String(txn.amount_paise / 100)) : '');
  const [merchant, setMerchant] = useState(txn.merchant ?? '');
  const [when, setWhen] = useState(txn.txn_at?.slice(0, 16) ?? nowLocal());
  const [categoryId, setCategoryId] = useState<number | null>(txn.category_id ?? null);
  const [kind, setKind] = useState<Kind>(txn.kind ?? 'spend');
  const [note, setNote] = useState(txn.note ?? '');
  const [applyAll, setApplyAll] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<EmailRow | null>(null);
  const [suggestions, setSuggestions] = useState<MerchantSuggestion[]>([]);
  const [merchantFocused, setMerchantFocused] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const swipe = useSwipeToClose(close);

  useEffect(() => {
    if (isNew) amountRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isNew]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [close]);

  useEffect(() => {
    if (!isNew) return;
    const t = setTimeout(() => {
      api.get<MerchantSuggestion[]>(`/api/merchants?q=${encodeURIComponent(merchant.trim())}`).then(setSuggestions).catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [merchant, isNew]);

  const categoryChanged = categoryId !== null && categoryId !== (txn.category_id ?? null);
  const canLearn = !isNew && txn.merchant_key !== 'unknown' && kind !== 'excluded';
  const today = dayPart(nowLocal());
  const yesterday = dayPart(shiftDays(nowLocal(), -1));
  const visibleSuggestions = suggestions.filter((s) => s.merchant.toLowerCase() !== merchant.trim().toLowerCase()).slice(0, 5);
  const categoryName = (id: number | null) => capitalise(categories.find((c) => c.id === id)?.name);

  function pickSuggestion(s: MerchantSuggestion) {
    setMerchant(s.merchant);
    if (s.category_id && categoryId === null) setCategoryId(s.category_id);
  }

  async function save() {
    const paise = amountToPaise(amount);
    if (!(paise > 0)) return setError('Enter an amount');
    if (!merchant.trim()) return setError('Enter where you spent it');
    setBusy(true);
    setError(null);
    const body: TxnInput = { amount_paise: paise, merchant: merchant.trim(), txn_at: when, category_id: categoryId, note: note.trim() || null, kind };
    const learn = canLearn && categoryChanged && applyAll;
    try {
      if (isNew) await api.post('/api/transactions', { ...body, email_id: txn.email_id ?? undefined });
      else await api.patch(`/api/transactions/${txn.id}`, { ...body, apply_to_merchant: learn });
      done();
      close();
      showToast(
        isNew
          ? `Added ${rupees(paise)} · ${merchant.trim()}`
          : learn
            ? `Saved · ${txn.merchant} is now ${categoryName(categoryId)}`
            : 'Saved',
      );
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    await api.del(`/api/transactions/${txn.id}`);
    done();
    close();
    showToast(`Deleted ${txn.merchant}`, {
      label: 'Undo',
      run: () => void api.post(`/api/transactions/${txn.id}/restore`).then(refresh),
    });
  }

  async function notDuplicate() {
    await api.patch(`/api/transactions/${txn.id}`, { not_duplicate: true });
    done();
    close();
    showToast('Counted as its own spend');
  }

  const kinds: Kind[] = isNew ? ['spend', 'refund'] : ['spend', 'refund', 'excluded'];

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal aria-label={isNew ? 'Add spend' : 'Edit spend'}>
      <div className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-[2px]" onClick={close} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        style={swipe.style}
        className="absolute inset-x-0 bottom-0 flex max-h-[94dvh] animate-sheet-up flex-col rounded-t-[1.75rem] bg-bg shadow-2xl transition-transform duration-200 md:inset-y-4 md:right-4 md:left-auto md:max-h-none md:w-[440px] md:animate-fade-in md:rounded-[1.75rem]"
      >
        <div {...swipe.handlers} className="touch-none px-5 pt-2.5 pb-1 select-none">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line md:hidden" aria-hidden />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{isNew ? 'Add spend' : 'Edit spend'}</h2>
            <button type="button" onClick={close} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-sunken text-ink-2">
              ✕
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain px-5 pt-2 pb-4">
          {txn.duplicate_of && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-3 text-sm">
              <span className="text-ink-2">Hidden as a duplicate of another alert for the same spend.</span>
              <button type="button" onClick={notDuplicate} className="shrink-0 font-medium text-accent">
                Not a duplicate
              </button>
            </div>
          )}

          <label className="flex items-baseline justify-center gap-1 pt-2">
            <span className="text-3xl font-medium text-muted">₹</span>
            <input
              ref={amountRef}
              value={amount}
              onChange={(e) => setAmount(groupAmountInput(e.target.value))}
              inputMode="decimal"
              placeholder="0"
              aria-label="Amount"
              style={{ width: `${Math.max(1, amount.length) + 0.5}ch` }}
              className="max-w-[75vw] bg-transparent text-5xl font-bold tracking-tight outline-none placeholder:text-line"
            />
          </label>

          <div className={`grid ${kinds.length === 2 ? 'grid-cols-2' : 'grid-cols-3'} rounded-2xl bg-sunken p-1 text-sm`} role="radiogroup" aria-label="Type">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`rounded-xl py-2 transition-colors ${kind === k ? 'bg-card font-semibold shadow-sm' : 'text-ink-2'}`}
              >
                {k === 'excluded' ? 'Not spend' : capitalise(k)}
              </button>
            ))}
          </div>
          {kind === 'excluded' && <p className="-mt-3 text-xs text-muted">Not counted: card bill payments, transfers to your own accounts, wallet top-ups.</p>}

          <div className="flex flex-col gap-2">
            <label htmlFor="merchant" className={label}>
              Where
            </label>
            <input
              id="merchant"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              onFocus={() => setMerchantFocused(true)}
              onBlur={() => setTimeout(() => setMerchantFocused(false), 150)}
              placeholder="Swiggy, petrol pump, …"
              autoComplete="off"
              className={field}
            />
            {isNew && merchantFocused && visibleSuggestions.length > 0 && (
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
                {visibleSuggestions.map((s) => {
                  const cat = categories.find((c) => c.id === s.category_id);
                  return (
                    <button
                      key={s.merchant}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickSuggestion(s)}
                      className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-card py-1 pr-3 pl-1 text-sm"
                    >
                      <span className="tile size-6 rounded-full text-xs" style={{ '--tile': cat?.color } as React.CSSProperties} aria-hidden>
                        {cat?.icon ?? '•'}
                      </span>
                      {s.merchant}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className={label}>When</span>
            <div className="flex flex-wrap items-center gap-2">
              {[
                ['Today', today],
                ['Yesterday', yesterday],
              ].map(([name, day]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setWhen(`${day}${when.slice(10)}`)}
                  aria-pressed={dayPart(when) === day}
                  className={`rounded-full border px-3.5 py-1.5 text-sm ${dayPart(when) === day ? 'border-accent bg-accent text-on-accent' : 'border-line bg-card'}`}
                >
                  {name}
                </button>
              ))}
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => e.target.value && setWhen(e.target.value)}
                aria-label="Date and time"
                className="min-w-0 flex-1 rounded-full border border-line bg-card px-3.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
          </div>

          {kind !== 'excluded' && (
            <div className="flex flex-col gap-2">
              <span className={label}>Category</span>
              <CategoryChips value={categoryId} onChange={setCategoryId} />
              {canLearn && categoryChanged && (
                <label className="mt-1 flex items-center justify-between gap-3 rounded-2xl bg-sunken px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">Always use for “{txn.merchant}”</span>
                    <span className="block text-xs text-muted">Past and future spends there move too</span>
                  </span>
                  <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} className="peer sr-only" />
                  <span
                    aria-hidden
                    className="relative h-7 w-12 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-accent after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-accent"
                  />
                </label>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="note" className={label}>
              Note
            </label>
            <input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className={field} />
          </div>

          {!isNew && (
            <div className="flex flex-col gap-3 rounded-2xl border border-line p-4 text-xs text-muted">
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
                  <div className="mt-2 rounded-xl bg-sunken p-3 break-words whitespace-pre-wrap text-ink-2">
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
              <button type="button" onClick={remove} disabled={busy} className="self-start font-semibold text-danger">
                Delete spend
              </button>
            </div>
          )}
        </div>

        <div className="pb-safe border-t border-line px-5 pt-3">
          {error && <p className="mb-2 text-sm text-danger">{error}</p>}
          <button type="submit" disabled={busy} className="mb-3 w-full rounded-2xl bg-accent py-3.5 font-semibold text-on-accent transition-opacity disabled:opacity-50">
            {isNew ? 'Add spend' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
