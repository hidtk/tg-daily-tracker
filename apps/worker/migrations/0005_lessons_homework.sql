-- Scheduled lessons (classes with a teacher) and homework given there
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Занятие',
  weekdays TEXT NOT NULL DEFAULT '[]',        -- JSON array of 0..6 (0 = Monday)
  time TEXT NOT NULL DEFAULT '19:30',         -- HH:MM local to tz
  tz TEXT NOT NULL DEFAULT 'Europe/Moscow',
  remind_morning INTEGER NOT NULL DEFAULT 1,
  remind_before_min INTEGER NOT NULL DEFAULT 90,
  last_morning_sent TEXT,
  last_before_sent TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_lessons_user ON lessons(user_id);

CREATE TABLE IF NOT EXISTS homeworks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  file_id TEXT,
  tags TEXT,                                   -- JSON array of skills
  due_date TEXT,                               -- YYYY-MM-DD
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  done_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_homeworks_user_open ON homeworks(user_id, done_at);
