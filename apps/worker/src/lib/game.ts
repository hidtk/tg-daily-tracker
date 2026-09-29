import {
  BOSSES,
  BOSS_TESTS,
  EARN,
  EMPTY_DAY,
  MAX_LEVEL,
  QUEST_WORDS,
  STAGES,
  addDays,
  computeGameStreak,
  dayXp,
  levelFor,
  nonReadingValue,
  rewardBetween,
  settlePlan,
  stageOf,
  xpToReach,
  type BossView,
  type DayActivity,
  type EarnSource,
  type GameState,
  type Reward,
} from '@tracker/shared';
import { NON_READING_REASONS, walletSettings, type Repo, type UserRow, type VocabRow } from './db';

/**
 * Words the "10 words" quest can ask on `date`: everything learned before that day, minus today's wrong answers
 * (a missed word can't be answered again the same day). Deterministic for past days, so XP never shifts later.
 */
export function wordsTargetOn(date: string, vocab: Pick<VocabRow, 'introduced_on'>[], wrong: number): number {
  const learned = vocab.filter((r) => r.introduced_on < date).length;
  return Math.min(QUEST_WORDS, Math.max(0, learned - wrong));
}

/** First win per boss: boss id → date. */
export function bossWins(attempts: { test_id: string; date: string; band: number }[]): Map<string, string> {
  const wins = new Map<string, string>();
  for (const a of attempts) {
    const b = BOSSES.find((x) => x.id === a.test_id);
    if (b && a.band >= b.pass && !wins.has(b.id)) wins.set(b.id, a.date);
  }
  return wins;
}

/** Pure part of the game state, so it can be tested without a database. */
export function buildGameState(o: {
  today: string;
  days: DayActivity[];
  vocab: Pick<VocabRow, 'introduced_on'>[];
  bossAttempts: { test_id: string; date: string; band: number }[];
  bySource: Partial<Record<EarnSource, number>>;
  balance: number;
  dailyCap: number;
}): GameState {
  const { today } = o;
  const wins = bossWins(o.bossAttempts);
  const days = o.days.map((d) => ({ ...d, bossWins: [...wins.values()].filter((w) => w === d.date).length }));
  if (!days.some((d) => d.date === today)) days.push({ date: today, ...EMPTY_DAY, bossWins: [...wins.values()].filter((w) => w === today).length });

  let xp = 0;
  let todayRes = dayXp(EMPTY_DAY, 0);
  for (const d of days) {
    const r = dayXp(d, wordsTargetOn(d.date, o.vocab, d.wordsWrong));
    xp += r.xp;
    if (d.date === today) todayRes = r;
  }
  const t = days.find((d) => d.date === today)!;
  const beaten = [...wins.keys()];
  const { level, gatedBy } = levelFor(xp, beaten);
  const stage = stageOf(level);

  const next = BOSSES.find((b) => !wins.has(b.id)) ?? null;
  let boss: BossView | null = null;
  if (next) {
    const test = BOSS_TESTS.find((x) => x.id === next.id);
    const mine = o.bossAttempts.filter((a) => a.test_id === next.id);
    boss = {
      ...next,
      title: test?.title ?? next.id,
      topic: test?.topic ?? '',
      minutes: test?.minutes ?? 20,
      unlocked: level >= next.level,
      beaten: false,
      tried_today: mine.some((a) => a.date === today),
      best_band: mine.length ? Math.max(...mine.map((a) => a.band)) : null,
    };
  }

  const readingDates = days.filter((d) => d.readingCounted > 0).map((d) => d.date);
  const doneSet = new Set(readingDates);
  const value = nonReadingValue(t).total;
  const readingDone = t.readingCounted > 0;
  const earned = Object.values(o.bySource).reduce((s, v) => s + (v ?? 0), 0);

  return {
    today,
    xp,
    level,
    level_from: xpToReach(level),
    level_to: level < MAX_LEVEL ? xpToReach(level + 1) : null,
    stage: { index: STAGES.indexOf(stage), ...stage },
    gated: !!gatedBy,
    boss,
    bosses_beaten: beaten,
    streak: computeGameStreak(readingDates, today),
    week: Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i - 6);
      return { date, done: doneSet.has(date) };
    }),
    quests: todayRes.quests,
    chest: { open: todayRes.chest, minutes: EARN.chest, xp: 30 },
    today_xp: todayRes.xp,
    minutes: {
      balance: Math.round(o.balance * 10) / 10,
      earned: Math.round(earned * 10) / 10,
      daily_cap: o.dailyCap,
      held: readingDone ? 0 : Math.max(0, Math.round((value - Math.min(value, EARN.freeWithoutReading)) * 10) / 10),
      reading_done: readingDone,
      free_without_reading: EARN.freeWithoutReading,
      by_source: o.bySource,
    },
  };
}

export async function gameState(repo: Repo, user: UserRow, today: string): Promise<GameState> {
  const [days, vocab, bossAttempts, bySource, balance] = await Promise.all([
    repo.gameDays(user.id),
    repo.vocabAll(user.id),
    repo.bossAttempts(user.id),
    repo.earnedBySource(user.id, today),
    repo.balance(user.id),
  ]);
  return buildGameState({ today, days, vocab, bossAttempts, bySource, balance, dailyCap: walletSettings(user).daily_earn_cap });
}

/**
 * Pay whatever today's non-Reading work is owed (see settlePlan) and the chest when every quest is done.
 * Safe to call after any action: it only ever pays the difference.
 */
export async function settleDay(repo: Repo, user: UserRow, today: string, reason: EarnSource, note: string | null = null): Promise<{ paid: number; chest: number; held: number }> {
  const [state, bySource, chestTaken] = await Promise.all([gameState(repo, user, today), repo.earnedBySource(user.id, today), repo.chestTaken(user.id, today)]);
  const day = (await repo.gameDays(user.id, today))[0] ?? { date: today, ...EMPTY_DAY };
  const w = walletSettings(user);
  const plan = settlePlan({
    value: nonReadingValue(day).total,
    paid: NON_READING_REASONS.reduce((s, r) => s + (bySource[r] ?? 0), 0),
    readingDone: day.readingCounted > 0,
    chestDue: state.chest.open && !chestTaken,
    earnedToday: state.minutes.earned,
    dailyCap: w.daily_earn_cap,
    balance: state.minutes.balance,
    bankCap: w.bank_cap,
  });
  if (plan.pay > 0) await repo.addMinutes(user.id, today, plan.pay, reason, note, w.bank_cap);
  if (state.chest.open && !chestTaken) await repo.openChest(user.id, today, plan.chest, w.bank_cap);
  return { paid: plan.pay, chest: plan.chest, held: plan.held };
}

/** Run an action and report what it brought: XP, minutes, quests, level, chest. */
export async function withReward<T>(repo: Repo, user: UserRow, today: string, action: () => Promise<T>, settle?: EarnSource, note?: string | null): Promise<{ result: T; reward: Reward }> {
  const before = await gameState(repo, user, today);
  const result = await action();
  if (settle) await settleDay(repo, user, today, settle, note ?? null);
  const after = await gameState(repo, user, today);
  return { result, reward: rewardBetween(before, after) };
}
