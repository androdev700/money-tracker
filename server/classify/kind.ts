import type { ParsedTxn } from '../parsers/index.ts';

export type Kind = 'spend' | 'refund' | 'excluded';

export interface KindResult {
  kind: Kind | null; // null: not a spend at all (e.g. salary credit) — no transaction is created
  reason: string | null;
}

const CC_BILL = /\bcred\b|cred\.club|credit ?card (?:bill|payment|dues)|ccpay|card ?bill|billdesk.*card|\bbbps\b.*card|autopay.*card|towards your .{0,30}credit card|payment received towards/i;
const WALLET_TOPUP = /add(?:ed)? money|wallet (?:load|top.?up|recharge)|load money|amazon ?pay balance|paytm wallet|mobikwik wallet/i;

export function classifyKind(txn: ParsedTxn, ownAccounts: string[]): KindResult {
  if (txn.direction === 'credit') {
    return txn.refund ? { kind: 'refund', reason: null } : { kind: null, reason: 'credit (income is not tracked)' };
  }

  const target = `${txn.merchantRaw ?? ''}`;
  if (CC_BILL.test(target) || CC_BILL.test(txn.window)) return { kind: 'excluded', reason: 'credit card bill payment' };
  if (WALLET_TOPUP.test(target) || WALLET_TOPUP.test(txn.window)) return { kind: 'excluded', reason: 'wallet top-up' };

  const own = ownAccounts.map((a) => a.trim().toLowerCase()).filter(Boolean);
  const targetLc = target.toLowerCase();
  // Only the payee side is checked: the source account's last-4 is in every alert.
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const isOwn = own.some((a) => (a.includes('@') ? targetLc.includes(a) : new RegExp(`(?:x|\\*|\\b)${escape(a)}\\b`).test(targetLc)));
  if (isOwn) return { kind: 'excluded', reason: 'transfer to own account' };

  return { kind: 'spend', reason: null };
}
