import { orderText, type OrderEmail, type OrderParse } from './common.ts';
import { looksLikeOrder, ORDER_PARSERS } from './parsers.ts';

export function parseOrderEmail(email: OrderEmail): OrderParse & { source: string | null } {
  const text = orderText(email);
  const parser = ORDER_PARSERS.find((p) => p.matches(email.from));
  if (parser) return { ...parser.parse(email, text), source: parser.source };
  return looksLikeOrder(email.subject, text)
    ? { status: 'unparsed', reason: 'unknown sender', source: null }
    : { status: 'ignored', reason: 'not an order confirmation', source: null };
}
