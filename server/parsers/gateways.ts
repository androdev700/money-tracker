import type { BankParser } from './common.ts';

// Gateway receipts duplicate a card/UPI alert; they're kept for the better merchant name and deduped by amount.
export const payu: BankParser = {
  id: 'payu',
  receipt: true,
  matches: (from) => /payu\.in|payu\.com/i.test(from),
  subjectMerchantPatterns: [/\bYour Order at\s+(.+?)\s+is successful/i, /\bpaid via .+? to\s+(.+)$/i],
  merchantPatterns: [/\bPaid to\s+(.+?)\s+(?:via|on)\s/i],
};

export const razorpay: BankParser = {
  id: 'razorpay',
  receipt: true,
  matches: (from) => /razorpay\.com/i.test(from),
  subjectMerchantPatterns: [/\bPayment successful for\s+(.+)$/i],
  merchantPatterns: [],
};
