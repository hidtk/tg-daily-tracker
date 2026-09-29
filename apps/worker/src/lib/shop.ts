import {
  SENTENCES_PER_DAY,
  SENTENCE_PAY,
  SPEAKING_TASKS,
  WORDS_PAID_PER_DAY,
  WORD_PAY,
  WRITING_TASKS,
  pickTop,
  readingParts,
  findReadingPart,
  type ShopResponse,
  type ShopTask,
  type TaskSize,
} from '@tracker/shared';
import { walletSettings, type Repo, type UserRow } from './db';
import { partState, passagesOnOffer } from './reading';
import { reviewQueue } from './vocab';
import { speakingCard, speakingTaskId, writingTaskId, writingTopic } from './tasks';
import { secondsLeft } from '../api/gate';

const round1 = (n: number) => Math.round(n * 10) / 10;
const SIZES: TaskSize[] = ['short', 'long'];

/**
 * The live shop: every task with its price, expected time and difficulty, and whether it can be done now.
 * Prices are clamped by what is left of today's limit; a task paid today moves to "done" with what it earned.
 */
export async function shopState(repo: Repo, user: UserRow, today: string, now = new Date()): Promise<ShopResponse> {
  const w = walletSettings(user);
  const [attempts, byTask, byKind, vocab, sentences, writings, speakings, balance, open] = await Promise.all([
    repo.readingAttempts(user.id),
    repo.earnedByTask(user.id, today),
    repo.earnedByKind(user.id, today),
    repo.vocabAll(user.id),
    repo.sentencesOn(user.id, today),
    repo.tasksOn(user.id, today, 'writing'),
    repo.tasksOn(user.id, today, 'speaking'),
    repo.balance(user.id),
    repo.openSession(user.id),
  ]);
  const earned = round1(Object.values(byKind).reduce((s, v) => s + (v ?? 0), 0));
  const earnLeft = round1(Math.max(0, Math.min(w.daily_earn_cap - earned, w.bank_cap - balance)));
  const tasks: ShopTask[] = [];
  const offer = (t: ShopTask) => {
    if ((t.status === 'open' || t.status === 'retry') && earnLeft <= 0) t.status = 'cap';
    t.price = t.status === 'done' ? t.price : round1(Math.min(t.price, earnLeft || t.price));
    tasks.push(t);
  };

  // Reading: parts of the passages on offer.
  for (const { test, hard } of passagesOnOffer(attempts, today)) {
    for (const part of readingParts(test, hard)) {
      const st = partState(part, attempts, today);
      if (st.status === 'blocked' || st.status === 'paid') continue;
      offer({ id: part.id, kind: 'reading', status: st.status, minutes: part.minutes, price: part.price, level: part.level, earned: 0, title: test.title, part: part.part, questions: part.questions.length, hard });
    }
  }
  // Reading parts finished today (may belong to a passage that is no longer on offer).
  for (const [id, sum] of byTask) {
    const part = findReadingPart(id);
    if (part) tasks.push({ id, kind: 'reading', status: 'done', minutes: part.minutes, price: part.price, level: part.level, earned: sum, title: part.test.title, part: part.part, questions: part.questions.length, hard: part.hard });
  }

  // Words: typed answers, paid up to WORDS_PAID_PER_DAY a day.
  const wordsEarned = byKind.words ?? 0;
  const paidLeft = Math.max(0, WORDS_PAID_PER_DAY - Math.round(wordsEarned / WORD_PAY));
  const questions = reviewQueue(vocab, today).length;
  const n = Math.min(paidLeft, questions);
  offer({
    id: 'words',
    kind: 'words',
    status: paidLeft === 0 ? 'done' : questions === 0 ? 'empty' : 'open',
    minutes: Math.max(2, Math.ceil(n * 0.5)),
    price: paidLeft === 0 ? WORDS_PAID_PER_DAY * WORD_PAY : n * WORD_PAY,
    level: 1,
    earned: wordsEarned,
    title: '',
    left: questions,
  });

  // A sentence with a word.
  const sentLeft = Math.max(0, SENTENCES_PER_DAY - sentences);
  offer({ id: 'sentence', kind: 'sentence', status: sentLeft ? 'open' : 'done', minutes: 2, price: SENTENCE_PAY, level: 1, earned: byKind.sentence ?? 0, title: '', left: sentLeft });

  // Writing and Speaking, a short and a long one each, once a day.
  for (const size of SIZES) {
    const doneW = writings.some((r) => r.task === writingTaskId(size) && r.status === 'accepted');
    const t = WRITING_TASKS[size];
    offer({ id: writingTaskId(size), kind: 'writing', status: doneW ? 'done' : 'open', minutes: t.minutes, price: t.price, level: t.level, earned: byTask.get(writingTaskId(size)) ?? 0, title: writingTopic(user, today, size).title, size });
  }
  for (const size of SIZES) {
    const doneS = speakings.some((r) => r.task === speakingTaskId(size) && r.status === 'accepted');
    const t = SPEAKING_TASKS[size];
    offer({ id: speakingTaskId(size), kind: 'speaking', status: doneS ? 'done' : 'open', minutes: t.minutes, price: t.price, level: t.level, earned: byTask.get(speakingTaskId(size)) ?? 0, title: speakingCard(user, today, size).title, size });
  }

  return {
    today,
    balance: round1(balance),
    earned_today: earned,
    daily_cap: w.daily_earn_cap,
    earn_left: earnLeft,
    session: open ? { app: open.app, seconds_left: Math.max(0, secondsLeft(balance, open, now)) } : null,
    tasks,
    top: pickTop(tasks),
  };
}
