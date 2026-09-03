-- Strict mode, accountability partner, IELTS goal
ALTER TABLE users ADD COLUMN strict_mode INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN partner_chat_id INTEGER;
ALTER TABLE users ADD COLUMN partner_name TEXT;
ALTER TABLE users ADD COLUMN partner_notify_missed INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN partner_code TEXT;
ALTER TABLE users ADD COLUMN last_partner_report TEXT;
ALTER TABLE users ADD COLUMN ielts_target REAL NOT NULL DEFAULT 7.0;
ALTER TABLE users ADD COLUMN ielts_exam_date TEXT;
ALTER TABLE users ADD COLUMN ielts_deadline_changed_on TEXT;
ALTER TABLE users ADD COLUMN ielts_weekly_hours REAL NOT NULL DEFAULT 7;

-- Activity kind: generic | ielts (ielts activities get skill tags + minutes UI)
ALTER TABLE activities ADD COLUMN kind TEXT NOT NULL DEFAULT 'generic';
UPDATE activities SET kind = 'ielts' WHERE name LIKE '%IELTS%' OR name LIKE 'English%';

-- Minutes + skill tags on entries
ALTER TABLE entries ADD COLUMN minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE entries ADD COLUMN skills TEXT; -- JSON array: listening|reading|writing|speaking|vocab|grammar

-- Proofs attached to a (activity, date). file_id is a Telegram file id (photo); text is a forwarded AI chat excerpt / link.
CREATE TABLE IF NOT EXISTS proofs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT NOT NULL,                 -- photo | chat
  file_id TEXT,
  text TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_proofs_user_date ON proofs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_proofs_activity_date ON proofs(activity_id, date);

-- Proof received by the bot but not yet assigned to an activity (waiting for the inline-keyboard answer)
CREATE TABLE IF NOT EXISTS pending_proofs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  file_id TEXT,
  text TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- IELTS mock test results (band scores)
CREATE TABLE IF NOT EXISTS mock_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  listening REAL,
  reading REAL,
  writing REAL,
  speaking REAL,
  overall REAL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_mocks_user_date ON mock_tests(user_id, date);
