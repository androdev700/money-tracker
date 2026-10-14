// What's in the Gmail Orders label, per sender, with sample text to build order parsers from. Read-only:
// it fetches new order mail into the emails table and never touches transactions.
//   npm run orders-report                     fetch, then summary + 2 samples per sender
//   npm run orders-report -- --no-fetch
//   npm run orders-report -- --sender=swiggy  more samples for one sender (matches the from address)
import { config, gmailConfigured } from '../server/config.ts';
import { openDb } from '../server/db.ts';
import { fetchNewEmails } from '../server/gmail/imap.ts';
import { cleanText } from '../server/parsers/common.ts';

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const senderFilter = flag('sender')?.toLowerCase();
const samplesPerSender = Number(flag('samples') ?? (senderFilter ? 6 : 2));
const sampleChars = Number(flag('chars') ?? (senderFilter ? 2500 : 1200));
const db = openDb(config.dbPath);

if (!args.includes('--no-fetch')) {
  const label = flag('label') ?? config.gmail.ordersLabel;
  if (!label) {
    console.error('Set GMAIL_ORDERS_LABEL=Orders in .env (or pass --label=Orders).');
    process.exit(1);
  }
  if (!gmailConfigured()) {
    console.error('Set GMAIL_USER and GMAIL_APP_PASSWORD in .env, or pass --no-fetch.');
    process.exit(1);
  }
  const { fetched, mailbox } = await fetchNewEmails(db, { mailbox: 'orders', label });
  console.log(`Fetched ${fetched} new email(s) from "${mailbox}".\n`);
}

const rows = db
  .prepare(`SELECT from_addr, subject, received_at, body_text FROM emails WHERE mailbox = 'orders' ORDER BY received_at DESC`)
  .all() as { from_addr: string; subject: string; received_at: string; body_text: string }[];

const sender = (from: string) => (from.match(/<([^>]+)>/)?.[1] ?? from).toLowerCase();
const shape = (subject: string) => subject.replace(/[\d,.]+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 80);

const bySender = new Map<string, typeof rows>();
for (const r of rows) {
  const s = sender(r.from_addr);
  if (senderFilter && !s.includes(senderFilter)) continue;
  bySender.set(s, [...(bySender.get(s) ?? []), r]);
}

console.log(`${rows.length} order emails from ${new Set(rows.map((r) => sender(r.from_addr))).size} senders.\n`);
for (const [s, list] of [...bySender].sort((a, b) => b[1].length - a[1].length)) {
  const shapes = new Map<string, typeof rows>();
  for (const r of list) shapes.set(shape(r.subject), [...(shapes.get(shape(r.subject)) ?? []), r]);
  const dates = list.map((r) => r.received_at.slice(0, 10)).sort();
  console.log(`━━ ${s}  (${list.length} emails, ${dates[0]} → ${dates.at(-1)})`);
  for (const [k, v] of [...shapes].sort((a, b) => b[1].length - a[1].length).slice(0, 10)) console.log(`   ${String(v.length).padStart(3)}× ${k}`);

  // One sample from each of the most common subject shapes: those are the formats parsers need to handle.
  const samples = [...shapes.values()].sort((a, b) => b.length - a.length).slice(0, samplesPerSender).map((v) => v[0]);
  for (const r of samples) {
    console.log(`\n   ┌ ${r.received_at.slice(0, 16)}  ${r.subject}`);
    console.log(`   │ ${cleanText(r.body_text).slice(0, sampleChars)}`);
    console.log('   └');
  }
  console.log('');
}
