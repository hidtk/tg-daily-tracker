-- Game layer: typed word answers instead of self-assessment, counted Reading attempts,
-- Writing and Speaking tasks, and a heartbeat for Shortcuts sessions (time limit inside the app).

-- How a word review was answered: 'self' = the old "knew it / forgot" buttons (earn nothing now),
-- 'translate' = typed from the Russian gloss, 'cloze' = typed into the example sentence.
ALTER TABLE vocab_reviews ADD COLUMN kind TEXT NOT NULL DEFAULT 'self';
ALTER TABLE vocab_reviews ADD COLUMN hint INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vocab_reviews ADD COLUMN practice INTEGER NOT NULL DEFAULT 0;

-- A Reading attempt counts for quests and the streak only if it was a real first try (time spent, not guessed).
ALTER TABLE reading_attempts ADD COLUMN counted INTEGER NOT NULL DEFAULT 0;
UPDATE reading_attempts SET counted = 1 WHERE earned > 0;

CREATE TABLE IF NOT EXISTS practice_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                 -- 'writing' | 'speaking'
  date TEXT NOT NULL,
  topic TEXT NOT NULL,                -- writing topic id / speaking card id
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  submitted_at TEXT,
  status TEXT NOT NULL DEFAULT 'started', -- 'started' | 'accepted'
  text TEXT,
  words INTEGER NOT NULL DEFAULT 0,
  vocab TEXT,                         -- JSON: vocabulary words used
  seconds INTEGER NOT NULL DEFAULT 0, -- writing: time spent; speaking: voice duration
  file_unique_id TEXT                 -- speaking: Telegram voice id, so one voice counts once
);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON practice_tasks(user_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_voice ON practice_tasks(user_id, file_unique_id);

-- Last heartbeat from the Shortcuts timer loop (?e=tick), and how the session ended:
-- 'close' (app closed), 'tick' (time ran out, sent Home), 'kicked' (the app really closed after that),
-- 'open' (settled when another app opened), 'stale' (no close and no heartbeat for a long time).
ALTER TABLE wallet_sessions ADD COLUMN last_seen TEXT;
ALTER TABLE wallet_sessions ADD COLUMN closed_by TEXT;
