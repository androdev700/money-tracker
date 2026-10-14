import type { DB } from '../db.ts';
import { applyOrderToTxn } from './enrich.ts';

/** Your own link between an order and a spend; survives re-reading order emails. */
export function linkOrder(db: DB, orderId: number, txnId: number): boolean {
  const taken = db.prepare('SELECT 1 FROM orders WHERE txn_id = ? AND id != ?').get(txnId, orderId);
  if (taken) return false;
  const res = db.prepare(`UPDATE orders SET txn_id = ?, status = 'matched', linked_by = 'user' WHERE id = ?`).run(txnId, orderId);
  if (res.changes) applyOrderToTxn(db, orderId);
  return res.changes > 0;
}
