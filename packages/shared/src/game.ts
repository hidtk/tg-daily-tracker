/**
 * Game layer: experience (XP), levels with boss gates, the day streak, daily quests and the
 * "work → social-media minutes" exchange rate. Everything here is pure: the server feeds it
 * per-day counts taken from the source tables, so XP and quests are always recomputed, never typed in.
 */
import { addDays, diffDays } from './dates';

// ---------- Exchange rate: minutes of social media ----------

/**
 * Reading is the main income (5–30 min per test by band, see minutesForBand). Everything else is a small top-up
 * with its own daily ceiling, and without today's Reading only FREE_WITHOUT_READING of it is paid out —
 * the rest waits ("held") until a Reading test is done the same day.
 */
export const EARN = {
  /** per correct typed word (no hint) */
  word: 0.5,
  wordsCap: 5,
  sentence: 1,
  sentencesCap: 5,
  writing: 10,
  writingPerDay: 1,
  speaking: 4,
  speakingPerDay: 2,
  /** all three daily quests done */
  chest: 10,
  freeWithoutReading: 10,
} as const;

/** A Reading attempt counts (quest, streak, minutes) only if it took at least this long and wasn't guessed. */
export const READING_MIN_SECONDS = 240;
export const READING_MIN_CORRECT = 5;

export const WRITING_MIN_WORDS = 120;
export const WRITING_MIN_VOCAB = 3;
export const WRITING_MIN_SECONDS = 300;
/** Words learned within this many days count as "recent vocabulary" for Writing. */
export const WRITING_VOCAB_DAYS = 30;
export const SPEAKING_MIN_SECONDS = 60;
export const QUEST_WORDS = 10;
export const SENTENCES_XP_PER_DAY = 10;

export function isReadingCounted(seconds: number, correct: number): boolean {
  return seconds >= READING_MIN_SECONDS && correct >= READING_MIN_CORRECT;
}

// ---------- XP ----------

export const XP = {
  word: 2,
  wordHint: 1,
  wordsCap: 40,
  sentence: 5,
  writing: 40,
  speaking: 25,
  readingBase: 10,
  readingPerCorrect: 2,
  quest: 10,
  chest: 30,
  bossWin: 100,
} as const;

export function readingXp(correct: number): number {
  return XP.readingBase + XP.readingPerCorrect * correct;
}

// ---------- Levels and bosses ----------

export const MAX_LEVEL = 30;

export interface Boss {
  id: string;
  /** reachable at this level; the next level opens only after a win */
  level: number;
  /** band needed to win */
  pass: number;
}

export const BOSSES: Boss[] = [
  { id: 'boss-1', level: 5, pass: 6.0 },
  { id: 'boss-2', level: 10, pass: 6.5 },
  { id: 'boss-3', level: 15, pass: 7.0 },
  { id: 'boss-4', level: 20, pass: 7.0 },
  { id: 'boss-5', level: 25, pass: 7.5 },
];

/** Stages of the ladder (English keys, translated in the app). Each ends with a boss. */
export const STAGES: { name: string; from: number; to: number }[] = [
  { name: 'Warm-up', from: 1, to: 5 },
  { name: 'Foundation', from: 6, to: 10 },
  { name: 'Momentum', from: 11, to: 15 },
  { name: 'Band 7 zone', from: 16, to: 20 },
  { name: 'Exam ready', from: 21, to: 25 },
  { name: 'Mastery', from: 26, to: 30 },
];

/** Total XP needed to reach `level` (level 1 = 0). Each step costs 25 XP more than the previous one: 100, 125, 150… */
export function xpToReach(level: number): number {
  const n = Math.max(0, level - 1);
  return 100 * n + (25 * n * (n - 1)) / 2;
}

export function stageOf(level: number) {
  return STAGES.find((s) => level >= s.from && level <= s.to) ?? STAGES[STAGES.length - 1];
}

/** Level from XP; a boss that isn't beaten caps the level at its milestone (XP keeps counting). */
export function levelFor(xp: number, beaten: Iterable<string>): { level: number; gatedBy: Boss | null } {
  const won = new Set(beaten);
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpToReach(level + 1)) level++;
  for (const b of BOSSES) {
    if (level > b.level && !won.has(b.id)) return { level: b.level, gatedBy: b };
  }
  return { level, gatedBy: null };
}

// ---------- Streak ----------

/**
 * A day joins the streak when its Reading quest is done. A missed day breaks it, unless a shield is left:
 * every 7 streak days earn one (at most 2), and a shield is spent automatically on a missed day.
 * An unfinished today never breaks anything.
 */
export function computeGameStreak(doneDates: Iterable<string>, today: string): { current: number; best: number; shields: number; today_done: boolean } {
  const done = new Set(doneDates);
  const sorted = [...done].filter((d) => d <= today).sort();
  if (!sorted.length) return { current: 0, best: 0, shields: 0, today_done: false };
  let run = 0;
  let best = 0;
  let shields = 0;
  for (let d = sorted[0]; diffDays(d, today) >= 0; d = addDays(d, 1)) {
    if (done.has(d)) {
      run++;
      if (run % 7 === 0) shields = Math.min(2, shields + 1);
      best = Math.max(best, run);
    } else if (d !== today) {
      if (shields > 0) shields--;
      else run = 0;
    }
  }
  return { current: run, best, shields, today_done: done.has(today) };
}

// ---------- Daily quests and XP per day ----------

export type QuestId = 'reading' | 'words' | 'create';

export interface Quest {
  id: QuestId;
  done: boolean;
  progress: number;
  target: number;
}

/** What was done on one day, counted from the source tables. */
export interface DayActivity {
  date: string;
  /** Reading attempts that count (first attempt, not rushed, not guessed) */
  readingCounted: number;
  /** XP of those attempts */
  readingXp: number;
  wordsOk: number;
  wordsHint: number;
  wordsWrong: number;
  sentences: number;
  writings: number;
  voices: number;
  bossWins: number;
}

export const EMPTY_DAY: Omit<DayActivity, 'date'> = { readingCounted: 0, readingXp: 0, wordsOk: 0, wordsHint: 0, wordsWrong: 0, sentences: 0, writings: 0, voices: 0, bossWins: 0 };

/**
 * The three quests: one Reading section (the key one), ten correct words, and one piece of own English
 * (a sentence, a Writing text or a Speaking answer). `wordsTarget` shrinks when fewer words can be asked today.
 */
export function questsFor(d: Omit<DayActivity, 'date'>, wordsTarget: number = QUEST_WORDS): Quest[] {
  const created = d.sentences + d.writings + d.voices;
  const words = d.wordsOk + d.wordsHint;
  const target = Math.max(0, Math.min(QUEST_WORDS, wordsTarget));
  return [
    { id: 'reading', done: d.readingCounted > 0, progress: Math.min(1, d.readingCounted), target: 1 },
    { id: 'words', done: words >= target, progress: Math.min(target, words), target },
    { id: 'create', done: created > 0, progress: Math.min(1, created), target: 1 },
  ];
}

export function dayXp(d: Omit<DayActivity, 'date'>, wordsTarget?: number): { xp: number; quests: Quest[]; chest: boolean } {
  const quests = questsFor(d, wordsTarget);
  const chest = quests.every((q) => q.done);
  const xp =
    d.readingXp +
    Math.min(XP.wordsCap, d.wordsOk * XP.word + d.wordsHint * XP.wordHint) +
    Math.min(SENTENCES_XP_PER_DAY, d.sentences) * XP.sentence +
    Math.min(EARN.writingPerDay, d.writings) * XP.writing +
    Math.min(EARN.speakingPerDay, d.voices) * XP.speaking +
    d.bossWins * XP.bossWin +
    quests.filter((q) => q.done).length * XP.quest +
    (chest ? XP.chest : 0);
  return { xp, quests, chest };
}

// ---------- Paying out the day's minutes ----------

/** Minutes the day's non-Reading work is worth, each source clamped by its own ceiling. */
export function nonReadingValue(d: Pick<DayActivity, 'wordsOk' | 'sentences' | 'writings' | 'voices'>) {
  const words = Math.min(EARN.wordsCap, d.wordsOk * EARN.word);
  const sentence = Math.min(EARN.sentencesCap, d.sentences * EARN.sentence);
  const writing = Math.min(EARN.writingPerDay, d.writings) * EARN.writing;
  const speaking = Math.min(EARN.speakingPerDay, d.voices) * EARN.speaking;
  return { words, sentence, writing, speaking, total: words + sentence + writing + speaking };
}

/**
 * How much to pay now. Idempotent: `paid` is what non-Reading work already brought today, so calling it
 * again after every action only pays the difference. Without Reading today, only `freeWithoutReading` is paid
 * and the rest is `held`; the chest pays once when every quest is done. Daily and bank caps clamp both.
 */
export function settlePlan(o: {
  value: number;
  paid: number;
  readingDone: boolean;
  chestDue: boolean;
  earnedToday: number;
  dailyCap: number;
  balance: number;
  bankCap: number;
}): { pay: number; chest: number; held: number; capped: boolean } {
  const target = o.readingDone ? o.value : Math.min(o.value, EARN.freeWithoutReading);
  const held = Math.max(0, o.value - target);
  const want = Math.max(0, target - o.paid);
  let room = Math.max(0, Math.min(o.dailyCap - o.earnedToday, o.bankCap - o.balance));
  const pay = Math.min(want, room);
  room -= pay;
  const chest = o.chestDue ? Math.min(EARN.chest, room) : 0;
  return { pay: round1(pay), chest: round1(chest), held: round1(held), capped: pay < want || (o.chestDue && chest < EARN.chest) };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------- API shapes ----------

export interface BossView extends Boss {
  title: string;
  topic: string;
  minutes: number;
  /** level reached: the boss can be challenged */
  unlocked: boolean;
  beaten: boolean;
  /** one try per day */
  tried_today: boolean;
  best_band: number | null;
}

export type EarnSource = 'reading' | 'words' | 'sentence' | 'writing' | 'speaking' | 'unlocked' | 'quest';

export interface GameState {
  today: string;
  xp: number;
  level: number;
  /** XP at the start of the current level and for the next one (null at the top) */
  level_from: number;
  level_to: number | null;
  stage: { index: number; name: string; from: number; to: number };
  /** XP is enough for the next level, but a boss stands in the way */
  gated: boolean;
  boss: BossView | null;
  bosses_beaten: string[];
  streak: { current: number; best: number; shields: number; today_done: boolean };
  /** last 7 days, oldest first: was the Reading quest done */
  week: { date: string; done: boolean }[];
  quests: Quest[];
  chest: { open: boolean; minutes: number; xp: number };
  today_xp: number;
  minutes: {
    balance: number;
    earned: number;
    daily_cap: number;
    held: number;
    reading_done: boolean;
    free_without_reading: number;
    by_source: Partial<Record<EarnSource, number>>;
  };
}

/** What one action brought — shown as a toast and drives the mascot. */
export interface Reward {
  xp: number;
  minutes: number;
  held: number;
  level_before: number;
  level_after: number;
  quests_done: QuestId[];
  chest: boolean;
  streak: number;
  boss_won: string | null;
}

export function rewardBetween(before: GameState, after: GameState): Reward {
  const doneBefore = new Set(before.quests.filter((q) => q.done).map((q) => q.id));
  return {
    xp: after.xp - before.xp,
    minutes: round1(after.minutes.earned - before.minutes.earned),
    held: after.minutes.held,
    level_before: before.level,
    level_after: after.level,
    quests_done: after.quests.filter((q) => q.done && !doneBefore.has(q.id)).map((q) => q.id),
    chest: after.chest.open && !before.chest.open,
    streak: after.streak.current,
    boss_won: after.bosses_beaten.find((b) => !before.bosses_beaten.includes(b)) ?? null,
  };
}
