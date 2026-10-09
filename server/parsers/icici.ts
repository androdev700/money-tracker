import type { BankParser } from './common.ts';

export const icici: BankParser = {
  id: 'icici',
  matches: (from) => /icici/i.test(from),
  useEmailTime: true,
  merchantPatterns: [
    /\btowards\s+(.+?)\s+from your\b/i,
    /\bInfo:?\s*(.+?)(?:\.\s|\s+The Available|\s+Avl|$)/i,
    /;\s*(.+?)\s+credited\b/i,
    /\bat\s+(.+?)\s+on\s+\d/i,
  ],
};
