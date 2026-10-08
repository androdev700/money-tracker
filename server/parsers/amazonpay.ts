import type { BankParser } from './common.ts';

// Amazon Pay balance payments have no bank alert; payments to other merchants may also have one (deduped).
export const amazonpay: BankParser = {
  id: 'amazonpay',
  receipt: true,
  matches: (from) => /amazonpay\.in|amazonpay\.com/i.test(from),
  // Refunds here are either re-reported by the card issuer or carry no amount, so the card alert is the record.
  ignoreSubject: /refund|cashback|reward|reminder|gift card/i,
  subjectMerchantPatterns: [/\bpayment of\s*₹?\s*[\d,.]+\s+to\s+(.+?)\s+was successful/i, /\bwas paid on\s+(.+)$/i],
  merchantPatterns: [/\bpayment to\s+(.+?)\s+(?:is approved|was successful)/i, /\bwas paid on\s+(\S+?)\.?\s/i],
};
