import {
  achievementViews,
  currentRun,
  longestRun,
  newlyReached,
  readingCatalog,
  readingParts,
  type AchievementId,
  type AchievementStats,
  type AchievementView,
  type Payout,
  type ShopKind,
} from '@tracker/shared';
import { walletSettings, type AttemptRow, type Repo, type UserRow } from './db';

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Pay for a finished task. The daily limit (sm_daily_cap) and the bank cap clamp the amount;
 * `kindCap` is the task kind's own daily ceiling (words, sentences). A debt leaves room: earnings pay it back first.
 */
export async function pay(repo: Repo, user: UserRow, today: string, kind: ShopKind, amount: number, note: string, kindCap?: number): Promise<{ paid: number; capped: boolean }> {
  if (amount <= 0) return { paid: 0, capped: false };
  const w = walletSettings(user);
  const [byKind, balance] = await Promise.all([repo.earnedByKind(user.id, today), repo.balance(user.id)]);
  const earned = Object.values(byKind).reduce((s, v) => s + (v ?? 0), 0);
  let room = Math.min(w.daily_earn_cap - earned, w.bank_cap - balance);
  if (kindCap != null) room = Math.min(room, kindCap - (byKind[kind] ?? 0));
  const paid = round1(Math.max(0, Math.min(amount, room)));
  if (paid > 0) await repo.addMinutes(user.id, today, paid, kind, note, w.bank_cap);
  return { paid, capped: paid < amount };
}

/** Parts of a passage that are finished: paid, or the whole passage at once. */
export function passagesDone(attempts: Pick<AttemptRow, 'test_id' | 'earned' | 'counted'>[]): number {
  const paid = new Set(attempts.filter((a) => a.earned > 0 || a.counted).map((a) => a.test_id));
  let n = 0;
  for (const { test, hard } of readingCatalog()) {
    const parts = readingParts(test, hard);
    const whole = parts.find((p) => p.part === 'all')!;
    if (paid.has(whole.id) || parts.filter((p) => p.part !== 'all').every((p) => paid.has(p.id))) n++;
  }
  return n;
}

export async function achievementStats(repo: Repo, user: UserRow): Promise<AchievementStats> {
  const [paid, attempts, counts] = await Promise.all([repo.paidTasks(user.id), repo.readingAttempts(user.id), repo.practiceCounts(user.id)]);
  const byDate = new Map<string, Set<string>>();
  for (const p of paid) {
    if (!byDate.has(p.date)) byDate.set(p.date, new Set());
    byDate.get(p.date)!.add(p.reason === 'reading' ? 'reading' : p.reason === 'words' || p.reason === 'sentence' ? 'vocab' : 'own');
  }
  const passed = attempts.filter((a) => a.earned > 0 || a.counted);
  return {
    paidTasks: paid.reduce((s, p) => s + p.n, 0),
    readingPassed: passed.length,
    readingPerfect: passed.filter((a) => a.correct === a.total).length,
    passages: passagesDone(attempts),
    wordsRight: counts.wordsRight,
    sentences: counts.sentences,
    writings: counts.writings,
    speakings: counts.speakings,
    activeDays: [...byDate.keys()].sort(),
    mixedDays: [...byDate.values()].filter((s) => s.size >= 3).length,
  };
}

export async function achievementsView(repo: Repo, user: UserRow): Promise<{ list: AchievementView[]; stats: AchievementStats }> {
  const [stats, rows] = await Promise.all([achievementStats(repo, user), repo.achievementRows(user.id)]);
  return { list: achievementViews(stats, new Map(rows.map((r) => [r.id, r.date]))), stats };
}

/** Record achievements reached by now and pay their bonus once (bonuses are on top of the daily limit). */
export async function settleAchievements(repo: Repo, user: UserRow, today: string): Promise<AchievementId[]> {
  const [stats, rows] = await Promise.all([achievementStats(repo, user), repo.achievementRows(user.id)]);
  const got: AchievementId[] = [];
  for (const a of newlyReached(stats, new Set(rows.map((r) => r.id)))) {
    if (!(await repo.addAchievement(user.id, a.id, today, a.bonus))) continue;
    await repo.addMinutes(user.id, today, a.bonus, 'achievement', a.id, walletSettings(user).bank_cap);
    got.push(a.id);
  }
  return got;
}

/** Pay, then check achievements: what a finished task brought. */
export async function payout(repo: Repo, user: UserRow, today: string, kind: ShopKind, amount: number, note: string, kindCap?: number): Promise<Payout> {
  const { paid, capped } = await pay(repo, user, today, kind, amount, note, kindCap);
  const achievements = await settleAchievements(repo, user, today);
  return { minutes: paid, capped, achievements, balance: round1(await repo.balance(user.id)) };
}

/** Streak of days with a paid task. */
export async function taskStreak(repo: Repo, user: UserRow, today: string): Promise<{ current: number; best: number }> {
  const days = [...new Set((await repo.paidTasks(user.id)).map((p) => p.date))];
  return { current: currentRun(days, today), best: longestRun(days) };
}
