import { cleanText, toLocalIso } from '../parsers/common.ts';

export type OrderKind = 'food' | 'grocery' | 'retail';

export interface ParsedItem {
  name: string;
  qty: number;
  pricePaise: number | null;
  /** A category name the parser already knows (movie tickets are personal); skips inference. */
  category?: string;
}

export interface ParsedOrder {
  source: string;
  store: string | null;
  orderRef: string | null;
  orderedAt: string;
  totalPaise: number;
  kind: OrderKind;
  items: ParsedItem[];
}

export interface OrderEmail {
  from: string;
  subject: string;
  receivedAt: string;
  body: string;
}

export type OrderParse = { status: 'order'; order: ParsedOrder } | { status: 'ignored'; reason: string } | { status: 'unparsed'; reason: string };

export interface OrderParser {
  source: string;
  matches: (from: string) => boolean;
  parse: (email: OrderEmail, text: string) => OrderParse;
}

export const orderText = (e: OrderEmail) => cleanText(`${e.subject}. ${e.body}`);

/** "1,709.00" → 170900; "₹ 2005/-" → 200500. */
export function rupeesToPaise(s: string | undefined | null): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

/** Amazon renders item prices with superscript paise and no point: "₹1,70400" is ₹1,704.00. */
export function superscriptPaise(s: string): number | null {
  const digits = s.replace(/[^\d]/g, '');
  return digits.length >= 3 ? Number(digits) : null;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');

/** "Oct 11, 5:00 PM" (no year: taken from the email, rolled back across New Year). */
export function monthDayTime(s: string, receivedAt: string): string | null {
  const m = s.match(/\b([A-Za-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]/);
  if (!m || !MONTHS[m[1].toLowerCase()]) return null;
  let hour = Number(m[3]) % 12;
  if (m[5].toLowerCase() === 'p') hour += 12;
  const received = new Date(receivedAt);
  let year = received.getFullYear();
  const mo = MONTHS[m[1].toLowerCase()];
  if (mo > received.getMonth() + 2) year -= 1;
  return `${year}-${pad(mo)}-${pad(Number(m[2]))}T${pad(hour)}:${m[4]}:00`;
}

export const receivedIso = (receivedAt: string) => toLocalIso(new Date(receivedAt));

/** Tidy an item name for display: drop "...", shout-case, extra spaces. */
export function itemTitle(name: string): string {
  let s = name.replace(/\.{2,}$|…$/, '').replace(/\s+/g, ' ').trim().replace(/[\s\-–,(:|/]+$/, '');
  if (s === s.toUpperCase() && /[A-Z]{3}/.test(s)) s = s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  return s.length > 42 ? `${s.slice(0, 40).trim()}…` : s;
}

/** Stable key for item rules; Amazon truncates names identically, so a prefix is enough. */
export const itemKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 32);

export function mealName(localIso: string): string {
  const h = Number(localIso.slice(11, 13));
  if (h >= 5 && h < 11) return 'Breakfast';
  if (h >= 11 && h < 16) return 'Lunch';
  if (h >= 16 && h < 19) return 'Snacks';
  if (h >= 19 && h < 23) return 'Dinner';
  return 'Late-night';
}
