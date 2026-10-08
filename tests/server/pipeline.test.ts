import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../server/app.ts';
import { openDb, type DB } from '../../server/db.ts';
import { processPending, reparse } from '../../server/pipeline/ingest.ts';

let db: DB;
let n = 0;

function addEmail(from: string, body: string, receivedAt = '2026-10-05T14:25:00', subject = 'Alert') {
  const id = `msg-${++n}`;
  db.prepare('INSERT INTO emails (id, from_addr, subject, received_at, body_text) VALUES (?, ?, ?, ?, ?)').run(id, from, subject, receivedAt, body);
  return id;
}

const hdfcUpi = (amount: string, vpa: string, name: string, date: string, ref: string) =>
  `Dear Customer, Rs.${amount} has been debited from account **4321 to VPA ${vpa} ${name} on ${date}. Your UPI transaction reference number is ${ref}.`;

const txns = () =>
  db.prepare('SELECT t.*, c.name AS category FROM transactions t LEFT JOIN categories c ON c.id = t.category_id ORDER BY t.id').all() as any[];

beforeEach(() => {
  db = openDb(':memory:');
});

describe('ingest pipeline', () => {
  it('creates categorised spends and skips non-spend emails', async () => {
    addEmail('alerts@hdfcbank.net', hdfcUpi('450.00', 'swiggy@icici', 'SWIGGY', '05-10-26', '627812345678'));
    addEmail('alerts@hdfcbank.net', 'Dear Customer, Rs.10000.00 has been credited to your account **4321 by VPA friend@okaxis FRIEND on 07-10-26.');
    const counts = await processPending(db, { useLlm: false });
    expect(counts).toMatchObject({ parsed: 1, ignored: 1 });
    expect(txns()).toMatchObject([{ merchant: 'Swiggy', category: 'food', kind: 'spend', amount_paise: 45000, needs_review: 0 }]);
  });

  it('flags the same UPI reference as a duplicate', async () => {
    addEmail('alerts@hdfcbank.net', hdfcUpi('450.00', 'swiggy@icici', 'SWIGGY', '05-10-26', '627812345678'));
    addEmail('alerts@hdfcbank.net', hdfcUpi('450.00', 'swiggy@icici', 'SWIGGY', '05-10-26', '627812345678'), '2026-10-05T18:00:00');
    await processPending(db, { useLlm: false });
    const [a, b] = txns();
    expect(b.duplicate_of).toBe(a.id);
  });

  it('treats same amount on the same card within 15 minutes as one spend, not further apart', async () => {
    const cc = (time: string) => `Thank you for using your HDFC Bank Credit Card ending 1234 for Rs 999.00 at CROMA on 05-10-2026 ${time}.`;
    addEmail('alerts@hdfcbank.net', cc('10:00:00'));
    addEmail('alerts@hdfcbank.net', cc('10:05:00'));
    addEmail('alerts@hdfcbank.net', cc('11:00:00'));
    await processPending(db, { useLlm: false });
    const [a, b, c] = txns();
    expect(b.duplicate_of).toBe(a.id);
    expect(c.duplicate_of).toBeNull();
  });

  it('flags an unknown merchant for review', async () => {
    addEmail('alerts@hdfcbank.net', hdfcUpi('80.00', 'q12345@ybl', 'RAMESH KUMAR', '05-10-26', '627800000001'));
    await processPending(db, { useLlm: false });
    expect(txns()[0]).toMatchObject({ category_id: null, needs_review: 1 });
  });

  it('never overwrites user edits or resurrects deletes on re-parse', async () => {
    addEmail('alerts@hdfcbank.net', hdfcUpi('450.00', 'swiggy@icici', 'SWIGGY', '05-10-26', '627812345678'));
    addEmail('alerts@hdfcbank.net', hdfcUpi('300.00', 'zomato@hdfcbank', 'ZOMATO', '05-10-26', '627812345679'));
    await processPending(db, { useLlm: false });
    const [a, b] = txns();
    db.prepare(`UPDATE transactions SET merchant = 'Team lunch', user_edited = 1 WHERE id = ?`).run(a.id);
    db.prepare(`UPDATE transactions SET deleted_at = datetime('now') WHERE id = ?`).run(b.id);

    await reparse(db, { useLlm: false });
    const after = txns();
    expect(after).toHaveLength(2);
    expect(after[0].merchant).toBe('Team lunch');
    expect(after[1].deleted_at).not.toBeNull();
  });
});

describe('API', () => {
  it('nets refunds, ignores excluded and duplicates in the month total', async () => {
    addEmail('alerts@hdfcbank.net', hdfcUpi('450.00', 'swiggy@icici', 'SWIGGY', '05-10-26', '627812345678'));
    addEmail('alerts@hdfcbank.net', hdfcUpi('450.00', 'swiggy@icici', 'SWIGGY', '05-10-26', '627812345678'));
    addEmail('alerts@hdfcbank.net', hdfcUpi('15000.00', 'cred.club@axisb', 'CRED', '06-10-26', '627812345680'));
    addEmail('alerts@hdfcbank.net', 'Thank you for using your HDFC Bank Credit Card ending 1234 for Rs 1,000.00 at MYNTRA DESIGNS on 06-10-2026 10:00:00.');
    addEmail('alerts@hdfcbank.net', 'Rs.400.00 has been credited to your HDFC Bank Credit Card ending 1234 towards refund from MYNTRA DESIGNS on 08-10-2026.');
    addEmail('alerts@hdfcbank.net', hdfcUpi('200.00', 'swiggy@icici', 'SWIGGY', '28-09-26', '627812345681'), '2026-09-28T20:00:00');
    await processPending(db, { useLlm: false });

    const app = await buildApp(db);
    const s = (await app.inject('/api/summary?month=2026-10')).json();
    expect(s.total).toBe(45000 + 100000 - 40000);
    expect(s.prevTotal).toBe(20000);
    expect(s.excludedCount).toBe(1);
    expect(Object.fromEntries(s.byCategory.map((c: any) => [c.name, c.total]))).toEqual({ shopping: 60000, food: 45000 });

    const excluded = (await app.inject('/api/transactions?month=2026-10&kind=excluded')).json();
    expect(excluded).toMatchObject([{ merchant: 'Cred', exclude_reason: 'credit card bill payment' }]);
  });

  it('learns a merchant rule from an edit and applies it to past and future spends', async () => {
    addEmail('alerts@hdfcbank.net', hdfcUpi('120.00', 'q99887766@ybl', 'SHARMA GENERAL STORE', '05-10-26', '627800000010'));
    addEmail('alerts@hdfcbank.net', hdfcUpi('90.00', 'q99887766@ybl', 'SHARMA GENERAL STORE', '06-10-26', '627800000011'));
    await processPending(db, { useLlm: false });
    const app = await buildApp(db);
    const [first, second] = txns();
    expect(first.category_id).toBeNull();

    const groceries = (db.prepare(`SELECT id FROM categories WHERE name = 'groceries'`).get() as { id: number }).id;
    const res = await app.inject({ method: 'PATCH', url: `/api/transactions/${first.id}`, payload: { category_id: groceries, apply_to_merchant: true } });
    expect(res.statusCode).toBe(200);
    expect(txns().find((t) => t.id === second.id)).toMatchObject({ category: 'groceries', needs_review: 0, categorised_by: 'rule' });

    addEmail('alerts@hdfcbank.net', hdfcUpi('60.00', 'q99887766@ybl', 'SHARMA GENERAL STORE', '07-10-26', '627800000012'));
    await processPending(db, { useLlm: false });
    expect(txns().at(-1)).toMatchObject({ category: 'groceries', needs_review: 0 });
  });

  it('adds, edits and soft-deletes a manual spend', async () => {
    const app = await buildApp(db);
    const created = await app.inject({
      method: 'POST',
      url: '/api/transactions',
      payload: { txn_at: '2026-10-10T19:30', amount_paise: 25000, merchant: 'Chai stall', category_id: 1, note: 'cash' },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;

    const edited = await app.inject({ method: 'PATCH', url: `/api/transactions/${id}`, payload: { amount_paise: 30000 } });
    expect(edited.json()).toMatchObject({ amount_paise: 30000, source: 'manual', txn_at: '2026-10-10T19:30:00' });

    expect((await app.inject({ method: 'DELETE', url: `/api/transactions/${id}` })).statusCode).toBe(204);
    expect((await app.inject('/api/summary?month=2026-10')).json().total).toBe(0);
  });

  it('rejects invalid input', async () => {
    const app = await buildApp(db);
    const res = await app.inject({ method: 'POST', url: '/api/transactions', payload: { txn_at: 'yesterday', amount_paise: -5, merchant: '' } });
    expect(res.statusCode).toBe(400);
  });
});

describe('re-read', () => {
  it('keeps dismissed emails dismissed', async () => {
    const id = addEmail('noreply@somewallet.com', 'You paid Rs 99 to Netflix.');
    await processPending(db, { useLlm: false });
    const app = await buildApp(db);
    await app.inject({ method: 'POST', url: `/api/emails/${id}/dismiss`, payload: {} });
    await app.inject({ method: 'POST', url: '/api/reparse', payload: { scope: 'all' } });
    expect((await app.inject('/api/emails?status=unparsed')).json()).toEqual([]);
  });

  it('dedupes across midnight within the window', async () => {
    const cc = (date: string, time: string) => `Thank you for using your HDFC Bank Credit Card ending 1234 for Rs 750.00 at CROMA on ${date} ${time}.`;
    addEmail('alerts@hdfcbank.net', cc('05-10-2026', '23:55:00'));
    addEmail('alerts@hdfcbank.net', cc('06-10-2026', '00:05:00'));
    await processPending(db, { useLlm: false });
    const [a, b] = txns();
    expect(b.duplicate_of).toBe(a.id);
  });
});

describe('categories', () => {
  it('rejects renaming onto an existing name', async () => {
    const app = await buildApp(db);
    const res = await app.inject({ method: 'PATCH', url: '/api/categories/1', payload: { name: 'groceries' } });
    expect(res.statusCode).toBe(409);
  });
});

describe('receipts vs bank alerts', () => {
  it('counts a gateway receipt and its card alert once, hours apart, and collapses repeated receipts', async () => {
    const receipt = 'PayU Transaction ID: 1 Rs. 6100.00 Paid to ACME PARTS PRIVATE LIMITED via creditcard on 26 Aug 2026 12:57 PM Bank Reference Number 1234567890123456789012';
    addEmail('payment-report@payu.in', receipt, '2026-08-26T12:58:00', 'Your Order at ACME PARTS PRIVATE LIMITED is successful');
    addEmail('payment-report@payu.in', receipt, '2026-08-26T12:59:00', 'Your Order at ACME PARTS PRIVATE LIMITED is successful');
    addEmail('credit_cards@icici.bank.in', 'Your ICICI Bank Credit Card XX9876 has been used for a transaction of INR 6,100.00 on Aug 26, 2026 at 16:40:00. Info: ACME PARTS.', '2026-08-26T16:41:00');
    await processPending(db, { useLlm: false });
    const counted = txns().filter((t) => !t.duplicate_of);
    expect(counted).toHaveLength(1);
    expect(counted[0]).toMatchObject({ bank: 'payu', amount_paise: 610000 });
  });

  it('keeps two different-amount spends separate', async () => {
    addEmail('no-reply@amazonpay.in', 'Thanks for using Amazon Pay Balance.', '2026-08-29T10:00:00', 'Rs 179.00 was paid on Amazon.in');
    addEmail('credit_cards@icici.bank.in', 'Your ICICI Bank Credit Card XX9876 has been used for a transaction of INR 180.00 on Aug 29, 2026 at 10:05:00. Info: AMAZON PAY INDIA.', '2026-08-29T10:06:00');
    await processPending(db, { useLlm: false });
    expect(txns().filter((t) => !t.duplicate_of)).toHaveLength(2);
  });
});

describe('receipt matching by merchant', () => {
  it('does not merge a receipt with a different merchant’s same-amount spend an hour later', async () => {
    addEmail('payment-report@payu.in', 'Rs. 500.00 Paid to ACME PARTS PRIVATE LIMITED via creditcard on 05 Oct 2026 5:20 PM', '2026-10-05T17:21:00', 'Your Order at ACME PARTS PRIVATE LIMITED is successful');
    addEmail('credit_cards@icici.bank.in', 'Your ICICI Bank Credit Card XX9876 has been used for a transaction of INR 500.00 on Oct 05, 2026 at 18:30:00. Info: SWIGGY.', '2026-10-05T18:31:00');
    await processPending(db, { useLlm: false });
    expect(txns().filter((t) => !t.duplicate_of)).toHaveLength(2);
  });

  it('merges a receipt with the same merchant’s alert hours later', async () => {
    addEmail('no-reply@razorpay.com', '₹450.02 Paid Successfully Method upi someone@ybl Paid On 01 Aug, 2026 11:45:02 AM', '2026-08-01T11:46:00', 'Payment successful for ShopCo');
    addEmail('alerts@hdfcbank.net', 'Rs.450.02 has been debited from account **4321 to VPA shopco.rzp@icici SHOPCO on 01-08-26. Your UPI transaction reference number is 627800000123.', '2026-08-01T16:00:00');
    await processPending(db, { useLlm: false });
    expect(txns().filter((t) => !t.duplicate_of)).toHaveLength(1);
  });
});
