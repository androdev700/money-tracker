import type { BankParser } from './common.ts';

export const kotak: BankParser = {
  id: 'kotak',
  matches: (from) => /kotak/i.test(from),
  merchantPatterns: [
    /\bSent Rs\.?\s*[\d,.]+\s+from .+?\s+to\s+(.+?)\s+on\s+\d/i,
    /\btowards\s+(.+?)\s+on\s+\d/i,
    /\bat\s+(.+?)\s+on\s+\d/i,
  ],
};
