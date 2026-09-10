-- Sentences for minutes, and the Reading library released in batches.

CREATE TABLE IF NOT EXISTS vocab_sentences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sentences_user ON vocab_sentences(user_id, date);
CREATE INDEX IF NOT EXISTS idx_sentences_word ON vocab_sentences(user_id, word_id, date);

ALTER TABLE users ADD COLUMN reading_batch INTEGER NOT NULL DEFAULT 1;
