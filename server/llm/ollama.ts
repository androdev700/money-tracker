import { config } from '../config.ts';

export interface LlmExtraction {
  is_spend_or_refund: boolean;
  direction: 'debit' | 'credit';
  is_refund: boolean;
  amount: number;
  merchant: string;
  date: string;
  card_or_account_last4: string;
}

let reachable: { ok: boolean; at: number } | null = null;

export async function ollamaAvailable(): Promise<boolean> {
  if (!config.ollama.url) return false;
  if (reachable && Date.now() - reachable.at < 60_000) return reachable.ok;
  try {
    const res = await fetch(`${config.ollama.url}/api/tags`, { signal: AbortSignal.timeout(2000) });
    const body = (await res.json()) as { models?: { name: string }[] };
    const ok = res.ok && Boolean(body.models?.some((m) => m.name.startsWith(config.ollama.model)));
    reachable = { ok, at: Date.now() };
  } catch {
    reachable = { ok: false, at: Date.now() };
  }
  return reachable.ok;
}

async function chat<T>(system: string, user: string, schema: object): Promise<T | null> {
  if (!(await ollamaAvailable())) return null;
  try {
    const res = await fetch(`${config.ollama.url}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(90_000),
      body: JSON.stringify({
        model: config.ollama.model,
        stream: false,
        format: schema,
        options: { temperature: 0 },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { message?: { content?: string } };
    return JSON.parse(body.message?.content ?? 'null') as T;
  } catch {
    return null;
  }
}

export function extractWithLlm(subject: string, body: string): Promise<LlmExtraction | null> {
  return chat<LlmExtraction>(
    'You read Indian bank transaction alert emails and extract the transaction. Amounts are in INR. ' +
      'The merchant is who received the money (payee name or UPI VPA), never the bank or the account holder. ' +
      'Ignore available balance and credit limit figures. Dates must be YYYY-MM-DD. ' +
      'Set is_spend_or_refund false for OTPs, statements, offers, and anything that is not a single transaction.',
    `Subject: ${subject}\n\n${body.slice(0, 2500)}`,
    {
      type: 'object',
      properties: {
        is_spend_or_refund: { type: 'boolean' },
        direction: { type: 'string', enum: ['debit', 'credit'] },
        is_refund: { type: 'boolean' },
        amount: { type: 'number' },
        merchant: { type: 'string' },
        date: { type: 'string' },
        card_or_account_last4: { type: 'string' },
      },
      required: ['is_spend_or_refund', 'direction', 'is_refund', 'amount', 'merchant', 'date', 'card_or_account_last4'],
    },
  );
}

export async function categoriseWithLlm(merchant: string, context: string, categories: string[]): Promise<string | null> {
  const out = await chat<{ category: string }>(
    `You categorise personal spending in India. Pick exactly one category from: ${categories.join(', ')}. ` +
      'food = restaurants and food delivery; groceries = supermarkets and quick-commerce; home = rent, utilities, ' +
      'repairs, household; vehicle = car or bike upkeep, tolls, parking; fuel = petrol pumps; drinks = alcohol, bars; ' +
      'health = medicines, doctors, gym; personal = travel, cabs, subscriptions, recharges, entertainment, self-care; ' +
      'shopping = online and retail shopping. Answer "unknown" if the merchant name gives no real clue.',
    `Merchant: ${merchant}\nAlert text: ${context.slice(0, 400)}`,
    {
      type: 'object',
      properties: { category: { type: 'string', enum: [...categories, 'unknown'] } },
      required: ['category'],
    },
  );
  return out && out.category !== 'unknown' ? out.category : null;
}

export interface LlmOrder {
  is_purchase: boolean;
  store: string;
  total: number;
  ordered_at: string;
  items: { name: string; qty: number; price: number }[];
}

export function extractOrderWithLlm(subject: string, body: string): Promise<LlmOrder | null> {
  return chat<LlmOrder>(
    'You read Indian purchase, booking, subscription and bill emails and extract what was bought. Amounts are in INR. ' +
      'total is the amount actually paid. ordered_at is "YYYY-MM-DD HH:MM" when stated, else "". ' +
      'items are the products or services bought (for a subscription or bill, one item naming it). ' +
      'Set is_purchase false for shipping/delivery updates, refunds, OTPs, offers, surveys and account notices.',
    `Subject: ${subject}\n\n${body.slice(0, 3000)}`,
    {
      type: 'object',
      properties: {
        is_purchase: { type: 'boolean' },
        store: { type: 'string' },
        total: { type: 'number' },
        ordered_at: { type: 'string' },
        items: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' }, qty: { type: 'number' }, price: { type: 'number' } }, required: ['name', 'qty', 'price'] },
        },
      },
      required: ['is_purchase', 'store', 'total', 'ordered_at', 'items'],
    },
  );
}
