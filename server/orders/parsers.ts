import { monthDayTime, receivedIso, rupeesToPaise, superscriptPaise, type OrderParse, type OrderParser, type ParsedItem } from './common.ts';

const ignored = (reason: string): OrderParse => ({ status: 'ignored', reason });
const unparsed = (reason: string): OrderParse => ({ status: 'unparsed', reason });

/** Text between two markers, or '' when the first is missing. */
function section(text: string, start: RegExp, end: RegExp): string {
  const s = text.search(start);
  if (s < 0) return '';
  const rest = text.slice(s).replace(start, '');
  const e = rest.search(end);
  return e < 0 ? rest : rest.slice(0, e);
}

const swiggy: OrderParser = {
  source: 'swiggy',
  matches: (from) => /@swiggy\.in|@instamart\.in/i.test(from),
  parse(email, text) {
    if (!/delivered/i.test(email.subject) || /dineout|booking|deal/i.test(email.subject)) return ignored('not an order confirmation');
    const orderRef = text.match(/order (?:id|no)\.?:?\s*(\d{6,})/i)?.[1] ?? null;

    // Instamart: "Order Items 1 x Name ₹199.00 … Order Summary … Grand Total ₹370.00"
    if (/Order Items/i.test(text)) {
      const list = section(text, /Order Items/i, /Order Summary|Item Bill/i);
      const items: ParsedItem[] = [...list.matchAll(/(\d+)\s*x\s+(.+?)\s+₹\s?([\d,]+(?:\.\d{1,2})?)/gi)].map((m) => ({
        name: m[2].trim(),
        qty: Number(m[1]),
        pricePaise: rupeesToPaise(m[3]),
      }));
      const total = rupeesToPaise(text.match(/Grand Total\s*₹\s?([\d,]+(?:\.\d{1,2})?)/i)?.[1]);
      if (!items.length || !total) return unparsed('instamart: items or total not found');
      return { status: 'order', order: { source: 'swiggy', store: 'Instamart', orderRef, orderedAt: receivedIso(email.receivedAt), totalPaise: total, kind: 'grocery', items } };
    }

    // Food: "ORDER JOURNEY <restaurant, address> Oct 11, 5:00 PM … BILL DETAILS Dish x1 ₹297 Packaging … Paid Via … ₹254"
    const journey = text.match(/ORDER JOURNEY\s+(.+?)(?:,|\s+\d)/i)?.[1];
    const store =
      journey
        ?.replace(/\s*[@#].*$/, '')
        .replace(/\s+(?:counter|shop|outlet|unit|no\.?|rw\d+\+?)$/i, '')
        .trim() || null;
    const orderedAt = monthDayTime(text.slice(text.search(/ORDER JOURNEY/i)), email.receivedAt) ?? receivedIso(email.receivedAt);
    const bill = section(text, /BILL DETAILS/i, /\b(?:Restaurant Packaging|Packaging|Platform fee|Delivery Fee|Discount|Taxes|Item Total|Paid Via|GST)\b/i);
    const items: ParsedItem[] = [...bill.matchAll(/\s*([^₹]+?)\s+x\s?(\d+)\s+₹\s?([\d,]+(?:\.\d{1,2})?)/gi)].map((m) => ({
      name: m[1].trim(),
      qty: Number(m[2]),
      pricePaise: rupeesToPaise(m[3]),
    }));
    const total = rupeesToPaise(
      text.match(/Paid Via[^₹]*₹\s?([\d,]+(?:\.\d{1,2})?)/i)?.[1] ?? text.match(/(?:Grand Total|Total Paid|To Pay)\s*₹\s?([\d,]+(?:\.\d{1,2})?)/i)?.[1],
    );
    if (!items.length || !total) return unparsed('swiggy: items or total not found');
    return { status: 'order', order: { source: 'swiggy', store, orderRef, orderedAt, totalPaise: total, kind: 'food', items } };
  },
};

const zomato: OrderParser = {
  source: 'zomato',
  matches: (from) => /noreply@zomato\.com/i.test(from),
  parse(email, text) {
    const store = email.subject.match(/Your Zomato order from\s+(.+)$/i)?.[1]?.trim();
    if (!store) return ignored('not an order confirmation');
    const orderRef = text.match(/ORDER ID:?\s*(\d{6,})/i)?.[1] ?? null;
    // "1 X Rumali Roti 1 X BBQ Chicken Seekh Kebab Total paid - ₹252.57"; no per-item prices.
    const list = text.slice(text.search(/\b\d+\s+X\s+/), text.search(/Total paid/i));
    const items: ParsedItem[] = [...list.matchAll(/(\d+)\s+X\s+(.+?)(?=\s+\d+\s+X\s+|$)/g)].map((m) => ({ name: m[2].trim(), qty: Number(m[1]), pricePaise: null }));
    const total = rupeesToPaise(text.match(/Total paid\s*-?\s*₹\s?([\d,]+(?:\.\d{1,2})?)/i)?.[1]);
    if (!items.length || !total) return unparsed('zomato: items or total not found');
    // The mail arrives on delivery; payment happened when ordering.
    const mins = Number(text.match(/delivered in (?:just )?(\d+) minutes/i)?.[1] ?? 0);
    const orderedAt = receivedIso(new Date(new Date(email.receivedAt).getTime() - mins * 60_000).toISOString());
    return { status: 'order', order: { source: 'zomato', store, orderRef, orderedAt, totalPaise: total, kind: 'food', items } };
  },
};

const amazon: OrderParser = {
  source: 'amazon',
  matches: (from) => /@amazon\.in/i.test(from),
  parse(email, text) {
    if (/^Item cancelled:/i.test(email.subject)) {
      const orderRef = text.match(/Order #\W*([\d-]{12,})/)?.[1];
      return orderRef ? { status: 'cancelled', source: 'amazon', orderRef } : ignored('cancellation without an order number');
    }
    // Shipping, delivery, return, refund and survey mails repeat the order; only the confirmation creates it.
    if (!/auto-confirm@amazon\.in/i.test(email.from) || !/^Ordered:/i.test(email.subject)) return ignored('not an order confirmation');
    const orderRef = text.match(/Order #\W*([\d-]{12,})/)?.[1] ?? null;
    const list = section(text, /View or edit order/i, /\bTotal\s+₹/i);
    const items: ParsedItem[] = [...list.matchAll(/\s*(.+?)\s+Quantity:\s*(\d+)\s+₹\s?([\d,]+)/g)].map((m) => ({
      name: m[1].trim(),
      qty: Number(m[2]),
      pricePaise: superscriptPaise(m[3]),
    }));
    const total = rupeesToPaise(text.match(/\bTotal\s+₹\s?([\d,]+\.\d{2})/)?.[1]) ?? items.reduce((s, i) => s + (i.pricePaise ?? 0) * i.qty, 0);
    if (!items.length || !total) return unparsed('amazon: items or total not found');
    return { status: 'order', order: { source: 'amazon', store: 'Amazon', orderRef, orderedAt: receivedIso(email.receivedAt), totalPaise: total, kind: 'retail', items } };
  },
};

const flipkart: OrderParser = {
  source: 'flipkart',
  matches: (from) => /flipkart\.com/i.test(from),
  parse(email, text) {
    if (!/successfully placed/i.test(email.subject)) return ignored('not an order confirmation');
    const orderRef = text.match(/Order ID\s*(OD\d+)/i)?.[1] ?? null;
    const items: ParsedItem[] = [...text.matchAll(/(?:by the seller\.|Qty:\s*\d+)\s+(.+?)\s+Delivery by .+?Qty:\s*(\d+)/gi)].map((m) => ({
      name: m[1].trim(),
      qty: Number(m[2]),
      pricePaise: null,
    }));
    const total = rupeesToPaise(text.match(/Amount Paid\s*(?:₨|Rs)\.?\s*([\d,]+(?:\.\d{1,2})?)/i)?.[1]);
    if (!items.length || !total) return unparsed('flipkart: items or total not found');
    return { status: 'order', order: { source: 'flipkart', store: 'Flipkart', orderRef, orderedAt: receivedIso(email.receivedAt), totalPaise: total, kind: 'retail', items } };
  },
};

const decathlon: OrderParser = {
  source: 'decathlon',
  matches: (from) => /noreply-decathlonindia@decathlon\.com/i.test(from),
  parse(email, text) {
    // "Shipped" mails are numbered by package, not order; Confirmed/Delivered carry the order number.
    const orderRef = email.subject.match(/Order\s+(\d{6,})\s+is\s+(?:Confirmed|Delivered)/i)?.[1];
    if (!orderRef) return ignored('not an order confirmation');
    const list = section(text, /Order details/i, /Order value/i)
      .replace(/Package ID\s*:\s*\d+/gi, '')
      .replace(/Delivery Date\s*:\s*\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s*\d{4}/gi, '');
    const items: ParsedItem[] = [...list.matchAll(/\s*(.+?)\s+Qty:\s*(\d+)\s+₹\s?([\d,]+(?:\.\d{1,2})?)/gi)].map((m) => ({
      name: m[1].trim(),
      qty: Number(m[2]),
      pricePaise: rupeesToPaise(m[3]),
    }));
    const total = rupeesToPaise(text.match(/\bTotal\s+₹\s?([\d,]+(?:\.\d{1,2})?)/)?.[1]);
    if (!items.length || !total) return unparsed('decathlon: items or total not found');
    return { status: 'order', order: { source: 'decathlon', store: 'Decathlon', orderRef, orderedAt: receivedIso(email.receivedAt), totalPaise: total, kind: 'retail', items } };
  },
};

const MONTH_NUM: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

const bookmyshow: OrderParser = {
  source: 'bookmyshow',
  matches: (from) => /tickets@bookmyshow\.(?:com|email)/i.test(from),
  parse(email, text) {
    const m = text.match(/Booking ID\s+(\w+)\s+(.+?)\s+(?:\(|\d{1,2}:\d{2}\s*[ap]m)/i);
    const total = rupeesToPaise(text.match(/AMOUNT PAID\s*Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/i)?.[1]);
    if (!m || !total) return unparsed('bookmyshow: title or amount not found');
    const qty = Number(text.match(/(\d+)\s+tickets?/i)?.[1] ?? 1);
    const at = text.match(/Booking Date & Time\s+\w+,\s+(\d{1,2})\s+(\w{3}),?\s+(\d{4})\s*\|\s*(\d{1,2}):(\d{2})\s*([ap])m/i);
    const orderedAt = at
      ? `${at[3]}-${MONTH_NUM[at[2].toLowerCase()]}-${at[1].padStart(2, '0')}T${String((Number(at[4]) % 12) + (at[6].toLowerCase() === 'p' ? 12 : 0)).padStart(2, '0')}:${at[5]}:00`
      : receivedIso(email.receivedAt);
    return {
      status: 'order',
      order: { source: 'bookmyshow', store: 'BookMyShow', orderRef: m[1], orderedAt, totalPaise: total, kind: 'retail', items: [{ name: m[2].trim(), qty, pricePaise: total, category: 'personal' }] },
    };
  },
};

const paymentReceipts: OrderParser = {
  source: 'receipts',
  matches: (from) => /razorpay\.com|payu\.in|payu\.com|amazonpay\.in/i.test(from),
  parse: () => ignored('payment receipt (read with bank alerts)'),
};

export const ORDER_PARSERS: OrderParser[] = [swiggy, zomato, amazon, flipkart, decathlon, bookmyshow, paymentReceipts];

/** Worth asking the local model about: reads like a purchase confirmation and names an amount. */
export function looksLikeOrder(subject: string, text: string): boolean {
  if (/ship|out for delivery|delivered|dispatch|on the way|arriving|return|refund|cancel|review|feedback|otp|one-time|password|registration|survey|reward|points|account|inquiry|declined|ends on|will end|reminder|required|important note/i.test(subject)) return false;
  if (/amount due|due date|pay now|pay before|payment link/i.test(text)) return false;
  return /order|booking|receipt|invoice|confirm|purchase|payment|membership|policy|bill/i.test(subject) && /(?:₹|Rs\.?|INR)\s?\d/.test(text);
}
