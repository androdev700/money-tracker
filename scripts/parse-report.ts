// Dry run of the full pipeline over every stored email, on a snapshot of the database: per-sender coverage,
// what was ignored and why, duplicate pairs, uncategorised merchants and monthly totals. The real data is untouched
// apart from new emails being fetched.
//   npm run parse-report                 fetch new mail, then report
//   npm run parse-report -- --no-fetch
//   npm run parse-report -- --refetch    re-download bodies (after a body-extraction fix), then report
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config, gmailConfigured } from '../server/config.ts';
import { openDb } from '../server/db.ts';
import { fetchNewEmails } from '../server/gmail/imap.ts';
import { cleanText } from '../server/parsers/common.ts';
import { parseEmail } from '../server/parsers/index.ts';
import { reparse } from '../server/pipeline/ingest.ts';

const args = new Set(process.argv.slice(2));
const db = openDb(config.dbPath);

if (!args.has('--no-fetch')) {
  if (!gmailConfigured()) {
    console.error('Set GMAIL_USER and GMAIL_APP_PASSWORD in .env, or pass --no-fetch.');
    process.exit(1);
  }
  const { fetched, mailbox } = await fetchNewEmails(db, { refetch: args.has('--refetch') });
  console.log(`${args.has('--refetch') ? 'Re-fetched' : 'Fetched'} ${fetched} email(s) from "${mailbox}".\n`);
}

const snapshot = join(tmpdir(), `money-report-${process.pid}.db`);
db.exec(`VACUUM INTO '${snapshot.replace(/'/g, "''")}'`);
db.close();
const sim = openDb(snapshot);
// Rebuild from scratch so the report reflects the current parsers; your edits and learned rules stay.
sim.exec(`UPDATE transactions SET duplicate_of = NULL
            WHERE user_edited = 0 OR duplicate_of IN (SELECT id FROM transactions WHERE user_edited = 0 AND deleted_at IS NULL);
          DELETE FROM transactions WHERE user_edited = 0 AND deleted_at IS NULL;`);
await reparse(sim, { useLlm: false });

const sender = (from: string) => (from.match(/<([^>]+)>/)?.[1] ?? from).toLowerCase();
const rupees = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;
const pad = (s: string | number, n: number) => String(s).padStart(n);
const shape = (subject: string) => subject.replace(/[\d,.]+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 70);

type Row = {
  id: string; from_addr: string; subject: string; received_at: string; body_text: string; parse_status: string; error: string | null;
  kind: string | null; dup: number | null; category_id: number | null; merchant: string | null; deleted_at: string | null;
};
const rows = sim
  .prepare(
    `SELECT e.id, e.from_addr, e.subject, e.received_at, e.body_text, e.parse_status, e.error,
            t.kind, t.duplicate_of AS dup, t.category_id, t.merchant, t.deleted_at
     FROM emails e LEFT JOIN transactions t ON t.email_id = e.id ORDER BY e.received_at`,
  )
  .all() as Row[];

type Stat = Record<'total' | 'spend' | 'refund' | 'excluded' | 'dup' | 'credit' | 'ignored' | 'unparsed' | 'uncat', number>;
const stats = new Map<string, Stat>();
const ignored = new Map<string, Map<string, number>>();
const unparsed: string[] = [];
const unknownMerchant: string[] = [];

for (const r of rows) {
  const s = sender(r.from_addr);
  const st = stats.get(s) ?? { total: 0, spend: 0, refund: 0, excluded: 0, dup: 0, credit: 0, ignored: 0, unparsed: 0, uncat: 0 };
  stats.set(s, st);
  st.total++;
  if (r.parse_status === 'unparsed') {
    st.unparsed++;
    unparsed.push(`  [${r.error ?? '?'}] ${r.received_at.slice(0, 10)} ${s}\n    ${r.subject}\n    ${cleanText(r.body_text).slice(0, 240)}`);
  } else if (r.parse_status === 'ignored') {
    const credit = r.error?.startsWith('credit');
    credit ? st.credit++ : st.ignored++;
    const m = ignored.get(s) ?? new Map<string, number>();
    ignored.set(s, m);
    const key = `${credit ? 'credit' : r.error}: ${shape(r.subject)}`;
    m.set(key, (m.get(key) ?? 0) + 1);
  } else if (r.kind && !r.deleted_at) {
    if (r.dup) st.dup++;
    else st[r.kind as 'spend' | 'refund' | 'excluded']++;
    if (!r.dup && r.kind !== 'excluded' && r.category_id === null) st.uncat++;
    if (r.merchant === 'Unknown') {
      const p = parseEmail({ from: r.from_addr, subject: r.subject, receivedAt: r.received_at, body: r.body_text });
      unknownMerchant.push(`  ${r.received_at.slice(0, 10)} ${s}\n    ${p.status === 'parsed' ? p.txn.window.slice(0, 300) : cleanText(r.body_text).slice(0, 300)}`);
    }
  }
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '-');
console.log('Coverage by sender:');
console.log(`  ${'sender'.padEnd(40)} total spend refund excl  dup credit ignored UNPARSED parsed% uncat`);
let txnEmails = 0, missed = 0;
for (const [s, st] of [...stats].sort((a, b) => b[1].total - a[1].total)) {
  const relevant = st.total - st.ignored;
  txnEmails += relevant;
  missed += st.unparsed;
  console.log(
    `  ${s.padEnd(40).slice(0, 40)} ${pad(st.total, 5)} ${pad(st.spend, 5)} ${pad(st.refund, 6)} ${pad(st.excluded, 4)} ${pad(st.dup, 4)} ${pad(st.credit, 6)} ${pad(st.ignored, 7)} ${pad(st.unparsed, 8)} ${pad(pct(relevant - st.unparsed, relevant), 7)} ${pad(st.uncat, 5)}`,
  );
}
console.log(`\n  ${rows.length} emails, ${txnEmails} transaction emails, regex parsed ${pct(txnEmails - missed, txnEmails)}\n`);

console.log('Ignored / credits by sender (check nothing here is a real spend):');
for (const [s, m] of [...ignored].sort((a, b) => [...b[1].values()].reduce((x, y) => x + y) - [...a[1].values()].reduce((x, y) => x + y))) {
  console.log(`  ${s}`);
  for (const [k, n] of [...m].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`    ${pad(n, 3)}× ${k}`);
}

if (unparsed.length) console.log(`\nUnparsed (${unparsed.length}):\n${unparsed.slice(0, 100).join('\n')}`);
if (unknownMerchant.length) console.log(`\nParsed but merchant not found (${unknownMerchant.length}):\n${unknownMerchant.slice(0, 30).join('\n')}`);

const dups = sim
  .prepare(
    `SELECT d.txn_at AS d_at, d.bank AS d_bank, d.merchant AS d_merchant, k.txn_at AS k_at, k.bank AS k_bank, k.merchant AS k_merchant, d.amount_paise
     FROM transactions d JOIN transactions k ON k.id = d.duplicate_of ORDER BY d.txn_at`,
  )
  .all() as { d_at: string; d_bank: string; d_merchant: string; k_at: string; k_bank: string; k_merchant: string; amount_paise: number }[];
if (dups.length) {
  console.log(`\nDuplicates — counted once (${dups.length}):`);
  for (const d of dups)
    console.log(`  ${pad(rupees(d.amount_paise), 10)}  kept ${d.k_at.slice(0, 16)} ${d.k_bank} "${d.k_merchant}"  ← hid ${d.d_at.slice(0, 16)} ${d.d_bank} "${d.d_merchant}"`);
}

const uncat = sim
  .prepare(
    `SELECT merchant, COUNT(*) AS n, SUM(amount_paise) AS total FROM transactions
     WHERE category_id IS NULL AND kind != 'excluded' AND duplicate_of IS NULL AND deleted_at IS NULL
     GROUP BY merchant_key ORDER BY n DESC, total DESC`,
  )
  .all() as { merchant: string; n: number; total: number }[];
if (uncat.length) {
  console.log(`\nUncategorised merchants (${uncat.length}) — pick these once in Review:`);
  for (const u of uncat.slice(0, 50)) console.log(`  ${pad(u.n, 3)}× ${u.merchant.padEnd(30)} ${pad(rupees(u.total), 10)}`);
}

const months = sim
  .prepare(
    `SELECT substr(t.txn_at, 1, 7) AS month, COALESCE(c.name, 'uncategorised') AS cat,
            SUM(CASE WHEN t.kind = 'refund' THEN -t.amount_paise ELSE t.amount_paise END) AS total
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.deleted_at IS NULL AND t.duplicate_of IS NULL AND t.kind IN ('spend','refund')
     GROUP BY month, cat ORDER BY month DESC, total DESC`,
  )
  .all() as { month: string; cat: string; total: number }[];
console.log('\nMonthly totals (compare with your statements):');
for (const month of [...new Set(months.map((m) => m.month))]) {
  const ms = months.filter((m) => m.month === month);
  console.log(`  ${month}  ${pad(rupees(ms.reduce((s, m) => s + m.total, 0)), 11)}   ${ms.map((m) => `${m.cat} ${rupees(m.total)}`).join(' · ')}`);
}

sim.close();
rmSync(snapshot, { force: true });
for (const ext of ['-wal', '-shm']) rmSync(snapshot + ext, { force: true });
