import { categoryIdByName } from '../classify/categorise.ts';
import type { DB } from '../db.ts';
import { itemTitle, mealName } from './common.ts';

export interface OrderRow {
  id: number;
  source: string;
  store: string | null;
  ordered_at: string;
  total_paise: number;
  kind: 'food' | 'grocery' | 'retail';
  txn_id: number | null;
  status: 'pending' | 'matched' | 'unmatched' | 'dismissed';
}

export interface ItemRow {
  name: string;
  qty: number;
  price_paise: number | null;
  category_id: number | null;
}

const withQty = (i: ItemRow) => `${itemTitle(i.name)}${i.qty > 1 ? ` ×${i.qty}` : ''}`;

/**
 * Food: one dish names the spend, several make it a meal. Everything else: the category with the most money
 * in it wins; several items that are mostly groceries are just "Groceries".
 */
export function describeOrder(order: OrderRow, items: ItemRow[], ids: Map<string, number>): { label: string | null; categoryId: number | null } {
  if (!items.length) return { label: order.store, categoryId: null };
  if (order.kind === 'food') return { label: items.length === 1 ? withQty(items[0]) : mealName(order.ordered_at), categoryId: ids.get('food') ?? null };

  const weight = (i: ItemRow) => (i.price_paise ?? 0) * i.qty || 1;
  const byCategory = new Map<number, number>();
  for (const i of items) if (i.category_id !== null) byCategory.set(i.category_id, (byCategory.get(i.category_id) ?? 0) + weight(i));
  const categoryId = [...byCategory].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  if (items.length === 1) return { label: withQty(items[0]), categoryId };
  if (categoryId !== null && categoryId === ids.get('groceries')) return { label: 'Groceries', categoryId };
  const top = [...items].sort((a, b) => weight(b) - weight(a))[0];
  return { label: `${itemTitle(top.name)} +${items.length - 1} more`, categoryId };
}

/**
 * Put the order's label and category on its spend. The label is extra detail; the category respects your edits
 * unless `force` (you just recategorised one of this order's items).
 */
export function applyOrderToTxn(db: DB, orderId: number, opts: { force?: boolean } = {}) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as OrderRow | undefined;
  if (!order?.txn_id) return;
  const items = db.prepare('SELECT name, qty, price_paise, category_id FROM order_items WHERE order_id = ? ORDER BY id').all(orderId) as unknown as ItemRow[];
  const { label, categoryId } = describeOrder(order, items, categoryIdByName(db));
  db.prepare(
    `UPDATE transactions SET label = ?1,
       category_id = CASE WHEN (user_edited = 0 OR ?4) AND ?2 IS NOT NULL THEN ?2 ELSE category_id END,
       categorised_by = CASE WHEN (user_edited = 0 OR ?4) AND ?2 IS NOT NULL THEN 'order' ELSE categorised_by END,
       needs_review = CASE WHEN (user_edited = 0 OR ?4) AND ?2 IS NOT NULL THEN 0 ELSE needs_review END,
       updated_at = datetime('now')
     WHERE id = ?3`,
  ).run(label, categoryId, order.txn_id, opts.force ? 1 : 0);
}
