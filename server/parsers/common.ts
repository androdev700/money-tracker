export type Direction = 'debit' | 'credit';
export type Instrument = 'UPI' | 'CC' | 'DC' | 'ACCOUNT';

export interface ParsedTxn {
  direction: Direction;
  refund: boolean;
  amountPaise: number;
  merchantRaw: string | null;
  last4: string | null;
  instrument: Instrument;
  txnAt: string;
  refNo: string | null;
  /** The sentence the fields were read from; kind rules look here, not at footers. */
  window: string;
}

export interface EmailInput {
  from: string;
  subject: string;
  receivedAt: string;
  body: string;
}

export type ParseResult =
  | { status: 'parsed'; txn: ParsedTxn }
  | { status: 'ignored'; reason: string }
  | { status: 'unparsed'; reason: string };

export function cleanText(s: string): string {
  return s
    .replace(/&nbsp;| /g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const AMOUNT_RE = /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/gi;
// Balance / limit figures share the email with the transaction amount and must never win.
const NON_TXN_AMOUNT_BEFORE = /(?:bal(?:ance)?|limit|avl|available|outstanding|due|minimum|min\.?)[^.]{0,25}$/i;

// SBI UPI alerts carry no currency marker: "debited by 120.0".
const BARE_AMOUNT_RE = /(?:debited by|debited for|credited by|amount of)\s*([\d,]+(?:\.\d{1,2})?)/gi;

export function findAmount(text: string): { paise: number; index: number } | null {
  for (const m of [...text.matchAll(AMOUNT_RE), ...text.matchAll(BARE_AMOUNT_RE)]) {
    const before = text.slice(Math.max(0, m.index - 40), m.index);
    if (NON_TXN_AMOUNT_BEFORE.test(before)) continue;
    const paise = Math.round(parseFloat(m[1].replace(/,/g, '')) * 100);
    if (paise > 0) return { paise, index: m.index };
  }
  return null;
}

const REFUND_RE = /\b(refund(?:ed)?|revers(?:al|ed)|chargeback)\b/i;
const DEBIT_RE = /\b(debited|spent|used for|thank you for using|sent|paid|purchase|withdrawn|transaction of|transaction amount|amount debited|transaction alert|debit by|has been used|is debited|towards)\b/i;
const CREDIT_RE = /\b(credited to your|has been credited|is credited|received|deposited|credit of)\b/i;

export function findDirection(window: string): { direction: Direction; refund: boolean } | null {
  // Footers say things like "failed transactions are reversed in 2 days"; an explicit debit verb wins over that.
  if (REFUND_RE.test(window) && !/\b(debited|spent|sent|withdrawn|thank you for using|has been used)\b/i.test(window))
    return { direction: 'credit', refund: true };
  if (/\bcredited to your\b|\bhas been credited to\b|\bis credited (?:with|by)\b|\breceived (?:in|from|towards)\b/i.test(window))
    return { direction: 'credit', refund: false };
  if (DEBIT_RE.test(window)) return { direction: 'debit', refund: false };
  if (CREDIT_RE.test(window)) return { direction: 'credit', refund: false };
  return null;
}

export function findLast4(window: string): string | null {
  const m =
    window.match(/(?:ending(?: with)?|ending in|card no\.?|a\/c no\.?|acct|account|a\/c|\bac\b|card)\s*(?:no\.?)?\s*[:#]?\s*(?:[x*X]+\s*)?(\d{3,4})\b/i) ??
    window.match(/\b[xX*]{2,}\s*(\d{3,4})\b/);
  return m ? m[1] : null;
}

export function findInstrument(window: string): Instrument {
  if (/credit card/i.test(window)) return 'CC';
  if (/debit card/i.test(window)) return 'DC';
  if (/\bUPI\b|\bVPA\b|[\w.-]+@[a-z]{2,}\b/i.test(window)) return 'UPI';
  return 'ACCOUNT';
}

export function findRef(text: string): string | null {
  const m =
    text.match(/UPI\/(?:P2[AM]\/|CR\/|DR\/)?(\d{12})/i) ??
    text.match(/(?:UPI|RRN|Ref(?:erence)?)\s*(?:transaction\s*)?(?:ref(?:erence)?\.?\s*)?(?:no\.?|number|id)?\s*(?:is)?\s*[:.-]?\s*(\d{10,16})/i);
  return m ? m[1] : null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');
const year4 = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

/** Local ISO without zone, e.g. 2026-10-05T14:22:11 — the process runs in IST. */
export function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function findDate(window: string, receivedAt: string): string {
  let y: number | undefined, mo: number | undefined, d: number | undefined;
  let m: RegExpMatchArray | null;
  if ((m = window.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/))) {
    [d, mo, y] = [Number(m[1]), Number(m[2]), year4(m[3])];
  } else if ((m = window.match(/\b(\d{1,2})[- ]?([A-Za-z]{3,4})[a-z]*[- ,']*(\d{4}|\d{2})\b/)) && MONTHS[m[2].toLowerCase()]) {
    [d, mo, y] = [Number(m[1]), MONTHS[m[2].toLowerCase()], year4(m[3])];
  } else if ((m = window.match(/\b([A-Za-z]{3,4})[a-z]* (\d{1,2}),? (\d{4})\b/)) && MONTHS[m[1].toLowerCase()]) {
    [d, mo, y] = [Number(m[2]), MONTHS[m[1].toLowerCase()], Number(m[3])];
  } else if ((m = window.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) {
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  }

  const received = new Date(receivedAt);
  const t = window.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/);

  if (!y || !mo || !d || mo > 12 || d > 31) return toLocalIso(received);

  const date = `${y}-${pad(mo)}-${pad(d)}`;
  if (t) return `${date}T${pad(Number(t[1]))}:${t[2]}:${t[3] ?? '00'}`;
  // No time in the alert: the receive time is accurate when it's the same day, noon otherwise.
  const recv = toLocalIso(received);
  return recv.startsWith(date) ? recv : `${date}T12:00:00`;
}

/** Text around the transaction amount — alerts put everything in one sentence; footers hold noise. */
export function windowAround(text: string, index: number): { window: string; offset: number } {
  const start = Math.max(0, index - 220);
  return { window: text.slice(start, index + 280), offset: index - start };
}

export function firstMatch(window: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = window.match(re);
    const v = m?.slice(1).filter(Boolean).join(' ').trim();
    if (v) return v;
  }
  return null;
}

// Shared across banks; bank parsers put their own patterns ahead of these.
export const GENERIC_MERCHANT_PATTERNS: RegExp[] = [
  /\bto VPA\s+(\S+@\S+?)\s+(.+?)\s+on\s+\d/i,
  /\bto VPA\s+(\S+@[\w.]+)/i,
  /\bInfo:?\s*(.+?)(?:\.\s|\. The|\s+The Available|\s+Avl|$)/i,
  /\bTransaction Info:?\s*(.+?)(?:\s+If|\s+Avl|\.|$)/i,
  /\bat\s+(.+?)\s+on\s+(?:\d|[A-Z][a-z]{2})/i,
  /\btowards\s+(.+?)\s+on\s+\d/i,
  /\btrf to\s+(.+?)\s+Ref/i,
  /\bto\s+([\w.-]+@[\w.]+)/i,
  /;\s*(.+?)\s+credited\b/i,
];

export interface BankParser {
  id: string;
  matches: (from: string) => boolean;
  merchantPatterns: RegExp[];
}

const NOT_TXN_SUBJECT = /\b(otp|one time password|statement|e-?statement|offer|reward points|password|login|update your|kyc|newsletter|emi conversion)\b/i;

export function parseWith(bank: BankParser, email: EmailInput): ParseResult {
  const text = cleanText(`${email.subject}. ${email.body}`);
  if (NOT_TXN_SUBJECT.test(email.subject) && !/debited|spent|credited/i.test(email.subject))
    return { status: 'ignored', reason: 'not a transaction alert' };

  const amount = findAmount(text);
  if (!amount) return { status: 'ignored', reason: 'no amount' };

  const { window, offset } = windowAround(text, amount.index);
  // Merchant patterns read from the start of the amount's sentence: "Sent Rs.300 from … to X", "for Rs 1,250 at X".
  const dot = window.lastIndexOf('. ', offset);
  const sentenceStart = dot < 0 ? 0 : dot + 2;
  const dir = findDirection(window);
  if (!dir) return { status: 'unparsed', reason: 'direction unclear' };

  return {
    status: 'parsed',
    txn: {
      direction: dir.direction,
      refund: dir.refund,
      amountPaise: amount.paise,
      merchantRaw: firstMatch(window.slice(sentenceStart), [...bank.merchantPatterns, ...GENERIC_MERCHANT_PATTERNS]),
      last4: findLast4(window),
      instrument: findInstrument(window),
      txnAt: findDate(window, email.receivedAt),
      refNo: findRef(window),
      window,
    },
  };
}
