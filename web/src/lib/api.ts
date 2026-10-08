export type Kind = 'spend' | 'refund' | 'excluded';

export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  sort: number;
  archived: number;
}

export interface Txn {
  id: number;
  email_id: string | null;
  source: 'email' | 'manual';
  txn_at: string;
  amount_paise: number;
  merchant: string;
  merchant_key: string;
  category_id: number | null;
  kind: Kind;
  exclude_reason: string | null;
  instrument: string | null;
  bank: string | null;
  account_last4: string | null;
  ref_no: string | null;
  note: string | null;
  categorised_by: string | null;
  needs_review: number;
  user_edited: number;
  duplicate_of: number | null;
  category_name: string | null;
  category_icon: string | null;
}

export interface Summary {
  month: string;
  total: number;
  prevTotal: number;
  prevToDate: number | null;
  byCategory: { category_id: number | null; name: string | null; icon: string | null; total: number; count: number }[];
  byDay: { day: string; total: number }[];
  excludedCount: number;
  reviewCount: number;
}

export interface SyncStatus {
  at: string;
  ok: boolean;
  fetched?: number;
  counts?: Record<string, number>;
  error?: string;
}

export interface Status {
  lastSync: SyncStatus | null;
  syncing: boolean;
  gmail: { configured: boolean; user: string; label: string };
  ollama: { enabled: boolean; available: boolean; model: string };
  reviewCount: number;
  unparsedCount: number;
}

export interface Rule {
  merchant_key: string;
  display_name: string | null;
  category_id: number;
  category_name: string;
  category_icon: string;
  txn_count: number;
}

export interface EmailRow {
  id: string;
  from_addr: string;
  subject: string;
  received_at: string;
  parse_status: string;
  error: string | null;
  snippet?: string;
  body_text?: string;
}

export interface TxnInput {
  txn_at?: string;
  amount_paise?: number;
  merchant?: string;
  category_id?: number | null;
  note?: string | null;
  kind?: Kind;
  email_id?: string;
  apply_to_merchant?: boolean;
  not_duplicate?: boolean;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    throw new Error(err?.message || err?.error || `${res.status} ${res.statusText}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: (path: string) => request<void>('DELETE', path),
};
