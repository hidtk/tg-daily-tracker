-- Version 2: the task shop, transparent achievements, the first-run guide and «Начать заново».

-- The first-run guide was seen. «Начать заново» sets it back to 0, so the guide shows again.
ALTER TABLE users ADD COLUMN onboarded INTEGER NOT NULL DEFAULT 0;

-- Writing / Speaking tasks now come in sizes: the shop task id ('writing:short', 'speaking:long', …)
-- and the rubric result (JSON: criteria and the optional AI feedback) are stored with the answer.
ALTER TABLE practice_tasks ADD COLUMN task TEXT;
ALTER TABLE practice_tasks ADD COLUMN feedback TEXT;
CREATE INDEX IF NOT EXISTS idx_tasks_task ON practice_tasks(user_id, task, date);

-- Achievements reached: one row each, so the bonus minutes are paid exactly once.
CREATE TABLE IF NOT EXISTS achievements (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  date TEXT NOT NULL,
  bonus REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_attempts_test ON reading_attempts(user_id, test_id);
