import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../server/app.ts';
import { openDb, type DB } from '../../server/db.ts';
import type { OrderEmail } from '../../server/orders/common.ts';
import { processPendingOrders, reparseOrders, senderSource } from '../../server/orders/ingest.ts';
import { matchOrders } from '../../server/orders/match.ts';
import { processPending } from '../../server/pipeline/ingest.ts';
import * as f from '../fixtures/orders.ts';

let db: DB;
let n = 0;

function bankAlert(body: string, receivedAt: string) {
  db.prepare(`INSERT INTO emails (id, from_addr, subject, received_at, body_text) VALUES (?, 'alerts@hdfcbank.net', 'Alert', ?, ?)`).run(`b${++n}`, receivedAt, body);
}
const upi = (amount: string, vpa: string, name: string, date: string) =>
  `Rs.${amount} has been debited from account **4321 to VPA ${vpa} ${name} on ${date}. Your UPI transaction reference number is 6278${String(++n).padStart(8, '0')}.`;
const card = (amount: string, merchant: string, date: string, time: string) =>
  `Thank you for using your HDFC Bank Credit Card ending 1234 for Rs ${amount} at ${merchant} on ${date} ${time}.`;
function orderEmail(e: OrderEmail) {
  db.prepare(`INSERT INTO emails (id, from_addr, subject, received_at, body_text, mailbox) VALUES (?, ?, ?, ?, ?, 'orders')`).run(`o${++n}`, e.from, e.subject, e.receivedAt, e.body);
}
const txns = () => db.prepare('SELECT t.*, c.name AS category FROM transactions t LEFT JOIN categories c ON c.id = t.category_id ORDER BY t.id').all() as any[];
const orders = () => db.prepare('SELECT * FROM orders ORDER BY id').all() as any[];
const run = async (now?: Date) => {
  await processPending(db, { useLlm: false });
  const counts = await processPendingOrders(db, { useLlm: false });
  if (now) matchOrders(db, now);
  return counts;
};

beforeEach(() => {
  db = openDb(':memory:');
});

describe('orders → spends', () => {
  it('names a multi-dish food order by the meal and a single dish by the dish', async () => {
    bankAlert(upi('344.00', 'swiggy@icici', 'SWIGGY', '11-10-26'), '2026-10-11T17:00:30');
    bankAlert(upi('254.00', 'swiggy@icici', 'SWIGGY', '12-10-26'), '2026-10-12T13:02:30');
    orderEmail(f.swiggyFood);
    orderEmail(f.swiggySingle);
    expect(await run()).toMatchObject({ order: 2, matched: 2 });
    expect(txns()).toMatchObject([
      { label: 'Snacks', category: 'food', merchant: 'Swiggy' },
      { label: 'Sabudana Khichdi with Dahi', category: 'food' },
    ]);
  });

  it('files a multi-item grocery basket from Amazon under Groceries and a single item by what it is', async () => {
    bankAlert(card('181.00', 'AMAZON PAY INDIA PRIVA', '29-08-2026', '11:04:00'), '2026-08-29T11:04:30');
    bankAlert(card('435.22', 'AMAZON PAY INDIA PRIVA', '12-10-2026', '18:31:00'), '2026-10-12T18:31:30');
    orderEmail(f.amazonMulti);
    orderEmail(f.amazonSingle);
    await run();
    expect(txns()).toMatchObject([
      { label: 'Groceries', category: 'groceries' },
      { label: 'Prestige Microfiber Spin Mop wi', category: 'home' },
    ]);
  });

  it('links a payment that arrives after its order, even once the order is waiting in Review', async () => {
    orderEmail(f.zomato);
    await run();
    expect(orders()[0].status).toBe('unmatched');
    bankAlert(upi('352.57', 'zomato@hdfcbank', 'ZOMATO', '26-08-26'), '2026-08-26T20:06:00');
    await run();
    expect(orders()[0]).toMatchObject({ status: 'matched', linked_by: 'auto' });
    expect(txns()[0]).toMatchObject({ label: 'Dinner', category: 'food' });
  });

  it('sends an order with no payment to Review once its window has passed', async () => {
    orderEmail(f.instamart);
    await run(new Date('2026-10-05T12:00:00'));
    expect(orders()[0].status).toBe('unmatched');
    const app = await buildApp(db);
    expect((await app.inject('/api/orders?status=unmatched')).json()).toMatchObject([{ store: 'Instamart', total_paise: 39700, items: [{ name: 'Amul Taaza Toned Milk 500ml' }, {}, {}] }]);
  });

  it('only links a spend named unlike the shop when the amount is exact and the time is close', async () => {
    bankAlert(upi('344.00', 'q123456@ybl', 'SOME NAME', '11-10-26'), '2026-10-11T17:30:00');
    orderEmail(f.swiggyFood);
    await run();
    expect(orders()[0].txn_id).toBe(txns()[0].id);

    db = openDb(':memory:');
    bankAlert(upi('344.00', 'q123456@ybl', 'SOME NAME', '11-10-26'), '2026-10-11T19:30:00');
    orderEmail(f.swiggyFood);
    await run();
    expect(orders()[0].txn_id).toBeNull();
  });

  it('keeps your category on a spend you edited, but still adds the label', async () => {
    bankAlert(card('435.22', 'AMAZON PAY INDIA PRIVA', '12-10-2026', '18:31:00'), '2026-10-12T18:31:30');
    await processPending(db, { useLlm: false });
    db.prepare(`UPDATE transactions SET category_id = (SELECT id FROM categories WHERE name = 'personal'), user_edited = 1`).run();
    orderEmail(f.amazonSingle);
    await run();
    expect(txns()[0]).toMatchObject({ category: 'personal', label: 'Prestige Microfiber Spin Mop wi' });
  });

  it('reads the same order once even when several emails carry it', async () => {
    orderEmail(f.decathlon);
    orderEmail({ ...f.decathlon, receivedAt: '2026-05-31T10:00:00' });
    expect(await run()).toMatchObject({ order: 1, duplicate: 1 });
  });

  it('never changes totals', async () => {
    bankAlert(upi('344.00', 'swiggy@icici', 'SWIGGY', '11-10-26'), '2026-10-11T17:00:30');
    await processPending(db, { useLlm: false });
    const app = await buildApp(db);
    const before = (await app.inject('/api/summary?month=2026-10')).json().total;
    orderEmail(f.swiggyFood);
    orderEmail(f.instamart);
    await run(new Date('2026-10-20T00:00:00'));
    expect((await app.inject('/api/summary?month=2026-10')).json().total).toBe(before);
  });

  it('rebuilds automatic links on re-read but keeps the ones you made', async () => {
    bankAlert(upi('344.00', 'swiggy@icici', 'SWIGGY', '11-10-26'), '2026-10-11T17:00:30');
    orderEmail(f.swiggyFood);
    orderEmail(f.instamart);
    await run(new Date('2026-10-20T00:00:00'));
    const app = await buildApp(db);
    const manual = (await app.inject({ method: 'POST', url: '/api/transactions', payload: { txn_at: '2026-10-04T19:00', amount_paise: 39700, merchant: 'Instamart' } })).json();
    const instamart = orders().find((o) => o.store === 'Instamart');
    await app.inject({ method: 'POST', url: `/api/orders/${instamart.id}/link`, payload: { txn_id: manual.id } });

    await reparseOrders(db, { useLlm: false });
    expect(orders().map((o) => [o.store, o.status, o.linked_by])).toEqual(
      expect.arrayContaining([
        ['Instamart', 'matched', 'user'],
        ['Green Bowl Kitchen', 'matched', 'auto'],
      ]),
    );
    expect(orders()).toHaveLength(2);
  });
});

describe('sender names', () => {
  it.each([
    ['no-reply@mailer22.actcorp.in', 'actcorp'],
    ['no-reply@spotify.com', 'spotify'],
    ['noreply@updates.industrybuying.com', 'industrybuying'],
  ])('%s → %s', (from, source) => expect(senderSource(from)).toBe(source));
});
