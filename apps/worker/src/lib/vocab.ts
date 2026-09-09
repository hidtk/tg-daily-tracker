import { REVIEW_INTERVALS, VOCAB, addDays, vocabById, type VocabCard, type VocabResponse } from '@tracker/shared';
import type { Repo, UserRow, VocabRow } from './db';

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
  const due = await repo.vocabDue(user.id, today);
  return { newWords, due };
}

export async function vocabState(repo: Repo, user: UserRow, today: string): Promise<VocabResponse> {
  const { newWords, due } = await vocabToday(repo, user, today);
  const all = await repo.vocabAll(user.id);
  const history = await repo.vocabHistory(user.id, addDays(today, -13));
  return {
    today,
    per_day: user.vocab_per_day ?? 5,
    new_words: newWords.map(toCard).filter((c): c is VocabCard => !!c),
    due: due.map(toCard).filter((c): c is VocabCard => !!c),
    learned: all.length,
    mastered: all.filter((r) => r.stage >= REVIEW_INTERVALS.length).length,
    total: VOCAB.length,
    history,
  };
}

/** Leitner step: success moves one interval up, failure drops back to the start and is due tomorrow. */
export async function reviewWord(repo: Repo, user: UserRow, wordId: number, ok: boolean, today: string): Promise<VocabCard | null> {
  const row = await repo.vocabGet(user.id, wordId);
  if (!row) return null;
  // Introduction already used the first interval (1 day), so stage s waits REVIEW_INTERVALS[s] days: 3, 7, 14, 30, then 30 again.
  const stage = ok ? Math.min(row.stage + 1, REVIEW_INTERVALS.length) : 0;
  const interval = ok ? REVIEW_INTERVALS[stage] ?? REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1] : 1;
  const next = addDays(today, interval);
  await repo.vocabRecordReview(user.id, wordId, ok, today, stage, next);
  return toCard({ ...row, stage, next_review: next, reviews: row.reviews + 1, lapses: row.lapses + (ok ? 0 : 1), last_reviewed: today });
}
