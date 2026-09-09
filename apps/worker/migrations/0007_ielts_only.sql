-- IELTS-only refocus: one implicit activity per user, vocabulary with spaced repetition, no strict mode.

UPDATE activities SET archived_at = datetime('now') WHERE kind != 'ielts' AND archived_at IS NULL;
UPDATE users SET strict_mode = 0;

ALTER TABLE users ADD COLUMN vocab_per_day INTEGER NOT NULL DEFAULT 5;
ALTER TABLE users ADD COLUMN last_vocab_sent TEXT;

CREATE TABLE IF NOT EXISTS vocab_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id INTEGER NOT NULL,
  stage INTEGER NOT NULL DEFAULT 0,
  introduced_on TEXT NOT NULL,
  next_review TEXT NOT NULL,
  reviews INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  last_reviewed TEXT,
  PRIMARY KEY (user_id, word_id)
);
CREATE INDEX IF NOT EXISTS idx_vocab_due ON vocab_progress(user_id, next_review);

CREATE TABLE IF NOT EXISTS vocab_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  ok INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vocab_reviews_user ON vocab_reviews(user_id, date);
