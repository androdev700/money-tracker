import { axis } from './axis.ts';
import { parseWith, type BankParser, type EmailInput, type ParseResult } from './common.ts';
import { hdfc } from './hdfc.ts';
import { icici } from './icici.ts';
import { kotak } from './kotak.ts';
import { sbi } from './sbi.ts';

const banks: BankParser[] = [hdfc, icici, axis, sbi, kotak];

export const bankFor = (from: string) => banks.find((b) => b.matches(from)) ?? null;

export function parseEmail(email: EmailInput): ParseResult & { bank: string | null } {
  const bank = bankFor(email.from);
  if (!bank) return { status: 'unparsed', reason: 'unknown sender', bank: null };
  return { ...parseWith(bank, email), bank: bank.id };
}

export type { EmailInput, ParsedTxn, ParseResult } from './common.ts';
