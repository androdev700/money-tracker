export const migrations: string[] = [
  `
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE emails (
    id TEXT PRIMARY KEY,
    uid INTEGER,
    from_addr TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    received_at TEXT NOT NULL,
    body_text TEXT NOT NULL,
    parse_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (parse_status IN ('pending','parsed','llm','unparsed','ignored')),
    parser TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX ix_emails_status ON emails(parse_status);

  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY,
    email_id TEXT REFERENCES emails(id),
    source TEXT NOT NULL CHECK (source IN ('email','manual')),
    txn_at TEXT NOT NULL,
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    merchant TEXT NOT NULL,
    merchant_key TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    kind TEXT NOT NULL CHECK (kind IN ('spend','refund','excluded')),
    exclude_reason TEXT,
    instrument TEXT,
    bank TEXT,
    account_last4 TEXT,
    ref_no TEXT,
    note TEXT,
    categorised_by TEXT,
    needs_review INTEGER NOT NULL DEFAULT 0,
    user_edited INTEGER NOT NULL DEFAULT 0,
    duplicate_of INTEGER REFERENCES transactions(id),
    deleted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX ux_txn_email ON transactions(email_id) WHERE email_id IS NOT NULL;
  CREATE INDEX ix_txn_at ON transactions(txn_at);
  CREATE INDEX ix_txn_merchant ON transactions(merchant_key);

  CREATE TABLE merchant_rules (
    merchant_key TEXT PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    display_name TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  INSERT INTO categories (name, icon, color, sort) VALUES
    ('food',      '🍜', '#e8590c', 1),
    ('groceries', '🛒', '#2f9e44', 2),
    ('home',      '🏠', '#1971c2', 3),
    ('vehicle',   '🚗', '#5f3dc4', 4),
    ('fuel',      '⛽', '#c92a2a', 5),
    ('shopping',  '🛍️', '#c2255c', 6),
    ('health',    '💊', '#0c8599', 7),
    ('personal',  '👤', '#e67700', 8),
    ('drinks',    '🍺', '#862e9c', 9);
  `,
];
