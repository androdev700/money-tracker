import { amazonpay } from './amazonpay.ts';
import { axis } from './axis.ts';
import { parseWith, preCheck, type BankParser, type EmailInput, type ParseResult } from './common.ts';
import { payu, razorpay } from './gateways.ts';
import { hdfc } from './hdfc.ts';
import { icici } from './icici.ts';
import { kotak } from './kotak.ts';
import { sbi } from './sbi.ts';

// Gateways first: "icici" or "hdfc" can appear in their sender names, never the other way round.
const banks: BankParser[] = [amazonpay, payu, razorpay, hdfc, icici, axis, sbi, kotak];

export const bankFor = (from: string) => banks.find((b) => b.matches(from)) ?? null;

export const isReceiptSource = (id: string | null) => Boolean(id && banks.find((b) => b.id === id)?.receipt);

export function parseEmail(email: EmailInput): ParseResult & { bank: string | null } {
  const bank = bankFor(email.from);
  if (!bank) {
    const pre = preCheck(email);
    return 'ignored' in pre ? { status: 'ignored', reason: pre.ignored, bank: null } : { status: 'unparsed', reason: 'unknown sender', bank: null };
  }
  return { ...parseWith(bank, email), bank: bank.id };
}

export type { EmailInput, ParsedTxn, ParseResult } from './common.ts';
