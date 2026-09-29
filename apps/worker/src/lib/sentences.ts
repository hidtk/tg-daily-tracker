import { syncDaySafe } from './autolog';
import { SENTENCES_PER_DAY, SENTENCE_PAY, VOCAB, checkSentence, vocabById, type SentenceResult, type SentenceState } from '@tracker/shared';
import type { Repo, UserRow } from './db';
import { payout } from './wallet';

/** Next word to write a sentence for: introduced words first (least recently used), then the rest of the bank. */
export async function nextSentenceWord(repo: Repo, user: UserRow, today: string) {
  const progress = new Set((await repo.vocabAll(user.id)).map((r) => r.word_id));
  const last = await repo.sentenceLastDates(user.id);
  const candidates = VOCAB.filter((w) => last.get(w.id) !== today);
  if (!candidates.length) return null;
  const score = (id: number) => (progress.has(id) ? 0 : 1_000_000) + (last.has(id) ? Number(last.get(id)!.replace(/-/g, '')) % 1_000_000 : 0);
  candidates.sort((a, b) => score(a.id) - score(b.id) || a.id - b.id);
  const w = candidates[0];
  return { id: w.id, word: w.word, ipa: w.ipa, pos: w.pos, meaning: w.meaning, ru: w.ru };
}

export async function sentenceState(repo: Repo, user: UserRow, today: string): Promise<SentenceState> {
  const count = await repo.sentencesOn(user.id, today);
  return { today, count, per_day: SENTENCES_PER_DAY, next: count >= SENTENCES_PER_DAY ? null : await nextSentenceWord(repo, user, today) };
}

/** A sentence with the word: checked by the rubric, accepted ones pay SENTENCE_PAY (SENTENCES_PER_DAY a day). */
export async function submitSentence(repo: Repo, user: UserRow, today: string, wordId: number, text: string): Promise<SentenceResult> {
  const w = vocabById(wordId);
  const blocked = async (b: 'limit' | 'done_today'): Promise<SentenceResult> => ({ ok: false, blocked: b, check: null, state: await sentenceState(repo, user, today), payout: null });
  if (!w || (await repo.sentencesOn(user.id, today)) >= SENTENCES_PER_DAY) return blocked('limit');
  if (await repo.sentenceExists(user.id, wordId, today)) return blocked('done_today');
  const check = checkSentence({ word: w.word, example: w.example, text, previous: await repo.recentSentenceTexts(user.id) });
  if (!check.ok) return { ok: false, blocked: null, check, state: await sentenceState(repo, user, today), payout: null };
  await repo.addSentence(user.id, wordId, today, text.trim());
  await syncDaySafe(repo, user, today);
  const p = await payout(repo, user, today, 'sentence', SENTENCE_PAY, 'sentence', SENTENCES_PER_DAY * SENTENCE_PAY);
  return { ok: true, blocked: null, check, state: await sentenceState(repo, user, today), payout: p };
}
