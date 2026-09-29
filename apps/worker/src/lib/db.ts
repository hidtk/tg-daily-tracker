import type { Settings, WalletLedgerEntry, WalletSettings, ShopKind } from '@tracker/shared';
import { DEFAULT_WALLET_SETTINGS, EARN_KINDS, GateApp } from '@tracker/shared';

export interface UserRow {
  id: number;
  tg_id: number;
  first_name: string;
  tz: string;
  morning_time: string;
  last_morning_sent: string | null;
  created_at: string;
  /** reused as "morning reminders on" */
  ielts_daily_task: number;
  wallet_enabled: number;
  sm_balance: number;
  sm_bank_cap: number;
  sm_daily_cap: number;
  sm_apps: string | null;
  sm_api_key: string | null;
  vocab_per_day: number;
  lang: string | null;
  nextdns_key: string | null;
  nextdns_profile: string | null;
  lock_state: string | null;
  lock_until: string | null;
  lock_password: string | null;
  lock_error: string | null;
  onboarded: number;
}

export interface SessionRow {
  id: number;
  user_id: number;
  app: string;
  started_at: string;
  ended_at: string | null;
  minutes: number;
  last_seen: string | null;
  closed_by: string | null;
}

export interface TaskRow {
  id: number;
  user_id: number;
  kind: 'writing' | 'speaking';
  task: string | null;
  date: string;
  topic: string;
  started_at: string;
  submitted_at: string | null;
  status: 'started' | 'accepted';
  text: string | null;
  words: number;
  vocab: string | null;
  seconds: number;
  file_unique_id: string | null;
  feedback: string | null;
}

export interface VocabRow {
  user_id: number;
  word_id: number;
  stage: number;
  introduced_on: string;
  next_review: string;
  reviews: number;
  lapses: number;
  last_reviewed: string | null;
}

export interface AttemptRow {
  test_id: string;
  date: string;
  correct: number;
  total: number;
  earned: number;
  counted: number;
}

export function userSettings(u: UserRow): Settings {
  return {
    tz: u.tz,
    reminders: (u.ielts_daily_task ?? 1) !== 0,
    morning_time: u.morning_time,
    vocab_per_day: u.vocab_per_day ?? 5,
    lang: u.lang === 'ru' ? 'ru' : 'en',
  };
}

export function walletSettings(u: UserRow): WalletSettings {
  let apps: GateApp[] = DEFAULT_WALLET_SETTINGS.apps;
  try {
    const parsed = u.sm_apps ? GateApp.array().safeParse(JSON.parse(u.sm_apps)) : null;
    if (parsed?.success) apps = parsed.data;
  } catch { /* keep defaults */ }
  return {
    wallet_enabled: (u.wallet_enabled ?? 1) !== 0,
    bank_cap: u.sm_bank_cap ?? DEFAULT_WALLET_SETTINGS.bank_cap,
    daily_earn_cap: u.sm_daily_cap ?? DEFAULT_WALLET_SETTINGS.daily_earn_cap,
    apps,
  };
}

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Tables with a user's progress. «Начать заново» empties them; users (settings, the gate key, NextDNS, language)
 * and the lock stay.
 */
export const PROGRESS_TABLES = [
  'reading_attempts', 'wallet_ledger', 'wallet_sessions', 'vocab_progress', 'vocab_reviews', 'vocab_sentences',
  'practice_tasks', 'achievements', 'entries', 'proofs', 'pending_proofs', 'mock_tests', 'homeworks', 'lessons',
] as const;

export class Repo {
  constructor(private db: D1Database) {}

  // ---- users ----

  getUserByTg(tgId: number) {
    return this.db.prepare('SELECT * FROM users WHERE tg_id = ?').bind(tgId).first<UserRow>();
  }

  getUserById(id: number) {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  }

  async ensureUser(tgId: number, firstName: string, tz: string): Promise<{ user: UserRow; isNew: boolean }> {
    const existing = await this.getUserByTg(tgId);
    if (existing) {
      const patch: Record<string, unknown> = {};
      if (existing.first_name !== firstName) patch.first_name = firstName;
      // A user created via /start has the default tz; adopt the device tz the first time the Mini App reports one.
      if (existing.tz === 'UTC' && tz && tz !== 'UTC') patch.tz = tz;
      if (Object.keys(patch).length) await this.updateUser(existing.id, patch);
      return { user: { ...existing, ...patch } as UserRow, isNew: false };
    }
    await this.db.prepare('INSERT INTO users (tg_id, first_name, tz) VALUES (?, ?, ?)').bind(tgId, firstName, tz).run();
    return { user: (await this.getUserByTg(tgId))!, isNew: true };
  }

  allUsers() {
    return this.db.prepare('SELECT * FROM users').all<UserRow>().then((r) => r.results);
  }

  async updateUser(userId: number, patch: Record<string, unknown>) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      if (!/^[a-z_]+$/.test(k)) throw new Error(`bad column ${k}`);
      sets.push(`${k} = ?`);
      vals.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
    }
    if (!sets.length) return;
    vals.push(userId);
    await this.db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  }

  markMorningSent(userId: number, date: string) {
    return this.db.prepare('UPDATE users SET last_morning_sent = ? WHERE id = ?').bind(date, userId).run();
  }

  /** «Начать заново»: progress, minutes and history go; settings, the gate key, NextDNS and the language stay. */
  async resetProgress(userId: number) {
    await this.db.batch([
      ...PROGRESS_TABLES.map((t) => this.db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(userId)),
      this.db.prepare('UPDATE users SET sm_balance = 0, reading_batch = 1, onboarded = 0, last_morning_sent = NULL WHERE id = ?').bind(userId),
    ]);
  }

  // ---- the automatic day log ----

  /** The one IELTS activity the day log is written to (created on demand). */
  async ieltsActivityId(userId: number): Promise<number> {
    const r = await this.db.prepare("SELECT id FROM activities WHERE user_id = ? AND kind = 'ielts' AND archived_at IS NULL ORDER BY id LIMIT 1").bind(userId).first<{ id: number }>();
    if (r) return r.id;
    const ins = await this.db.prepare("INSERT INTO activities (user_id, name, emoji, color, schedule_type, kind) VALUES (?, 'IELTS', '', '#1668e3', 'daily', 'ielts')").bind(userId).run();
    return Number(ins.meta.last_row_id);
  }

  /** What was actually done in the app on a date (source for the automatic day log). */
  async activityOn(userId: number, date: string, maxSecondsPerTest: number) {
    const [r, v, s, w, sp] = await this.db.batch([
      this.db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(MIN(seconds, ?3)), 0) AS sec FROM reading_attempts WHERE user_id = ?1 AND date = ?2').bind(userId, date, maxSecondsPerTest),
      this.db.prepare('SELECT COUNT(*) AS n FROM vocab_reviews WHERE user_id = ? AND date = ?').bind(userId, date),
      this.db.prepare('SELECT COUNT(*) AS n FROM vocab_sentences WHERE user_id = ? AND date = ?').bind(userId, date),
      this.db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(MIN(seconds, ?3)), 0) AS sec FROM practice_tasks WHERE user_id = ?1 AND date = ?2 AND kind = 'writing' AND status = 'accepted'").bind(userId, date, maxSecondsPerTest),
      this.db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(seconds), 0) AS sec FROM practice_tasks WHERE user_id = ? AND date = ? AND kind = 'speaking' AND status = 'accepted'").bind(userId, date),
    ]);
    const first = (x: D1Result) => (x.results?.[0] ?? {}) as { n?: number; sec?: number };
    return {
      readingTests: first(r).n ?? 0,
      readingSeconds: first(r).sec ?? 0,
      reviews: first(v).n ?? 0,
      sentences: first(s).n ?? 0,
      writings: first(w).n ?? 0,
      writingSeconds: first(w).sec ?? 0,
      voices: first(sp).n ?? 0,
      voiceSeconds: first(sp).sec ?? 0,
    };
  }

  /** Automatic day entry: done, with minutes and skills computed from app activity. */
  async autoEntry(userId: number, activityId: number, date: string, minutes: number, skills: string[]) {
    await this.db
      .prepare(
        `INSERT INTO entries (user_id, activity_id, date, planned, done, minutes, skills)
         VALUES (?, ?, ?, 0, 1, ?, ?)
         ON CONFLICT(activity_id, date) DO UPDATE SET
           done = 1, skipped = 0, skip_reason = NULL, minutes = excluded.minutes, skills = excluded.skills,
           updated_at = ${NOW}
         WHERE entries.user_id = excluded.user_id`,
      )
      .bind(userId, activityId, date, minutes, JSON.stringify(skills))
      .run();
  }

  /** Study minutes per day from the automatic log. */
  async studyMinutes(userId: number, from: string): Promise<Map<string, number>> {
    const { results } = await this.db.prepare('SELECT date, SUM(minutes) AS m FROM entries WHERE user_id = ? AND date >= ? AND done = 1 GROUP BY date').bind(userId, from).all<{ date: string; m: number }>();
    return new Map(results.map((r) => [r.date, r.m ?? 0]));
  }

  // ---- wallet ----

  /** Stable per-user key for the iOS Shortcuts gate endpoint. */
  async ensureApiKey(u: UserRow): Promise<string> {
    if (u.sm_api_key) return u.sm_api_key;
    const key = randomKey();
    await this.updateUser(u.id, { sm_api_key: key });
    return key;
  }

  getUserByApiKey(key: string) {
    return this.db.prepare('SELECT * FROM users WHERE sm_api_key = ?').bind(key).first<UserRow>();
  }

  async balance(userId: number): Promise<number> {
    const r = await this.db.prepare('SELECT sm_balance AS b FROM users WHERE id = ?').bind(userId).first<{ b: number }>();
    return r?.b ?? 0;
  }

  /**
   * Apply a signed change to the balance and write a ledger row.
   * Earnings are capped by the bank (never below what is already there); spends only floor at 0,
   * so lowering the bank cap never wipes existing minutes.
   */
  async addMinutes(userId: number, date: string, delta: number, reason: WalletLedgerEntry['reason'], note: string | null, cap: number): Promise<number> {
    await this.db
      .prepare('UPDATE users SET sm_balance = MAX(0, CASE WHEN ?1 > 0 THEN MIN(MAX(?2, sm_balance), sm_balance + ?1) ELSE sm_balance + ?1 END) WHERE id = ?3')
      .bind(delta, cap, userId)
      .run();
    if (delta !== 0) {
      await this.db.prepare('INSERT INTO wallet_ledger (user_id, date, delta, reason, note) VALUES (?, ?, ?, ?, ?)').bind(userId, date, delta, reason, note).run();
    }
    return this.balance(userId);
  }

  /** Atomically spend minutes if the balance covers them. Returns false (and writes nothing) otherwise. */
  async trySpend(userId: number, date: string, minutes: number, note: string): Promise<boolean> {
    const r = await this.db.prepare('UPDATE users SET sm_balance = sm_balance - ?1 WHERE id = ?2 AND sm_balance >= ?1').bind(minutes, userId).run();
    if ((r.meta.changes ?? 0) === 0) return false;
    await this.db.prepare('INSERT INTO wallet_ledger (user_id, date, delta, reason, note) VALUES (?, ?, ?, ?, ?)').bind(userId, date, -minutes, 'spend', note).run();
    return true;
  }

  /**
   * Charge time actually used in an app. Unlike addMinutes this may go below zero:
   * the overrun becomes a debt that the next earnings pay back.
   */
  async charge(userId: number, date: string, minutes: number, note: string): Promise<number> {
    if (minutes <= 0) return this.balance(userId);
    await this.db.prepare('UPDATE users SET sm_balance = sm_balance - ? WHERE id = ?').bind(minutes, userId).run();
    await this.db.prepare('INSERT INTO wallet_ledger (user_id, date, delta, reason, note) VALUES (?, ?, ?, ?, ?)').bind(userId, date, -minutes, 'spend', note).run();
    return this.balance(userId);
  }

  /** Minutes earned on a date by task kind (achievement bonuses and refunds are not earnings). */
  async earnedByKind(userId: number, date: string): Promise<Partial<Record<ShopKind, number>>> {
    const { results } = await this.db
      .prepare(`SELECT reason, SUM(delta) AS s FROM wallet_ledger WHERE user_id = ? AND date = ? AND delta > 0 AND reason IN (${EARN_KINDS.map(() => '?').join(', ')}) GROUP BY reason`)
      .bind(userId, date, ...EARN_KINDS)
      .all<{ reason: ShopKind; s: number }>();
    return Object.fromEntries(results.map((r) => [r.reason, round1(r.s)]));
  }

  /** Minutes earned today from tasks — the daily limit applies to this. */
  async earnedOn(userId: number, date: string): Promise<number> {
    const by = await this.earnedByKind(userId, date);
    return round1(Object.values(by).reduce((s, v) => s + (v ?? 0), 0));
  }

  /** Earned per task id (the ledger note) on a date. */
  async earnedByTask(userId: number, date: string): Promise<Map<string, number>> {
    const { results } = await this.db
      .prepare(`SELECT note, SUM(delta) AS s FROM wallet_ledger WHERE user_id = ? AND date = ? AND delta > 0 AND reason IN (${EARN_KINDS.map(() => '?').join(', ')}) GROUP BY note`)
      .bind(userId, date, ...EARN_KINDS)
      .all<{ note: string; s: number }>();
    return new Map(results.map((r) => [r.note, round1(r.s)]));
  }

  /** Every paid task: date and kind — the source for achievements and the streak. */
  async paidTasks(userId: number): Promise<{ date: string; reason: ShopKind; n: number; s: number }[]> {
    const { results } = await this.db
      .prepare(`SELECT date, reason, COUNT(*) AS n, SUM(delta) AS s FROM wallet_ledger WHERE user_id = ? AND delta > 0 AND reason IN (${EARN_KINDS.map(() => '?').join(', ')}) GROUP BY date, reason ORDER BY date`)
      .bind(userId, ...EARN_KINDS)
      .all<{ date: string; reason: ShopKind; n: number; s: number }>();
    return results;
  }

  async ledger(userId: number, limit = 30): Promise<WalletLedgerEntry[]> {
    const { results } = await this.db
      .prepare('SELECT id, at, date, delta, reason, note FROM wallet_ledger WHERE user_id = ? AND delta <> 0 ORDER BY id DESC LIMIT ?')
      .bind(userId, limit)
      .all<WalletLedgerEntry>();
    return results;
  }

  // ---- Shortcuts sessions ----

  openSession(userId: number) {
    return this.db.prepare('SELECT * FROM wallet_sessions WHERE user_id = ? AND ended_at IS NULL ORDER BY id DESC LIMIT 1').bind(userId).first<SessionRow>();
  }

  lastSession(userId: number) {
    return this.db.prepare('SELECT * FROM wallet_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 1').bind(userId).first<SessionRow>();
  }

  async markKicked(id: number) {
    await this.db.prepare("UPDATE wallet_sessions SET closed_by = 'kicked' WHERE id = ? AND closed_by = 'tick'").bind(id).run();
  }

  /** Heartbeat from the Shortcuts timer loop. */
  async touchSession(id: number) {
    await this.db.prepare(`UPDATE wallet_sessions SET last_seen = ${NOW} WHERE id = ? AND ended_at IS NULL`).bind(id).run();
  }

  async startSession(userId: number, app: string): Promise<number> {
    const r = await this.db.prepare(`INSERT INTO wallet_sessions (user_id, app, started_at) VALUES (?, ?, ${NOW})`).bind(userId, app).run();
    return Number(r.meta.last_row_id);
  }

  /** Close a session once. Returns false if it was already closed (a concurrent request got there first). */
  async endSession(id: number, minutes: number, closedBy: string): Promise<boolean> {
    const r = await this.db.prepare(`UPDATE wallet_sessions SET ended_at = ${NOW}, minutes = ?, closed_by = ? WHERE id = ? AND ended_at IS NULL`).bind(minutes, closedBy, id).run();
    return (r.meta.changes ?? 0) > 0;
  }

  /** Sessions left open by a missed close event (no close and no heartbeat for a while), across all users. */
  async staleSessions(olderThanMin: number) {
    const { results } = await this.db
      .prepare(`SELECT * FROM wallet_sessions WHERE ended_at IS NULL AND COALESCE(last_seen, started_at) < strftime('%Y-%m-%dT%H:%M:%fZ','now', ?)`)
      .bind(`-${olderThanMin} minutes`)
      .all<SessionRow>();
    return results;
  }

  async openLocks(nowIso: string): Promise<UserRow[]> {
    const { results } = await this.db.prepare("SELECT * FROM users WHERE lock_state = 'open' AND lock_until IS NOT NULL AND lock_until <= ?").bind(nowIso).all<UserRow>();
    return results;
  }

  // ---- Reading ----

  /** Attempts at shop Reading parts (ids r:<test>:<part>), oldest first. */
  async readingAttempts(userId: number): Promise<AttemptRow[]> {
    const { results } = await this.db
      .prepare("SELECT test_id, date, correct, total, earned, counted FROM reading_attempts WHERE user_id = ? AND test_id LIKE 'r:%' ORDER BY id")
      .bind(userId)
      .all<AttemptRow>();
    return results;
  }

  async addAttempt(userId: number, a: { test_id: string; date: string; correct: number; total: number; band: number; seconds: number; earned: number; counted: boolean }): Promise<number> {
    const r = await this.db
      .prepare('INSERT INTO reading_attempts (user_id, test_id, date, correct, total, band, seconds, earned, counted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(userId, a.test_id, a.date, a.correct, a.total, a.band, a.seconds, a.earned, a.counted ? 1 : 0)
      .run();
    return Number(r.meta.last_row_id);
  }

  async setAttemptEarned(id: number, earned: number) {
    await this.db.prepare('UPDATE reading_attempts SET earned = ? WHERE id = ?').bind(earned, id).run();
  }

  // ---- achievements ----

  async achievementRows(userId: number): Promise<{ id: string; date: string }[]> {
    const { results } = await this.db.prepare('SELECT id, date FROM achievements WHERE user_id = ?').bind(userId).all<{ id: string; date: string }>();
    return results;
  }

  /** Record an achievement once. False if it was already there (a parallel request got it). */
  async addAchievement(userId: number, id: string, date: string, bonus: number): Promise<boolean> {
    const r = await this.db.prepare('INSERT OR IGNORE INTO achievements (user_id, id, date, bonus) VALUES (?, ?, ?, ?)').bind(userId, id, date, bonus).run();
    return (r.meta.changes ?? 0) > 0;
  }

  /** Counts for achievements that are not in the ledger: words right, sentences, Writing and Speaking. */
  async practiceCounts(userId: number) {
    const [w, s, t] = await this.db.batch([
      this.db.prepare("SELECT COUNT(*) AS n FROM vocab_reviews WHERE user_id = ? AND ok = 1 AND hint = 0 AND kind <> 'self'").bind(userId),
      this.db.prepare('SELECT COUNT(*) AS n FROM vocab_sentences WHERE user_id = ?').bind(userId),
      this.db.prepare("SELECT SUM(CASE WHEN kind = 'writing' THEN 1 ELSE 0 END) AS w, SUM(CASE WHEN kind = 'speaking' THEN 1 ELSE 0 END) AS s FROM practice_tasks WHERE user_id = ? AND status = 'accepted'").bind(userId),
    ]);
    const first = (x: D1Result) => (x.results?.[0] ?? {}) as { n?: number; w?: number; s?: number };
    return { wordsRight: first(w).n ?? 0, sentences: first(s).n ?? 0, writings: first(t).w ?? 0, speakings: first(t).s ?? 0 };
  }

  // ---- Writing and Speaking ----

  tasksOn(userId: number, date: string, kind: 'writing' | 'speaking') {
    return this.db.prepare('SELECT * FROM practice_tasks WHERE user_id = ? AND date = ? AND kind = ? ORDER BY id').bind(userId, date, kind).all<TaskRow>().then((r) => r.results);
  }

  async startTask(userId: number, date: string, kind: 'writing' | 'speaking', task: string, topic: string) {
    await this.db.prepare('INSERT INTO practice_tasks (user_id, kind, task, date, topic) VALUES (?, ?, ?, ?, ?)').bind(userId, kind, task, date, topic).run();
  }

  /** Accept a started Writing once (a parallel submit can't accept it twice). */
  async acceptWriting(id: number, text: string, words: number, vocab: string[], seconds: number, feedback: unknown): Promise<boolean> {
    const r = await this.db
      .prepare(`UPDATE practice_tasks SET status = 'accepted', submitted_at = ${NOW}, text = ?, words = ?, vocab = ?, seconds = ?, feedback = ? WHERE id = ? AND status = 'started'`)
      .bind(text, words, JSON.stringify(vocab), seconds, JSON.stringify(feedback), id)
      .run();
    return (r.meta.changes ?? 0) > 0;
  }

  /** Record an accepted voice answer; false if this exact voice was already counted. */
  async addVoice(userId: number, date: string, task: string, card: string, seconds: number, fileUniqueId: string, feedback: unknown): Promise<boolean> {
    const r = await this.db
      .prepare(`INSERT OR IGNORE INTO practice_tasks (user_id, kind, task, date, topic, status, submitted_at, seconds, file_unique_id, feedback) VALUES (?, 'speaking', ?, ?, ?, 'accepted', ${NOW}, ?, ?, ?)`)
      .bind(userId, task, date, card, seconds, fileUniqueId, JSON.stringify(feedback))
      .run();
    return (r.meta.changes ?? 0) > 0;
  }

  async voiceSeen(userId: number, fileUniqueId: string): Promise<boolean> {
    return !!(await this.db.prepare('SELECT 1 AS x FROM practice_tasks WHERE user_id = ? AND file_unique_id = ?').bind(userId, fileUniqueId).first());
  }

  async recentWritings(userId: number, limit = 30): Promise<string[]> {
    const { results } = await this.db
      .prepare("SELECT text FROM practice_tasks WHERE user_id = ? AND kind = 'writing' AND status = 'accepted' ORDER BY id DESC LIMIT ?")
      .bind(userId, limit)
      .all<{ text: string }>();
    return results.map((r) => r.text);
  }

  // ---- vocabulary ----

  async vocabAll(userId: number): Promise<VocabRow[]> {
    const { results } = await this.db.prepare('SELECT * FROM vocab_progress WHERE user_id = ? ORDER BY word_id').bind(userId).all<VocabRow>();
    return results;
  }

  async vocabIntroducedOn(userId: number, date: string): Promise<VocabRow[]> {
    const { results } = await this.db.prepare('SELECT * FROM vocab_progress WHERE user_id = ? AND introduced_on = ? ORDER BY word_id').bind(userId, date).all<VocabRow>();
    return results;
  }

  /** Introduce the next `n` unseen words (bank order) for `date`. Returns the rows introduced. */
  async vocabIntroduce(userId: number, date: string, n: number, total: number): Promise<VocabRow[]> {
    if (n <= 0) return [];
    const r = await this.db.prepare('SELECT MAX(word_id) AS m FROM vocab_progress WHERE user_id = ?').bind(userId).first<{ m: number | null }>();
    const start = (r?.m ?? 0) + 1;
    const rows: VocabRow[] = [];
    const next = addDaysIso(date, 1);
    for (let id = start; id < start + n && id <= total; id++) {
      await this.db.prepare('INSERT OR IGNORE INTO vocab_progress (user_id, word_id, stage, introduced_on, next_review) VALUES (?, ?, 0, ?, ?)').bind(userId, id, date, next).run();
      rows.push({ user_id: userId, word_id: id, stage: 0, introduced_on: date, next_review: next, reviews: 0, lapses: 0, last_reviewed: null });
    }
    return rows;
  }

  async vocabGet(userId: number, wordId: number): Promise<VocabRow | null> {
    return this.db.prepare('SELECT * FROM vocab_progress WHERE user_id = ? AND word_id = ?').bind(userId, wordId).first<VocabRow>();
  }

  /**
   * Record a typed answer once per word per day. Returns false (and writes nothing) if the word was already
   * answered today — a second tab or a double tap can't earn twice.
   */
  async vocabRecordReview(userId: number, wordId: number, a: { ok: boolean; hint: boolean; practice: boolean; kind: 'translate' | 'cloze' }, today: string, stage: number, nextReview: string): Promise<boolean> {
    const r = await this.db
      .prepare(
        `UPDATE vocab_progress SET stage = ?, next_review = ?, reviews = reviews + 1, lapses = lapses + ?, last_reviewed = ?
         WHERE user_id = ? AND word_id = ? AND (last_reviewed IS NULL OR last_reviewed <> ?)`,
      )
      .bind(stage, nextReview, a.ok ? 0 : 1, today, userId, wordId, today)
      .run();
    if ((r.meta.changes ?? 0) === 0) return false;
    await this.db
      .prepare('INSERT INTO vocab_reviews (user_id, word_id, date, ok, kind, hint, practice) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(userId, wordId, today, a.ok ? 1 : 0, a.kind, a.hint ? 1 : 0, a.practice ? 1 : 0)
      .run();
    return true;
  }

  // ---- sentences ----

  async sentencesOn(userId: number, date: string): Promise<number> {
    const r = await this.db.prepare('SELECT COUNT(*) AS n FROM vocab_sentences WHERE user_id = ? AND date = ?').bind(userId, date).first<{ n: number }>();
    return r?.n ?? 0;
  }

  async sentenceExists(userId: number, wordId: number, date: string): Promise<boolean> {
    return !!(await this.db.prepare('SELECT 1 AS x FROM vocab_sentences WHERE user_id = ? AND word_id = ? AND date = ?').bind(userId, wordId, date).first());
  }

  async addSentence(userId: number, wordId: number, date: string, text: string) {
    await this.db.prepare('INSERT INTO vocab_sentences (user_id, word_id, date, text) VALUES (?, ?, ?, ?)').bind(userId, wordId, date, text).run();
  }

  /** word_id → last date a sentence was written, for choosing the next word. */
  async sentenceLastDates(userId: number): Promise<Map<number, string>> {
    const { results } = await this.db.prepare('SELECT word_id, MAX(date) AS d FROM vocab_sentences WHERE user_id = ? GROUP BY word_id').bind(userId).all<{ word_id: number; d: string }>();
    return new Map(results.map((r) => [r.word_id, r.d]));
  }

  async recentSentenceTexts(userId: number, limit = 50): Promise<string[]> {
    const { results } = await this.db.prepare('SELECT text FROM vocab_sentences WHERE user_id = ? ORDER BY id DESC LIMIT ?').bind(userId, limit).all<{ text: string }>();
    return results.map((r) => r.text);
  }
}

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function randomKey(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
