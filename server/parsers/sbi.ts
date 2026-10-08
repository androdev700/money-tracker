import type { BankParser } from './common.ts';

export const sbi: BankParser = {
  id: 'sbi',
  matches: (from) => /sbi(card)?\.co|sbicard|alerts\.sbi|onlinesbi/i.test(from),
  merchantPatterns: [
    /\bspent on your SBI Credit Card ending \d+ at\s+(.+?)\s+on\s+\d/i,
    /\btrf to\s+(.+?)\s+Ref/i,
    /\bat\s+(.+?)\s+on\s+\d/i,
  ],
};
