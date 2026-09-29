import { syncDaySafe } from './autolog';
import {
  REVIEW_INTERVALS,
  VOCAB,
  WORDS_PAID_PER_DAY,
  WORD_PAY,
  addDays,
  checkTyped,
  clozeFor,
  diffDays,
  vocabById,
  wordForms,
  type VocabAnswerResult,
  type VocabCard,
  type VocabQuestion,
  type VocabQuestionKind,
  type VocabResponse,
} from '@tracker/shared';
import type { Repo, UserRow, VocabRow } from './db';
import { payout } from './wallet';

/** Extra (not yet due) words offered after the due ones, so the words task always has something to ask. */
const PRACTICE_LIMIT = 20;

export function toCard(r: VocabRow): VocabCard | null {
  const w = vocabById(r.word_id);
  if (!w) return null;
  return { ...w, stage: r.stage };
}

/** Words for today: introduces the day's batch on first call. */
export async function newWordsToday(repo: Repo, user: UserRow, today: string): Promise<VocabRow[]> {
  const perDay = user.vocab_per_day ?? 5;
  const rows = await repo.vocabIntroducedOn(user.id, today);
  if (rows.length || perDay <= 0) return rows;
  return repo.vocabIntroduce(user.id, today, perDay, VOCAB.length);
}

/** Words that can be asked today: due ones first, then extra practice. New words are asked from the next day. */
export function reviewQueue(all: VocabRow[], today: string): { row: VocabRow; practice: boolean }[] {
  const asked = all.filter((r) => r.introduced_on < today && r.last_reviewed !== today);
  const due = asked.filter((r) => r.next_review <= today).sort((a, b) => a.next_review.localeCompare(b.next_review) || a.word_id - b.word_id);
  const practice = asked
    .filter((r) => r.next_review > today)
    .sort((a, b) => (a.last_reviewed ?? '').localeCompare(b.last_reviewed ?? '') || a.stage - b.stage || a.word_id - b.word_id)
    .slice(0, PRACTICE_LIMIT);
  return [...due.map((row) => ({ row, practice: false })), ...practice.map((row) => ({ row, practice: true }))];
}

/**
 * Question type for a word today: the Russian gloss → type the word, or the example sentence with a blank.
 * Alternates by day and stage, so a word is asked both ways over time. Deterministic: the server can re-derive it.
 */
export function questionKind(row: Pick<VocabRow, 'word_id' | 'stage'>, today: string): VocabQuestionKind {
  const w = vocabById(row.word_id);
  if (!w || !clozeFor(w)) return 'translate';
  return (row.word_id + row.stage + diffDays('2026-01-01', today)) % 2 === 0 ? 'cloze' : 'translate';
}

/** Accepted answers: the headword and its forms (mitigates, mitigated…), and for a cloze the form used in the sentence. */
export function expectedAnswers(row: Pick<VocabRow, 'word_id' | 'stage'>, today: string): { kind: VocabQuestionKind; shown: string; accept: string[] } | null {
  const w = vocabById(row.word_id);
  if (!w) return null;
  const kind = questionKind(row, today);
  const cloze = kind === 'cloze' ? clozeFor(w) : null;
  const forms = wordForms(w.word);
  return cloze ? { kind, shown: cloze.answer, accept: [cloze.answer, ...forms] } : { kind: 'translate', shown: w.word, accept: forms };
}

export function toQuestion(r: VocabRow, today: string): VocabQuestion | null {
  const w = vocabById(r.word_id);
  const exp = expectedAnswers(r, today);
  if (!w || !exp) return null;
  return {
    word_id: r.word_id,
    kind: exp.kind,
    ru: w.ru,
    meaning: w.meaning,
    pos: w.pos,
    sentence: exp.kind === 'cloze' ? clozeFor(w)!.sentence : null,
    letters: exp.shown.length,
    first: exp.shown[0] ?? '',
  };
}

export async function vocabState(repo: Repo, user: UserRow, today: string): Promise<VocabResponse> {
  const newWords = await newWordsToday(repo, user, today);
  const all = await repo.vocabAll(user.id);
  const paidToday = Math.round(((await repo.earnedByKind(user.id, today)).words ?? 0) / WORD_PAY);
  return {
    today,
    new_words: newWords.map(toCard).filter((c): c is VocabCard => !!c),
    queue: reviewQueue(all, today).map((q) => toQuestion(q.row, today)).filter((q): q is VocabQuestion => !!q),
    paid_today: paidToday,
    paid_left: Math.max(0, WORDS_PAID_PER_DAY - paidToday),
    learned: all.length,
    total: VOCAB.length,
  };
}

/**
 * Spaced repetition after a typed answer.
 * Due word: right → one interval up; right with a hint → same stage, again tomorrow; wrong → back to the start, tomorrow.
 * Practice word (not due): right leaves the schedule alone; wrong resets it like a due word.
 */
export function nextSchedule(row: Pick<VocabRow, 'stage' | 'next_review'>, a: { ok: boolean; hint: boolean; practice: boolean }, today: string): { stage: number; next: string } {
  if (!a.ok) return { stage: 0, next: addDays(today, 1) };
  if (a.practice) return { stage: row.stage, next: row.next_review };
  if (a.hint) return { stage: row.stage, next: addDays(today, 1) };
  // Introduction already used the first interval (1 day), so stage s waits REVIEW_INTERVALS[s] days: 3, 7, 14, 30, then 30 again.
  const stage = Math.min(row.stage + 1, REVIEW_INTERVALS.length);
  return { stage, next: addDays(today, REVIEW_INTERVALS[stage] ?? REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1]) };
}

export type AnswerError = 'not_started' | 'new_today' | 'already';

/** Check a typed answer on the server, move the word along its schedule and pay for a right one (no hint). */
export async function answerWord(repo: Repo, user: UserRow, wordId: number, given: string, hint: boolean, today: string): Promise<VocabAnswerResult | AnswerError> {
  const row = await repo.vocabGet(user.id, wordId);
  if (!row) return 'not_started';
  if (row.introduced_on >= today) return 'new_today';
  if (row.last_reviewed === today) return 'already';
  const w = vocabById(wordId)!;
  const exp = expectedAnswers(row, today)!;
  const check = checkTyped(given, exp.accept);
  const a = { ok: check.ok, hint, practice: row.next_review > today, kind: exp.kind };
  const sched = nextSchedule(row, a, today);
  if (!(await repo.vocabRecordReview(user.id, wordId, a, today, sched.stage, sched.next))) return 'already';
  await syncDaySafe(repo, user, today);
  const p = await payout(repo, user, today, 'words', check.ok && !hint ? WORD_PAY : 0, 'words', WORDS_PAID_PER_DAY * WORD_PAY);
  return { ok: check.ok, typo: check.ok && !check.exact, answer: exp.shown, word: w.word, ru: w.ru, meaning: w.meaning, example: w.example, payout: p };
}
