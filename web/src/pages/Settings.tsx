import { useEffect, useState, type ReactNode } from 'react';
import { CategoryTile, useCategoryMap } from '../components/CategoryTile';
import { Section } from '../components/Grouped';
import { Glyph } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { api, type Rule, type Status, type SyncStatus } from '../lib/api';
import { capitalise, relativeTime } from '../lib/format';
import { useApi, useStore } from '../lib/store';

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cell">
      <div className="cell-body">
        <span className="shrink-0">{label}</span>
        <span className="ml-auto min-w-0 truncate text-right text-label-2">{children}</span>
      </div>
    </div>
  );
}

function ActionRow({ children, onClick, disabled, tone = 'accent' }: { children: ReactNode; onClick: () => void; disabled?: boolean; tone?: 'accent' | 'danger' }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`cell tap ${tone === 'danger' ? 'text-danger' : 'text-accent-text'} disabled:text-label-3`}>
      <span className="cell-body">{children}</span>
    </button>
  );
}

function SyncSection() {
  const { refresh } = useStore();
  const { data: status } = useApi<Status>('/api/status');
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setResult(null);
    try {
      const r = await fn();
      const s = r as SyncStatus & Record<string, number>;
      setResult(s.ok === false ? s.error! : `Done: ${Object.entries(s.counts ?? s).filter(([k, v]) => typeof v === 'number' && v > 0 && k !== 'fetched').map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing new'}`);
    } catch (e) {
      setResult((e as Error).message);
    }
    setBusy(null);
    refresh();
  };

  const last = status?.lastSync;
  const syncing = busy === 'sync' || !!status?.syncing;
  return (
    <>
      <Section
        header="Gmail sync"
        footer={
          status && !status.gmail.configured ? (
            'Put GMAIL_USER and GMAIL_APP_PASSWORD in .env, then restart the server.'
          ) : last && !last.ok ? (
            <span className="text-danger">{last.error}</span>
          ) : status && !status.ollama.available && status.ollama.enabled ? (
            `Ollama or ${status.ollama.model} not found, so emails are read with patterns only.`
          ) : null
        }
      >
        <InfoRow label="Account">
          {status && (status.gmail.configured ? `${status.gmail.user} · “${status.gmail.label}”` : <span className="text-danger">Not set up</span>)}
        </InfoRow>
        <InfoRow label="Last sync">
          {last ? (
            <span className="inline-flex items-center gap-1.5">
              <span className={`size-2 shrink-0 rounded-full ${last.ok ? 'bg-ok' : 'bg-danger'}`} aria-hidden />
              {relativeTime(last.at)}
              <span className="sr-only">{last.ok ? ', succeeded' : ', failed'}</span>
            </span>
          ) : (
            'Never'
          )}
        </InfoRow>
        <InfoRow label="Smart parsing">{status && (status.ollama.available ? `${status.ollama.model} on Ollama` : 'Off')}</InfoRow>
      </Section>
      <Section footer={result}>
        <ActionRow disabled={!!busy || status?.syncing} onClick={() => run('sync', () => api.post('/api/sync'))}>
          {syncing ? 'Syncing…' : 'Sync now'}
        </ActionRow>
        <ActionRow disabled={!!busy} onClick={() => run('reparse', () => api.post('/api/reparse', { scope: 'all' }))}>
          {busy === 'reparse' ? 'Re-reading…' : 'Re-read all emails'}
        </ActionRow>
      </Section>
    </>
  );
}

function OwnAccountsSection() {
  const { data } = useApi<{ ownAccounts: string[] }>('/api/settings');
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (data) setText(data.ownAccounts.join('\n'));
  }, [data]);

  return (
    <Section header="Your own accounts" footer="Money sent to these isn’t counted as spend. One per line: the last 4 digits of another account, or a UPI ID. Re-read emails afterwards.">
      <div className="cell">
        <div className="cell-body py-0 pr-0">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSaved(false);
            }}
            rows={4}
            placeholder={'9911\nyou@okhdfcbank'}
            aria-label="Your own accounts"
            className="block w-full resize-y bg-transparent py-3 pr-4 font-mono text-body outline-none"
          />
        </div>
      </div>
      <ActionRow
        onClick={async () => {
          await api.put('/api/settings', { ownAccounts: text.split(/\n|,/) });
          setSaved(true);
        }}
      >
        <span className="flex items-center gap-1.5">
          {saved && <Glyph name="check" className="size-4" strokeWidth={2.5} />}
          {saved ? 'Saved' : 'Save'}
        </span>
      </ActionRow>
    </Section>
  );
}

const quietInput = 'min-w-0 rounded-md bg-transparent px-1.5 py-1 -mx-1.5 outline-none focus:bg-fill';

function CategoriesSection() {
  const { categories, refresh } = useStore();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [error, setError] = useState<string | null>(null);

  const update = async (id: number, body: object) => {
    await api.patch(`/api/categories/${id}`, body);
    refresh();
  };

  return (
    <Section header="Categories" footer={error ? <span className="text-danger">{error}</span> : 'Tap a name or emoji to change it.'}>
      {categories.map((c) => (
        <div key={c.id} className="cell">
          <span className={c.archived ? 'opacity-40' : ''}>
            <CategoryTile icon={c.icon} color={c.color} />
          </span>
          <div className="cell-body py-0">
            <input
              defaultValue={capitalise(c.name)}
              onBlur={(e) => e.target.value.trim() && e.target.value.trim().toLowerCase() !== c.name && update(c.id, { name: e.target.value })}
              className={`flex-1 ${quietInput} ${c.archived ? 'text-label-2' : ''}`}
              aria-label={`${c.name} name`}
            />
            <input
              defaultValue={c.icon}
              onBlur={(e) => e.target.value && e.target.value !== c.icon && update(c.id, { icon: e.target.value })}
              className="h-8 w-10 shrink-0 rounded-lg bg-fill text-center text-[1.125rem] outline-none focus-visible:outline-2 focus-visible:outline-accent"
              aria-label={`${c.name} icon`}
            />
            <button onClick={() => update(c.id, { archived: !c.archived })} className="-mr-2 min-h-11 w-[4.5rem] shrink-0 text-right text-body text-accent-text pr-2">
              {c.archived ? 'Restore' : 'Hide'}
            </button>
          </div>
        </div>
      ))}
      <form
        className="cell"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await api.post('/api/categories', { name, icon: icon || '•', color: '#2a78d6' });
            setName('');
            setIcon('');
            refresh();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="🙂"
          aria-label="New category icon"
          className="size-[1.875rem] shrink-0 rounded-[0.4375rem] bg-fill text-center text-[1rem] outline-none focus-visible:outline-2 focus-visible:outline-accent"
        />
        <div className="cell-body py-0">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" aria-label="New category name" className={`flex-1 ${quietInput}`} />
          <button disabled={!name.trim()} className="-mr-2 min-h-11 shrink-0 pr-2 pl-3 text-body font-semibold text-accent-text disabled:text-label-3">
            Add
          </button>
        </div>
      </form>
    </Section>
  );
}

function RulesSection() {
  const { refresh } = useStore();
  const categories = useCategoryMap();
  const { data: rules } = useApi<Rule[]>('/api/rules');
  return (
    <Section header="Learned merchants" footer="Made when you pick a category. Remove one to let auto-categorising decide again.">
      {rules && !rules.length && <p className="px-4 py-3 text-label-2">None yet</p>}
      {rules?.map((r) => (
        <div key={r.merchant_key} className="cell">
          <div className="cell-body py-1.5 pr-1">
            <span className="min-w-0 flex-1">
              <span className="block truncate">{r.display_name ?? r.merchant_key}</span>
              <span className="block text-footnote text-label-2">
                {r.txn_count} spend{r.txn_count === 1 ? '' : 's'}
              </span>
            </span>
            <span className="flex min-w-0 shrink items-center gap-1.5 text-subhead text-label-2">
              <CategoryTile icon={r.category_icon} color={categories.get(r.category_id)?.color} size="sm" />
              <span className="truncate">{capitalise(r.category_name)}</span>
            </span>
            <button
              onClick={async () => {
                await api.del(`/api/rules/${encodeURIComponent(r.merchant_key)}`);
                refresh();
              }}
              className="grid size-11 shrink-0 place-items-center rounded-full text-danger"
              aria-label={`Remove rule for ${r.merchant_key}`}
              title="Remove"
            >
              <svg viewBox="0 0 24 24" className="size-[1.375rem]" aria-hidden>
                <circle cx="12" cy="12" r="10" fill="currentColor" />
                <path d="M7.5 12h9" stroke="white" strokeWidth={2.25} strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </Section>
  );
}

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" add={false} />
      <div className="mx-auto flex max-w-[42rem] flex-col gap-8 pt-2">
        <div className="flex flex-col gap-6">
          <SyncSection />
        </div>
        <OwnAccountsSection />
        <CategoriesSection />
        <RulesSection />
      </div>
    </>
  );
}
