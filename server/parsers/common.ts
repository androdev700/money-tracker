export type Direction = 'debit' | 'credit';
export type Instrument = 'UPI' | 'CC' | 'DC' | 'WALLET' | 'ACCOUNT';

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

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: "'", lsquo: "'", ndash: '-', mdash: '-', rupee: '₹' };

/** Normalise an email body to one line of plain text. Some senders put HTML or raw CSS in the text part. */
export function cleanText(s: string): string {
  let out = s
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '');
  if (/\{[^{}]*:[^{}]*\}/.test(out)) {
    out = out.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/@import[^;]*;/g, ' ');
    // Two passes clear one level of nesting (@media { a { … } }).
    for (let i = 0; i < 2; i++) out = out.replace(/\{[^{}]*\}/g, ' ');
  }
  return out.replace(/\s+/g, ' ').trim();
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
const DEBIT_RE = /\b(debited|spent|used for|thank you for using|sent|paid|purchase|withdrawn|transaction of|transaction amount|amount debited|transaction alert|debit by|has been used|is debited|towards|payment of|payment to)\b/i;
const CREDIT_RE = /\b(credited to your|has been credited|is credited|received|deposited|credit of)\b/i;

export function findDirection(window: string): { direction: Direction; refund: boolean } | null {
  // Footers say things like "failed transactions are reversed in 2 days"; an explicit debit verb wins over that.
  if (REFUND_RE.test(window) && !/\b(debited|spent|sent|withdrawn|thank you for using|has been used)\b/i.test(window))
    return { direction: 'credit', refund: true };
  if (/\bcredited to your\b|\b(?:has been|is) credited (?:to|with|by)\b|\breceived (?:in|from|towards)\b|\b(?:we have )?received (?:a |your )?payment\b|\bpayment (?:has been |is )?received\b/i.test(window))
    return { direction: 'credit', refund: false };
  if (DEBIT_RE.test(window)) return { direction: 'debit', refund: false };
  if (CREDIT_RE.test(window)) return { direction: 'credit', refund: false };
  return null;
}

export function findLast4(window: string): string | null {
  const m =
    window.match(/\b\d{4}[\s-]*[xX*]{4}[\s-]*[xX*]{4}[\s-]*(\d{4})\b/) ??
    window.match(/(?:ending(?: with)?|ending in|card no\.?|a\/c no\.?|acct|account|a\/c|\bac\b|card)\s*(?:no\.?)?\s*[:#]?\s*(?:[x*X]+\s*)?(\d{3,4})\b/i) ??
    window.match(/\b[xX*]{2,}[\s-]*(\d{3,4})\b/);
  return m ? m[1] : null;
}

export function findInstrument(window: string): Instrument {
  if (/amazon pay balance|\bwallet\b|paytm balance/i.test(window)) return 'WALLET';
  if (/credit ?card|method card/i.test(window)) return 'CC';
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

/** `useEmailTime`: the sender's printed time can't be trusted, so take the email's arrival time instead. */
export function findDate(window: string, receivedAt: string, opts: { useEmailTime?: boolean } = {}): string {
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
  const t = window.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b(?:\s*([AaPp])\.?[Mm]\b)?/);
  let hour = t ? Number(t[1]) : 0;
  if (t?.[4]?.toLowerCase() === 'p' && hour < 12) hour += 12;
  if (t?.[4]?.toLowerCase() === 'a' && hour === 12) hour = 0;

  if (!y || !mo || !d || mo > 12 || d > 31) return toLocalIso(received);

  const date = `${y}-${pad(mo)}-${pad(d)}`;
  const recv = toLocalIso(received);
  // A delayed alert that lands on a later day keeps the transaction's own date.
  if (opts.useEmailTime && recv.startsWith(date)) return recv;
  if (t) return `${date}T${pad(hour)}:${t[2]}:${t[3] ?? '00'}`;
  // No time in the alert: the receive time is accurate when it's the same day, noon otherwise.
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
  /** Merchant named only in the subject ("Payment successful for X"). Tried first. */
  subjectMerchantPatterns?: RegExp[];
  /** Subjects from this sender that are never a spend (cashback, reminders). */
  ignoreSubject?: RegExp;
  /** A merchant/gateway receipt: the same payment usually also has a bank alert. */
  receipt?: boolean;
  /** Printed times are unreliable (ICICI: 12-hour clock without AM/PM); use when the email arrived. */
  useEmailTime?: boolean;
}

const NOT_TXN_SUBJECT = /\b(otp|one time password|statement|e-?statement|offer|reward|cashback|reminder|upcoming|pre-?debit|password|login|update your|payment method|kyc|newsletter|emi conversion)\b/i;

// "has been declined", "payment failed"; footers say "in case of a failed transaction", which must not match.
const DECLINED = /\b(?:has been|was|been|is|got)\s+(?:declined|rejected|unsuccessful)\b|\b(?:transaction|payment)\s+(?:has\s+)?(?:failed|declined)\b/i;
// Advance notice of a standing instruction / mandate; the real debit sends its own alert later.
const UPCOMING = /\bwill be (?:debited|charged|deducted)\b|\b(?:is|are) (?:due|scheduled) (?:to be|for) (?:debit|deduct|charg)/i;
const INTEREST = /\bint(?:erest)?\.?\s*(?:pd|paid|credited)\b|\binterest (?:credit|paid|payout)\b/i;
// Bank senders that only ever send statements, marketing and awareness mail.
const NON_ALERT_SENDER = /statement|custcomm|mailers?\.|retailproducts|feedback@|newsletter|marketing|promo|offers?@/i;

/** Checks that apply to every sender, known or not. Returns the amount when the email is worth parsing. */
export function preCheck(email: EmailInput): { ignored: string } | { text: string; amount: { paise: number; index: number } } {
  if (NON_ALERT_SENDER.test(email.from)) return { ignored: 'not an alert sender' };
  if (NOT_TXN_SUBJECT.test(email.subject) && !/debited|spent|credited/i.test(email.subject)) return { ignored: 'not a transaction alert' };
  const text = cleanText(`${email.subject}. ${email.body}`);
  const amount = findAmount(text);
  return amount ? { text, amount } : { ignored: 'no amount' };
}

export function parseWith(bank: BankParser, email: EmailInput): ParseResult {
  if (bank.ignoreSubject?.test(email.subject)) return { status: 'ignored', reason: 'not a payment' };
  const pre = preCheck(email);
  if ('ignored' in pre) return { status: 'ignored', reason: pre.ignored };
  const { text, amount } = pre;

  const { window, offset } = windowAround(text, amount.index);
  // Merchant patterns read from the start of the amount's sentence: "Sent Rs.300 from … to X", "for Rs 1,250 at X".
  const dot = window.lastIndexOf('. ', offset);
  const sentenceStart = dot < 0 ? 0 : dot + 2;
  if (DECLINED.test(window) || DECLINED.test(email.subject)) return { status: 'ignored', reason: 'declined or failed' };
  if (INTEREST.test(window)) return { status: 'ignored', reason: 'interest credit' };
  if (UPCOMING.test(window)) return { status: 'ignored', reason: 'upcoming payment notice' };
  const dir = findDirection(window);
  if (!dir) return { status: 'unparsed', reason: 'direction unclear' };

  return {
    status: 'parsed',
    txn: {
      direction: dir.direction,
      refund: dir.refund,
      amountPaise: amount.paise,
      merchantRaw:
        firstMatch(cleanText(email.subject), bank.subjectMerchantPatterns ?? []) ??
        firstMatch(window.slice(sentenceStart), [...bank.merchantPatterns, ...GENERIC_MERCHANT_PATTERNS]),
      last4: findLast4(window),
      instrument: findInstrument(window),
      txnAt: findDate(window, email.receivedAt, { useEmailTime: bank.useEmailTime }),
      refNo: findRef(window),
      window,
    },
  };
}
