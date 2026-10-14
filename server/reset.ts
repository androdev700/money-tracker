import { tx, type DB } from './db.ts';

const WIPED_SETTINGS = ['imap_cursor', 'imap_cursor:orders', 'last_sync'];

/**
 * Start the data over: spends, emails and orders go, along with the Gmail cursors so the next sync reads the
 * labels again from the start date. What the app has learned stays: merchant and item rules, categories and
 * your own-accounts list.
 */
export function resetData(db: DB) {
  return tx(db, () => {
    const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
    const removed = { transactions: count('transactions'), emails: count('emails'), orders: count('orders') };
    db.exec(`DELETE FROM order_items; DELETE FROM orders; DELETE FROM transactions; DELETE FROM emails;`);
    db.prepare(`DELETE FROM settings WHERE key IN (${WIPED_SETTINGS.map(() => '?').join(', ')})`).run(...WIPED_SETTINGS);
    return removed;
  });
}
