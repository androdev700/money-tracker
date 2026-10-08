import type { FastifyInstance } from 'fastify';
import { config, gmailConfigured } from '../config.ts';
import { getSetting, setSetting, type DB } from '../db.ts';
import { ollamaAvailable } from '../llm/ollama.ts';
import { DISMISSED, reparse } from '../pipeline/ingest.ts';
import { exclusive, isSyncing, syncNow } from '../sync.ts';

export function adminRoutes(app: FastifyInstance, db: DB) {
  app.get('/api/status', async () => {
    const counts = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM transactions WHERE deleted_at IS NULL AND duplicate_of IS NULL AND kind != 'excluded'
              AND (needs_review = 1 OR category_id IS NULL)) AS review,
           (SELECT COUNT(*) FROM emails WHERE parse_status = 'unparsed') AS unparsed`,
      )
      .get() as { review: number; unparsed: number };
    return {
      lastSync: getSetting(db, 'last_sync', null),
      syncing: isSyncing(),
      gmail: { configured: gmailConfigured(), user: config.gmail.user, label: config.gmail.label },
      ollama: { enabled: Boolean(config.ollama.url), available: await ollamaAvailable(), model: config.ollama.model },
      reviewCount: counts.review,
      unparsedCount: counts.unparsed,
    };
  });

  app.post('/api/sync', async () => syncNow(db));

  app.post<{ Body: { scope?: 'all' | 'unparsed' } }>('/api/reparse', async (req) =>
    exclusive(async () => reparse(db, { useLlm: await ollamaAvailable() }, req.body?.scope === 'unparsed' ? 'unparsed' : 'all')),
  );

  app.get('/api/categories', async () => db.prepare('SELECT * FROM categories ORDER BY archived, sort, name').all());

  const categorySchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 30 },
      icon: { type: 'string', minLength: 1, maxLength: 8 },
      color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
      sort: { type: 'integer' },
      archived: { type: 'boolean' },
    },
  };

  app.post<{ Body: { name: string; icon: string; color: string } }>(
    '/api/categories',
    { schema: { body: { ...categorySchema, required: ['name', 'icon', 'color'] } } },
    async (req, reply) => {
      const { name, icon, color } = req.body;
      const sort = (db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM categories').get() as { s: number }).s;
      try {
        const res = db.prepare('INSERT INTO categories (name, icon, color, sort) VALUES (?, ?, ?, ?)').run(name.trim().toLowerCase(), icon, color, sort);
        return reply.code(201).send(db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(res.lastInsertRowid)));
      } catch {
        return reply.code(409).send({ error: 'a category with that name exists' });
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: { name?: string; icon?: string; color?: string; sort?: number; archived?: boolean } }>(
    '/api/categories/:id',
    { schema: { body: categorySchema } },
    async (req, reply) => {
      const b = req.body;
      const cols = Object.entries({
        name: b.name?.trim().toLowerCase(),
        icon: b.icon,
        color: b.color,
        sort: b.sort,
        archived: b.archived === undefined ? undefined : Number(b.archived),
      }).filter(([, v]) => v !== undefined) as [string, string | number][];
      if (!cols.length) return reply.code(400).send({ error: 'nothing to update' });
      try {
        db.prepare(`UPDATE categories SET ${cols.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`).run(
          ...cols.map(([, v]) => v),
          Number(req.params.id),
        );
      } catch {
        return reply.code(409).send({ error: 'a category with that name exists' });
      }
      return db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(req.params.id));
    },
  );

  app.get('/api/rules', async () =>
    db
      .prepare(
        `SELECT r.merchant_key, r.display_name, r.category_id, c.name AS category_name, c.icon AS category_icon,
                (SELECT COUNT(*) FROM transactions t WHERE t.merchant_key = r.merchant_key AND t.deleted_at IS NULL) AS txn_count
         FROM merchant_rules r JOIN categories c ON c.id = r.category_id ORDER BY r.updated_at DESC`,
      )
      .all(),
  );

  app.delete<{ Params: { key: string } }>('/api/rules/:key', async (req, reply) => {
    db.prepare('DELETE FROM merchant_rules WHERE merchant_key = ?').run(req.params.key);
    return reply.code(204).send();
  });

  app.get('/api/settings', async () => ({ ownAccounts: getSetting<string[]>(db, 'own_accounts', []) }));

  app.put<{ Body: { ownAccounts: string[] } }>(
    '/api/settings',
    {
      schema: {
        body: {
          type: 'object',
          required: ['ownAccounts'],
          properties: { ownAccounts: { type: 'array', items: { type: 'string', maxLength: 80 }, maxItems: 50 } },
        },
      },
    },
    async (req) => {
      const own = req.body.ownAccounts.map((s) => s.trim()).filter(Boolean);
      setSetting(db, 'own_accounts', own);
      return { ownAccounts: own };
    },
  );

  app.get<{ Querystring: { status?: string } }>('/api/emails', async (req) =>
    db
      .prepare(
        `SELECT id, from_addr, subject, received_at, parse_status, parser, error, substr(body_text, 1, 300) AS snippet
         FROM emails WHERE parse_status = ? ORDER BY received_at DESC LIMIT 200`,
      )
      .all(req.query.status ?? 'unparsed'),
  );

  app.get<{ Params: { id: string } }>('/api/emails/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM emails WHERE id = ?').get(req.params.id);
    return row ?? reply.code(404).send({ error: 'not found' });
  });

  app.post<{ Params: { id: string } }>('/api/emails/:id/dismiss', async (req) => {
    db.prepare(`UPDATE emails SET parse_status = 'ignored', error = ? WHERE id = ?`).run(DISMISSED, req.params.id);
    return { ok: true };
  });
}
