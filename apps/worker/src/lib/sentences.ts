import { syncDaySafe } from './autolog';
import {
  SENTENCES_PER_DAY,
  SENTENCE_PAY,
  VOCAB,
  checkSentence,
  vocabById,
  type Criterion,
  type JudgeKind,
  type JudgeVerdict,
  type SentenceResult,
  type SentenceState,
} from '@tracker/shared';
import type { Env } from '../env';
import { Repo, type SentenceRow, type UserRow } from './db';
import { judgeKind, sentenceJudge, verdictAccepts, type SentenceJudge } from './judge';
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

/** Minutes a sentence pays: only when a model checks the meaning. */
export function sentencePay(kind: JudgeKind): number {
  return kind === 'none' ? 0 : SENTENCE_PAY;
}

function reasonOf(r: SentenceRow): string | null {
  if (!r.verdict) return null;
  try {
    return (JSON.parse(r.verdict) as JudgeVerdict).reason_ru || null;
  } catch {
    return null;
  }
}

export async function sentenceState(repo: Repo, user: UserRow, today: string, kind: JudgeKind): Promise<SentenceState> {
  const [count, rows] = await Promise.all([repo.sentencesOn(user.id, today), repo.sentencesToday(user.id, today)]);
  return {
    today,
    count,
    per_day: SENTENCES_PER_DAY,
    next: count >= SENTENCES_PER_DAY ? null : await nextSentenceWord(repo, user, today),
    judge: kind,
    pay: sentencePay(kind),
    recent: rows.slice(0, 5).map((r) => ({ word: vocabById(r.word_id)?.word ?? '', text: r.text, status: r.status, reason: reasonOf(r) })),
  };
}

const aiCriterion = (ok: boolean): Criterion => ({ id: 'meaning_ai', ok });

/**
 * A sentence with the word. The rules go first (length 6–25 words, not a word list, not stuffed with bank words,
 * not the example or an earlier sentence). Then:
 *   no model configured — kept as practice, no minutes;
 *   the model says it makes sense and uses the word right — SENTENCE_PAY (SENTENCES_PER_DAY a day);
 *   the model says no — not kept, the reason is shown, another try is allowed;
 *   the model is unavailable (down, or its daily ceiling is reached) — nothing paid now, the sentence waits and the
 *   cron asks again (fail closed).
 * A sentence counts for one word only, however many bank words it has.
 */
export async function submitSentence(repo: Repo, user: UserRow, today: string, wordId: number, text: string, judge: SentenceJudge | null): Promise<SentenceResult> {
  const kind: JudgeKind = judge?.kind ?? 'none';
  const w = vocabById(wordId);
  const state = () => sentenceState(repo, user, today, kind);
  const out = async (r: Omit<SentenceResult, 'state'>): Promise<SentenceResult> => ({ ...r, state: await state() });
  if (!w || (await repo.sentencesOn(user.id, today)) >= SENTENCES_PER_DAY) return out({ ok: false, blocked: 'limit', status: null, check: null, verdict: null, payout: null });
  if (await repo.sentenceExists(user.id, wordId, today)) return out({ ok: false, blocked: 'done_today', status: null, check: null, verdict: null, payout: null });
  const clean = text.trim().replace(/\s+/g, ' ');
  const check = checkSentence({ word: w.word, example: w.example, text: clean, previous: await repo.recentSentenceTexts(user.id) });
  if (!check.ok) return out({ ok: false, blocked: null, status: null, check, verdict: null, payout: null });

  if (!judge) {
    await repo.addSentence(user.id, wordId, today, clean, 'practice');
    await syncDaySafe(repo, user, today);
    return out({ ok: true, blocked: null, status: 'practice', check, verdict: null, payout: null });
  }

  const verdict = await judge.judge({ word: w.word, meaning: w.meaning, text: clean });
  if (verdict === 'unavailable') {
    await repo.addSentence(user.id, wordId, today, clean, 'pending');
    await syncDaySafe(repo, user, today);
    return out({ ok: false, blocked: null, status: 'pending', check, verdict: null, payout: null });
  }
  const accepted = verdictAccepts(verdict);
  const full = { ...check, ok: accepted, criteria: [...check.criteria, aiCriterion(accepted)] };
  if (!accepted) return out({ ok: false, blocked: null, status: null, check: full, verdict, payout: null });
  const id = await repo.addSentence(user.id, wordId, today, clean, 'accepted', verdict);
  await syncDaySafe(repo, user, today);
  const p = await payout(repo, user, today, 'sentence', SENTENCE_PAY, `sentence:${id}`, SENTENCES_PER_DAY * SENTENCE_PAY);
  return out({ ok: true, blocked: null, status: 'accepted', check: full, verdict, payout: p });
}

/** Give up on a waiting sentence after this many unanswered checks (it stays unpaid). */
const MAX_TRIES = 48;

/**
 * Cron: ask the model again about sentences that waited because it was unavailable. Accepted ones are paid on the
 * day they were written (that day's limits apply), rejected ones free their place. No model now — they keep waiting.
 */
export async function recheckPending(env: Env, now = new Date()): Promise<{ accepted: number; rejected: number; waiting: number }> {
  const repo = new Repo(env.DB);
  const judge = sentenceJudge(env, repo, now);
  const counts = { accepted: 0, rejected: 0, waiting: 0 };
  if (!judge) return counts;
  for (const r of await repo.pendingSentences()) {
    const w = vocabById(r.word_id);
    const user = await repo.getUserById(r.user_id);
    if (!w || !user) continue;
    if (r.tries >= MAX_TRIES) {
      await repo.settleSentence(r.id, 'rejected', { ok: false, grammar: 0, meaning: 0, uses_word_correctly: false, reason_ru: 'Проверка так и не прошла — предложение не оплачено. Напиши новое.' });
      counts.rejected++;
      continue;
    }
    const verdict = await judge.judge({ word: w.word, meaning: w.meaning, text: r.text });
    if (verdict === 'unavailable') {
      await repo.sentenceTried(r.id);
      counts.waiting++;
      // The ceiling or an outage hits every sentence alike: stop for this run.
      break;
    }
    const ok = verdictAccepts(verdict);
    if (!(await repo.settleSentence(r.id, ok ? 'accepted' : 'rejected', verdict))) continue;
    if (ok) {
      await payout(repo, user, r.date, 'sentence', SENTENCE_PAY, `sentence:${r.id}`, SENTENCES_PER_DAY * SENTENCE_PAY);
      counts.accepted++;
    } else counts.rejected++;
  }
  return counts;
}

export { judgeKind };
