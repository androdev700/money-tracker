import type { FastifyInstance } from 'fastify';
import { normaliseMerchant } from '../classify/merchant.ts';
import { tx, type DB } from '../db.ts';
import { toLocalIso } from '../parsers/common.ts';
import { applyMerchantRule } from '../pipeline/ingest.ts';

const MONTH = /^\d{4}-\d{2}$/;
const COUNTED = `t.deleted_at IS NULL AND t.duplicate_of IS NULL AND t.kind IN ('spend','refund')`;
const SIGNED = `CASE WHEN t.kind = 'refund' THEN -t.amount_paise ELSE t.amount_paise END`;

const TXN_SELECT = `
  SELECT t.id, t.email_id, t.source, t.txn_at, t.amount_paise, t.merchant, t.merchant_key, t.category_id,
         t.kind, t.exclude_reason, t.instrument, t.bank, t.account_last4, t.ref_no, t.note, t.categorised_by,
         t.needs_review, t.user_edited, t.duplicate_of,
         c.name AS category_name, c.icon AS category_icon, c.color AS category_color
  FROM transactions t LEFT JOIN categories c ON c.id = t.category_id`;

function prevMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

interface TxnBody {
  txn_at?: string;
  amount_paise?: number;
  merchant?: string;
  category_id?: number | null;
  note?: string | null;
  kind?: 'spend' | 'refund' | 'excluded';
  email_id?: string;
  apply_to_merchant?: boolean;
  not_duplicate?: boolean;
}

const txnBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    txn_at: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2})?$' },
    amount_paise: { type: 'integer', minimum: 1 },
    merchant: { type: 'string', minLength: 1, maxLength: 80 },
    category_id: { type: ['integer', 'null'] },
    note: { type: ['string', 'null'], maxLength: 500 },
    kind: { enum: ['spend', 'refund', 'excluded'] },
    email_id: { type: 'string' },
    apply_to_merchant: { type: 'boolean' },
    not_duplicate: { type: 'boolean' },
  },
};

const withSeconds = (s: string) => (s.length === 16 ? `${s}:00` : s);

export function transactionRoutes(app: FastifyInstance, db: DB) {
  app.get<{ Querystring: { month?: string } }>('/api/summary', async (req, reply) => {
    const month = req.query.month ?? '';
    if (!MONTH.test(month)) return reply.code(400).send({ error: 'month must be YYYY-MM' });

    const total = (m: string, upTo = '9999') =>
      (db.prepare(`SELECT COALESCE(SUM(${SIGNED}), 0) AS v FROM transactions t WHERE ${COUNTED} AND substr(t.txn_at, 1, 7) = ? AND t.txn_at <= ?`).get(m, upTo) as { v: number }).v;

    // Mid-month, "vs last month" only means something against the same number of days.
    const now = toLocalIso(new Date());
    const prev = prevMonth(month);
    const [py, pm] = prev.split('-').map(Number);
    const sameDay = Math.min(Number(now.slice(8, 10)), new Date(py, pm, 0).getDate());
    const prevToDate = now.startsWith(month) ? total(prev, `${prev}-${String(sameDay).padStart(2, '0')}T23:59:59`) : null;

    const byCategory = db
      .prepare(
        `SELECT t.category_id, c.name, c.icon, c.color, SUM(${SIGNED}) AS total, COUNT(*) AS count
         FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
         WHERE ${COUNTED} AND substr(t.txn_at, 1, 7) = ?
         GROUP BY t.category_id ORDER BY total DESC`,
      )
      .all(month);

    const byDay = db
      .prepare(
        `SELECT substr(t.txn_at, 1, 10) AS day, SUM(${SIGNED}) AS total FROM transactions t
         WHERE ${COUNTED} AND substr(t.txn_at, 1, 7) = ? GROUP BY day ORDER BY day`,
      )
      .all(month);

    const flags = db
      .prepare(
        `SELECT
           SUM(t.kind = 'excluded' AND t.deleted_at IS NULL) AS excluded,
           SUM(t.deleted_at IS NULL AND t.duplicate_of IS NULL AND t.kind != 'excluded'
               AND (t.needs_review = 1 OR t.category_id IS NULL)) AS review
         FROM transactions t WHERE substr(t.txn_at, 1, 7) = ?`,
      )
      .get(month) as { excluded: number | null; review: number | null };

    return {
      month,
      total: total(month),
      prevTotal: total(prev),
      prevToDate,
      byCategory,
      byDay,
      excludedCount: flags.excluded ?? 0,
      reviewCount: flags.review ?? 0,
    };
  });

  app.get<{
    Querystring: { month?: string; category?: string; kind?: string; source?: string; q?: string; review?: string; limit?: string };
  }>('/api/transactions', async (req) => {
    const { month, category, kind = 'counted', source, q, review } = req.query;
    const where = ['t.deleted_at IS NULL'];
    const args: (string | number)[] = [];

    if (month && MONTH.test(month)) {
      where.push('substr(t.txn_at, 1, 7) = ?');
      args.push(month);
    }
    if (category === 'none') where.push('t.category_id IS NULL');
    else if (category) {
      where.push('t.category_id = ?');
      args.push(Number(category));
    }
    if (kind === 'counted') where.push(`t.kind IN ('spend','refund') AND t.duplicate_of IS NULL`);
    else if (kind === 'duplicate') where.push('t.duplicate_of IS NOT NULL');
    else if (kind !== 'all') {
      where.push('t.kind = ?');
      args.push(kind);
    }
    if (source === 'email' || source === 'manual') {
      where.push('t.source = ?');
      args.push(source);
    }
    if (review === '1') where.push(`t.kind != 'excluded' AND t.duplicate_of IS NULL AND (t.needs_review = 1 OR t.category_id IS NULL)`);
    if (q?.trim()) {
      where.push('(t.merchant LIKE ? OR t.note LIKE ? OR t.merchant_key LIKE ?)');
      const like = `%${q.trim()}%`;
      args.push(like, like, like);
    }
    const limit = Math.min(Number(req.query.limit) || 500, 2000);
    return db.prepare(`${TXN_SELECT} WHERE ${where.join(' AND ')} ORDER BY t.txn_at DESC, t.id DESC LIMIT ${limit}`).all(...args);
  });

  app.get<{ Params: { id: string } }>('/api/transactions/:id', async (req, reply) => {
    const row = db.prepare(`${TXN_SELECT} WHERE t.id = ?`).get(Number(req.params.id));
    return row ?? reply.code(404).send({ error: 'not found' });
  });

  app.post<{ Body: TxnBody }>(
    '/api/transactions',
    { schema: { body: { ...txnBodySchema, required: ['txn_at', 'amount_paise', 'merchant'] } } },
    async (req, reply) => {
      const b = req.body;
      const merchant = normaliseMerchant(b.merchant!);
      const kind = b.kind ?? 'spend';
      const id = tx(db, () => {
        const res = db
          .prepare(
            `INSERT INTO transactions (email_id, source, txn_at, amount_paise, merchant, merchant_key, category_id, kind,
               exclude_reason, note, categorised_by, user_edited)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'user', 1)`,
          )
          .run(
            b.email_id ?? null,
            b.email_id ? 'email' : 'manual',
            withSeconds(b.txn_at!),
            b.amount_paise!,
            b.merchant!.trim(),
            merchant.key,
            b.category_id ?? null,
            kind,
            kind === 'excluded' ? 'marked by you' : null,
            b.note ?? null,
          );
        if (b.email_id) db.prepare(`UPDATE emails SET parse_status = 'parsed', parser = 'manual', error = NULL WHERE id = ?`).run(b.email_id);
        return Number(res.lastInsertRowid);
      });
      if (b.apply_to_merchant && b.category_id) applyMerchantRule(db, merchant.key, b.category_id, null);
      return reply.code(201).send(db.prepare(`${TXN_SELECT} WHERE t.id = ?`).get(id));
    },
  );

  app.patch<{ Params: { id: string }; Body: TxnBody }>(
    '/api/transactions/:id',
    { schema: { body: txnBodySchema } },
    async (req, reply) => {
      const id = Number(req.params.id);
      const current = db.prepare('SELECT merchant, merchant_key FROM transactions WHERE id = ? AND deleted_at IS NULL').get(id) as
        | { merchant: string; merchant_key: string }
        | undefined;
      if (!current) return reply.code(404).send({ error: 'not found' });

      const b = req.body;
      const sets: string[] = [];
      const args: (string | number | null)[] = [];
      const set = (col: string, v: string | number | null) => {
        sets.push(`${col} = ?`);
        args.push(v);
      };
      if (b.txn_at) set('txn_at', withSeconds(b.txn_at));
      if (b.amount_paise) set('amount_paise', b.amount_paise);
      if (b.merchant) set('merchant', b.merchant.trim());
      if (b.category_id !== undefined) {
        set('category_id', b.category_id);
        set('categorised_by', 'user');
      }
      if (b.note !== undefined) set('note', b.note);
      if (b.kind) {
        set('kind', b.kind);
        set('exclude_reason', b.kind === 'excluded' ? 'marked by you' : null);
      }
      if (b.not_duplicate) set('duplicate_of', null);

      db.prepare(
        `UPDATE transactions SET ${[...sets, 'user_edited = 1', 'needs_review = 0', `updated_at = datetime('now')`].join(', ')} WHERE id = ?`,
      ).run(...args, id);

      if (b.apply_to_merchant && b.category_id) {
        const renamed = b.merchant && b.merchant.trim() !== current.merchant ? b.merchant.trim() : null;
        applyMerchantRule(db, current.merchant_key, b.category_id, renamed);
      }
      return db.prepare(`${TXN_SELECT} WHERE t.id = ?`).get(id);
    },
  );

  // Soft delete: an email-sourced row must stay tombstoned or the next sync would recreate it.
  app.delete<{ Params: { id: string } }>('/api/transactions/:id', async (req, reply) => {
    const res = db.prepare(`UPDATE transactions SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`).run(Number(req.params.id));
    return res.changes ? reply.code(204).send() : reply.code(404).send({ error: 'not found' });
  });
}
