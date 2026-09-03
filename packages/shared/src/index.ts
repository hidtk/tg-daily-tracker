import { z } from 'zod';

// ---------- Constants ----------

/** How many days back a user may edit entries (0 = today only). */
export const EDIT_DAYS_BACK = 1;
export const NOTE_MAX = 200;
export const NAME_MAX = 40;

// ---------- Schemas ----------

export const ScheduleType = z.enum(['daily', 'every_other_day', 'weekdays']);
export type ScheduleType = z.infer<typeof ScheduleType>;

export const ActivityKind = z.enum(['generic', 'ielts']);
export type ActivityKind = z.infer<typeof ActivityKind>;

export const Skill = z.enum(['listening', 'reading', 'writing', 'speaking', 'vocab', 'grammar']);
export type Skill = z.infer<typeof Skill>;
export const SKILLS: Skill[] = ['listening', 'reading', 'writing', 'speaking', 'vocab', 'grammar'];
export const SKILL_LABEL: Record<Skill, string> = {
  listening: 'Listening', reading: 'Reading', writing: 'Writing', speaking: 'Speaking', vocab: 'Vocab', grammar: 'Grammar',
};
export const MINUTE_PRESETS = [15, 30, 45, 60, 90, 120];

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
  kind: ActivityKind.default('generic'),
  sort: z.number().int(),
  archived_at: z.string().nullable(),
});
export type Activity = z.infer<typeof ActivitySchema>;

export const ActivityInputSchema = ActivitySchema.omit({ id: true, sort: true, archived_at: true }).partial({
  schedule_days: true,
  anchor_date: true,
  goal_text: true,
  goal_date: true,
  kind: true,
});
export type ActivityInput = z.infer<typeof ActivityInputSchema>;

export const EntrySchema = z.object({
  activity_id: z.number().int(),
  date: IsoDate,
  planned: z.boolean(),
  plan_note: z.string().max(NOTE_MAX).nullable(),
  done: z.boolean(),
  done_note: z.string().max(NOTE_MAX).nullable(),
  minutes: z.number().int().min(0).max(1440).default(0),
  skills: z.array(Skill).nullable().default(null),
  /** conscious skip: "won't do today" + reason */
  skipped: z.boolean().default(false),
  skip_reason: z.string().max(NOTE_MAX).nullable().default(null),
  updated_at: z.string().optional(),
  /** server-side only: attached proofs */
  proofs: z.array(z.object({ id: z.number(), type: z.enum(['photo', 'chat']), text: z.string().nullable(), created_at: z.string() })).optional(),
});
export type Entry = z.infer<typeof EntrySchema>;
export type Proof = NonNullable<Entry['proofs']>[number];

export const EntriesPutSchema = z.object({
  entries: z.array(EntrySchema.omit({ updated_at: true, proofs: true })).min(1).max(100),
});

/** How many conscious skips per activity per ISO week do not break the streak. */
export const FREE_SKIPS_PER_WEEK = 1;

export function isConfirmed(e: Pick<Entry, 'done' | 'proofs'>): boolean {
  return e.done && (e.proofs?.length ?? 0) > 0;
}
/** Counts as done for streaks/stats: in strict mode only confirmed entries. */
export function countsAsDone(e: Pick<Entry, 'done' | 'proofs'>, strict: boolean): boolean {
  return strict ? isConfirmed(e) : e.done;
}

export const SettingsSchema = z.object({
  tz: z.string().min(1).max(64),
  morning_time: HHMM,
  evening_time: HHMM,
  weekly_summary: z.boolean(),
  weekly_time: HHMM,
  ai_endpoint: z.string().max(300).nullable(),
  ai_key: z.string().max(300).nullable(),
  strict_mode: z.boolean(),
  partner_notify_missed: z.boolean(),
  ielts_target: z.number().min(4).max(9),
  ielts_exam_date: IsoDate.nullable(),
  ielts_weekly_hours: z.number().min(0).max(80),
});
export type Settings = z.infer<typeof SettingsSchema>;
export const SettingsPutSchema = SettingsSchema.partial();

/** Read-only info returned alongside settings. */
export interface SettingsView extends Settings {
  partner: { name: string; linked: boolean } | null;
  /** exam date can be changed at most once per day */
  deadline_editable: boolean;
  bot_username: string;
}

export const DEFAULT_SETTINGS: Settings = {
  tz: 'UTC',
  morning_time: '08:00',
  evening_time: '21:00',
  weekly_summary: true,
  weekly_time: '20:00',
  ai_endpoint: null,
  ai_key: null,
  strict_mode: true,
  partner_notify_missed: true,
  ielts_target: 7.0,
  ielts_exam_date: null,
  ielts_weekly_hours: 7,
};

export const MockTestSchema = z.object({
  id: z.number().int(),
  date: IsoDate,
  listening: z.number().min(0).max(9).nullable(),
  reading: z.number().min(0).max(9).nullable(),
  writing: z.number().min(0).max(9).nullable(),
  speaking: z.number().min(0).max(9).nullable(),
  overall: z.number().min(0).max(9).nullable(),
  note: z.string().max(200).nullable(),
});
export type MockTest = z.infer<typeof MockTestSchema>;
export const MockTestInputSchema = MockTestSchema.omit({ id: true });

/** IELTS overall band: average of four rounded to nearest 0.5 (official rule). */
export function ieltsOverall(l: number | null, r: number | null, w: number | null, s: number | null): number | null {
  const v = [l, r, w, s];
  if (v.some((x) => x === null)) return null;
  const avg = (v as number[]).reduce((a, b) => a + b, 0) / 4;
  return Math.round(avg * 2) / 2;
}

// ---------- API response types ----------

export interface TodayResponse {
  date: string;
  today: string; // server-computed "today" in user's tz
  activities: Activity[]; // all non-archived
  scheduled_ids: number[]; // activities scheduled for `date`
  entries: Entry[];
  editable: boolean;
  strict_mode: boolean;
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
  done: number; // according to strict mode
  confirmed: number;
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
  settings: SettingsView;
}

export interface WeekStat {
  from: string; // Monday
  minutes_by_skill: Record<Skill, number>;
  minutes_total: number;
  scheduled: number;
  done: number; // counts per mode
  confirmed: number;
}

export interface IeltsResponse {
  target: number;
  exam_date: string | null;
  days_left: number | null;
  deadline_editable: boolean;
  weekly_hours: number;
  weeks: WeekStat[]; // last 12 weeks, oldest first
  mocks: MockTest[]; // oldest first
  total_minutes: number;
  /** discipline score 0..100 for the last 4 weeks: confirmed / scheduled */
  discipline: number;
  /** current & best streak of the ielts activity */
  streak: { current: number; best: number } | null;
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
  skipDates: Set<string> = new Set(),
): { current: number; best: number } {
  let best = 0;
  let run = 0;
  let current = 0;
  let d = from;
  const scheduledDays: string[] = [];
  // The first FREE_SKIPS_PER_WEEK conscious skips in a week are treated as unscheduled days.
  const skipsUsed = new Map<string, number>();
  while (diffDays(d, today) >= 0) {
    if (isScheduledOn(a, d)) {
      if (skipDates.has(d) && !doneDates.has(d)) {
        const wk = addDays(d, -weekdayMon0(d));
        const used = skipsUsed.get(wk) ?? 0;
        skipsUsed.set(wk, used + 1);
        if (used < FREE_SKIPS_PER_WEEK) {
          d = addDays(d, 1);
          continue;
        }
      }
      scheduledDays.push(d);
    }
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
  { name: 'English (IELTS)', emoji: '🇬🇧', color: '#3b82f6', schedule_type: 'daily', goal_text: 'IELTS 7.0', goal_date: null, kind: 'ielts' },
  { name: 'Диплом', emoji: '🎓', color: '#a855f7', schedule_type: 'daily', goal_text: 'Защита диплома', goal_date: null },
  { name: 'Спорт', emoji: '🏋️', color: '#22c55e', schedule_type: 'every_other_day', goal_text: null, goal_date: null },
];
