import { syncDaySafe } from './autolog';
import {
  REVIEW_INTERVALS,
  VOCAB,
  addDays,
  checkTyped,
  clozeFor,
  diffDays,
  vocabById,
  type VocabAnswerResult,
  type VocabCard,
  type VocabQuestion,
  type VocabQuestionKind,
  type VocabResponse,
} from '@tracker/shared';
import type { Repo, UserRow, VocabRow } from './db';
import { wordsTargetOn, withReward } from './game';

/** Extra (not yet due) words offered after the due ones, so the daily "10 words" quest is always reachable. */
const PRACTICE_LIMIT = 20;

export function toCard(r: VocabRow): VocabCard | null {
  const w = vocabById(r.word_id);
  if (!w) return null;
  return { ...w, stage: r.stage, introduced_on: r.introduced_on, next_review: r.next_review, reviews: r.reviews, lapses: r.lapses };
}

/** Words for today: introduces the day's batch on first call, then returns it plus everything due. */
export async function vocabToday(repo: Repo, user: UserRow, today: string): Promise<{ newWords: VocabRow[]; due: VocabRow[] }> {
  const perDay = user.vocab_per_day ?? 5;
  let newWords = await repo.vocabIntroducedOn(user.id, today);
  if (!newWords.length && perDay > 0) newWords = await repo.vocabIntroduce(user.id, today, perDay, VOCAB.length);
  const due = (await repo.vocabDue(user.id, today)).filter((r) => r.last_reviewed !== today);
  return { newWords, due };
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

/** Accepted answers for a word: the headword, and for a cloze also the form used in the sentence. */
export function expectedAnswers(row: Pick<VocabRow, 'word_id' | 'stage'>, today: string): { kind: VocabQuestionKind; shown: string; accept: string[] } | null {
  const w = vocabById(row.word_id);
  if (!w) return null;
  const kind = questionKind(row, today);
  const cloze = kind === 'cloze' ? clozeFor(w) : null;
  return cloze ? { kind, shown: cloze.answer, accept: [cloze.answer, w.word] } : { kind: 'translate', shown: w.word, accept: [w.word] };
}

export function toQuestion(r: VocabRow, today: string, practice: boolean): VocabQuestion | null {
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
    practice,
    stage: r.stage,
  };
}

export async function vocabState(repo: Repo, user: UserRow, today: string): Promise<VocabResponse> {
  const { newWords, due } = await vocabToday(repo, user, today);
  const all = await repo.vocabAll(user.id);
  const dueIds = new Set(due.map((r) => r.word_id));
  const practice = all
    .filter((r) => r.introduced_on < today && r.last_reviewed !== today && !dueIds.has(r.word_id))
    .sort((a, b) => (a.last_reviewed ?? '').localeCompare(b.last_reviewed ?? '') || a.stage - b.stage || a.word_id - b.word_id)
    .slice(0, PRACTICE_LIMIT);
  const history = await repo.vocabHistory(user.id, addDays(today, -13));
  const day = (await repo.gameDays(user.id, today))[0];
  const answered = (day?.wordsOk ?? 0) + (day?.wordsHint ?? 0) + (day?.wordsWrong ?? 0);
  return {
    today,
    per_day: user.vocab_per_day ?? 5,
    new_words: newWords.map(toCard).filter((c): c is VocabCard => !!c),
    queue: [...due.map((r) => toQuestion(r, today, false)), ...practice.map((r) => toQuestion(r, today, true))].filter((q): q is VocabQuestion => !!q),
    due_count: due.length,
    answered_today: answered,
    correct_today: (day?.wordsOk ?? 0) + (day?.wordsHint ?? 0),
    words_target: wordsTargetOn(today, all, day?.wordsWrong ?? 0),
    learned: all.length,
    mastered: all.filter((r) => r.stage >= REVIEW_INTERVALS.length).length,
    total: VOCAB.length,
    history,
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

/** Check a typed answer on the server, move the word along its schedule and pay XP/minutes for a right one. */
export async function answerWord(repo: Repo, user: UserRow, wordId: number, given: string, hint: boolean, today: string): Promise<VocabAnswerResult | AnswerError> {
  const row = await repo.vocabGet(user.id, wordId);
  if (!row) return 'not_started';
  if (row.introduced_on >= today) return 'new_today';
  if (row.last_reviewed === today) return 'already';
  const w = vocabById(wordId)!;
  const exp = expectedAnswers(row, today)!;
  const check = checkTyped(given, exp.accept);
  const practice = row.next_review > today;
  const a = { ok: check.ok, hint, practice, kind: exp.kind };
  const sched = nextSchedule(row, a, today);
  let recorded = false;
  const { reward } = await withReward(
    repo,
    user,
    today,
    async () => {
      recorded = await repo.vocabRecordReview(user.id, wordId, a, today, sched.stage, sched.next);
      if (recorded) await syncDaySafe(repo, user, today);
    },
    'words',
    w.word,
  );
  if (!recorded) return 'already';
  return { ok: check.ok, typo: check.ok && !check.exact, answer: exp.shown, word: w.word, ru: w.ru, meaning: w.meaning, example: w.example, stage: sched.stage, next_review: sched.next, reward };
}

