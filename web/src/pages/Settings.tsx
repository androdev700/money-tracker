import { useEffect, useState } from 'react';
import { api, type Rule, type Status, type SyncStatus } from '../lib/api';
import { capitalise, relativeTime } from '../lib/format';
import { useApi, useStore } from '../lib/store';

const card = 'card p-4';
const btn = 'rounded-full border border-line px-4 py-1.5 text-sm font-medium hover:bg-sunken disabled:opacity-50';

function SyncCard() {
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
  return (
    <section className={card}>
      <h2 className="mb-3 font-medium">Gmail sync</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted">Account</dt>
        <dd>{status?.gmail.configured ? `${status.gmail.user} · label “${status.gmail.label}”` : <span className="text-danger">Not configured — set it in .env</span>}</dd>
        <dt className="text-muted">Last sync</dt>
        <dd>
          {last ? (
            <>
              {relativeTime(last.at)} · {last.ok ? <span className="text-good">ok</span> : <span className="text-danger">failed</span>}
              {!last.ok && <span className="block text-xs text-danger">{last.error}</span>}
            </>
          ) : (
            'never'
          )}
        </dd>
        <dt className="text-muted">Smart parsing</dt>
        <dd>
          {status?.ollama.available ? (
            <span>
              <span className="text-good">●</span> {status.ollama.model} on Ollama
            </span>
          ) : (
            <span className="text-ink-2">Off — regex only{status?.ollama.enabled ? ` (Ollama or ${status.ollama.model} not found)` : ''}</span>
          )}
        </dd>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={btn} disabled={!!busy || status?.syncing} onClick={() => run('sync', () => api.post('/api/sync'))}>
          {busy === 'sync' || status?.syncing ? 'Syncing…' : 'Sync now'}
        </button>
        <button className={btn} disabled={!!busy} onClick={() => run('reparse', () => api.post('/api/reparse', { scope: 'all' }))}>
          {busy === 'reparse' ? 'Re-reading…' : 'Re-read all emails'}
        </button>
      </div>
      {result && <p className="mt-2 text-xs text-ink-2">{result}</p>}
    </section>
  );
}

function OwnAccountsCard() {
  const { data } = useApi<{ ownAccounts: string[] }>('/api/settings');
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (data) setText(data.ownAccounts.join('\n'));
  }, [data]);

  return (
    <section className={card}>
      <h2 className="font-medium">Your own accounts</h2>
      <p className="mb-3 text-sm text-ink-2">
        Money sent to these isn’t counted as spend. One per line: last 4 digits of another account, or your UPI ID. Then re-read emails.
      </p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        rows={4}
        placeholder={'9911\nyou@okhdfcbank'}
        className="w-full rounded-xl border border-line bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-accent"
      />
      <button
        className={`${btn} mt-2`}
        onClick={async () => {
          await api.put('/api/settings', { ownAccounts: text.split(/\n|,/) });
          setSaved(true);
        }}
      >
        {saved ? 'Saved ✓' : 'Save'}
      </button>
    </section>
  );
}

function CategoriesCard() {
  const { categories, refresh } = useStore();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [error, setError] = useState<string | null>(null);

  const update = async (id: number, body: object) => {
    await api.patch(`/api/categories/${id}`, body);
    refresh();
  };

  return (
    <section className={card}>
      <h2 className="mb-3 font-medium">Categories</h2>
      <ul className="flex flex-col divide-y divide-line">
        {categories.map((c) => (
          <li key={c.id} className={`flex items-center gap-2 py-2 ${c.archived ? 'opacity-50' : ''}`}>
            <input
              defaultValue={c.icon}
              onBlur={(e) => e.target.value && e.target.value !== c.icon && update(c.id, { icon: e.target.value })}
              className="w-10 rounded-lg bg-transparent text-center text-lg"
              aria-label={`${c.name} icon`}
            />
            <input
              defaultValue={capitalise(c.name)}
              onBlur={(e) => e.target.value.trim() && e.target.value.trim().toLowerCase() !== c.name && update(c.id, { name: e.target.value })}
              className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 hover:bg-sunken focus:bg-sunken focus:outline-none"
              aria-label={`${c.name} name`}
            />
            <button onClick={() => update(c.id, { archived: !c.archived })} className="text-xs text-ink-2">
              {c.archived ? 'Restore' : 'Hide'}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
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
        <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🙂" className="w-12 rounded-xl border border-line bg-bg px-2 py-2 text-center" aria-label="New category icon" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2" />
        <button className={btn} disabled={!name.trim()}>
          Add
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </section>
  );
}

function RulesCard() {
  const { refresh } = useStore();
  const { data: rules } = useApi<Rule[]>('/api/rules');
  return (
    <section className={card}>
      <h2 className="font-medium">Learned merchants</h2>
      <p className="mb-3 text-sm text-ink-2">Created when you pick a category. Remove one to let auto-categorising decide again.</p>
      {!rules?.length && <p className="text-sm text-muted">None yet.</p>}
      <ul className="flex flex-col divide-y divide-line">
        {rules?.map((r) => (
          <li key={r.merchant_key} className="flex items-center gap-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">
              {r.display_name ?? r.merchant_key} <span className="text-xs text-muted">· {r.txn_count}×</span>
            </span>
            <span className="shrink-0 text-ink-2">
              {r.category_icon} {capitalise(r.category_name)}
            </span>
            <button
              onClick={async () => {
                await api.del(`/api/rules/${encodeURIComponent(r.merchant_key)}`);
                refresh();
              }}
              className="text-xs text-danger"
              aria-label={`Remove rule for ${r.merchant_key}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <SyncCard />
      <OwnAccountsCard />
      <CategoriesCard />
      <RulesCard />
    </div>
  );
}
