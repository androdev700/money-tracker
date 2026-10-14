import { describe, expect, it } from 'vitest';
import { openDb, getSetting, setSetting } from '../../server/db.ts';
import { resetData } from '../../server/reset.ts';

describe('reset', () => {
  it('clears spends, emails, orders and cursors but keeps what was learned', () => {
    const db = openDb(':memory:');
    db.prepare(`INSERT INTO emails (id, received_at, body_text) VALUES ('e1', '2026-09-01T10:00:00', 'x'), ('o1', '2026-09-01T10:00:00', 'y')`).run();
    db.prepare(`INSERT INTO transactions (email_id, source, txn_at, amount_paise, merchant, merchant_key, kind) VALUES ('e1', 'email', '2026-09-01T10:00:00', 100, 'Swiggy', 'swiggy', 'spend')`).run();
    db.prepare(`INSERT INTO orders (email_id, source, ordered_at, total_paise, kind, txn_id) VALUES ('o1', 'swiggy', '2026-09-01T10:00:00', 100, 'food', 1)`).run();
    db.prepare(`INSERT INTO order_items (order_id, name) VALUES (1, 'Dosa')`).run();
    db.prepare(`INSERT INTO merchant_rules (merchant_key, category_id) VALUES ('swiggy', 1)`).run();
    db.prepare(`INSERT INTO item_rules (item_key, category_id, source) VALUES ('dosa', 1, 'user')`).run();
    setSetting(db, 'own_accounts', ['9911']);
    setSetting(db, 'imap_cursor', { uidValidity: '1', lastUid: 50 });
    setSetting(db, 'imap_cursor:orders', { uidValidity: '1', lastUid: 9 });

    expect(resetData(db)).toEqual({ transactions: 1, emails: 2, orders: 1 });
    const n = (t: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
    expect([n('transactions'), n('emails'), n('orders'), n('order_items')]).toEqual([0, 0, 0, 0]);
    expect([n('merchant_rules'), n('item_rules'), n('categories')]).toEqual([1, 1, 9]);
    expect(getSetting(db, 'own_accounts', [])).toEqual(['9911']);
    expect(getSetting(db, 'imap_cursor', null)).toBeNull();
    expect(getSetting(db, 'imap_cursor:orders', null)).toBeNull();
  });
});
