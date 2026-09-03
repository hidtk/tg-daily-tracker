import type { Activity, ActivityInput, Entry, MockTest, Proof, Settings, Skill } from '@tracker/shared';
import { TEMPLATE_ACTIVITIES } from '@tracker/shared';

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
      if (existing.first_name !== firstName) {
        await this.db.prepare('UPDATE users SET first_name = ? WHERE id = ?').bind(firstName, existing.id).run();
      }
      return { user: existing, isNew: false };
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

  markSent(userId: number, col: 'last_morning_sent' | 'last_evening_sent' | 'last_weekly_sent' | 'last_partner_report' | 'last_task_sent', date: string) {
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
}
