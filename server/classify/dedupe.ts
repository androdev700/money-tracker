import type { DB } from '../db.ts';
import { isReceiptSource } from '../parsers/index.ts';

export interface DedupeCandidate {
  kind: string;
  amountPaise: number;
  txnAt: string;
  last4: string | null;
  refNo: string | null;
  emailId: string | null;
  bank: string | null;
  merchantKey: string;
}

const ALERT_WINDOW_MIN = 15;
// A receipt (Amazon Pay, PayU, Razorpay) and the bank alert for the same payment: hours apart is fine when the
// merchant names agree (times come from different clocks or are missing); otherwise only near-simultaneous ones.
const RECEIPT_SAME_MERCHANT_MIN = 24 * 60;
const RECEIPT_OTHER_MERCHANT_MIN = 20;

const compact = (k: string) => k.replace(/[^a-z0-9]/g, '');
/** "acmeparts" ~ "acme parts", "zepto" ~ "zeptonow", "amazon" ~ "amazon pay". */
function similarMerchant(a: string, b: string) {
  const [x, y] = [compact(a), compact(b)];
  if (x.length < 4 || y.length < 4 || a === 'unknown' || b === 'unknown') return false;
  return x.includes(y.slice(0, 6)) || y.includes(x.slice(0, 6));
}

/** Id of an existing transaction this one duplicates, or null. Later alerts point at the earlier row. */
export function findDuplicate(db: DB, c: DedupeCandidate): number | null {
  const rows = db
    .prepare(
      `SELECT id, txn_at, account_last4, ref_no, bank, merchant_key FROM transactions
       WHERE deleted_at IS NULL AND duplicate_of IS NULL AND kind = ? AND amount_paise = ?
         AND (email_id IS NULL OR email_id != ?)
         AND txn_at BETWEEN strftime('%Y-%m-%dT%H:%M:%S', ?, '-1 day') AND strftime('%Y-%m-%dT%H:%M:%S', ?, '+1 day')`,
    )
    .all(c.kind, c.amountPaise, c.emailId ?? '', c.txnAt, c.txnAt) as {
    id: number;
    txn_at: string;
    account_last4: string | null;
    ref_no: string | null;
    bank: string | null;
    merchant_key: string;
  }[];

  const candidateIsReceipt = isReceiptSource(c.bank);
  for (const r of rows) {
    const minutes = Math.abs(Date.parse(r.txn_at) - Date.parse(c.txnAt)) / 60000;
    const rowIsReceipt = isReceiptSource(r.bank);

    if (candidateIsReceipt !== rowIsReceipt) {
      const limit = similarMerchant(c.merchantKey, r.merchant_key) ? RECEIPT_SAME_MERCHANT_MIN : RECEIPT_OTHER_MERCHANT_MIN;
      if (minutes <= limit) return r.id;
      continue;
    }
    if (c.refNo && r.ref_no) {
      if (c.refNo === r.ref_no) return r.id;
      continue;
    }
    const sameCard = !c.last4 || !r.account_last4 || c.last4 === r.account_last4;
    if (minutes <= ALERT_WINDOW_MIN && sameCard) return r.id;
  }
  return null;
}
