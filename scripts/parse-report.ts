// Dry run of the regex parsers over every stored email: per-sender coverage plus the misses to tune against.
// Fetches new mail first (emails table only); transactions are never written.
//   npm run parse-report            fetch + report
//   npm run parse-report -- --no-fetch
//   npm run parse-report -- --all   also list every parsed row
import { config, gmailConfigured } from '../server/config.ts';
import { categorise } from '../server/classify/categorise.ts';
import { classifyKind } from '../server/classify/kind.ts';
import { normaliseMerchant } from '../server/classify/merchant.ts';
import { getSetting, openDb } from '../server/db.ts';
import { fetchNewEmails } from '../server/gmail/imap.ts';
import { cleanText } from '../server/parsers/common.ts';
import { parseEmail } from '../server/parsers/index.ts';

const args = new Set(process.argv.slice(2));
const db = openDb(config.dbPath);

if (!args.has('--no-fetch')) {
  if (!gmailConfigured()) {
    console.error('Set GMAIL_USER and GMAIL_APP_PASSWORD in .env, or pass --no-fetch.');
    process.exit(1);
  }
  const { fetched, mailbox } = await fetchNewEmails(db);
  console.log(`Fetched ${fetched} new email(s) from "${mailbox}".\n`);
}

const emails = db.prepare('SELECT id, from_addr, subject, received_at, body_text FROM emails ORDER BY received_at').all() as {
  id: string;
  from_addr: string;
  subject: string;
  received_at: string;
  body_text: string;
}[];
const own = getSetting<string[]>(db, 'own_accounts', []);
const catName = new Map((db.prepare('SELECT id, name FROM categories').all() as { id: number; name: string }[]).map((c) => [c.id, c.name]));

type Stat = { total: number; spend: number; refund: number; excluded: number; credit: number; ignored: number; unparsed: number; uncategorised: number };
const bySender = new Map<string, Stat>();
const misses: string[] = [];
const uncategorised = new Map<string, number>();
const rows: string[] = [];

const senderOf = (from: string) => from.match(/<([^>]+)>/)?.[1] ?? from;
const rupees = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;

for (const e of emails) {
  const sender = senderOf(e.from_addr);
  const s = bySender.get(sender) ?? { total: 0, spend: 0, refund: 0, excluded: 0, credit: 0, ignored: 0, unparsed: 0, uncategorised: 0 };
  bySender.set(sender, s);
  s.total++;

  const res = parseEmail({ from: e.from_addr, subject: e.subject, receivedAt: e.received_at, body: e.body_text });
  if (res.status === 'ignored') {
    s.ignored++;
    continue;
  }
  if (res.status === 'unparsed') {
    s.unparsed++;
    misses.push(`  [${res.reason}] ${e.received_at.slice(0, 10)} ${sender}\n    ${e.subject}\n    ${cleanText(e.body_text).slice(0, 260)}`);
    continue;
  }
  const { kind, reason } = classifyKind(res.txn, own);
  if (!kind) {
    s.credit++;
    continue;
  }
  s[kind]++;
  const m = normaliseMerchant(res.txn.merchantRaw);
  const cat = kind === 'excluded' ? null : categorise(db, m.key, res.txn.merchantRaw ?? '');
  if (kind !== 'excluded' && !cat) {
    s.uncategorised++;
    uncategorised.set(m.name, (uncategorised.get(m.name) ?? 0) + 1);
  }
  rows.push(
    `  ${res.txn.txnAt.slice(0, 16)}  ${kind.padEnd(8)} ${rupees(res.txn.amountPaise).padStart(10)}  ${m.name.padEnd(28).slice(0, 28)} ${((cat ? catName.get(cat.categoryId) : kind === 'excluded' ? `(${reason})` : null) ?? '??').padEnd(12)} raw="${res.txn.merchantRaw ?? ''}"`,
  );
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '-');
console.log('Coverage by sender (transaction emails = total − ignored):');
console.log('  sender'.padEnd(42) + 'total  spend refund excl credit ignored UNPARSED  parsed%  uncat');
let tot = 0, txnEmails = 0, unparsed = 0;
for (const [sender, s] of [...bySender].sort((a, b) => b[1].total - a[1].total)) {
  const relevant = s.total - s.ignored;
  tot += s.total;
  txnEmails += relevant;
  unparsed += s.unparsed;
  console.log(
    `  ${sender.padEnd(40).slice(0, 40)}${String(s.total).padStart(5)}  ${String(s.spend).padStart(5)} ${String(s.refund).padStart(6)} ${String(s.excluded).padStart(4)} ${String(s.credit).padStart(6)} ${String(s.ignored).padStart(7)} ${String(s.unparsed).padStart(8)}  ${pct(relevant - s.unparsed, relevant).padStart(7)}  ${String(s.uncategorised).padStart(5)}`,
  );
}
console.log(`\n  ${tot} emails, ${txnEmails} transaction emails, regex parsed ${pct(txnEmails - unparsed, txnEmails)}\n`);

if (misses.length) console.log(`Unparsed (${misses.length}):\n${misses.slice(0, 40).join('\n')}\n`);
if (uncategorised.size)
  console.log(
    `Uncategorised merchants (${uncategorised.size}):\n${[...uncategorised].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([m, c]) => `  ${String(c).padStart(3)}× ${m}`).join('\n')}\n`,
  );
if (args.has('--all')) console.log(`Parsed rows:\n${rows.join('\n')}`);
else console.log(`(${rows.length} parsed rows; pass --all to list them)`);
