-- Closing three holes: sentences for minutes, the minute that never ends, the switched-off automation.

-- Sentences: accepted (checked by the model, paid) | pending (the model was unavailable, checked later, paid then)
-- | practice (no model configured: rules only, no minutes) | rejected (the model said no after a pending wait).
ALTER TABLE vocab_sentences ADD COLUMN status TEXT NOT NULL DEFAULT 'accepted';
ALTER TABLE vocab_sentences ADD COLUMN verdict TEXT;
ALTER TABLE vocab_sentences ADD COLUMN tries INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_sentences_status ON vocab_sentences(status);

-- Model requests per UTC day and provider: a hard ceiling keeps Workers AI inside the free daily allowance.
CREATE TABLE IF NOT EXISTS llm_usage (
  day TEXT NOT NULL,
  provider TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, provider)
);

-- «Быстрый тест»: multiple-choice sets (a gap in a bank example, the meaning of a word), checked by the key.
CREATE TABLE IF NOT EXISTS quiz_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  n INTEGER NOT NULL,
  questions TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  submitted_at TEXT,
  correct INTEGER,
  paid REAL NOT NULL DEFAULT 0,
  UNIQUE (user_id, date, n)
);

-- The DNS lock is opened by a Shortcuts session ('session') or by a paid window from the app ('manual').
ALTER TABLE users ADD COLUMN lock_source TEXT;
-- Paid windows from the app, for telling real use from a bypass in the NextDNS logs.
CREATE TABLE IF NOT EXISTS lock_windows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opened_at TEXT NOT NULL,
  closed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lock_windows_user ON lock_windows(user_id, closed_at);

-- Bypass detection from the NextDNS logs.
ALTER TABLE users ADD COLUMN gate_seen_at TEXT;             -- last request from the Shortcut
ALTER TABLE users ADD COLUMN bypass_checked_at TEXT;        -- logs are read up to here
ALTER TABLE users ADD COLUMN lock_warning TEXT;             -- since when the automation looks switched off
ALTER TABLE users ADD COLUMN lock_warning_checked_at TEXT;
ALTER TABLE users ADD COLUMN streak_reset_on TEXT;          -- a bypass resets the streak: days up to here don't count
CREATE TABLE IF NOT EXISTS bypasses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  app TEXT NOT NULL,
  first_at TEXT NOT NULL,
  last_at TEXT NOT NULL,
  minutes REAL NOT NULL,
  penalty REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, app, first_at)
);
CREATE INDEX IF NOT EXISTS idx_bypasses_user ON bypasses(user_id, first_at DESC);
