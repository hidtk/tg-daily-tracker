-- Social-media minutes wallet: earn minutes by passing Reading mini-tests, spend them in gated apps.

ALTER TABLE users ADD COLUMN wallet_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN sm_balance REAL NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN sm_bank_cap INTEGER NOT NULL DEFAULT 120;
ALTER TABLE users ADD COLUMN sm_daily_cap INTEGER NOT NULL DEFAULT 60;
ALTER TABLE users ADD COLUMN sm_apps TEXT NOT NULL DEFAULT '["instagram","tiktok","youtube","vk"]';
ALTER TABLE users ADD COLUMN sm_api_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_api_key ON users(sm_api_key);

CREATE TABLE IF NOT EXISTS reading_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_id TEXT NOT NULL,
  date TEXT NOT NULL,
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL,
  band REAL NOT NULL,
  seconds INTEGER NOT NULL,
  earned INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON reading_attempts(user_id, date);

CREATE TABLE IF NOT EXISTS wallet_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  date TEXT NOT NULL,
  delta REAL NOT NULL,
  reason TEXT NOT NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON wallet_ledger(user_id, at DESC);

CREATE TABLE IF NOT EXISTS wallet_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  minutes REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON wallet_sessions(user_id, started_at DESC);
