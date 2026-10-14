// What the Orders label yields: each order read, what it was matched to and how the spend would be named.
// Dry run on a snapshot of the database; the only real write is fetching new order mail.
//   npm run orders-report                      fetch, then orders, matches and misses
//   npm run orders-report -- --no-fetch
//   npm run orders-report -- --llm             also ask the local model about unknown senders (slow)
//   npm run orders-report -- --raw             per-sender subjects and sample text instead
//   npm run orders-report -- --raw --sender=x  more samples for one sender
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config, gmailConfigured } from '../server/config.ts';
import { openDb } from '../server/db.ts';
import { fetchNewEmails } from '../server/gmail/imap.ts';
import { itemTitle } from '../server/orders/common.ts';
import { reparseOrders } from '../server/orders/ingest.ts';
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

const sender = (from: string) => (from.match(/<([^>]+)>/)?.[1] ?? from).toLowerCase();
const rupees = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;

if (!args.includes('--raw')) {
  const snapshot = join(tmpdir(), `orders-report-${process.pid}.db`);
  db.exec(`VACUUM INTO '${snapshot.replace(/'/g, "''")}'`);
  db.close();
  const sim = openDb(snapshot);
  const counts = await reparseOrders(sim, { useLlm: args.includes('--llm') });

  const perSender = sim
    .prepare(
      `SELECT from_addr, parse_status, COUNT(*) AS n FROM emails WHERE mailbox = 'orders' GROUP BY from_addr, parse_status`,
    )
    .all() as { from_addr: string; parse_status: string; n: number }[];
  const table = new Map<string, Record<string, number>>();
  for (const r of perSender) {
    const t = table.get(sender(r.from_addr)) ?? {};
    t[r.parse_status] = (t[r.parse_status] ?? 0) + r.n;
    table.set(sender(r.from_addr), t);
  }
  console.log('Order emails by sender:');
  console.log(`  ${'sender'.padEnd(40)} orders  llm ignored UNPARSED`);
  for (const [s, t] of [...table].sort((a, b) => (b[1].parsed ?? 0) - (a[1].parsed ?? 0) || (b[1].unparsed ?? 0) - (a[1].unparsed ?? 0))) {
    if (!t.parsed && !t.llm && !t.unparsed) continue;
    console.log(`  ${s.padEnd(40).slice(0, 40)} ${String(t.parsed ?? 0).padStart(6)} ${String(t.llm ?? 0).padStart(4)} ${String(t.ignored ?? 0).padStart(7)} ${String(t.unparsed ?? 0).padStart(8)}`);
  }
  const quiet = [...table].filter(([, t]) => !t.parsed && !t.llm && !t.unparsed).map(([s]) => s);
  if (quiet.length) console.log(`  (only notices, all ignored: ${quiet.join(', ')})`);

  const orders = sim
    .prepare(
      `SELECT o.*, t.merchant AS t_merchant, t.amount_paise AS t_amount, t.txn_at AS t_at, t.label AS t_label, c.name AS t_category
       FROM orders o LEFT JOIN transactions t ON t.id = o.txn_id LEFT JOIN categories c ON c.id = t.category_id
       ORDER BY o.ordered_at DESC`,
    )
    .all() as any[];
  const itemsOf = sim.prepare(
    `SELECT oi.name, oi.qty, c.name AS category, oi.categorised_by FROM order_items oi LEFT JOIN categories c ON c.id = oi.category_id WHERE oi.order_id = ? ORDER BY oi.id`,
  );
  console.log(`\nOrders (${orders.length}; ${counts.matched} linked to a spend):`);
  for (const o of orders.slice(0, 120)) {
    const items = (itemsOf.all(o.id) as any[]).map((i) => `${itemTitle(i.name).slice(0, 34)}${i.qty > 1 ? ` ×${i.qty}` : ''} [${i.category ?? '?'}${i.categorised_by === 'llm' ? '*' : ''}]`);
    const head = `${o.ordered_at.slice(0, 16)}  ${(o.store ?? o.source).slice(0, 24).padEnd(24)} ${rupees(o.total_paise).padStart(10)}`;
    const link = o.txn_id
      ? `→ "${o.t_label}" (${o.t_category ?? 'uncategorised'}) ← ${o.t_merchant} ${rupees(o.t_amount)} ${o.t_at.slice(5, 16)}`
      : '→ NO PAYMENT FOUND (goes to Review)';
    console.log(`  ${head}  ${link}\n      ${items.slice(0, 4).join(' · ')}${items.length > 4 ? ` · +${items.length - 4}` : ''}`);
  }

  const misses = sim
    .prepare(`SELECT from_addr, subject, received_at, body_text, error FROM emails WHERE mailbox = 'orders' AND parse_status = 'unparsed' ORDER BY received_at DESC`)
    .all() as any[];
  if (misses.length) {
    console.log(`\nNot read (${misses.length}) — candidates for a parser${args.includes('--llm') ? '' : ' or --llm'}:`);
    for (const m of misses.slice(0, 30)) console.log(`  [${m.error}] ${m.received_at.slice(0, 10)} ${sender(m.from_addr)}\n    ${m.subject}\n    ${cleanText(m.body_text).slice(0, 300)}`);
  }
  sim.close();
  for (const ext of ['', '-wal', '-shm']) rmSync(snapshot + ext, { force: true });
  process.exit(0);
}

const rows = db
  .prepare(`SELECT from_addr, subject, received_at, body_text FROM emails WHERE mailbox = 'orders' ORDER BY received_at DESC`)
  .all() as { from_addr: string; subject: string; received_at: string; body_text: string }[];

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
