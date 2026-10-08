import type { BankParser } from './common.ts';

export const axis: BankParser = {
  id: 'axis',
  matches: (from) => /axisbank|axis\.bank/i.test(from),
  merchantPatterns: [
    /\bMerchant Name:?\s*(.+?)\s+(?:Axis Bank|Card|Date|Available|Transaction)/i,
    /\bTransaction Info:?\s*(.+?)(?:\s+If|\s+Avl|\s+Available|$)/i,
    /\bIST\s+at\s+(.+?)(?:\.\s|\s+Avl|\s+Available|$)/i,
    /\bat\s+(.+?)\s+on\s+\d/i,
    /\bat\s+(UPI\/\S+)/i,
  ],
};
