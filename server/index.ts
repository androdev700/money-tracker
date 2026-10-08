import { config } from './config.ts';
import { buildApp } from './app.ts';
import { openDb } from './db.ts';
import { startScheduler } from './sync.ts';

const db = openDb(config.dbPath);
const app = await buildApp(db, { logger: true });
await app.listen({ host: config.host, port: config.port });
startScheduler(db, (msg) => app.log.info(msg));
