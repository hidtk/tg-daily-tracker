import { z } from 'zod';

// ---------- Constants ----------

/** How many days back a user may edit entries (0 = today only). */
export const EDIT_DAYS_BACK = 1;
export const NOTE_MAX = 200;
export const NAME_MAX = 40;

// ---------- Schemas ----------

export const ScheduleType = z.enum(['daily', 'every_other_day', 'weekdays']);
export type ScheduleType = z.infer<typeof ScheduleType>;

/** ISO date YYYY-MM-DD */
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD expected');
/** HH:MM 24h */
export const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM expected');

export const ActivitySchema = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(NAME_MAX),
  emoji: z.string().min(1).max(8),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  schedule_type: ScheduleType,
  /** weekdays: array of 0..6 (0 = Monday); every_other_day: anchor date; daily: null */
  schedule_days: z.array(z.number().int().min(0).max(6)).nullable(),
  anchor_date: IsoDate.nullable(),
  goal_text: z.string().max(80).nullable(),
  goal_date: IsoDate.nullable(),
  sort: z.number().int(),
  archived_at: z.string().nullable(),
});
export type Activity = z.infer<typeof ActivitySchema>;

export const ActivityInputSchema = ActivitySchema.omit({ id: true, sort: true, archived_at: true }).partial({
  schedule_days: true,
  anchor_date: true,
  goal_text: true,
  goal_date: true,
});
export type ActivityInput = z.infer<typeof ActivityInputSchema>;

export const EntrySchema = z.object({
  activity_id: z.number().int(),
  date: IsoDate,
  planned: z.boolean(),
  plan_note: z.string().max(NOTE_MAX).nullable(),
  done: z.boolean(),
  done_note: z.string().max(NOTE_MAX).nullable(),
  updated_at: z.string().optional(),
});
export type Entry = z.infer<typeof EntrySchema>;

export const EntriesPutSchema = z.object({
  entries: z.array(EntrySchema.omit({ updated_at: true })).min(1).max(100),
});

export const SettingsSchema = z.object({
  tz: z.string().min(1).max(64),
  morning_time: HHMM,
  evening_time: HHMM,
  weekly_summary: z.boolean(),
  weekly_time: HHMM,
  ai_endpoint: z.string().max(300).nullable(),
  ai_key: z.string().max(300).nullable(),
});
export type Settings = z.infer<typeof SettingsSchema>;
export const SettingsPutSchema = SettingsSchema.partial();

export const DEFAULT_SETTINGS: Settings = {
  tz: 'UTC',
  morning_time: '08:00',
  evening_time: '21:00',
  weekly_summary: true,
  weekly_time: '20:00',
  ai_endpoint: null,
  ai_key: null,
};

// ---------- API response types ----------

export interface TodayResponse {
  date: string;
  today: string; // server-computed "today" in user's tz
  activities: Activity[]; // all non-archived
  scheduled_ids: number[]; // activities scheduled for `date`
  entries: Entry[];
  editable: boolean;
}

export interface StreakInfo {
  activity_id: number;
  current: number;
  best: number;
  done_total: number;
}

export interface HeatmapDay {
  date: string;
  scheduled: number;
  planned: number;
  done: number;
}

export interface StatsResponse {
  month: string; // YYYY-MM
  today: string; // in user's tz
  streaks: StreakInfo[];
  days: HeatmapDay[];
}

export interface AuthResponse {
  token: string;
  user: { tg_id: number; first_name: string; is_new: boolean };
  settings: Settings;
}

// ---------- Date helpers (pure, no TZ) ----------

export function parseIso(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

/** Difference in days: b - a */
export function diffDays(a: string, b: string): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86_400_000);
}

/** First and last day of a YYYY-MM month. */
export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayMon0(iso: string): number {
  return (parseIso(iso).getUTCDay() + 6) % 7;
}

/** Local "today" date string for a given IANA tz. */
export function todayInTz(tz: string, now: Date = new Date()): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    return fmt.format(now); // en-CA gives YYYY-MM-DD
  } catch {
    return toIso(now);
  }
}

/** Local HH:MM in tz. */
export function timeInTz(tz: string, now: Date = new Date()): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    return fmt.format(now).replace('24:', '00:');
  } catch {
    return now.toISOString().slice(11, 16);
  }
}

// ---------- Schedule logic ----------

export function isScheduledOn(a: Pick<Activity, 'schedule_type' | 'schedule_days' | 'anchor_date'>, iso: string): boolean {
  switch (a.schedule_type) {
    case 'daily':
      return true;
    case 'weekdays':
      return (a.schedule_days ?? []).includes(weekdayMon0(iso));
    case 'every_other_day': {
      const anchor = a.anchor_date ?? iso;
      return Math.abs(diffDays(anchor, iso)) % 2 === 0;
    }
  }
}

export function isEditable(date: string, today: string, daysBack = EDIT_DAYS_BACK): boolean {
  const diff = diffDays(date, today);
  return diff >= 0 && diff <= daysBack;
}

// ---------- Streaks ----------

/**
 * Compute current & best streak for one activity.
 * Only scheduled days count; a non-scheduled day neither extends nor breaks the streak.
 * "Today" counts only if done (an unfinished today never breaks the current streak).
 */
export function computeStreak(
  a: Pick<Activity, 'schedule_type' | 'schedule_days' | 'anchor_date'>,
  doneDates: Set<string>,
  today: string,
  from: string,
): { current: number; best: number } {
  let best = 0;
  let run = 0;
  let current = 0;
  let d = from;
  const scheduledDays: string[] = [];
  while (diffDays(d, today) >= 0) {
    if (isScheduledOn(a, d)) scheduledDays.push(d);
    d = addDays(d, 1);
  }
  for (const day of scheduledDays) {
    if (doneDates.has(day)) {
      run++;
      if (run > best) best = run;
    } else if (day !== today) {
      run = 0;
    }
  }
  // current: walk backwards from today
  for (let i = scheduledDays.length - 1; i >= 0; i--) {
    const day = scheduledDays[i];
    if (doneDates.has(day)) current++;
    else if (day === today) continue;
    else break;
  }
  return { current, best };
}

// ---------- Default template ----------

export const TEMPLATE_ACTIVITIES: ActivityInput[] = [
  { name: 'English (IELTS)', emoji: '🇬🇧', color: '#3b82f6', schedule_type: 'daily', goal_text: 'IELTS', goal_date: null },
  { name: 'Диплом', emoji: '🎓', color: '#a855f7', schedule_type: 'daily', goal_text: 'Защита диплома', goal_date: null },
  { name: 'Спорт', emoji: '🏋️', color: '#22c55e', schedule_type: 'every_other_day', goal_text: null, goal_date: null },
];
