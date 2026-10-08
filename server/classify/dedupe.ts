import type { DB } from '../db.ts';

export interface DedupeCandidate {
  kind: string;
  amountPaise: number;
  txnAt: string;
  last4: string | null;
  refNo: string | null;
  emailId: string | null;
}

const WINDOW_MIN = 15;

/** Id of an existing transaction this one duplicates, or null. Later alerts point at the earlier row. */
export function findDuplicate(db: DB, c: DedupeCandidate): number | null {
  const rows = db
    .prepare(
      `SELECT id, txn_at, account_last4, ref_no FROM transactions
       WHERE deleted_at IS NULL AND duplicate_of IS NULL AND kind = ? AND amount_paise = ?
         AND (email_id IS NULL OR email_id != ?)
         AND txn_at BETWEEN strftime('%Y-%m-%dT%H:%M:%S', ?, '-1 day') AND strftime('%Y-%m-%dT%H:%M:%S', ?, '+1 day')`,
    )
    .all(c.kind, c.amountPaise, c.emailId ?? '', c.txnAt, c.txnAt) as {
    id: number;
    txn_at: string;
    account_last4: string | null;
    ref_no: string | null;
  }[];

  for (const r of rows) {
    if (c.refNo && r.ref_no) {
      if (c.refNo === r.ref_no) return r.id;
      continue;
    }
    const minutes = Math.abs(Date.parse(r.txn_at) - Date.parse(c.txnAt)) / 60000;
    const sameCard = !c.last4 || !r.account_last4 || c.last4 === r.account_last4;
    if (minutes <= WINDOW_MIN && sameCard) return r.id;
  }
  return null;
}
