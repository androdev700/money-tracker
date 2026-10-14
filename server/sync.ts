import { config, gmailConfigured } from './config.ts';
import { setSetting, type DB } from './db.ts';
import { fetchNewEmails } from './gmail/imap.ts';
import { ollamaAvailable } from './llm/ollama.ts';
import { processPendingOrders } from './orders/ingest.ts';
import { processPending } from './pipeline/ingest.ts';

export interface SyncStatus {
  at: string;
  ok: boolean;
  fetched?: number;
  counts?: Record<string, number>;
  orders?: Record<string, number>;
  ordersError?: string;
  error?: string;
}

let running: Promise<SyncStatus> | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** Pipeline runs (sync, re-read) are serialised: two passes over the same email would race across LLM awaits. */
export function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn);
  queue = next.catch(() => {});
  return next;
}

export function isSyncing() {
  return running !== null;
}

export function syncNow(db: DB): Promise<SyncStatus> {
  running ??= exclusive(() => run(db)).finally(() => (running = null));
  return running;
}

async function run(db: DB): Promise<SyncStatus> {
  let status: SyncStatus;
  try {
    if (!gmailConfigured()) throw new Error('Gmail is not configured: set GMAIL_USER and GMAIL_APP_PASSWORD in .env');
    const { fetched } = await fetchNewEmails(db);
    const useLlm = await ollamaAvailable();
    const counts = await processPending(db, { useLlm });
    // Orders only add detail, so a problem with that label is reported without failing the sync.
    let ordersError: string | undefined;
    if (config.gmail.ordersLabel) {
      try {
        await fetchNewEmails(db, { mailbox: 'orders', label: config.gmail.ordersLabel });
      } catch (e) {
        ordersError = (e as Error).message;
      }
    }
    const orders = await processPendingOrders(db, { useLlm });
    status = { at: new Date().toISOString(), ok: true, fetched, counts, orders, ...(ordersError && { ordersError }) };
  } catch (e) {
    status = { at: new Date().toISOString(), ok: false, error: (e as Error).message };
  }
  setSetting(db, 'last_sync', status);
  return status;
}

export function startScheduler(db: DB, log: (msg: string) => void) {
  if (!gmailConfigured()) {
    log('Gmail not configured; scheduled sync disabled');
    return;
  }
  const tick = () => syncNow(db).then((s) => log(s.ok ? `sync ok: ${JSON.stringify(s.counts)} (${s.fetched} new)` : `sync failed: ${s.error}`));
  setTimeout(tick, 5_000);
  setInterval(tick, config.syncIntervalMin * 60_000);
}
