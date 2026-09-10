import type { Activity, ActivityInput, Entry, Homework, Lesson, LessonInput, MockTest, Proof, ReadingAttemptView, Settings, Skill, WalletLedgerEntry, WalletSession, WalletSettings } from '@tracker/shared';
import { DEFAULT_WALLET_SETTINGS, GateApp, TEMPLATE_ACTIVITIES } from '@tracker/shared';

export interface UserRow {
  id: number;
  tg_id: number;
  first_name: string;
  tz: string;
  morning_time: string;
  evening_time: string;
  weekly_summary: number;
  weekly_time: string;
  ai_endpoint: string | null;
  ai_key: string | null;
  last_morning_sent: string | null;
  last_evening_sent: string | null;
  last_weekly_sent: string | null;
  created_at: string;
  strict_mode: number;
  partner_chat_id: number | null;
  partner_name: string | null;
  partner_notify_missed: number;
  partner_code: string | null;
  last_partner_report: string | null;
  ielts_target: number;
  ielts_exam_date: string | null;
  ielts_deadline_changed_on: string | null;
  ielts_weekly_hours: number;
  ielts_daily_task: number;
  last_task_sent: string | null;
  wallet_enabled: number;
  sm_balance: number;
  sm_bank_cap: number;
  sm_daily_cap: number;
  sm_apps: string | null;
  sm_api_key: string | null;
  vocab_per_day: number;
  last_vocab_sent: string | null;
  lang: string | null;
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

interface ActivityRow extends Omit<Activity, 'schedule_days'> {
  user_id: number;
  schedule_days: string | null;
}

interface EntryRow {
  activity_id: number;
  date: string;
  planned: number;
  plan_note: string | null;
  done: number;
  done_note: string | null;
  minutes: number;
  skills: string | null;
  skipped: number;
  skip_reason: string | null;
  updated_at: string;
}

interface ProofRow {
  id: number;
  activity_id: number;
  date: string;
  type: 'photo' | 'chat';
  file_id: string | null;
  text: string | null;
  created_at: string;
}

export interface LessonRow {
  id: number;
  user_id: number;
  title: string;
  weekdays: string;
  time: string;
  tz: string;
  remind_morning: number;
  remind_before_min: number;
  last_morning_sent: string | null;
  last_before_sent: string | null;
}

interface HomeworkRow {
  id: number;
  lesson_id: number | null;
  text: string;
  file_id: string | null;
  tags: string | null;
  due_date: string | null;
  created_at: string;
  done_at: string | null;
}

export function rowToLesson(r: LessonRow): Lesson {
  return {
    id: r.id,
    title: r.title,
    weekdays: JSON.parse(r.weekdays) as number[],
    time: r.time,
    tz: r.tz,
    remind_morning: !!r.remind_morning,
    remind_before_min: r.remind_before_min,
  };
}

function rowToHomework(r: HomeworkRow): Homework {
  return {
    id: r.id,
    lesson_id: r.lesson_id,
    text: r.text,
    has_file: !!r.file_id,
    tags: r.tags ? (JSON.parse(r.tags) as Skill[]) : [],
    due_date: r.due_date,
    created_at: r.created_at,
    done_at: r.done_at,
  };
}

export interface PendingProof {
  id: number;
  user_id: number;
  type: 'photo' | 'chat';
  file_id: string | null;
  text: string | null;
  created_at: string;
}

function rowToActivity(r: ActivityRow): Activity {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    color: r.color,
    schedule_type: r.schedule_type,
    schedule_days: r.schedule_days ? (JSON.parse(r.schedule_days) as number[]) : null,
    anchor_date: r.anchor_date,
    goal_text: r.goal_text,
    goal_date: r.goal_date,
    kind: r.kind ?? 'generic',
    sort: r.sort,
    archived_at: r.archived_at,
  };
}

function rowToEntry(r: EntryRow, proofs: Proof[] = []): Entry {
  return {
    activity_id: r.activity_id,
    date: r.date,
    planned: !!r.planned,
    plan_note: r.plan_note,
    done: !!r.done,
    done_note: r.done_note,
    minutes: r.minutes ?? 0,
    skills: r.skills ? (JSON.parse(r.skills) as Skill[]) : null,
    skipped: !!r.skipped,
    skip_reason: r.skip_reason,
    updated_at: r.updated_at,
    proofs,
  };
}

function rowToProof(r: ProofRow): Proof {
  return { id: r.id, type: r.type, text: r.text, created_at: r.created_at };
}

export function userSettings(u: UserRow): Settings {
  return {
    tz: u.tz,
    morning_time: u.morning_time,
    evening_time: u.evening_time,
    weekly_summary: !!u.weekly_summary,
    weekly_time: u.weekly_time,
    ai_endpoint: u.ai_endpoint,
    ai_key: u.ai_key,
    strict_mode: !!u.strict_mode,
    partner_notify_missed: !!u.partner_notify_missed,
    ielts_target: u.ielts_target ?? 7,
    ielts_exam_date: u.ielts_exam_date,
    ielts_weekly_hours: u.ielts_weekly_hours ?? 7,
    ielts_daily_task: (u.ielts_daily_task ?? 1) !== 0,
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

export class Repo {
  constructor(private db: D1Database) {}

  // ---- users ----

  getUserByTg(tgId: number) {
    return this.db.prepare('SELECT * FROM users WHERE tg_id = ?').bind(tgId).first<UserRow>();
  }

  getUserById(id: number) {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  }

  getUserByPartnerCode(code: string) {
    return this.db.prepare('SELECT * FROM users WHERE partner_code = ?').bind(code).first<UserRow>();
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
    const user = (await this.getUserByTg(tgId))!;
    await this.createTemplateActivities(user.id, tz);
    return { user, isNew: true };
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

  updateSettings(userId: number, patch: Partial<Settings>) {
    return this.updateUser(userId, patch);
  }

  markSent(userId: number, col: 'last_morning_sent' | 'last_evening_sent' | 'last_weekly_sent' | 'last_partner_report' | 'last_task_sent' | 'last_vocab_sent', date: string) {
    return this.db.prepare(`UPDATE users SET ${col} = ? WHERE id = ?`).bind(date, userId).run();
  }

  // ---- activities ----

  async listActivities(userId: number, includeArchived = false): Promise<Activity[]> {
    const q = includeArchived
      ? 'SELECT * FROM activities WHERE user_id = ? ORDER BY sort, id'
      : 'SELECT * FROM activities WHERE user_id = ? AND archived_at IS NULL ORDER BY sort, id';
    const { results } = await this.db.prepare(q).bind(userId).all<ActivityRow>();
    return results.map(rowToActivity);
  }

  async getActivity(userId: number, id: number): Promise<Activity | null> {
    const r = await this.db.prepare('SELECT * FROM activities WHERE user_id = ? AND id = ?').bind(userId, id).first<ActivityRow>();
    return r ? rowToActivity(r) : null;
  }

  async createActivity(userId: number, a: ActivityInput, today: string): Promise<Activity> {
    const max = await this.db.prepare('SELECT COALESCE(MAX(sort), -1) AS m FROM activities WHERE user_id = ?').bind(userId).first<{ m: number }>();
    const res = await this.db
      .prepare(
        `INSERT INTO activities (user_id, name, emoji, color, schedule_type, schedule_days, anchor_date, goal_text, goal_date, kind, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        userId,
        a.name,
        a.emoji,
        a.color,
        a.schedule_type,
        a.schedule_type === 'weekdays' ? JSON.stringify(a.schedule_days ?? [0, 1, 2, 3, 4]) : null,
        a.schedule_type === 'every_other_day' ? (a.anchor_date ?? today) : null,
        a.goal_text ?? null,
        a.goal_date ?? null,
        a.kind ?? 'generic',
        (max?.m ?? -1) + 1,
      )
      .run();
    return (await this.getActivity(userId, Number(res.meta.last_row_id)))!;
  }

  async updateActivity(userId: number, id: number, a: Partial<ActivityInput> & { sort?: number; archived_at?: string | null }): Promise<Activity | null> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    const push = (k: string, v: unknown) => {
      sets.push(`${k} = ?`);
      vals.push(v);
    };
    if (a.name !== undefined) push('name', a.name);
    if (a.emoji !== undefined) push('emoji', a.emoji);
    if (a.color !== undefined) push('color', a.color);
    if (a.schedule_type !== undefined) push('schedule_type', a.schedule_type);
    if (a.schedule_days !== undefined) push('schedule_days', a.schedule_days ? JSON.stringify(a.schedule_days) : null);
    if (a.anchor_date !== undefined) push('anchor_date', a.anchor_date);
    if (a.goal_text !== undefined) push('goal_text', a.goal_text);
    if (a.goal_date !== undefined) push('goal_date', a.goal_date);
    if (a.kind !== undefined) push('kind', a.kind);
    if (a.sort !== undefined) push('sort', a.sort);
    if (a.archived_at !== undefined) push('archived_at', a.archived_at);
    if (!sets.length) return this.getActivity(userId, id);
    vals.push(userId, id);
    await this.db.prepare(`UPDATE activities SET ${sets.join(', ')} WHERE user_id = ? AND id = ?`).bind(...vals).run();
    return this.getActivity(userId, id);
  }

  async createTemplateActivities(userId: number, tz: string) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    for (const t of TEMPLATE_ACTIVITIES) await this.createActivity(userId, t, today);
  }

  // ---- entries ----

  private async attachProofs(userId: number, entries: EntryRow[], from: string, to: string): Promise<Entry[]> {
    if (!entries.length) return [];
    const { results } = await this.db
      .prepare('SELECT * FROM proofs WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY id')
      .bind(userId, from, to)
      .all<ProofRow>();
    const byKey = new Map<string, Proof[]>();
    for (const p of results) {
      const k = `${p.activity_id}|${p.date}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(rowToProof(p));
    }
    return entries.map((e) => rowToEntry(e, byKey.get(`${e.activity_id}|${e.date}`) ?? []));
  }

  async entriesForDate(userId: number, date: string): Promise<Entry[]> {
    const { results } = await this.db.prepare('SELECT * FROM entries WHERE user_id = ? AND date = ?').bind(userId, date).all<EntryRow>();
    return this.attachProofs(userId, results, date, date);
  }

  async entriesBetween(userId: number, from: string, to: string): Promise<Entry[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM entries WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date')
      .bind(userId, from, to)
      .all<EntryRow>();
    return this.attachProofs(userId, results, from, to);
  }

  async allEntries(userId: number): Promise<Entry[]> {
    const { results } = await this.db.prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY date').bind(userId).all<EntryRow>();
    return this.attachProofs(userId, results, '0000-00-00', '9999-12-31');
  }

  async getEntry(userId: number, activityId: number, date: string): Promise<Entry | null> {
    const r = await this.db
      .prepare('SELECT * FROM entries WHERE user_id = ? AND activity_id = ? AND date = ?')
      .bind(userId, activityId, date)
      .first<EntryRow>();
    if (!r) return null;
    return (await this.attachProofs(userId, [r], date, date))[0];
  }

  async upsertEntries(userId: number, entries: Omit<Entry, 'updated_at' | 'proofs'>[]) {
    const stmt = this.db.prepare(
      `INSERT INTO entries (user_id, activity_id, date, planned, plan_note, done, done_note, minutes, skills, skipped, skip_reason, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(activity_id, date) DO UPDATE SET
         planned = excluded.planned, plan_note = excluded.plan_note,
         done = excluded.done, done_note = excluded.done_note,
         minutes = excluded.minutes, skills = excluded.skills,
         skipped = excluded.skipped, skip_reason = excluded.skip_reason,
         updated_at = excluded.updated_at
       WHERE entries.user_id = excluded.user_id`,
    );
    await this.db.batch(
      entries.map((e) =>
        stmt.bind(
          userId,
          e.activity_id,
          e.date,
          e.planned ? 1 : 0,
          e.plan_note || null,
          e.done ? 1 : 0,
          e.done_note || null,
          e.minutes ?? 0,
          e.skills?.length ? JSON.stringify(e.skills) : null,
          e.skipped ? 1 : 0,
          e.skipped ? e.skip_reason || null : null,
        ),
      ),
    );
  }

  /** Mark done (keeping other fields) — used when a proof arrives via the bot. */
  async markDone(userId: number, activityId: number, date: string, minutes?: number) {
    await this.db
      .prepare(
        `INSERT INTO entries (user_id, activity_id, date, planned, done, minutes)
         VALUES (?, ?, ?, 0, 1, ?)
         ON CONFLICT(activity_id, date) DO UPDATE SET
           done = 1, skipped = 0, skip_reason = NULL,
           minutes = CASE WHEN excluded.minutes > 0 THEN excluded.minutes ELSE entries.minutes END,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE entries.user_id = excluded.user_id`,
      )
      .bind(userId, activityId, date, minutes ?? 0)
      .run();
  }

  async setMinutes(userId: number, activityId: number, date: string, minutes: number) {
    await this.db
      .prepare(`UPDATE entries SET minutes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id = ? AND activity_id = ? AND date = ?`)
      .bind(minutes, userId, activityId, date)
      .run();
  }

  // ---- proofs ----

  async addProof(userId: number, activityId: number, date: string, p: { type: 'photo' | 'chat'; file_id?: string | null; text?: string | null }) {
    await this.db
      .prepare('INSERT INTO proofs (user_id, activity_id, date, type, file_id, text) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(userId, activityId, date, p.type, p.file_id ?? null, p.text ?? null)
      .run();
  }

  getProof(userId: number, id: number) {
    return this.db.prepare('SELECT * FROM proofs WHERE user_id = ? AND id = ?').bind(userId, id).first<ProofRow>();
  }

  async deleteProof(userId: number, id: number) {
    await this.db.prepare('DELETE FROM proofs WHERE user_id = ? AND id = ?').bind(userId, id).run();
  }

  async addPendingProof(userId: number, p: { type: 'photo' | 'chat'; file_id?: string | null; text?: string | null }): Promise<number> {
    const r = await this.db
      .prepare('INSERT INTO pending_proofs (user_id, type, file_id, text) VALUES (?, ?, ?, ?)')
      .bind(userId, p.type, p.file_id ?? null, p.text ?? null)
      .run();
    return Number(r.meta.last_row_id);
  }

  getPendingProof(userId: number, id: number) {
    return this.db.prepare('SELECT * FROM pending_proofs WHERE user_id = ? AND id = ?').bind(userId, id).first<PendingProof>();
  }

  async deletePendingProof(id: number) {
    await this.db.prepare('DELETE FROM pending_proofs WHERE id = ?').bind(id).run();
  }

  // ---- mock tests ----

  async listMocks(userId: number): Promise<MockTest[]> {
    const { results } = await this.db.prepare('SELECT * FROM mock_tests WHERE user_id = ? ORDER BY date, id').bind(userId).all<MockTest & { user_id: number }>();
    return results.map(({ user_id: _u, ...m }) => m);
  }

  async addMock(userId: number, m: Omit<MockTest, 'id'>): Promise<MockTest> {
    const r = await this.db
      .prepare('INSERT INTO mock_tests (user_id, date, listening, reading, writing, speaking, overall, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(userId, m.date, m.listening, m.reading, m.writing, m.speaking, m.overall, m.note)
      .run();
    return { id: Number(r.meta.last_row_id), ...m };
  }

  async deleteMock(userId: number, id: number) {
    await this.db.prepare('DELETE FROM mock_tests WHERE user_id = ? AND id = ?').bind(userId, id).run();
  }

  // ---- lessons ----

  async listLessonRows(userId: number): Promise<LessonRow[]> {
    const { results } = await this.db.prepare('SELECT * FROM lessons WHERE user_id = ? ORDER BY id').bind(userId).all<LessonRow>();
    return results;
  }

  async listLessons(userId: number): Promise<Lesson[]> {
    return (await this.listLessonRows(userId)).map(rowToLesson);
  }

  async allLessonRows(): Promise<LessonRow[]> {
    const { results } = await this.db.prepare('SELECT * FROM lessons').all<LessonRow>();
    return results;
  }

  async createLesson(userId: number, l: LessonInput): Promise<Lesson> {
    const r = await this.db
      .prepare('INSERT INTO lessons (user_id, title, weekdays, time, tz, remind_morning, remind_before_min) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(userId, l.title, JSON.stringify(l.weekdays), l.time, l.tz, l.remind_morning ? 1 : 0, l.remind_before_min)
      .run();
    return { id: Number(r.meta.last_row_id), ...l };
  }

  async updateLesson(userId: number, id: number, l: Partial<LessonInput>): Promise<Lesson | null> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    const push = (k: string, v: unknown) => { sets.push(`${k} = ?`); vals.push(v); };
    if (l.title !== undefined) push('title', l.title);
    if (l.weekdays !== undefined) push('weekdays', JSON.stringify(l.weekdays));
    if (l.time !== undefined) push('time', l.time);
    if (l.tz !== undefined) push('tz', l.tz);
    if (l.remind_morning !== undefined) push('remind_morning', l.remind_morning ? 1 : 0);
    if (l.remind_before_min !== undefined) push('remind_before_min', l.remind_before_min);
    if (sets.length) {
      vals.push(userId, id);
      await this.db.prepare(`UPDATE lessons SET ${sets.join(', ')} WHERE user_id = ? AND id = ?`).bind(...vals).run();
    }
    const r = await this.db.prepare('SELECT * FROM lessons WHERE user_id = ? AND id = ?').bind(userId, id).first<LessonRow>();
    return r ? rowToLesson(r) : null;
  }

  async deleteLesson(userId: number, id: number) {
    await this.db.prepare('DELETE FROM lessons WHERE user_id = ? AND id = ?').bind(userId, id).run();
  }

  markLessonSent(id: number, col: 'last_morning_sent' | 'last_before_sent', date: string) {
    return this.db.prepare(`UPDATE lessons SET ${col} = ? WHERE id = ?`).bind(date, id).run();
  }

  // ---- homework ----

  async openHomeworks(userId: number): Promise<Homework[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM homeworks WHERE user_id = ? AND done_at IS NULL ORDER BY COALESCE(due_date, "9999"), id')
      .bind(userId)
      .all<HomeworkRow>();
    return results.map(rowToHomework);
  }

  async addHomework(userId: number, h: { text: string; file_id?: string | null; tags: Skill[]; due_date: string | null; lesson_id: number | null }): Promise<Homework> {
    const r = await this.db
      .prepare('INSERT INTO homeworks (user_id, lesson_id, text, file_id, tags, due_date) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(userId, h.lesson_id, h.text, h.file_id ?? null, JSON.stringify(h.tags), h.due_date)
      .run();
    return { id: Number(r.meta.last_row_id), lesson_id: h.lesson_id, text: h.text, has_file: !!h.file_id, tags: h.tags, due_date: h.due_date, created_at: new Date().toISOString(), done_at: null };
  }

  async getHomework(userId: number, id: number): Promise<(Homework & { file_id: string | null }) | null> {
    const r = await this.db.prepare('SELECT * FROM homeworks WHERE user_id = ? AND id = ?').bind(userId, id).first<HomeworkRow>();
    return r ? { ...rowToHomework(r), file_id: r.file_id } : null;
  }

  async completeHomework(userId: number, id: number) {
    await this.db.prepare(`UPDATE homeworks SET done_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id = ? AND id = ? AND done_at IS NULL`).bind(userId, id).run();
  }

  async deleteHomework(userId: number, id: number) {
    await this.db.prepare('DELETE FROM homeworks WHERE user_id = ? AND id = ?').bind(userId, id).run();
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

  /** Apply a signed change to the balance, clamped to [0, cap], and write a ledger row. */
  async addMinutes(userId: number, date: string, delta: number, reason: WalletLedgerEntry['reason'], note: string | null, cap: number): Promise<number> {
    await this.db
      .prepare('UPDATE users SET sm_balance = MAX(0, MIN(?, sm_balance + ?)) WHERE id = ?')
      .bind(cap, delta, userId)
      .run();
    if (delta !== 0) {
      await this.db
        .prepare('INSERT INTO wallet_ledger (user_id, date, delta, reason, note) VALUES (?, ?, ?, ?, ?)')
        .bind(userId, date, delta, reason, note)
        .run();
    }
    return this.balance(userId);
  }

  async earnedOn(userId: number, date: string): Promise<number> {
    const r = await this.db
      .prepare('SELECT COALESCE(SUM(delta), 0) AS s FROM wallet_ledger WHERE user_id = ? AND date = ? AND delta > 0')
      .bind(userId, date)
      .first<{ s: number }>();
    return r?.s ?? 0;
  }

  async rewardedTestIds(userId: number): Promise<string[]> {
    const { results } = await this.db
      .prepare('SELECT DISTINCT test_id FROM reading_attempts WHERE user_id = ? AND earned > 0')
      .bind(userId)
      .all<{ test_id: string }>();
    return results.map((r) => r.test_id);
  }

  async addAttempt(userId: number, a: Omit<ReadingAttemptView, 'id' | 'first'> ): Promise<number> {
    const r = await this.db
      .prepare('INSERT INTO reading_attempts (user_id, test_id, date, correct, total, band, seconds, earned) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(userId, a.test_id, a.date, a.correct, a.total, a.band, a.seconds, a.earned)
      .run();
    return Number(r.meta.last_row_id);
  }

  async attempts(userId: number, limit = 30): Promise<ReadingAttemptView[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM reading_attempts WHERE user_id = ? ORDER BY id DESC LIMIT ?')
      .bind(userId, limit)
      .all<{ id: number; test_id: string; date: string; correct: number; total: number; band: number; seconds: number; earned: number }>();
    return results.map((r) => ({ ...r, first: r.earned > 0 }));
  }

  async ledger(userId: number, limit = 40): Promise<WalletLedgerEntry[]> {
    const { results } = await this.db
      .prepare('SELECT id, at, delta, reason, note FROM wallet_ledger WHERE user_id = ? ORDER BY id DESC LIMIT ?')
      .bind(userId, limit)
      .all<WalletLedgerEntry>();
    return results;
  }

  openSession(userId: number) {
    return this.db
      .prepare('SELECT * FROM wallet_sessions WHERE user_id = ? AND ended_at IS NULL ORDER BY id DESC LIMIT 1')
      .bind(userId)
      .first<{ id: number; app: string; started_at: string; ended_at: string | null; minutes: number }>();
  }

  async startSession(userId: number, app: string): Promise<number> {
    const r = await this.db
      .prepare(`INSERT INTO wallet_sessions (user_id, app, started_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)
      .bind(userId, app)
      .run();
    return Number(r.meta.last_row_id);
  }

  async endSession(id: number, minutes: number) {
    await this.db
      .prepare(`UPDATE wallet_sessions SET ended_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), minutes = ? WHERE id = ?`)
      .bind(minutes, id)
      .run();
  }

  async sessions(userId: number, limit = 20): Promise<WalletSession[]> {
    const { results } = await this.db
      .prepare('SELECT id, app, started_at, ended_at, minutes FROM wallet_sessions WHERE user_id = ? ORDER BY id DESC LIMIT ?')
      .bind(userId, limit)
      .all<{ id: number; app: string; started_at: string; ended_at: string | null; minutes: number }>();
    return results.map((r) => ({ ...r, app: (r.app as WalletSession['app']) }));
  }

  /** Sessions left open by a missed close event, across all users. */
  async staleSessions(olderThanMin: number) {
    const { results } = await this.db
      .prepare(`SELECT * FROM wallet_sessions WHERE ended_at IS NULL AND started_at < strftime('%Y-%m-%dT%H:%M:%fZ','now', ?)`)
      .bind(`-${olderThanMin} minutes`)
      .all<{ id: number; user_id: number; app: string; started_at: string }>();
    return results;
  }

  // ---- vocabulary ----

  async vocabAll(userId: number): Promise<VocabRow[]> {
    const { results } = await this.db.prepare('SELECT * FROM vocab_progress WHERE user_id = ? ORDER BY word_id').bind(userId).all<VocabRow>();
    return results;
  }

  async vocabDue(userId: number, today: string): Promise<VocabRow[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM vocab_progress WHERE user_id = ? AND next_review <= ? AND introduced_on < ? ORDER BY next_review, word_id')
      .bind(userId, today, today)
      .all<VocabRow>();
    return results;
  }

  async vocabIntroducedOn(userId: number, date: string): Promise<VocabRow[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM vocab_progress WHERE user_id = ? AND introduced_on = ? ORDER BY word_id')
      .bind(userId, date)
      .all<VocabRow>();
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
      await this.db
        .prepare('INSERT OR IGNORE INTO vocab_progress (user_id, word_id, stage, introduced_on, next_review) VALUES (?, ?, 0, ?, ?)')
        .bind(userId, id, date, next)
        .run();
      rows.push({ user_id: userId, word_id: id, stage: 0, introduced_on: date, next_review: next, reviews: 0, lapses: 0, last_reviewed: null });
    }
    return rows;
  }

  async vocabGet(userId: number, wordId: number): Promise<VocabRow | null> {
    return this.db.prepare('SELECT * FROM vocab_progress WHERE user_id = ? AND word_id = ?').bind(userId, wordId).first<VocabRow>();
  }

  async vocabRecordReview(userId: number, wordId: number, ok: boolean, today: string, stage: number, nextReview: string) {
    await this.db
      .prepare(
        `UPDATE vocab_progress SET stage = ?, next_review = ?, reviews = reviews + 1, lapses = lapses + ?, last_reviewed = ? WHERE user_id = ? AND word_id = ?`,
      )
      .bind(stage, nextReview, ok ? 0 : 1, today, userId, wordId)
      .run();
    await this.db.prepare('INSERT INTO vocab_reviews (user_id, word_id, date, ok) VALUES (?, ?, ?, ?)').bind(userId, wordId, today, ok ? 1 : 0).run();
  }

  async vocabHistory(userId: number, from: string): Promise<{ date: string; reviews: number; correct: number }[]> {
    const { results } = await this.db
      .prepare('SELECT date, COUNT(*) AS reviews, SUM(ok) AS correct FROM vocab_reviews WHERE user_id = ? AND date >= ? GROUP BY date ORDER BY date')
      .bind(userId, from)
      .all<{ date: string; reviews: number; correct: number }>();
    return results;
  }
}

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

function randomKey(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
