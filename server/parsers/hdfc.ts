import type { BankParser } from './common.ts';

export const hdfc: BankParser = {
  id: 'hdfc',
  matches: (from) => /hdfcbank/i.test(from),
  merchantPatterns: [
    /\bto VPA\s+(\S+@\S+?)\s+(.+?)\s+on\s+\d/i,
    /\bfor Rs\.?\s*[\d,.]+\s+at\s+(.+?)\s+on\s+\d/i,
    /\btowards\s+(.+?)\s+on\s+\d{1,2}\s+[A-Z][a-z]{2}/i,
    /\btowards\s+(.+?)\s+on\s+\d/i,
    /\bat\s+(.+?)\s+on\s+\d/i,
    /\bto\s+(.+?)\s+on\s+\d{1,2}-\d{1,2}-\d{2}/i,
  ],
};
