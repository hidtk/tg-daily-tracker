/**
 * The task shop: every small task has its own price in social-media minutes, an expected time and a difficulty.
 * Pure rules only — the server builds the live list (what is open, done, waiting) from the database.
 */
import { HARD_TESTS } from './hard';
import { READING_TESTS, type QuestionType, type ReadingQuestion, type ReadingTest } from './reading';
import { SPEAKING_RULES, WRITING_RULES, type TaskSize } from './check';

export type ShopKind = 'reading' | 'words' | 'quiz' | 'sentence' | 'writing' | 'speaking';
export type Level = 1 | 2 | 3;

/** Ledger reasons for earned minutes (they count towards the daily limit). */
export const EARN_KINDS: ShopKind[] = ['reading', 'words', 'quiz', 'sentence', 'writing', 'speaking'];

// ---------- Prices ----------

/** Words: each right typed answer (no hint) pays WORD_PAY, at most WORDS_PAID_PER_DAY a day. */
export const WORD_PAY = 0.5;
export const WORDS_PAID_PER_DAY = 10;
/**
 * Sentences: SENTENCES_PER_DAY a day, SENTENCE_PAY each — only when a model checked the meaning. Without a model
 * (the default) a sentence passes the rules only and pays nothing: it is practice, the rules alone can't tell sense
 * from a string of words.
 */
export const SENTENCE_PAY = 1;
export const SENTENCES_PER_DAY = 5;
/**
 * «Быстрый тест»: QUIZ_SIZE multiple-choice questions (a gap in a bank example, the meaning of a word), checked by the
 * key. QUIZ_PASS or more right pays QUIZ_PAY; QUIZ_SETS_PER_DAY sets a day. Faster than QUIZ_MIN_SECONDS per question
 * is tapping at random — nothing.
 */
export const QUIZ_SIZE = 5;
export const QUIZ_PASS = 4;
export const QUIZ_PAY = 1;
export const QUIZ_SETS_PER_DAY = 5;
export const QUIZ_MIN_SECONDS = 4;

export const WRITING_TASKS: Record<TaskSize, { price: number; minutes: number; level: Level }> = {
  short: { price: 5, minutes: 8, level: 1 },
  long: { price: 12, minutes: 20, level: 3 },
};

export const SPEAKING_TASKS: Record<TaskSize, { price: number; minutes: number; level: Level }> = {
  short: { price: 3, minutes: 3, level: 1 },
  long: { price: 6, minutes: 5, level: 2 },
};

export { WRITING_RULES, SPEAKING_RULES };

// ---------- Reading, split into parts ----------

/** A part is one type of questions from a passage (4–5 questions), or the whole passage at once. */
export type ReadingPartId = 'tfng' | 'mcq' | 'gap' | 'all';

export interface ReadingPart {
  id: string; // r:<test>:<part>
  test: ReadingTest;
  part: ReadingPartId;
  hard: boolean;
  questions: ReadingQuestion[];
  /** expected time, minutes (the passage has to be read for any part) */
  minutes: number;
  /** full price, paid in proportion to the right answers */
  price: number;
  level: Level;
  /** faster than this is a guess: no minutes */
  minSeconds: number;
}

const PART_BASE: Record<Exclude<ReadingPartId, 'all'>, { minutes: number; price: number; level: Level }> = {
  tfng: { minutes: 8, price: 5, level: 2 },
  mcq: { minutes: 7, price: 5, level: 2 },
  gap: { minutes: 6, price: 4, level: 1 },
};

/** The whole passage pays more than its three parts together: one long sitting, like the exam. */
const ALL_BONUS = 4;
/** Hard passages (longer, trickier) pay half as much again. */
const HARD_FACTOR = 1.5;

export const PASS_SHARE = 0.5;

export function readingTaskId(testId: string, part: ReadingPartId): string {
  return `r:${testId}:${part}`;
}

const allTests = () => [...READING_TESTS.map((t) => ({ t, hard: false })), ...HARD_TESTS.map((t) => ({ t, hard: true }))];

export function readingParts(test: ReadingTest, hard: boolean): ReadingPart[] {
  const extra = hard ? 3 : 0;
  const k = hard ? HARD_FACTOR : 1;
  const parts: ReadingPart[] = (['tfng', 'mcq', 'gap'] as const).map((p) => {
    const qs = test.questions.filter((q) => q.type === (p as QuestionType));
    const b = PART_BASE[p];
    return {
      id: readingTaskId(test.id, p),
      test,
      part: p,
      hard,
      questions: qs,
      minutes: b.minutes + extra,
      price: Math.round(b.price * k),
      level: hard ? 3 : b.level,
      minSeconds: Math.max(60, qs.length * 20),
    };
  });
  const all: ReadingPart = {
    id: readingTaskId(test.id, 'all'),
    test,
    part: 'all',
    hard,
    questions: test.questions,
    minutes: test.minutes + (hard ? 5 : 3),
    price: parts.reduce((s, p) => s + p.price, 0) + Math.round(ALL_BONUS * k),
    level: 3,
    minSeconds: 240,
  };
  return [...parts, all];
}

export function findReadingPart(id: string): ReadingPart | null {
  const m = id.match(/^r:([a-z0-9-]+):(tfng|mcq|gap|all)$/);
  if (!m) return null;
  const hit = allTests().find((x) => x.t.id === m[1]);
  if (!hit) return null;
  return readingParts(hit.t, hit.hard).find((p) => p.part === m[2]) ?? null;
}

/** Tests in shop order: the regular library first, then the hard ones. */
export function readingCatalog(): { test: ReadingTest; hard: boolean }[] {
  return allTests().map(({ t, hard }) => ({ test: t, hard }));
}

/**
 * Minutes for a Reading part: price × share of right answers, rounded. Below PASS_SHARE — nothing
 * (a retry is offered the next day). Faster than the minimum time — nothing (a guess).
 */
export function readingPay(part: Pick<ReadingPart, 'price' | 'minSeconds'>, correct: number, total: number, seconds: number): { pay: number; passed: boolean; fast: boolean } {
  const share = total ? correct / total : 0;
  const fast = seconds < part.minSeconds;
  const passed = share >= PASS_SHARE;
  return { pay: passed && !fast ? Math.round(part.price * share) : 0, passed, fast };
}

// ---------- The live list ----------

/**
 * open — can be done now; retry — failed before, can be done again now; wait — failed today, again tomorrow;
 * done — paid today (earned shows how much); cap — the daily limit is reached; empty — nothing to do yet.
 */
export type TaskStatus = 'open' | 'retry' | 'wait' | 'done' | 'cap' | 'empty';

export interface ShopTask {
  id: string;
  kind: ShopKind;
  status: TaskStatus;
  /** expected time, minutes */
  minutes: number;
  /** minutes of social media it pays now at most (clamped by what is left of today's limit) */
  price: number;
  level: Level;
  /** earned for it today */
  earned: number;
  /** content title: a passage, a Writing topic, a Speaking card (English) */
  title: string;
  part?: ReadingPartId;
  questions?: number;
  hard?: boolean;
  size?: TaskSize;
  /** words: questions ready; sentences: paid sentences left today */
  left?: number;
}

export interface ShopResponse {
  today: string;
  balance: number;
  earned_today: number;
  daily_cap: number;
  earn_left: number;
  /** a Shortcuts session running right now */
  session: { app: string; seconds_left: number } | null;
  /** the Shortcut has been silent for a day while NextDNS saw social media: the automation looks switched off */
  lock_alert: { since: string } | null;
  tasks: ShopTask[];
  /** the three best tasks right now (ids from `tasks`) */
  top: string[];
}

/** Minutes of social media per minute of work — the "value" of a task. */
export function value(t: Pick<ShopTask, 'price' | 'minutes'>): number {
  return t.minutes ? t.price / t.minutes : 0;
}

/** Suggested tasks fit into a short break: up to this many minutes, when there is such a task. */
export const TOP_MAX_MINUTES = 10;

/**
 * Three tasks to suggest now: one Reading, one quick vocabulary task, one own-English task (Writing or Speaking),
 * each the best value in its group among tasks that take up to TOP_MAX_MINUTES; free slots are filled by the next best.
 */
export function pickTop(tasks: ShopTask[], n = 3): string[] {
  const doable = tasks.filter((t) => (t.status === 'open' || t.status === 'retry') && t.price > 0);
  const byValue = (a: ShopTask, b: ShopTask) => value(b) - value(a) || a.minutes - b.minutes;
  const best = (list: ShopTask[]) => [...list.filter((t) => t.minutes <= TOP_MAX_MINUTES)].sort(byValue)[0] ?? [...list].sort(byValue)[0];
  const picks: ShopTask[] = [];
  const groups: ShopKind[][] = [['reading'], ['words', 'quiz', 'sentence'], ['writing', 'speaking']];
  for (const g of groups) {
    const b = best(doable.filter((t) => g.includes(t.kind)));
    if (b) picks.push(b);
  }
  for (const t of [...doable].sort(byValue)) {
    if (picks.length >= n) break;
    if (!picks.includes(t)) picks.push(t);
  }
  return picks.slice(0, n).map((t) => t.id);
}
