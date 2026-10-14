import type { FastifyInstance } from 'fastify';
import { categoryIdByName } from '../classify/categorise.ts';
import { tx, type DB } from '../db.ts';
import { itemKey } from '../orders/common.ts';
import { applyOrderToTxn, describeOrder, type ItemRow, type OrderRow } from '../orders/enrich.ts';
import { linkOrder } from '../orders/link.ts';

const ITEMS = `SELECT oi.id, oi.name, oi.qty, oi.price_paise, oi.category_id, oi.categorised_by,
                      c.name AS category_name, c.icon AS category_icon, c.color AS category_color
               FROM order_items oi LEFT JOIN categories c ON c.id = oi.category_id WHERE oi.order_id = ? ORDER BY oi.id`;

export function orderRoutes(app: FastifyInstance, db: DB) {
  const items = (orderId: number) => db.prepare(ITEMS).all(orderId) as unknown as (ItemRow & { id: number })[];

  app.get<{ Params: { id: string } }>('/api/transactions/:id/order', async (req) => {
    const order = db.prepare('SELECT * FROM orders WHERE txn_id = ?').get(Number(req.params.id)) as OrderRow | undefined;
    return order ? { ...order, items: items(order.id) } : null;
  });

  app.get<{ Querystring: { status?: string } }>('/api/orders', async (req) => {
    const ids = categoryIdByName(db);
    const rows = db
      .prepare(`SELECT * FROM orders WHERE status = ? AND extracted_by != 'llm' ORDER BY ordered_at DESC LIMIT 200`)
      .all(req.query.status ?? 'unmatched') as unknown as OrderRow[];
    return rows.map((o) => {
      const list = items(o.id);
      return { ...o, items: list, suggested: describeOrder(o, list, ids) };
    });
  });

  // Spends this order could belong to: same amount (±₹1) within a week either side, not already linked.
  app.get<{ Params: { id: string } }>('/api/orders/:id/candidates', async (req, reply) => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id)) as OrderRow | undefined;
    if (!o) return reply.code(404).send({ error: 'not found' });
    return db
      .prepare(
        `SELECT t.id, t.txn_at, t.amount_paise, t.merchant, t.label, c.icon AS category_icon, c.color AS category_color, c.name AS category_name
         FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.deleted_at IS NULL AND t.duplicate_of IS NULL AND t.kind = 'spend'
           AND t.amount_paise BETWEEN ?1 - 100 AND ?1 + 100
           AND t.txn_at BETWEEN strftime('%Y-%m-%dT%H:%M:%S', ?2, '-7 days') AND strftime('%Y-%m-%dT%H:%M:%S', ?2, '+7 days')
           AND NOT EXISTS (SELECT 1 FROM orders x WHERE x.txn_id = t.id)
         ORDER BY abs(julianday(t.txn_at) - julianday(?2)) LIMIT 20`,
      )
      .all(o.total_paise, o.ordered_at);
  });

  app.post<{ Params: { id: string }; Body: { txn_id: number } }>(
    '/api/orders/:id/link',
    { schema: { body: { type: 'object', required: ['txn_id'], properties: { txn_id: { type: 'integer' } } } } },
    async (req, reply) => (linkOrder(db, Number(req.params.id), req.body.txn_id) ? { ok: true } : reply.code(409).send({ error: 'that spend already has an order' })),
  );

  app.post<{ Params: { id: string } }>('/api/orders/:id/dismiss', async (req) => {
    db.prepare(`UPDATE orders SET status = 'dismissed' WHERE id = ?`).run(Number(req.params.id));
    return { ok: true };
  });

  // "Not this spend": drop the order's details from it and stop matching the order.
  app.post<{ Params: { id: string } }>('/api/orders/:id/unlink', async (req) => {
    tx(db, () => {
      db.prepare('UPDATE transactions SET label = NULL WHERE id = (SELECT txn_id FROM orders WHERE id = ?)').run(Number(req.params.id));
      db.prepare(`UPDATE orders SET txn_id = NULL, status = 'dismissed', linked_by = 'user' WHERE id = ?`).run(Number(req.params.id));
    });
    return { ok: true };
  });

  // Correct one item: remembered for that product everywhere, and this order's spend follows it.
  app.patch<{ Params: { id: string }; Body: { category_id: number } }>(
    '/api/order-items/:id',
    { schema: { body: { type: 'object', required: ['category_id'], properties: { category_id: { type: 'integer' } } } } },
    async (req, reply) => {
      const item = db.prepare('SELECT order_id, name FROM order_items WHERE id = ?').get(Number(req.params.id)) as { order_id: number; name: string } | undefined;
      if (!item) return reply.code(404).send({ error: 'not found' });
      const key = itemKey(item.name);
      tx(db, () => {
        db.prepare(
          `INSERT INTO item_rules (item_key, category_id, source) VALUES (?, ?, 'user')
           ON CONFLICT(item_key) DO UPDATE SET category_id = excluded.category_id, source = 'user', updated_at = datetime('now')`,
        ).run(key, req.body.category_id);
        const same = (db.prepare('SELECT id, order_id, name FROM order_items').all() as { id: number; order_id: number; name: string }[]).filter((i) => itemKey(i.name) === key);
        const update = db.prepare(`UPDATE order_items SET category_id = ?, categorised_by = 'user' WHERE id = ?`);
        for (const i of same) update.run(req.body.category_id, i.id);
        for (const orderId of new Set(same.map((i) => i.order_id))) applyOrderToTxn(db, orderId, { force: orderId === item.order_id });
      });
      return { ok: true, items: items(item.order_id) };
    },
  );
}

