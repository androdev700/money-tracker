import { tx, type DB } from '../db.ts';
import { extractOrderWithLlm } from '../llm/ollama.ts';
import { categoriseItem } from './categorise-item.ts';
import { receivedIso, type OrderEmail, type ParsedOrder } from './common.ts';
import { matchOrders } from './match.ts';
import { parseOrderEmail } from './parse.ts';

interface Options {
  useLlm: boolean;
}

const GENERIC_HOST = /^(?:mail|mailer|email|updates?|alerts?|noreply|no-reply|info|net|e|em|delivery|cs|rmt|www|in|com|co|org|email)$/;

/** "no-reply@mailer22.actcorp.in" → "actcorp". */
export function senderSource(from: string): string {
  const host = from.match(/@([\w.-]+)/)?.[1]?.toLowerCase() ?? 'unknown';
  const parts = host.split('.').map((p) => p.replace(/\d+$/, '')).filter((p) => p && !GENERIC_HOST.test(p));
  return parts.at(-1) ?? host;
}

async function llmOrder(email: OrderEmail): Promise<ParsedOrder | 'ignored' | null> {
  const out = await extractOrderWithLlm(email.subject, email.body);
  if (!out) return null;
  if (!out.is_purchase || !(out.total > 0)) return 'ignored';
  const at = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(out.ordered_at) ? `${out.ordered_at.replace(' ', 'T')}:00` : receivedIso(email.receivedAt);
  const items = out.items.filter((i) => i.name?.trim()).map((i) => ({ name: i.name.trim(), qty: Math.max(1, Math.round(i.qty) || 1), pricePaise: i.price > 0 ? Math.round(i.price * 100) : null }));
  return {
    source: senderSource(email.from),
    store: out.store?.trim() || null,
    orderRef: null,
    orderedAt: at,
    totalPaise: Math.round(out.total * 100),
    kind: 'retail',
    items: items.length ? items : [{ name: out.store || senderSource(email.from), qty: 1, pricePaise: Math.round(out.total * 100) }],
  };
}

type Row = { id: string; from_addr: string; subject: string; received_at: string; body_text: string };
export type OrderOutcome = 'order' | 'llm' | 'duplicate' | 'ignored' | 'unparsed';

/** Read pending order emails into orders + items, then link orders to spends. Never creates or changes amounts. */
export async function processPendingOrders(db: DB, opts: Options): Promise<Record<OrderOutcome, number> & { matched: number }> {
  const counts: Record<OrderOutcome, number> = { order: 0, llm: 0, duplicate: 0, ignored: 0, unparsed: 0 };
  const emails = db
    .prepare(`SELECT id, from_addr, subject, received_at, body_text FROM emails WHERE mailbox = 'orders' AND parse_status = 'pending' ORDER BY received_at`)
    .all() as unknown as Row[];
  const setStatus = db.prepare('UPDATE emails SET parse_status = ?, parser = ?, error = ? WHERE id = ?');

  for (const e of emails) {
    const email: OrderEmail = { from: e.from_addr, subject: e.subject, receivedAt: e.received_at, body: e.body_text };
    const res = parseOrderEmail(email);
    let order: ParsedOrder | null = res.status === 'order' ? res.order : null;
    let by: 'parser' | 'llm' = 'parser';

    if (res.status === 'unparsed' && opts.useLlm) {
      const llm = await llmOrder(email);
      if (llm === 'ignored') {
        setStatus.run('ignored', 'llm', 'not a purchase', e.id);
        counts.ignored++;
        continue;
      }
      if (llm) {
        order = llm;
        by = 'llm';
      }
    }
    if (!order) {
      setStatus.run(res.status === 'order' ? 'ignored' : res.status, res.source, 'reason' in res ? res.reason : null, e.id);
      counts[res.status === 'unparsed' ? 'unparsed' : 'ignored']++;
      continue;
    }

    // Confirmation, shipped and delivered mails can all carry the same order; the first one read wins.
    if (order.orderRef && db.prepare('SELECT 1 FROM orders WHERE source = ? AND order_ref = ?').get(order.source, order.orderRef)) {
      setStatus.run('ignored', order.source, 'same order as an earlier email', e.id);
      counts.duplicate++;
      continue;
    }

    const categorised: { item: ParsedOrder['items'][number]; cat: Awaited<ReturnType<typeof categoriseItem>> }[] = [];
    for (const item of order.items) categorised.push({ item, cat: await categoriseItem(db, item, { useLlm: opts.useLlm, orderKind: order.kind }) });

    const o = order;
    tx(db, () => {
      const id = Number(
        db
          .prepare(
            `INSERT INTO orders (email_id, source, store, order_ref, ordered_at, total_paise, kind, extracted_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(e.id, o.source, o.store, o.orderRef, o.orderedAt, o.totalPaise, o.kind, by).lastInsertRowid,
      );
      const insertItem = db.prepare('INSERT INTO order_items (order_id, name, qty, price_paise, category_id, categorised_by) VALUES (?, ?, ?, ?, ?, ?)');
      for (const { item, cat } of categorised) insertItem.run(id, item.name, item.qty, item.pricePaise, cat.categoryId, cat.by);
      setStatus.run(by === 'llm' ? 'llm' : 'parsed', o.source, null, e.id);
    });
    counts[by === 'llm' ? 'llm' : 'order']++;
  }

  return { ...counts, matched: matchOrders(db).matched };
}

/** Rebuild orders from their emails (after parser changes). Orders you linked or dismissed by hand stay. */
export async function reparseOrders(db: DB, opts: Options) {
  tx(db, () => {
    const rebuilt = `SELECT id FROM orders WHERE linked_by IS NOT 'user' AND status != 'dismissed'`;
    db.exec(`UPDATE transactions SET label = NULL WHERE id IN (SELECT txn_id FROM orders WHERE id IN (${rebuilt}))`);
    db.exec(`DELETE FROM order_items WHERE order_id IN (${rebuilt})`);
    db.exec(`DELETE FROM orders WHERE id IN (${rebuilt})`);
    db.exec(`UPDATE emails SET parse_status = 'pending' WHERE mailbox = 'orders' AND id NOT IN (SELECT email_id FROM orders)`);
  });
  return processPendingOrders(db, opts);
}
