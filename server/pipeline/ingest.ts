import { categorise, categoryFromHistory, categoryIdByName, MIN_PREFIX_RULE, type CategoryMatch } from '../classify/categorise.ts';
import { findDuplicate } from '../classify/dedupe.ts';
import { classifyKind } from '../classify/kind.ts';
import { normaliseMerchant } from '../classify/merchant.ts';
import { getSetting, tx, type DB } from '../db.ts';
import { categoriseWithLlm, extractWithLlm } from '../llm/ollama.ts';
import { cleanText, findDate, findInstrument, findRef, type ParsedTxn } from '../parsers/common.ts';
import { parseEmail } from '../parsers/index.ts';

export interface EmailRow {
  id: string;
  from_addr: string;
  subject: string;
  received_at: string;
  body_text: string;
}

export const DISMISSED = 'dismissed by you';

export type EmailOutcome = 'parsed' | 'llm' | 'unparsed' | 'ignored' | 'kept';

interface Options {
  useLlm: boolean;
}

async function llmParse(email: EmailRow): Promise<ParsedTxn | 'ignored' | null> {
  const out = await extractWithLlm(email.subject, email.body_text);
  if (!out) return null;
  if (!out.is_spend_or_refund || !(out.amount > 0)) return 'ignored';
  const text = cleanText(`${email.subject}. ${email.body_text}`);
  const window = text.slice(0, 600);
  return {
    direction: out.direction,
    refund: out.is_refund,
    amountPaise: Math.round(out.amount * 100),
    merchantRaw: out.merchant || null,
    last4: /^\d{3,4}$/.test(out.card_or_account_last4) ? out.card_or_account_last4 : null,
    instrument: findInstrument(window),
    txnAt: findDate(out.date, email.received_at),
    refNo: findRef(text),
    window,
  };
}

async function pickCategory(db: DB, txn: ParsedTxn, key: string, merchantName: string, isRefund: boolean, useLlm: boolean) {
  let match: CategoryMatch | null = categorise(db, key, txn.merchantRaw ?? '');
  if (!match && isRefund) match = categoryFromHistory(db, key);
  if (match) return { id: match.categoryId, by: match.by, displayName: match.displayName ?? null };

  if (useLlm && key !== 'unknown') {
    const ids = categoryIdByName(db);
    const name = await categoriseWithLlm(merchantName, txn.window, [...ids.keys()]);
    const id = name ? ids.get(name) : undefined;
    if (id) return { id, by: 'llm', displayName: null };
  }
  return null;
}

export async function processEmail(db: DB, email: EmailRow, opts: Options): Promise<EmailOutcome> {
  const existing = db
    .prepare('SELECT id, user_edited, deleted_at FROM transactions WHERE email_id = ?')
    .get(email.id) as { id: number; user_edited: number; deleted_at: string | null } | undefined;
  // Your edits and deletes are final; a re-parse never touches them.
  // Nor does a pass without the model undo what the model produced earlier.
  const prevParser = (db.prepare('SELECT parser FROM emails WHERE id = ?').get(email.id) as { parser: string | null } | undefined)?.parser;
  if (existing && (existing.user_edited || existing.deleted_at || (prevParser === 'llm' && !opts.useLlm))) {
    db.prepare(`UPDATE emails SET parse_status = CASE WHEN parser = 'llm' THEN 'llm' ELSE 'parsed' END, error = NULL WHERE id = ?`).run(email.id);
    return 'kept';
  }

  const parsed = parseEmail({ from: email.from_addr, subject: email.subject, receivedAt: email.received_at, body: email.body_text });
  let txn: ParsedTxn | null = null;
  let status: 'parsed' | 'llm' = 'parsed';

  if (parsed.status === 'parsed') {
    txn = parsed.txn;
  } else if (parsed.status === 'ignored') {
    return finish(db, email.id, existing?.id, 'ignored', parsed.bank, parsed.reason);
  } else if (opts.useLlm) {
    const llm = await llmParse(email);
    if (llm === 'ignored') return finish(db, email.id, existing?.id, 'ignored', 'llm', 'llm: not a transaction');
    if (llm) {
      txn = llm;
      status = 'llm';
    }
  }
  if (!txn) return finish(db, email.id, existing?.id, 'unparsed', parsed.bank, parsed.status === 'unparsed' ? parsed.reason : null);
  const t = txn;

  const ownAccounts = getSetting<string[]>(db, 'own_accounts', []);
  const { kind, reason } = classifyKind(txn, ownAccounts);
  if (!kind) return finish(db, email.id, existing?.id, 'ignored', parsed.bank ?? 'llm', reason);

  const merchant = normaliseMerchant(txn.merchantRaw);
  const category = kind === 'excluded' ? null : await pickCategory(db, txn, merchant.key, merchant.name, kind === 'refund', opts.useLlm);
  const needsReview =
    kind !== 'excluded' && (status === 'llm' || !category || category.by === 'llm' || merchant.key === 'unknown');

  const values = {
    txn_at: txn.txnAt,
    amount_paise: txn.amountPaise,
    merchant: category?.displayName || merchant.name,
    merchant_key: merchant.key,
    category_id: category?.id ?? null,
    kind,
    exclude_reason: reason,
    instrument: txn.instrument,
    bank: parsed.bank,
    account_last4: txn.last4,
    ref_no: txn.refNo,
    categorised_by: category?.by ?? null,
    needs_review: needsReview ? 1 : 0,
  };

  tx(db, () => {
    const duplicateOf = findDuplicate(db, {
      kind,
      amountPaise: t.amountPaise,
      txnAt: t.txnAt,
      last4: t.last4,
      refNo: t.refNo,
      emailId: email.id,
      bank: parsed.bank,
      merchantKey: merchant.key,
    });
    const row = { ...values, duplicate_of: duplicateOf === existing?.id ? null : duplicateOf };
    if (existing) {
      const cols = Object.keys(row);
      db.prepare(`UPDATE transactions SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
        .run(...(Object.values(row) as (string | number | null)[]), existing.id);
    } else {
      const cols = ['email_id', 'source', ...Object.keys(row)];
      db.prepare(`INSERT INTO transactions (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
        .run(email.id, 'email', ...(Object.values(row) as (string | number | null)[]));
    }
    setEmailStatus(db, email.id, status, status === 'llm' ? 'llm' : parsed.bank, null);
  });
  return status;
}

function finish(db: DB, emailId: string, existingTxnId: number | undefined, status: 'ignored' | 'unparsed', parser: string | null, error: string | null): EmailOutcome {
  tx(db, () => {
    if (existingTxnId) {
      db.prepare('UPDATE transactions SET duplicate_of = NULL WHERE duplicate_of = ?').run(existingTxnId);
      db.prepare('DELETE FROM transactions WHERE id = ?').run(existingTxnId);
    }
    setEmailStatus(db, emailId, status, parser, error);
  });
  return status;
}

function setEmailStatus(db: DB, id: string, status: string, parser: string | null, error: string | null) {
  db.prepare('UPDATE emails SET parse_status = ?, parser = ?, error = ? WHERE id = ?').run(status, parser, error, id);
}

export async function processPending(db: DB, opts: Options): Promise<Record<EmailOutcome, number>> {
  const counts: Record<EmailOutcome, number> = { parsed: 0, llm: 0, unparsed: 0, ignored: 0, kept: 0 };
  const pending = db
    .prepare(`SELECT id, from_addr, subject, received_at, body_text FROM emails WHERE parse_status = 'pending' ORDER BY received_at`)
    .all() as unknown as EmailRow[];
  for (const email of pending) counts[await processEmail(db, email, opts)]++;
  return counts;
}

/** Re-run parsing over stored emails after parser or rule changes. User-edited rows are left alone. */
export async function reparse(db: DB, opts: Options, where: 'all' | 'unparsed' = 'all') {
  db.prepare(
    `UPDATE emails SET parse_status = 'pending' WHERE ${where === 'unparsed' ? `parse_status = 'unparsed'` : `error IS NOT '${DISMISSED}'`}`,
  ).run();
  return processPending(db, opts);
}

/** Save a merchant → category rule and apply it to past transactions you haven't edited by hand. */
export function applyMerchantRule(db: DB, merchantKey: string, categoryId: number, displayName: string | null) {
  if (merchantKey === 'unknown') return;
  tx(db, () => {
    db.prepare(
      `INSERT INTO merchant_rules (merchant_key, category_id, display_name) VALUES (?, ?, ?)
       ON CONFLICT(merchant_key) DO UPDATE SET category_id = excluded.category_id,
         display_name = excluded.display_name, updated_at = datetime('now')`,
    ).run(merchantKey, categoryId, displayName);
    // Same matching as categorise(): exact or prefix, and never over a more specific rule.
    db.prepare(
      `UPDATE transactions AS t SET category_id = ?1, categorised_by = 'rule', needs_review = 0,
         merchant = COALESCE(?2, merchant), updated_at = datetime('now')
       WHERE t.user_edited = 0 AND t.kind != 'excluded'
         AND (t.merchant_key = ?3 OR (length(?3) >= ${MIN_PREFIX_RULE} AND substr(t.merchant_key, 1, length(?3)) = ?3))
         AND NOT EXISTS (SELECT 1 FROM merchant_rules r WHERE length(r.merchant_key) > length(?3)
                           AND substr(t.merchant_key, 1, length(r.merchant_key)) = r.merchant_key)`,
    ).run(categoryId, displayName, merchantKey);
  });
}
