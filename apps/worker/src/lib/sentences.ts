import { syncDaySafe } from './autolog';
import { SENTENCES_PER_DAY, VOCAB, checkSentence, vocabById, type SentenceResult, type SentenceState } from '@tracker/shared';
import { Repo, type UserRow } from './db';
import { withReward } from './game';

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

/** A sentence with the word: checked by rules, then XP and (for the first few a day) a minute through the daily settle. */
export async function submitSentence(repo: Repo, user: UserRow, today: string, wordId: number, text: string): Promise<SentenceResult> {
  const fail = async (reason: string): Promise<SentenceResult> => ({ ok: false, reason, state: await sentenceState(repo, user, today), reward: null });
  const w = vocabById(wordId);
  if (!w) return fail('unknown');
  if ((await repo.sentencesOn(user.id, today)) >= SENTENCES_PER_DAY) return fail('cap');
  if (await repo.sentenceExists(user.id, wordId, today)) return fail('done_today');
  const check = checkSentence(w.word, w.example, text);
  if (!check.ok) return fail(check.reason ?? 'error');
  const { reward } = await withReward(
    repo,
    user,
    today,
    async () => {
      await repo.addSentence(user.id, wordId, today, text.trim());
      await syncDaySafe(repo, user, today);
    },
    'sentence',
    w.word,
  );
  return { ok: true, state: await sentenceState(repo, user, today), reward };
}
