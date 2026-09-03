-- Users (one row per Telegram user)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_id INTEGER NOT NULL UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  tz TEXT NOT NULL DEFAULT 'UTC',
  morning_time TEXT NOT NULL DEFAULT '08:00',
  evening_time TEXT NOT NULL DEFAULT '21:00',
  weekly_summary INTEGER NOT NULL DEFAULT 1,
  weekly_time TEXT NOT NULL DEFAULT '20:00',
  ai_endpoint TEXT,
  ai_key TEXT,
  last_morning_sent TEXT,
  last_evening_sent TEXT,
  last_weekly_sent TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Activities
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '✅',
  color TEXT NOT NULL DEFAULT '#3b82f6',
  schedule_type TEXT NOT NULL DEFAULT 'daily', -- daily | every_other_day | weekdays
  schedule_days TEXT,                           -- JSON array of 0..6 (0 = Monday) for weekdays
  anchor_date TEXT,                             -- YYYY-MM-DD anchor for every_other_day
  goal_text TEXT,
  goal_date TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id, archived_at);

-- Daily entries: plan (morning) + fact (evening)
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  date TEXT NOT NULL,                           -- YYYY-MM-DD in user's tz
  planned INTEGER NOT NULL DEFAULT 0,
  plan_note TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  done_note TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(activity_id, date)
);
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries(user_id, date);
