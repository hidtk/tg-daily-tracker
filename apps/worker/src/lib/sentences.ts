import { SENTENCES_PER_DAY, SENTENCE_MINUTES, VOCAB, checkSentence, vocabById, type SentenceState } from '@tracker/shared';
import { Repo, walletSettings, type UserRow } from './db';

/** Next word to write a sentence for: introduced words first (least recently used), then the rest of the bank. */
export async function nextSentenceWord(repo: Repo, user: UserRow, today: string) {
  const progress = await repo.vocabAll(user.id);
  const stageById = new Map(progress.map((r) => [r.word_id, r.stage]));
  const last = await repo.sentenceLastDates(user.id);
  const candidates = VOCAB.filter((w) => last.get(w.id) !== today);
  if (!candidates.length) return null;
  const score = (id: number) => (stageById.has(id) ? 0 : 1000) + (last.has(id) ? Number(last.get(id)!.replace(/-/g, '')) % 100000 : 0);
  candidates.sort((a, b) => score(a.id) - score(b.id) || a.id - b.id);
  const w = candidates[0];
  return { ...w, stage: stageById.get(w.id) ?? null };
}

export async function sentenceState(repo: Repo, user: UserRow, today: string): Promise<SentenceState> {
  const count = await repo.sentencesOn(user.id, today);
  const recent = (await repo.recentSentences(user.id)).map((r) => ({ word: vocabById(r.word_id)?.word ?? '?', text: r.text, date: r.date }));
  return {
    today,
    count,
    cap: SENTENCES_PER_DAY,
    balance: Math.floor(await repo.balance(user.id)),
    next: count >= SENTENCES_PER_DAY ? null : await nextSentenceWord(repo, user, today),
    recent,
  };
}

export async function submitSentence(repo: Repo, user: UserRow, today: string, wordId: number, text: string): Promise<{ ok: boolean; reason?: string; earned: number; state: SentenceState }> {
  const w = vocabById(wordId);
  if (!w) return { ok: false, reason: 'unknown', earned: 0, state: await sentenceState(repo, user, today) };
  const count = await repo.sentencesOn(user.id, today);
  if (count >= SENTENCES_PER_DAY) return { ok: false, reason: 'cap', earned: 0, state: await sentenceState(repo, user, today) };
  if (await repo.sentenceExists(user.id, wordId, today)) return { ok: false, reason: 'done_today', earned: 0, state: await sentenceState(repo, user, today) };
  const check = checkSentence(w.word, w.example, text);
  if (!check.ok) return { ok: false, reason: check.reason, earned: 0, state: await sentenceState(repo, user, today) };
  await repo.addSentence(user.id, wordId, today, text.trim());
  const ws = walletSettings(user);
  // Sentences have their own daily cap; only the bank cap applies here.
  await repo.addMinutes(user.id, today, SENTENCE_MINUTES, 'sentence', w.word, ws.bank_cap);
  return { ok: true, earned: SENTENCE_MINUTES, state: await sentenceState(repo, user, today) };
}
