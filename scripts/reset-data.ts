// Clear spends, emails and orders and re-read Gmail from scratch; learned rules, categories and own accounts stay.
// Backs up the database first. Without --yes it only shows what would go.
//   npm run reset-data            preview
//   npm run reset-data -- --yes   back up, then clear
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config } from '../server/config.ts';
import { openDb } from '../server/db.ts';
import { resetData } from '../server/reset.ts';

const db = openDb(config.dbPath);
const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
console.log(`Would remove: ${n('SELECT COUNT(*) AS n FROM transactions')} spends, ${n('SELECT COUNT(*) AS n FROM emails')} emails, ${n('SELECT COUNT(*) AS n FROM orders')} orders.`);
console.log(`Keeps: ${n('SELECT COUNT(*) AS n FROM merchant_rules')} merchant rules, ${n('SELECT COUNT(*) AS n FROM item_rules')} item rules, ${n('SELECT COUNT(*) AS n FROM categories')} categories, your own accounts.`);
console.log(config.syncFrom ? `The next sync reads Gmail from ${config.syncFrom}.` : `SYNC_FROM is not set: the next sync reads the last ${config.backfillMonths} months.`);

if (!process.argv.includes('--yes')) {
  console.log('\nNothing changed. Run again with --yes to do it.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backup = join(dirname(config.dbPath), 'backups', `money-${stamp}.db`);
mkdirSync(dirname(backup), { recursive: true });
db.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
console.log(`\nBacked up to ${backup}`);
console.log('Removed:', resetData(db));
console.log('Restart the app to sync: launchctl kickstart -k gui/$(id -u)/com.money-tracker');
