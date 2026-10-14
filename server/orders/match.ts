import type { DB } from '../db.ts';
import { applyOrderToTxn, type OrderRow } from './enrich.ts';

// How each order source shows up on bank alerts and payment receipts.
const ALIASES: Record<string, string[]> = {
  swiggy: ['swiggy', 'bundl', 'instamart'],
  zomato: ['zomato', 'eternal', 'blinkit', 'grofers'],
  amazon: ['amazon', 'amzn'],
  flipkart: ['flipkart', 'fkrt'],
  decathlon: ['decathlon'],
  bookmyshow: ['bookmyshow', 'bigtree'],
};

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const aliasesFor = (o: OrderRow) => ALIASES[o.source] ?? [compact(o.source), ...(o.store ? [compact(o.store).slice(0, 8)] : [])].filter((a) => a.length >= 4);

/** Food and quick commerce charge when you order; shops may charge later, at dispatch. */
export const windowMinutes = (kind: string) => (kind === 'retail' ? 72 * 60 : 3 * 60);
// A spend whose name doesn't look like the shop needs both the exact amount and this close a time.
const UNNAMED_MATCH_MINUTES = 60;

interface Candidate {
  id: number;
  txn_at: string;
  amount_paise: number;
  name: string;
}

/**
 * Link unlinked orders to the spend that paid for them: same amount (±₹1) within the window, preferring a spend
 * named like the shop, then the exact amount, then the closest time. Runs both ways on every sync, so a bank
 * alert arriving after its order still links. Orders past their window without a match wait in Review.
 */
export function matchOrders(db: DB, now = new Date()): { matched: number; unmatched: number } {
  const orders = db
    .prepare(`SELECT * FROM orders WHERE status IN ('pending', 'unmatched') AND txn_id IS NULL ORDER BY ordered_at`)
    .all() as unknown as OrderRow[];
  const findCandidates = db.prepare(
    `SELECT t.id, t.txn_at, t.amount_paise, lower(t.merchant || ' ' || t.merchant_key) AS name FROM transactions t
     WHERE t.deleted_at IS NULL AND t.duplicate_of IS NULL AND t.kind = 'spend'
       AND t.amount_paise BETWEEN ?1 - 100 AND ?1 + 100
       AND t.txn_at BETWEEN strftime('%Y-%m-%dT%H:%M:%S', ?2, ?3) AND strftime('%Y-%m-%dT%H:%M:%S', ?2, ?4)
       AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.txn_id = t.id)`,
  );
  let matched = 0;
  let unmatched = 0;

  for (const o of orders) {
    const win = windowMinutes(o.kind);
    const aliases = aliasesFor(o);
    const scored = (findCandidates.all(o.total_paise, o.ordered_at, `-${win} minutes`, `+${win} minutes`) as unknown as Candidate[])
      .map((c) => ({
        c,
        named: aliases.some((a) => compact(c.name).includes(a)),
        exact: c.amount_paise === o.total_paise,
        minutes: Math.abs(Date.parse(c.txn_at) - Date.parse(o.ordered_at)) / 60_000,
      }))
      .filter((s) => s.named || (s.exact && s.minutes <= UNNAMED_MATCH_MINUTES))
      .sort((a, b) => Number(b.named) - Number(a.named) || Number(b.exact) - Number(a.exact) || a.minutes - b.minutes);

    const best = scored[0];
    if (best) {
      db.prepare(`UPDATE orders SET txn_id = ?, status = 'matched', linked_by = 'auto' WHERE id = ?`).run(best.c.id, o.id);
      applyOrderToTxn(db, o.id);
      matched++;
    } else if (now.getTime() - Date.parse(o.ordered_at) > win * 60_000 && o.status !== 'unmatched') {
      db.prepare(`UPDATE orders SET status = 'unmatched' WHERE id = ?`).run(o.id);
      unmatched++;
    }
  }
  return { matched, unmatched };
}
