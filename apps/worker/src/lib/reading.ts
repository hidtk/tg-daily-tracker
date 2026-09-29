import {
  BOSSES,
  BOSS_TESTS,
  bandForTest,
  creditForAttempt,
  isCorrect,
  isReadingCounted,
  readingLibrary,
  type ReadingResult,
  type ReadingSubmit,
  type ReadingTest,
} from '@tracker/shared';
import { syncDaySafe } from './autolog';
import { walletSettings, type Repo, type UserRow } from './db';
import { gameState, withReward } from './game';
import { HttpError } from './http';

function grade(test: ReadingTest, answers: string[]) {
  const wrong: ReadingResult['wrong'] = [];
  let correct = 0;
  test.questions.forEach((q, i) => {
    const given = answers[i] ?? '';
    if (isCorrect(q, given)) correct++;
    else wrong.push({ n: q.n, given, answer: q.answer, explain: q.explain });
  });
  return { correct, wrong, band: bandForTest(correct, test.questions.length) };
}

/**
 * Reading test or boss: grade, pay minutes by band, count it for the quest/streak if it was a real try,
 * then settle the day (held minutes and the chest open once Reading is done).
 * Rushed (< READING_MIN_SECONDS) or guessed (< READING_MIN_CORRECT right) attempts earn nothing and don't count.
 */
export async function submitReading(repo: Repo, user: UserRow, today: string, body: ReadingSubmit): Promise<ReadingResult> {
  const bossDef = BOSSES.find((b) => b.id === body.test_id) ?? null;
  const test = bossDef ? BOSS_TESTS.find((t) => t.id === bossDef.id) : readingLibrary(user.reading_batch ?? 1).find((t) => t.id === body.test_id);
  if (!test) throw new HttpError(404, 'Unknown test');

  const rewarded = await repo.rewardedTestIds(user.id);
  let repeat = rewarded.includes(test.id);
  if (bossDef) {
    const state = await gameState(repo, user, today);
    if (state.bosses_beaten.includes(bossDef.id)) throw new HttpError(409, 'This boss is already beaten');
    if (state.level < bossDef.level) throw new HttpError(403, `The boss opens at level ${bossDef.level}`);
    if ((await repo.bossAttempts(user.id)).some((a) => a.test_id === bossDef.id && a.date === today)) throw new HttpError(429, 'One try at the boss per day — come back tomorrow');
    repeat = false; // every daily boss try is a real attempt: the answers are never shown before a win
  }

  const { correct, wrong, band } = grade(test, body.answers);
  const counted = !repeat && isReadingCounted(body.seconds, correct);
  const won = !!bossDef && band >= bossDef.pass;
  const w = walletSettings(user);
  const earnedToday = await repo.earnedOn(user.id, today);
  const balance = await repo.balance(user.id);
  const credit = creditForAttempt({
    band,
    seconds: body.seconds,
    repeat: repeat || !counted,
    earnedToday,
    balance,
    dailyCap: w.daily_earn_cap,
    bankCap: w.bank_cap,
    limitMin: test.minutes + 10,
  });

  const { reward } = await withReward(
    repo,
    user,
    today,
    async () => {
      await repo.addAttempt(user.id, { test_id: test.id, date: today, correct, total: test.questions.length, band, seconds: body.seconds, earned: credit.earned, counted });
      await syncDaySafe(repo, user, today);
      if (credit.earned) await repo.addMinutes(user.id, today, credit.earned, 'reading', test.id, w.bank_cap);
    },
    'unlocked',
  );

  return {
    correct,
    total: test.questions.length,
    band,
    earned: credit.earned,
    base: credit.base,
    halved: credit.halved,
    capped: credit.capped,
    repeat,
    counted,
    balance: await repo.balance(user.id),
    boss: bossDef ? { id: bossDef.id, pass: bossDef.pass, won } : null,
    // A lost boss keeps its secrets: only which questions were wrong, not the right answers.
    wrong: bossDef && !won ? wrong.map((x) => ({ n: x.n, given: x.given, answer: '', explain: '' })) : wrong,
    reward,
  };
}
