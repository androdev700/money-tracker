import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DB } from './db.ts';
import { adminRoutes } from './routes/admin.ts';
import { transactionRoutes } from './routes/transactions.ts';

export async function buildApp(db: DB, opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ? { level: 'info' } : false });
  transactionRoutes(app, db);
  adminRoutes(app, db);

  const webRoot = resolve(import.meta.dirname, '../dist/web');
  if (existsSync(webRoot)) {
    await app.register(fastifyStatic, { root: webRoot });
    // Client-side routes (/review, /settings) get the app shell; missing files and API paths are real 404s.
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith('/api/') || /\.\w+$/.test(req.url.split('?')[0])
        ? reply.code(404).send({ error: 'not found' })
        : reply.sendFile('index.html'),
    );
  }
  return app;
}
