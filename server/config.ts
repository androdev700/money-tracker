// Bank alerts state times in IST; pin the process so stored local times and month buckets agree.
process.env.TZ ||= 'Asia/Kolkata';

const env = process.env;

export const config = {
  host: env.HOST || '127.0.0.1',
  port: Number(env.PORT || 4100),
  dbPath: env.DB_PATH || 'data/money.db',
  gmail: {
    user: env.GMAIL_USER || '',
    password: (env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, ''),
    label: env.GMAIL_LABEL || 'transactions',
    ordersLabel: env.GMAIL_ORDERS_LABEL || '',
  },
  backfillMonths: Number(env.BACKFILL_MONTHS || 6),
  /** YYYY-MM-DD: never read mail from before this day (overrides BACKFILL_MONTHS). */
  syncFrom: /^\d{4}-\d{2}-\d{2}$/.test(env.SYNC_FROM ?? '') ? env.SYNC_FROM! : null,
  syncIntervalMin: Number(env.SYNC_INTERVAL_MIN || 15),
  ollama: {
    url: env.OLLAMA_URL ?? 'http://127.0.0.1:11434',
    model: env.OLLAMA_MODEL || 'llama3.2:3b',
  },
};

export const gmailConfigured = () => Boolean(config.gmail.user && config.gmail.password);
