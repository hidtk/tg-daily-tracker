import {
  EARN,
  SPEAKING_MIN_SECONDS,
  WRITING_MIN_SECONDS,
  WRITING_MIN_VOCAB,
  WRITING_MIN_WORDS,
  WRITING_VOCAB_DAYS,
  addDays,
  countWords,
  isEnglish,
  overlap,
  speakingCardById,
  speakingCardFor,
  vocabById,
  vocabUsed,
  writingTopicById,
  writingTopicFor,
  type Reward,
  type SpeakingState,
  type WritingResult,
  type WritingState,
} from '@tracker/shared';
import { syncDaySafe } from './autolog';
import type { Repo, UserRow } from './db';
import { withReward } from './game';

// ---------- Writing ----------

/** Words learned recently (last WRITING_VOCAB_DAYS days; if that's thin, the latest ones overall). */
export async function recentVocab(repo: Repo, user: UserRow, today: string) {
  const rows = (await repo.vocabAll(user.id)).filter((r) => r.introduced_on <= today);
  const from = addDays(today, -WRITING_VOCAB_DAYS);
  let pick = rows.filter((r) => r.introduced_on >= from);
  if (pick.length < 10) pick = [...rows].sort((a, b) => b.introduced_on.localeCompare(a.introduced_on) || b.word_id - a.word_id).slice(0, 10);
  return pick
    .map((r) => vocabById(r.word_id))
    .filter((w): w is NonNullable<typeof w> => !!w)
    .map((w) => ({ id: w.id, word: w.word, ru: w.ru }));
}

export async function writingState(repo: Repo, user: UserRow, today: string): Promise<WritingState> {
  const rows = await repo.tasksOn(user.id, today, 'writing');
  const accepted = rows.find((r) => r.status === 'accepted');
  const started = [...rows].reverse().find((r) => r.status === 'started');
  const topic = writingTopicById((accepted ?? started)?.topic ?? '') ?? writingTopicFor(user.tg_id, today);
  return {
    today,
    topic,
    vocab: await recentVocab(repo, user, today),
    started_at: started?.started_at ?? accepted?.started_at ?? null,
    done: accepted ? { words: accepted.words, vocab: accepted.vocab ? (JSON.parse(accepted.vocab) as string[]) : [], text: accepted.text ?? '' } : null,
    min_words: WRITING_MIN_WORDS,
    min_vocab: WRITING_MIN_VOCAB,
    min_seconds: WRITING_MIN_SECONDS,
  };
}

/** Start the clock for today's text (the server keeps the start time, so the minimum time can be checked). */
export async function startWriting(repo: Repo, user: UserRow, today: string): Promise<WritingState> {
  const rows = await repo.tasksOn(user.id, today, 'writing');
  if (!rows.some((r) => r.status === 'accepted') && !rows.some((r) => r.status === 'started')) {
    await repo.startTask(user.id, today, 'writing', writingTopicFor(user.tg_id, today).id);
  }
  return writingState(repo, user, today);
}

/** Pure checks for a Writing text. */
export function checkWriting(o: { text: string; seconds: number; vocab: { id: number; word: string }[]; previous: string[] }): { reasons: WritingResult['reasons']; words: number; used: string[] } {
  const words = countWords(o.text);
  const ids = vocabUsed(o.text, o.vocab);
  const used = o.vocab.filter((w) => ids.includes(w.id)).map((w) => w.word);
  const reasons: WritingResult['reasons'] = [];
  if (words < WRITING_MIN_WORDS) reasons.push('short');
  if (used.length < WRITING_MIN_VOCAB) reasons.push('vocab');
  if (!isEnglish(o.text)) reasons.push('language');
  if (o.seconds < WRITING_MIN_SECONDS) reasons.push('fast');
  if (o.previous.some((p) => overlap(p, o.text) > 0.6)) reasons.push('repeat');
  return { reasons, words, used };
}

export async function submitWriting(repo: Repo, user: UserRow, today: string, text: string, now = new Date()): Promise<WritingResult> {
  const rows = await repo.tasksOn(user.id, today, 'writing');
  const started = [...rows].reverse().find((r) => r.status === 'started');
  const base = { words: countWords(text), vocab_used: [] as string[], seconds: 0, reward: null as Reward | null };
  if (rows.some((r) => r.status === 'accepted')) return { ok: false, reasons: ['done_today'], ...base, state: await writingState(repo, user, today) };
  if (!started) return { ok: false, reasons: ['not_started'], ...base, state: await writingState(repo, user, today) };
  const seconds = Math.max(0, Math.round((now.getTime() - Date.parse(started.started_at)) / 1000));
  const vocab = await recentVocab(repo, user, today);
  const check = checkWriting({ text, seconds, vocab, previous: await repo.recentWritings(user.id) });
  if (check.reasons.length) return { ok: false, reasons: check.reasons, words: check.words, vocab_used: check.used, seconds, reward: null, state: await writingState(repo, user, today) };
  let accepted = false;
  const { reward } = await withReward(
    repo,
    user,
    today,
    async () => {
      accepted = await repo.acceptWriting(started.id, text.trim(), check.words, check.used, seconds);
      if (accepted) await syncDaySafe(repo, user, today);
    },
    'writing',
    writingTopicById(started.topic)?.title ?? null,
  );
  if (!accepted) return { ok: false, reasons: ['done_today'], words: check.words, vocab_used: check.used, seconds, reward: null, state: await writingState(repo, user, today) };
  return { ok: true, reasons: [], words: check.words, vocab_used: check.used, seconds, reward, state: await writingState(repo, user, today) };
}

// ---------- Speaking ----------

export async function speakingState(repo: Repo, user: UserRow, today: string, botUsername: string): Promise<SpeakingState> {
  const done = (await repo.tasksOn(user.id, today, 'speaking')).filter((r) => r.status === 'accepted');
  const card = done.length < EARN.speakingPerDay ? speakingCardFor(user.tg_id, today, done.length) : null;
  return {
    today,
    card,
    done_today: done.map((r) => ({ card: speakingCardById(r.topic)?.title ?? r.topic, seconds: r.seconds })),
    per_day: EARN.speakingPerDay,
    min_seconds: SPEAKING_MIN_SECONDS,
    bot_username: botUsername,
  };
}

export type VoiceOutcome =
  | { status: 'ok'; card: string; seconds: number; reward: Reward; next: ReturnType<typeof speakingCardFor> | null }
  | { status: 'short'; seconds: number; card: string }
  | { status: 'forwarded' | 'duplicate'; card: string }
  | { status: 'limit' };

/**
 * A voice message to the bot is a Speaking answer for today's card: at least SPEAKING_MIN_SECONDS long,
 * recorded by the user (not forwarded), each voice counts once, EARN.speakingPerDay a day.
 */
export async function acceptVoice(repo: Repo, user: UserRow, today: string, v: { seconds: number; fileUniqueId: string; forwarded: boolean }): Promise<VoiceOutcome> {
  const done = (await repo.tasksOn(user.id, today, 'speaking')).filter((r) => r.status === 'accepted');
  if (done.length >= EARN.speakingPerDay) return { status: 'limit' };
  const card = speakingCardFor(user.tg_id, today, done.length);
  if (v.forwarded) return { status: 'forwarded', card: card.title };
  if (v.seconds < SPEAKING_MIN_SECONDS) return { status: 'short', seconds: v.seconds, card: card.title };
  let added = false;
  const { reward } = await withReward(
    repo,
    user,
    today,
    async () => {
      added = await repo.addVoice(user.id, today, card.id, v.seconds, v.fileUniqueId);
      if (added) await syncDaySafe(repo, user, today);
    },
    'speaking',
    card.title,
  );
  if (!added) return { status: 'duplicate', card: card.title };
  const next = done.length + 1 < EARN.speakingPerDay ? speakingCardFor(user.tg_id, today, done.length + 1) : null;
  return { status: 'ok', card: card.title, seconds: v.seconds, reward, next };
}
