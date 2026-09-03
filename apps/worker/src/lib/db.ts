import type { Activity, ActivityInput, Entry, Settings } from '@tracker/shared';
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
  updated_at: string;
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
    sort: r.sort,
    archived_at: r.archived_at,
  };
}

function rowToEntry(r: EntryRow): Entry {
  return {
    activity_id: r.activity_id,
    date: r.date,
    planned: !!r.planned,
    plan_note: r.plan_note,
    done: !!r.done,
    done_note: r.done_note,
    updated_at: r.updated_at,
  };
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
  };
}

export class Repo {
  constructor(private db: D1Database) {}

  // ---- users ----

  getUserByTg(tgId: number) {
    return this.db.prepare('SELECT * FROM users WHERE tg_id = ?').bind(tgId).first<UserRow>();
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

  async updateSettings(userId: number, patch: Partial<Settings>) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      sets.push(`${k} = ?`);
      vals.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
    }
    if (!sets.length) return;
    vals.push(userId);
    await this.db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  }

  markSent(userId: number, col: 'last_morning_sent' | 'last_evening_sent' | 'last_weekly_sent', date: string) {
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
        `INSERT INTO activities (user_id, name, emoji, color, schedule_type, schedule_days, anchor_date, goal_text, goal_date, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  async entriesForDate(userId: number, date: string): Promise<Entry[]> {
    const { results } = await this.db.prepare('SELECT * FROM entries WHERE user_id = ? AND date = ?').bind(userId, date).all<EntryRow>();
    return results.map(rowToEntry);
  }

  async entriesBetween(userId: number, from: string, to: string): Promise<Entry[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM entries WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date')
      .bind(userId, from, to)
      .all<EntryRow>();
    return results.map(rowToEntry);
  }

  async allEntries(userId: number): Promise<Entry[]> {
    const { results } = await this.db.prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY date').bind(userId).all<EntryRow>();
    return results.map(rowToEntry);
  }

  async upsertEntries(userId: number, entries: Omit<Entry, 'updated_at'>[]) {
    const stmt = this.db.prepare(
      `INSERT INTO entries (user_id, activity_id, date, planned, plan_note, done, done_note, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(activity_id, date) DO UPDATE SET
         planned = excluded.planned, plan_note = excluded.plan_note,
         done = excluded.done, done_note = excluded.done_note,
         updated_at = excluded.updated_at
       WHERE entries.user_id = excluded.user_id`,
    );
    await this.db.batch(
      entries.map((e) =>
        stmt.bind(userId, e.activity_id, e.date, e.planned ? 1 : 0, e.plan_note || null, e.done ? 1 : 0, e.done_note || null),
      ),
    );
  }
}
