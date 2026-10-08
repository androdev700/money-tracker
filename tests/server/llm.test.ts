import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDb } from '../../server/db.ts';
import { processPending, reparse } from '../../server/pipeline/ingest.ts';

// Stands in for Ollama's /api/tags and /api/chat so the fallback path runs without a model.
function fakeOllama(replies: { extract?: object; category?: string }) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/tags')) return Response.json({ models: [{ name: 'qwen2.5:3b' }] });
    const body = JSON.parse(String(init?.body));
    const isExtract = 'is_spend_or_refund' in body.format.properties;
    const content = isExtract ? replies.extract : { category: replies.category ?? 'unknown' };
    return Response.json({ message: { role: 'assistant', content: JSON.stringify(content) } });
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('Ollama fallback', () => {
  it('extracts an unknown-format email and flags it for review', async () => {
    const fetchMock = fakeOllama({
      extract: { is_spend_or_refund: true, direction: 'debit', is_refund: false, amount: 649, merchant: 'Netflix', date: '2026-10-03', card_or_account_last4: '' },
      category: 'personal',
    });
    vi.stubGlobal('fetch', fetchMock);
    const db = openDb(':memory:');
    db.prepare(`INSERT INTO emails (id, from_addr, subject, received_at, body_text) VALUES ('m1', 'noreply@wallet.com', 'Paid', '2026-10-03T09:00:00', 'You paid ₹649 to Netflix')`).run();

    expect(await processPending(db, { useLlm: true })).toMatchObject({ llm: 1 });
    const t = db.prepare('SELECT t.*, c.name AS category FROM transactions t JOIN categories c ON c.id = t.category_id').get() as any;
    expect(t).toMatchObject({ merchant: 'Netflix', amount_paise: 64900, category: 'personal', needs_review: 1, txn_at: '2026-10-03T09:00:00' });
    expect(fetchMock.mock.calls.map(([u]) => String(u).split('/api/')[1])).toContain('chat');
  });

  it('asks the model for a category when no rule or keyword matches', async () => {
    vi.stubGlobal('fetch', fakeOllama({ category: 'home' }));
    const db = openDb(':memory:');
    db.prepare(`INSERT INTO emails (id, from_addr, subject, received_at, body_text) VALUES ('m1', 'alerts@hdfcbank.net', 'UPI', '2026-10-03T09:00:00', ?)`).run(
      'Rs.800.00 has been debited from account **4321 to VPA q123456@ybl GANESH WORKS on 03-10-26. Your UPI transaction reference number is 627800000099.',
    );
    await processPending(db, { useLlm: true });
    const t = db.prepare('SELECT t.categorised_by, t.needs_review, c.name FROM transactions t JOIN categories c ON c.id = t.category_id').get();
    expect(t).toEqual({ categorised_by: 'llm', needs_review: 1, name: 'home' });
  });

  it('marks the email unparsed when the model is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    const db = openDb(':memory:');
    db.prepare(`INSERT INTO emails (id, from_addr, subject, received_at, body_text) VALUES ('m1', 'noreply@wallet.com', 'Paid', '2026-10-03T09:00:00', 'You paid ₹649 to Netflix')`).run();
    expect(await processPending(db, { useLlm: true })).toMatchObject({ unparsed: 1 });
  });
});

describe('re-read without the model', () => {
  it('keeps transactions the model created earlier', async () => {
    vi.stubGlobal('fetch', fakeOllama({
      extract: { is_spend_or_refund: true, direction: 'debit', is_refund: false, amount: 649, merchant: 'Netflix', date: '2026-10-03', card_or_account_last4: '' },
      category: 'personal',
    }));
    const db = openDb(':memory:');
    db.prepare(`INSERT INTO emails (id, from_addr, subject, received_at, body_text) VALUES ('m1', 'alerts@hdfcbank.net', 'Alert', '2026-10-03T09:00:00', 'Rs.649.00 for NETFLIX subscription renewal')`).run();
    await processPending(db, { useLlm: true });
    await reparse(db, { useLlm: false });
    expect(db.prepare('SELECT merchant FROM transactions').all()).toEqual([{ merchant: 'Netflix' }]);
    expect(db.prepare('SELECT parse_status, parser FROM emails').get()).toEqual({ parse_status: 'llm', parser: 'llm' });
  });
});
