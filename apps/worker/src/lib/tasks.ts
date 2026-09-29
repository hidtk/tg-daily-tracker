import {
  SPEAKING_RULES,
  SPEAKING_TASKS,
  WRITING_RULES,
  WRITING_TASKS,
  addDays,
  checkVoice,
  checkWriting,
  speakingCardById,
  speakingCardFor,
  vocabById,
  writingTopicById,
  writingTopicFor,
  type AiFeedback,
  type CheckResult,
  type Payout,
  type SpeakingCard,
  type SpeakingState,
  type TaskSize,
  type WritingResult,
  type WritingState,
} from '@tracker/shared';
import { syncDaySafe } from './autolog';
import { userSettings, type Repo, type TaskRow, type UserRow } from './db';
import { aiWritingFeedback } from './llm';
import { payout } from './wallet';

/** Words learned within this many days count as "recent vocabulary" for Writing. */
const RECENT_DAYS = 30;

export const writingTaskId = (size: TaskSize) => `writing:${size}`;
export const speakingTaskId = (size: TaskSize) => `speaking:${size}`;
/** Topic / card number for a size: the long task takes the day's first, the short one the second. */
const slot = (size: TaskSize) => (size === 'long' ? 0 : 1);

export function writingTopic(user: UserRow, today: string, size: TaskSize) {
  return writingTopicFor(user.tg_id, today, slot(size));
}

export function speakingCard(user: UserRow, today: string, size: TaskSize): SpeakingCard {
  return speakingCardFor(user.tg_id, today, slot(size));
}

// ---------- Writing ----------

/** Words learned recently (last RECENT_DAYS days; if that's thin, the latest ones overall). */
export async function recentVocab(repo: Repo, user: UserRow, today: string) {
  const rows = (await repo.vocabAll(user.id)).filter((r) => r.introduced_on <= today);
  const from = addDays(today, -RECENT_DAYS);
  let pick = rows.filter((r) => r.introduced_on >= from);
  if (pick.length < 10) pick = [...rows].sort((a, b) => b.introduced_on.localeCompare(a.introduced_on) || b.word_id - a.word_id).slice(0, 10);
  return pick
    .map((r) => vocabById(r.word_id))
    .filter((w): w is NonNullable<typeof w> => !!w)
    .map((w) => ({ id: w.id, word: w.word, ru: w.ru }));
}

function parseFeedback(row: TaskRow | undefined): AiFeedback | null {
  try {
    return row?.feedback ? ((JSON.parse(row.feedback) as { ai?: AiFeedback | null }).ai ?? null) : null;
  } catch {
    return null;
  }
}

export async function writingState(repo: Repo, user: UserRow, today: string, size: TaskSize, ai: boolean): Promise<WritingState> {
  const rows = (await repo.tasksOn(user.id, today, 'writing')).filter((r) => r.task === writingTaskId(size));
  const accepted = rows.find((r) => r.status === 'accepted');
  const started = [...rows].reverse().find((r) => r.status === 'started');
  const topic = writingTopicById((accepted ?? started)?.topic ?? '') ?? writingTopic(user, today, size);
  const r = WRITING_RULES[size];
  return {
    today,
    size,
    topic,
    vocab: await recentVocab(repo, user, today),
    started_at: started?.started_at ?? accepted?.started_at ?? null,
    done: accepted
      ? { words: accepted.words, text: accepted.text ?? '', paid: (await repo.earnedByTask(user.id, today)).get(writingTaskId(size)) ?? 0, feedback: parseFeedback(accepted) }
      : null,
    rules: { min_words: r.minWords, vocab: r.vocab, linking: r.linking, sentences: r.sentences, min_seconds: r.minSeconds },
    price: WRITING_TASKS[size].price,
    ai,
  };
}

/** Start the clock for today's text (the server keeps the start time, so the minimum time can be checked). */
export async function startWriting(repo: Repo, user: UserRow, today: string, size: TaskSize, ai: boolean): Promise<WritingState> {
  const rows = (await repo.tasksOn(user.id, today, 'writing')).filter((r) => r.task === writingTaskId(size));
  if (!rows.length) await repo.startTask(user.id, today, 'writing', writingTaskId(size), writingTopic(user, today, size).id);
  return writingState(repo, user, today, size, ai);
}

/**
 * Check a Writing text by the rubric (length, recent words, linking words, sentences, English, variety, no gibberish,
 * not a copy, not the prompt, time). If everything passes and the AI check is configured, it may still say
 * "off topic". Accepted: the price once a day for this size.
 */
export async function submitWriting(repo: Repo, user: UserRow, today: string, size: TaskSize, text: string, apiKey?: string, now = new Date()): Promise<WritingResult> {
  const ai = !!apiKey;
  const rows = (await repo.tasksOn(user.id, today, 'writing')).filter((r) => r.task === writingTaskId(size));
  const started = [...rows].reverse().find((r) => r.status === 'started');
  const empty = { criteria: [], words: 0, vocab_used: [], linking: [], seconds: 0, ai: null, payout: null };
  if (rows.some((r) => r.status === 'accepted')) return { ok: false, blocked: 'done_today', ...empty, state: await writingState(repo, user, today, size, ai) };
  if (!started) return { ok: false, blocked: 'not_started', ...empty, state: await writingState(repo, user, today, size, ai) };

  const topic = writingTopicById(started.topic) ?? writingTopic(user, today, size);
  const seconds = Math.max(0, Math.round((now.getTime() - Date.parse(started.started_at)) / 1000));
  const check = checkWriting({ size, text, seconds, vocab: await recentVocab(repo, user, today), previous: await repo.recentWritings(user.id), prompt: topic.prompt });
  const criteria = [...check.criteria];
  let feedback: AiFeedback | null = null;
  if (check.ok && ai) {
    feedback = await aiWritingFeedback(apiKey, { topic: topic.prompt, text, lang: userSettings(user).lang });
    if (feedback) criteria.push({ id: 'topic_ai', ok: feedback.on_topic });
  }
  const ok = criteria.every((c) => c.ok);
  const base = { criteria, words: check.words, vocab_used: check.used, linking: check.linking, seconds, ai: feedback };
  if (!ok) return { ok: false, blocked: null, ...base, payout: null, state: await writingState(repo, user, today, size, ai) };

  if (!(await repo.acceptWriting(started.id, text.trim(), check.words, check.used, seconds, { criteria, ai: feedback }))) {
    return { ok: false, blocked: 'done_today', ...base, payout: null, state: await writingState(repo, user, today, size, ai) };
  }
  await syncDaySafe(repo, user, today);
  const p = await payout(repo, user, today, 'writing', WRITING_TASKS[size].price, writingTaskId(size));
  return { ok: true, blocked: null, ...base, payout: p, state: await writingState(repo, user, today, size, ai) };
}

// ---------- Speaking ----------

export async function speakingState(repo: Repo, user: UserRow, today: string, botUsername: string): Promise<SpeakingState> {
  const done = (await repo.tasksOn(user.id, today, 'speaking')).filter((r) => r.status === 'accepted');
  const earned = await repo.earnedByTask(user.id, today);
  return {
    today,
    cards: (['long', 'short'] as TaskSize[]).map((size) => {
      const row = done.find((r) => r.task === speakingTaskId(size));
      return {
        size,
        card: (row && speakingCardById(row.topic)) || speakingCard(user, today, size),
        min_seconds: SPEAKING_RULES[size].minSeconds,
        price: SPEAKING_TASKS[size].price,
        done: row ? { seconds: row.seconds, paid: earned.get(speakingTaskId(size)) ?? 0 } : null,
      };
    }),
    bot_username: botUsername,
  };
}

export type VoiceOutcome =
  | { status: 'ok'; size: TaskSize; card: SpeakingCard; seconds: number; check: CheckResult; payout: Payout; next: { size: TaskSize; card: SpeakingCard } | null }
  | { status: 'rejected'; size: TaskSize; card: SpeakingCard; seconds: number; check: CheckResult }
  | { status: 'limit' };

/**
 * A voice message to the bot is a Speaking answer. Long enough for the long task (and it's still open) → the long
 * task; otherwise the short one. Checked: length, recorded by the user (not forwarded), not counted before.
 */
export async function acceptVoice(repo: Repo, user: UserRow, today: string, v: { seconds: number; fileUniqueId: string; forwarded: boolean }): Promise<VoiceOutcome> {
  const done = new Set((await repo.tasksOn(user.id, today, 'speaking')).filter((r) => r.status === 'accepted').map((r) => r.task));
  const longDone = done.has(speakingTaskId('long'));
  const shortDone = done.has(speakingTaskId('short'));
  if (longDone && shortDone) return { status: 'limit' };
  const size: TaskSize = !longDone && (v.seconds >= SPEAKING_RULES.long.minSeconds || shortDone) ? 'long' : 'short';
  const card = speakingCard(user, today, size);
  let check = checkVoice({ size, seconds: v.seconds, forwarded: v.forwarded, duplicate: await repo.voiceSeen(user.id, v.fileUniqueId) });
  if (!check.ok) return { status: 'rejected', size, card, seconds: v.seconds, check };
  if (!(await repo.addVoice(user.id, today, speakingTaskId(size), card.id, v.seconds, v.fileUniqueId, { criteria: check.criteria }))) {
    check = checkVoice({ size, seconds: v.seconds, forwarded: v.forwarded, duplicate: true });
    return { status: 'rejected', size, card, seconds: v.seconds, check };
  }
  await syncDaySafe(repo, user, today);
  const p = await payout(repo, user, today, 'speaking', SPEAKING_TASKS[size].price, speakingTaskId(size));
  const other: TaskSize = size === 'long' ? 'short' : 'long';
  const next = done.has(speakingTaskId(other)) ? null : { size: other, card: speakingCard(user, today, other) };
  return { status: 'ok', size, card, seconds: v.seconds, check, payout: p, next };
}
