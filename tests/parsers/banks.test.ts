import { describe, expect, it } from 'vitest';
import { categorise } from '../../server/classify/categorise.ts';
import { classifyKind } from '../../server/classify/kind.ts';
import { normaliseMerchant } from '../../server/classify/merchant.ts';
import { openDb } from '../../server/db.ts';
import { parseEmail } from '../../server/parsers/index.ts';
import { fixtures } from '../fixtures/alerts.ts';

const db = openDb(':memory:');
const categoryName = (id: number | undefined) =>
  id === undefined ? null : (db.prepare('SELECT name FROM categories WHERE id = ?').get(id) as { name: string }).name;

describe('bank alert parsing', () => {
  for (const f of fixtures) {
    it(f.name, () => {
      const res = parseEmail({ from: f.from, subject: f.subject, body: f.body, receivedAt: f.receivedAt! });
      expect(res.status).toBe(f.expect.status);
      if (res.status !== 'parsed' || f.expect.status !== 'parsed') return;

      const e = f.expect;
      const t = res.txn;
      expect({ direction: t.direction, amountPaise: t.amountPaise, last4: t.last4, instrument: t.instrument, txnAt: t.txnAt }).toEqual({
        direction: e.direction,
        amountPaise: e.amountPaise,
        last4: e.last4,
        instrument: e.instrument,
        txnAt: e.txnAt,
      });
      if (e.refNo !== undefined) expect(t.refNo).toBe(e.refNo);
      if (e.refund !== undefined) expect(t.refund).toBe(e.refund);

      const kind = classifyKind(t, []);
      expect(kind.kind).toBe(e.kind);
      if (e.kind === null) return;

      const merchant = normaliseMerchant(t.merchantRaw);
      expect(merchant.name).toBe(e.merchant);
      if (e.category !== undefined) expect(categoryName(categorise(db, merchant.key, t.merchantRaw ?? '')?.categoryId)).toBe(e.category);
    });
  }
});

describe('own-account transfers', () => {
  const base = { direction: 'debit' as const, refund: false, amountPaise: 100, last4: '4321', instrument: 'UPI' as const, txnAt: '2026-10-01T10:00:00', refNo: null, window: '' };

  it('excludes a transfer to one of my VPAs', () => {
    expect(classifyKind({ ...base, merchantRaw: 'me@okhdfcbank MY NAME' }, ['me@okhdfcbank']).kind).toBe('excluded');
  });
  it('excludes a transfer to my other account by last-4', () => {
    expect(classifyKind({ ...base, merchantRaw: 'A/c XX9911' }, ['9911']).kind).toBe('excluded');
  });
  it('does not exclude on the source account last-4', () => {
    expect(classifyKind({ ...base, merchantRaw: 'swiggy@icici SWIGGY' }, ['4321']).kind).toBe('spend');
  });
  it('excludes wallet top-ups', () => {
    expect(classifyKind({ ...base, merchantRaw: 'Paytm Add Money' }, []).kind).toBe('excluded');
  });
});

describe('merchant normalisation', () => {
  it.each([
    ['VPS*SWIGGY', 'Swiggy', 'swiggy'],
    ['PYU*Swiggy Food', 'Swiggy Food', 'swiggy food'],
    ['UPI/P2M/628112345678/ZEPTO MARKETPLACE PRIVATE LIMITED', 'Zepto Marketplace', 'zepto marketplace'],
    ['paytmqr281005050101xyz@paytm', 'UPI paytmqr28100505010', 'paytmqr281005050101xyz@paytm'],
    ['rapido.bike@ybl', 'Rapido Bike', 'rapido bike'],
    ['', 'Unknown', 'unknown'],
  ])('%s → %s', (raw, name, key) => {
    expect(normaliseMerchant(raw)).toEqual({ name, key });
  });
});

describe('regressions', () => {
  it('a debit whose footer mentions reversals is still a debit', () => {
    const res = parseEmail({
      from: 'alerts@icicibank.com',
      subject: 'Transaction alert',
      receivedAt: '2026-10-05T10:00:00',
      body: 'ICICI Bank Account XX123 has been debited with INR 220.00 on 06-Oct-26. Info: UPI/628012345678/BLINKIT. In case of a failed transaction, the amount will be reversed within 2 working days.',
    });
    expect(res.status === 'parsed' && [res.txn.direction, res.txn.refund]).toEqual(['debit', false]);
  });

  it('own-account entries with regex characters do not throw', () => {
    const t = { direction: 'debit' as const, refund: false, amountPaise: 100, last4: null, instrument: 'UPI' as const, txnAt: '2026-10-01T10:00:00', refNo: null, window: '', merchantRaw: 'my (savings' };
    expect(classifyKind(t, ['my (savings']).kind).toBe('excluded');
  });
});
