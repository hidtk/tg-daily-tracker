import {
  QUIZ_MIN_SECONDS,
  QUIZ_PASS,
  QUIZ_PAY,
  QUIZ_SETS_PER_DAY,
  QUIZ_SIZE,
  VOCAB,
  clozeFor,
  vocabById,
  type QuizQuestion,
  type QuizResult,
  type QuizState,
  type VocabWord,
} from '@tracker/shared';
import type { QuizSetRow, Repo, UserRow } from './db';
import { syncDaySafe } from './autolog';
import { payout } from './wallet';

/**
 * «Быстрый тест»: QUIZ_SIZE multiple-choice questions on the words — the bank example with a gap (choose the word),
 * or a word (choose its meaning). The key stays on the server; a set is answered once. Nothing to game: the answer
 * is either the right option or not.
 */

/** A stored question: the word, the kind and the options as word ids (the answer is the word itself). */
interface Stored {
  word_id: number;
  kind: 'cloze' | 'meaning';
  options: number[];
}

/** Small seeded generator, so a set can be rebuilt the same way in tests. */
function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  };
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function seedOf(userId: number, date: string, n: number): number {
  let h = 2166136261;
  for (const c of `${userId}|${date}|${n}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Words to ask: learned ones first (the Words task introduced them), then the start of the bank. */
async function pool(repo: Repo, user: UserRow, today: string): Promise<VocabWord[]> {
  const learned = (await repo.vocabAll(user.id)).filter((r) => r.introduced_on <= today).map((r) => vocabById(r.word_id)).filter((w): w is VocabWord => !!w);
  if (learned.length >= QUIZ_SIZE * 2) return learned;
  const ids = new Set(learned.map((w) => w.id));
  return [...learned, ...VOCAB.filter((w) => !ids.has(w.id)).slice(0, QUIZ_SIZE * 4 - learned.length)];
}

export function buildSet(words: VocabWord[], seed: number): Stored[] {
  const rand = rng(seed);
  const picked = shuffle(words, rand).slice(0, QUIZ_SIZE);
  return picked.map((w, i) => {
    const kind: Stored['kind'] = i % 2 === 0 && clozeFor(w) ? 'cloze' : 'meaning';
    // Distractors: other words, the same part of speech first, so the grammar of the gap doesn't give it away.
    const others = shuffle(VOCAB.filter((x) => x.id !== w.id && x.ru !== w.ru), rand);
    const same = others.filter((x) => x.pos === w.pos);
    const distract = [...same, ...others.filter((x) => x.pos !== w.pos)].slice(0, 3);
    return { word_id: w.id, kind, options: shuffle([w.id, ...distract.map((x) => x.id)], rand) };
  });
}

export function showQuestion(q: Stored): QuizQuestion {
  const w = vocabById(q.word_id)!;
  if (q.kind === 'cloze') return { kind: 'cloze', prompt: clozeFor(w)!.sentence, options: q.options.map((id) => vocabById(id)!.word) };
  return { kind: 'meaning', prompt: w.word, options: q.options.map((id) => vocabById(id)!.ru) };
}

const parse = (row: QuizSetRow): Stored[] => JSON.parse(row.questions) as Stored[];

export async function quizState(repo: Repo, user: UserRow, today: string): Promise<QuizState> {
  let sets = await repo.quizSetsOn(user.id, today);
  let open = sets.find((s) => !s.submitted_at) ?? null;
  if (!open && sets.length < QUIZ_SETS_PER_DAY) {
    const n = sets.length + 1;
    await repo.createQuizSet(user.id, today, n, JSON.stringify(buildSet(await pool(repo, user, today), seedOf(user.id, today, n))));
    sets = await repo.quizSetsOn(user.id, today);
    open = sets.find((s) => !s.submitted_at) ?? null;
  }
  return {
    today,
    set: open ? { id: open.id, n: open.n, questions: parse(open).map(showQuestion) } : null,
    done_today: sets.filter((s) => s.submitted_at).length,
    per_day: QUIZ_SETS_PER_DAY,
    pay: QUIZ_PAY,
    pass: QUIZ_PASS,
  };
}

export type QuizError = 'not_found' | 'already';

/** Check a set by the key: QUIZ_PASS+ right pays QUIZ_PAY, unless it was answered faster than a person can read. */
export async function submitQuiz(repo: Repo, user: UserRow, today: string, id: number, answers: number[], now = new Date()): Promise<QuizResult | QuizError> {
  const row = await repo.quizSet(user.id, id);
  if (!row) return 'not_found';
  const qs = parse(row);
  const right = qs.map((q) => q.options.indexOf(q.word_id));
  const correct = right.filter((r, i) => answers[i] === r).length;
  if (!(await repo.finishQuizSet(row.id, correct))) return 'already';
  const seconds = (now.getTime() - Date.parse(row.started_at)) / 1000;
  const fast = seconds < QUIZ_MIN_SECONDS * qs.length;
  const passed = correct >= QUIZ_PASS;
  const p = await payout(repo, user, row.date, 'quiz', passed && !fast ? QUIZ_PAY : 0, `quiz:${row.date}:${row.n}`, QUIZ_SETS_PER_DAY * QUIZ_PAY);
  if (p.minutes > 0) await repo.setQuizPaid(row.id, p.minutes);
  await syncDaySafe(repo, user, today);
  return { correct, total: qs.length, passed, fast, right, payout: p, state: await quizState(repo, user, today) };
}
