import { z } from 'zod';
import type { CheckResult, Criterion, TaskSize } from './check';
import type { AchievementId, AchievementView } from './achievements';
import type { QuestionType } from './reading';

export * from './text';
export * from './check';
export * from './tasks';
export * from './shop';
export * from './achievements';
export * from './reading';
export * from './vocab';
export { HARD_TESTS } from './hard';
export { parseIso, toIso, addDays, diffDays } from './dates';
import { parseIso, toIso } from './dates';

// ---------- Dates ----------

/** ISO date YYYY-MM-DD */
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD expected');
/** HH:MM 24h */
export const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM expected');

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

// ---------- Settings ----------

export const SettingsSchema = z.object({
  tz: z.string().min(1).max(64),
  /** the morning message with three tasks */
  reminders: z.boolean(),
  morning_time: HHMM,
  /** new vocabulary words introduced each day (0 = off) */
  vocab_per_day: z.number().int().min(0).max(20),
  lang: z.enum(['en', 'ru']),
});
export type Settings = z.infer<typeof SettingsSchema>;
export const SettingsPutSchema = SettingsSchema.partial();

export interface SettingsView extends Settings {
  bot_username: string;
  /** the first-run guide was seen (reset turns it off again) */
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = { tz: 'UTC', reminders: true, morning_time: '08:00', vocab_per_day: 5, lang: 'en' };

export interface AuthResponse {
  token: string;
  user: { tg_id: number; first_name: string; is_new: boolean };
  settings: SettingsView;
}

/** «Начать заново»: the word typed to confirm (either language). */
export const RESET_WORDS = ['ЗАНОВО', 'RESET'];
export const ResetSchema = z.object({ word: z.string().max(20) });

// ---------- Social-media minutes and the lock ----------

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
/** Cap on minutes earned in one day (achievement bonuses are on top). */
export const WALLET_DAILY_EARN_CAP_DEFAULT = 60;
/** If the app never reports a close event (and the timer loop is silent), a session is force-closed after this. */
export const WALLET_SESSION_MAX_MIN = 45;
/** One session never charges more than this, even if the close event comes very late. */
export const WALLET_SESSION_HARD_CAP_MIN = 180;
/** The Shortcuts timer loop asks the server this often (seconds) … */
export const GATE_TICK_SECONDS = 20;
/** … and is sent Home when less than this is left, so the overrun or loss is at most ~10 seconds. */
export const GATE_BLOCK_BELOW_SECONDS = 10;

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

export type LedgerReason = 'reading' | 'words' | 'quiz' | 'sentence' | 'writing' | 'speaking' | 'achievement' | 'spend' | 'manual' | 'penalty';

export interface WalletLedgerEntry {
  id: number;
  at: string; // ISO datetime
  date: string;
  delta: number; // + earned, − spent
  reason: LedgerReason | string;
  note: string | null;
}

export interface WalletResponse extends WalletSettings {
  /** negative = debt: time used beyond the paid minutes, paid back from the next earnings */
  balance: number;
  /** a Shortcuts session running right now */
  session: { app: GateApp; started_at: string; seconds_left: number } | null;
  earned_today: number;
  /** how much can still be earned today */
  earn_left: number;
  gate_url: string;
  lock: LockState;
  /** the lock buddy: a friend whose Telegram gets a message about every bypass */
  friend: { name: string | null; invite: string | null };
}

/** DNS lock driven by the wallet. */
export interface LockState {
  configured: boolean;
  state: 'locked' | 'open' | null;
  /** ISO datetime when the open window ends */
  until: string | null;
  remaining_min: number;
  error: string | null;
  /** link to the Apple configuration profile (open in Safari) */
  profile_url: string | null;
  removal_password: string | null;
  profile_id: string | null;
}

export const LockConfigSchema = z.object({ key: z.string().min(10).max(120), profile: z.string().regex(/^[a-z0-9]{4,10}$/i) });
export const UnlockSchema = z.object({ minutes: z.number().int().min(1).max(180) });
export const UNLOCK_PRESETS = [10, 15, 30, 60];

/** What a finished task brought: minutes (after the daily limit), and achievements reached by it. */
export interface Payout {
  minutes: number;
  /** the daily limit or the bank cap cut the payment */
  capped: boolean;
  achievements: AchievementId[];
  balance: number;
}

// ---------- Reading ----------

/** A Reading part as the app sees it: the passage and the questions, without the answers. */
export interface ReadingTask {
  id: string;
  title: string;
  topic: string;
  hard: boolean;
  part: 'tfng' | 'mcq' | 'gap' | 'all';
  paragraphs: string[];
  questions: { n: number; type: QuestionType; prompt: string; options?: string[] }[];
  minutes: number;
  price: number;
  min_seconds: number;
}

export const ReadingSubmitSchema = z.object({
  task_id: z.string().min(1).max(40),
  seconds: z.number().int().min(0).max(24 * 3600),
  answers: z.array(z.string().max(60)).max(20),
});
export type ReadingSubmit = z.infer<typeof ReadingSubmitSchema>;

export interface ReadingResult {
  correct: number;
  total: number;
  /** full price of the part; the pay is price × share right */
  price: number;
  /** 50%+ right: the part is done (answers are shown) */
  passed: boolean;
  /** faster than the minimum time: no minutes */
  fast: boolean;
  payout: Payout;
  /** passed: every wrong answer with the right one; not passed: only which, with a paragraph hint */
  wrong: { n: number; given: string; answer: string | null; explain: string | null; hint: string | null }[];
}

// ---------- Words ----------

export interface VocabCard {
  id: number;
  word: string;
  ipa: string;
  pos: string;
  meaning: string;
  example: string;
  ru: string;
  stage: number;
}

export type VocabQuestionKind = 'translate' | 'cloze';

/** A review question: the answer is typed and checked on the server, so the word itself is not sent. */
export interface VocabQuestion {
  word_id: number;
  kind: VocabQuestionKind;
  ru: string;
  meaning: string;
  pos: string;
  /** cloze: the example sentence with the word blanked out */
  sentence: string | null;
  /** letters in the expected answer, and its first letter (shown only as a hint) */
  letters: number;
  first: string;
}

export interface VocabResponse {
  today: string;
  /** words introduced today: study them, they are asked from tomorrow */
  new_words: VocabCard[];
  queue: VocabQuestion[];
  /** answers typed right today that paid, and how many more can pay */
  paid_today: number;
  paid_left: number;
  learned: number;
  total: number;
}

export const VocabAnswerSchema = z.object({
  word_id: z.number().int().min(1),
  answer: z.string().max(80),
  hint: z.boolean().default(false),
});

export interface VocabAnswerResult {
  ok: boolean;
  /** ok with a one-letter typo */
  typo: boolean;
  /** the expected answer (the form used in the sentence for cloze) */
  answer: string;
  word: string;
  ru: string;
  meaning: string;
  example: string;
  payout: Payout;
}

// ---------- Sentences ----------

export const SentenceSubmitSchema = z.object({ word_id: z.number().int().min(1), text: z.string().min(1).max(400) });

/** Who checks the meaning of a sentence: nobody (rules only, no minutes), Workers AI, or an own model over HTTP. */
export type JudgeKind = 'none' | 'workers-ai' | 'http';

/** The model's verdict on a sentence (strict JSON). */
export interface JudgeVerdict {
  ok: boolean;
  /** 0 — many mistakes, 1 — small mistakes, 2 — correct */
  grammar: number;
  /** 0 — nonsense, 1 — unclear, 2 — makes sense */
  meaning: number;
  uses_word_correctly: boolean;
  /** why, in plain Russian */
  reason_ru: string;
}

/** accepted — checked and paid; pending — the model was unavailable, checked later; practice — no model, no minutes. */
export type SentenceStatus = 'accepted' | 'pending' | 'practice' | 'rejected';

export interface SentenceState {
  today: string;
  count: number;
  per_day: number;
  next: { id: number; word: string; ipa: string; pos: string; meaning: string; ru: string } | null;
  judge: JudgeKind;
  /** minutes a sentence pays now (0 without a model) */
  pay: number;
  /** today's sentences with what happened to them, newest first */
  recent: { word: string; text: string; status: SentenceStatus; reason: string | null }[];
}

export interface SentenceResult {
  ok: boolean;
  /** why nothing was checked: limit reached, word already used today */
  blocked: 'limit' | 'done_today' | null;
  /** what happened to a sentence that passed the rules (null when it didn't) */
  status: SentenceStatus | null;
  check: CheckResult | null;
  verdict: JudgeVerdict | null;
  state: SentenceState;
  payout: Payout | null;
}

// ---------- «Быстрый тест» ----------

export interface QuizQuestion {
  kind: 'cloze' | 'meaning';
  /** cloze: the bank example with a gap; meaning: the word */
  prompt: string;
  options: string[];
}

export interface QuizState {
  today: string;
  /** the set to answer now (null: none left today) */
  set: { id: number; n: number; questions: QuizQuestion[] } | null;
  done_today: number;
  per_day: number;
  pay: number;
  pass: number;
}

export const QuizSubmitSchema = z.object({ id: z.number().int().min(1), answers: z.array(z.number().int().min(-1).max(9)).max(20) });

export interface QuizResult {
  correct: number;
  total: number;
  passed: boolean;
  fast: boolean;
  /** the right option per question, shown after the answer */
  right: number[];
  payout: Payout;
  state: QuizState;
}

// ---------- Writing ----------

export const WritingSize = z.enum(['short', 'long']);

export interface WritingState {
  today: string;
  size: TaskSize;
  topic: { id: string; title: string; prompt: string };
  /** recent vocabulary to use */
  vocab: { id: number; word: string; ru: string }[];
  started_at: string | null;
  /** accepted today */
  done: { words: number; text: string; paid: number; feedback: AiFeedback | null } | null;
  rules: { min_words: number; vocab: number; linking: number; sentences: number; min_seconds: number };
  price: number;
  /** the AI check is configured on the server */
  ai: boolean;
}

export const WritingStartSchema = z.object({ size: WritingSize });
export const WritingSubmitSchema = z.object({ size: WritingSize, text: z.string().min(1).max(6000) });

/** Optional AI opinion on a Writing text (only when the server has an API key). */
export interface AiFeedback {
  on_topic: boolean;
  band: number;
  tips: string[];
}

export interface WritingResult {
  ok: boolean;
  /** not checked at all: 'not_started' | 'done_today' */
  blocked: 'not_started' | 'done_today' | null;
  criteria: Criterion[];
  words: number;
  vocab_used: string[];
  linking: string[];
  seconds: number;
  ai: AiFeedback | null;
  payout: Payout | null;
  state: WritingState;
}

// ---------- Speaking ----------

export interface SpeakingState {
  today: string;
  cards: { size: TaskSize; card: { id: string; title: string; prompt: string; points: string[] }; min_seconds: number; price: number; done: { seconds: number; paid: number } | null }[];
  bot_username: string;
}

// ---------- Progress ----------

export interface ProgressResponse {
  today: string;
  achievements: AchievementView[];
  /** last 7 days, oldest first: study minutes (automatic log) and social-media minutes earned */
  week: { date: string; study: number; earned: number }[];
  streak: { current: number; best: number };
  totals: { tasks: number; earned: number; study_minutes: number; words_learned: number };
  /** latest wallet movements */
  ledger: WalletLedgerEntry[];
  /** bypasses the server noticed in the NextDNS logs, newest first */
  bypasses: { at: string; date: string; app: string; minutes: number; penalty: number }[];
}
