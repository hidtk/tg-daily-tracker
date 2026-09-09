import { z } from 'zod';
import { minutesForBand, READING_TIME_LIMIT_MIN } from './reading';

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
  /** send an IELTS practice task with the morning reminder */
  ielts_daily_task: z.boolean(),
  /** new vocabulary words introduced each morning (0 = off) */
  vocab_per_day: z.number().int().min(0).max(20),
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
  strict_mode: false,
  partner_notify_missed: true,
  ielts_target: 7.0,
  ielts_exam_date: null,
  ielts_weekly_hours: 7,
  ielts_daily_task: true,
  vocab_per_day: 5,
};

export const LessonSchema = z.object({
  id: z.number().int(),
  title: z.string().min(1).max(60),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  time: HHMM,
  tz: z.string().min(1).max(64),
  remind_morning: z.boolean(),
  remind_before_min: z.number().int().min(0).max(720),
});
export type Lesson = z.infer<typeof LessonSchema>;
export const LessonInputSchema = LessonSchema.omit({ id: true });
export type LessonInput = z.infer<typeof LessonInputSchema>;

export interface Homework {
  id: number;
  lesson_id: number | null;
  text: string;
  has_file: boolean;
  tags: Skill[];
  due_date: string | null;
  created_at: string;
  done_at: string | null;
}

/** Next date (>= from) on which one of the weekdays occurs. */
export function nextWeekdayDate(from: string, weekdays: number[], includeFrom = true): string | null {
  if (!weekdays.length) return null;
  for (let i = includeFrom ? 0 : 1; i < 8; i++) {
    const d = addDays(from, i);
    if (weekdays.includes(weekdayMon0(d))) return d;
  }
  return null;
}

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
  lessons_today: Lesson[];
  homeworks: Homework[];
  exam_date: string | null;
  target: number;
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
  { name: 'IELTS', emoji: '📖', color: '#1f1f1f', schedule_type: 'daily', goal_text: 'IELTS 7.0', goal_date: null, kind: 'ielts' },
];

// ---------- Social-media minutes wallet ----------

export * from './reading';

/** Apps that can be gated by the wallet. */
export const GateApp = z.enum(['instagram', 'tiktok', 'youtube', 'vk', 'other']);
export type GateApp = z.infer<typeof GateApp>;

export const GATE_APP_LABEL: Record<GateApp, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube / Shorts',
  vk: 'VK',
  other: 'Другое',
};

/** Unspent minutes carry over, but the bank is capped. */
export const WALLET_BANK_CAP_DEFAULT = 120;
/** Cap on minutes earned in one day. */
export const WALLET_DAILY_EARN_CAP_DEFAULT = 60;
/** If the app never reports a close event, a session is force-closed after this. */
export const WALLET_SESSION_MAX_MIN = 45;

export const WalletSettingsSchema = z.object({
  wallet_enabled: z.boolean(),
  bank_cap: z.number().int().min(0).max(600),
  daily_earn_cap: z.number().int().min(0).max(600),
  apps: z.array(GateApp).max(8),
});
export type WalletSettings = z.infer<typeof WalletSettingsSchema>;
export const WalletSettingsPutSchema = WalletSettingsSchema.partial();

export const DEFAULT_WALLET_SETTINGS: WalletSettings = {
  wallet_enabled: true,
  bank_cap: WALLET_BANK_CAP_DEFAULT,
  daily_earn_cap: WALLET_DAILY_EARN_CAP_DEFAULT,
  apps: ['instagram', 'tiktok', 'youtube', 'vk'],
};

export interface WalletLedgerEntry {
  id: number;
  at: string; // ISO datetime
  delta: number; // + earned, − spent
  reason: 'reading' | 'spend' | 'expire' | 'manual';
  note: string | null;
}

export interface ReadingAttemptView {
  id: number;
  test_id: string;
  date: string;
  correct: number;
  total: number;
  band: number;
  seconds: number;
  earned: number;
  /** first completion of this test — repeats do not earn */
  first: boolean;
}

export interface WalletSession {
  id: number;
  app: GateApp;
  started_at: string;
  ended_at: string | null;
  minutes: number;
}

export interface WalletResponse extends WalletSettings {
  balance: number;
  earned_today: number;
  /** how much can still be earned today */
  earn_left: number;
  api_key: string;
  gate_url: string;
  attempts: ReadingAttemptView[];
  ledger: WalletLedgerEntry[];
  sessions: WalletSession[];
  /** ids of tests already completed for reward */
  done_test_ids: string[];
}

export const ReadingSubmitSchema = z.object({
  test_id: z.string().min(1).max(32),
  seconds: z.number().int().min(0).max(24 * 3600),
  answers: z.array(z.string().max(60)),
});
export type ReadingSubmit = z.infer<typeof ReadingSubmitSchema>;

export interface ReadingResult {
  correct: number;
  total: number;
  band: number;
  earned: number;
  /** reward before penalties/caps */
  base: number;
  halved: boolean;
  capped: boolean;
  repeat: boolean;
  balance: number;
  wrong: { n: number; given: string; answer: string; explain: string }[];
}

/**
 * Minutes actually credited for an attempt.
 * Over the time limit the reward is halved; a repeat of an already-rewarded test earns nothing;
 * the daily cap and the bank cap clamp the rest.
 */
export function creditForAttempt(opts: {
  band: number;
  seconds: number;
  repeat: boolean;
  earnedToday: number;
  balance: number;
  dailyCap: number;
  bankCap: number;
  limitMin?: number;
}): { base: number; earned: number; halved: boolean; capped: boolean } {
  const base = minutesForBand(opts.band);
  if (opts.repeat) return { base, earned: 0, halved: false, capped: false };
  const limit = opts.limitMin ?? READING_TIME_LIMIT_MIN;
  const halved = opts.seconds > limit * 60;
  let earned = halved ? Math.floor(base / 2) : base;
  const byDaily = Math.max(0, opts.dailyCap - opts.earnedToday);
  const byBank = Math.max(0, opts.bankCap - opts.balance);
  const allowed = Math.min(byDaily, byBank);
  const capped = earned > allowed;
  earned = Math.min(earned, allowed);
  return { base, earned, halved, capped };
}

// ---------- Vocabulary ----------

export * from './vocab';

export interface VocabCard {
  id: number;
  word: string;
  ipa: string;
  pos: string;
  meaning: string;
  example: string;
  ru: string;
  /** 0 = just introduced; each successful review moves one step up REVIEW_INTERVALS */
  stage: number;
  introduced_on: string;
  next_review: string;
  reviews: number;
  lapses: number;
}

export interface VocabResponse {
  today: string;
  per_day: number;
  /** words introduced today (or to be introduced now) */
  new_words: VocabCard[];
  /** words whose review is due today or overdue */
  due: VocabCard[];
  /** totals */
  learned: number; // introduced so far
  mastered: number; // stage >= REVIEW_INTERVALS.length
  total: number;
  /** last 14 days: number of reviews done per day */
  history: { date: string; reviews: number; correct: number }[];
}

export const VocabReviewSchema = z.object({
  word_id: z.number().int().min(1),
  ok: z.boolean(),
});
export type VocabReview = z.infer<typeof VocabReviewSchema>;
