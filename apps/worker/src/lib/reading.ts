import {
  bandForTest,
  findReadingPart,
  isCorrect,
  paragraphHint,
  readingCatalog,
  readingParts,
  readingPay,
  type ReadingPart,
  type ReadingResult,
  type ReadingSubmit,
  type ReadingTask,
} from '@tracker/shared';
import { syncDaySafe } from './autolog';
import type { AttemptRow, Repo, UserRow } from './db';
import { HttpError } from './http';
import { payout } from './wallet';

/** Where a Reading part stands for this user. */
export type PartState = { status: 'open' | 'retry' | 'wait' | 'paid' | 'blocked'; paidOn: string | null; earned: number };

/**
 * A part pays once. A failed (or rushed) try can be repeated from the next day. The whole passage and its parts
 * exclude each other: once one way was started, the other is not offered.
 */
export function partState(part: ReadingPart, attempts: AttemptRow[], today: string): PartState {
  const all = readingParts(part.test, part.hard);
  const tried = (id: string) => attempts.filter((a) => a.test_id === id);
  const mine = tried(part.id);
  const paid = mine.find((a) => a.earned > 0 || a.counted);
  if (paid) return { status: 'paid', paidOn: paid.date, earned: paid.earned };
  const others = part.part === 'all' ? all.filter((p) => p.part !== 'all') : all.filter((p) => p.part === 'all');
  if (others.some((p) => tried(p.id).length)) return { status: 'blocked', paidOn: null, earned: 0 };
  if (!mine.length) return { status: 'open', paidOn: null, earned: 0 };
  return { status: mine.some((a) => a.date === today) ? 'wait' : 'retry', paidOn: null, earned: 0 };
}

/** A passage is finished when its whole-passage task or all three parts paid. */
export function passageFinished(test: ReadingPart['test'], hard: boolean, attempts: AttemptRow[], today: string): boolean {
  const parts = readingParts(test, hard);
  const st = (p: ReadingPart) => partState(p, attempts, today).status;
  const whole = parts.find((p) => p.part === 'all')!;
  return st(whole) === 'paid' || parts.filter((p) => p.part !== 'all').every((p) => st(p) === 'paid');
}

/** Passages on offer: the next regular one and the next hard one that are not finished. */
export function passagesOnOffer(attempts: AttemptRow[], today: string) {
  const open = readingCatalog().filter(({ test, hard }) => !passageFinished(test, hard, attempts, today));
  return [...open.filter((x) => !x.hard).slice(0, 1), ...open.filter((x) => x.hard).slice(0, 1)];
}

/** The part as the app sees it — no answers, no explanations. */
export function readingTaskView(part: ReadingPart): ReadingTask {
  return {
    id: part.id,
    title: part.test.title,
    topic: part.test.topic,
    hard: part.hard,
    part: part.part,
    paragraphs: part.test.paragraphs,
    questions: part.questions.map((q) => ({ n: q.n, type: q.type, prompt: q.prompt, options: q.options })),
    minutes: part.minutes,
    price: part.price,
    min_seconds: part.minSeconds,
  };
}

export async function readingTask(repo: Repo, user: UserRow, today: string, id: string): Promise<ReadingTask> {
  const part = findReadingPart(id);
  if (!part) throw new HttpError(404, 'Unknown task');
  const st = partState(part, await repo.readingAttempts(user.id), today);
  if (st.status === 'paid') throw new HttpError(409, 'This task is already done');
  if (st.status === 'blocked') throw new HttpError(409, 'This passage is already being done another way');
  if (st.status === 'wait') throw new HttpError(429, 'Try this task again tomorrow');
  return readingTaskView(part);
}

/**
 * Check a Reading part: pay price × share right (50%+ and not rushed). A passed part shows every right answer;
 * a failed one shows only which answers were wrong and the paragraph to look at, so tomorrow's retry is real work.
 */
export async function submitReading(repo: Repo, user: UserRow, today: string, body: ReadingSubmit): Promise<ReadingResult> {
  const part = findReadingPart(body.task_id);
  if (!part) throw new HttpError(404, 'Unknown task');
  const st = partState(part, await repo.readingAttempts(user.id), today);
  if (st.status === 'paid') throw new HttpError(409, 'This task is already done');
  if (st.status === 'blocked') throw new HttpError(409, 'This passage is already being done another way');
  if (st.status === 'wait') throw new HttpError(429, 'Try this task again tomorrow');

  let correct = 0;
  const wrong: ReadingResult['wrong'] = [];
  part.questions.forEach((q, i) => {
    const given = body.answers[i] ?? '';
    if (isCorrect(q, given)) correct++;
    else wrong.push({ n: q.n, given, answer: q.answer, explain: q.explain, hint: paragraphHint(q.explain) });
  });
  const total = part.questions.length;
  const r = readingPay(part, correct, total, body.seconds);

  // Counted = the part is done for good (even if today's limit left nothing to pay).
  const id = await repo.addAttempt(user.id, { test_id: part.id, date: today, correct, total, band: bandForTest(correct, total), seconds: body.seconds, earned: 0, counted: r.passed && !r.fast });
  await syncDaySafe(repo, user, today);
  const p = await payout(repo, user, today, 'reading', r.pay, part.id);
  if (p.minutes > 0) await repo.setAttemptEarned(id, p.minutes);

  return {
    correct,
    total,
    price: part.price,
    passed: r.passed && !r.fast,
    fast: r.fast,
    payout: p,
    wrong: r.passed && !r.fast ? wrong : wrong.map((x) => ({ ...x, answer: null, explain: null })),
  };
}
