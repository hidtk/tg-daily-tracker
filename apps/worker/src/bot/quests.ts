import { EARN, SPEAKING_MIN_SECONDS, WRITING_MIN_VOCAB, WRITING_MIN_WORDS, type GameState, type QuestId, type Reward, type SpeakingCard, type WritingTopic } from '@tracker/shared';
import { escapeHtml, type InlineKeyboardButton } from '../lib/telegram';
import type { VoiceOutcome } from '../lib/tasks';

/** Screens of the Mini App a bot button can open (?go=…). */
export type AppScreen = 'today' | 'reading' | 'words' | 'writing' | 'speaking' | 'boss';

export function appUrl(base: string, go?: AppScreen): string {
  if (!go || base.startsWith('https://t.me/')) return base;
  return `${base}${base.includes('?') ? '&' : '?'}go=${go}`;
}

export function appButton(base: string, text: string, go?: AppScreen): InlineKeyboardButton {
  const url = appUrl(base, go);
  // web_app buttons require an HTTPS Mini App URL; a t.me fallback is a plain link.
  return base.startsWith('https://t.me/') ? { text, url } : { text, web_app: { url } };
}

const QUEST_LABEL: Record<QuestId, string> = {
  reading: 'Reading: one test (the key quest)',
  words: 'Words: type the answers',
  create: 'Your own English: a sentence, a Writing text or a Speaking voice message',
};

function mark(done: boolean): string {
  return done ? '☑' : '☐';
}

export function cardText(card: SpeakingCard): string {
  return `<b>${escapeHtml(card.title)}</b>\n${escapeHtml(card.prompt)}\nYou should say:\n${card.points.map((p) => `• ${escapeHtml(p)}`).join('\n')}`;
}

/** The daily plan: quests with progress, today's Speaking card and Writing topic, and what each one pays. */
export function questsText(s: GameState, card: SpeakingCard | null, topic: WritingTopic, header = '<b>Today’s quests</b>'): string {
  const lines = s.quests.map((q) => `${mark(q.done)} ${QUEST_LABEL[q.id]}${q.target > 1 ? ` — ${q.progress}/${q.target}` : ''}`);
  const streak = s.streak.current ? `Streak: <b>${s.streak.current}</b> day${s.streak.current === 1 ? '' : 's'}${s.streak.today_done ? ' (today counted)' : ' — Reading today keeps it'}.` : 'Streak: 0 — one Reading test today starts it.';
  const parts = [
    header,
    '',
    ...lines,
    '',
    `All three open the chest: +${EARN.chest} min, +30 XP.`,
    streak,
    `Level ${s.level} · ${s.xp} XP${s.boss?.unlocked ? ` · the level ${s.boss.level} boss is waiting` : ''}.`,
  ];
  if (card) {
    parts.push('', `<b>Speaking card</b> — record a voice message here, at least ${SPEAKING_MIN_SECONDS} seconds. It counts by itself (+25 XP, +${EARN.speaking} min).`, cardText(card));
  }
  parts.push('', `<b>Writing</b> — ${escapeHtml(topic.title)}: ${WRITING_MIN_WORDS}+ words using ${WRITING_MIN_VOCAB} of your recent words, in the app (+40 XP, +${EARN.writing} min).`);
  return parts.join('\n');
}

export function questsKeyboard(base: string, s: GameState): InlineKeyboardButton[][] {
  const rows: InlineKeyboardButton[][] = [[appButton(base, s.quests[0].done ? 'Open the quests' : 'Start Reading', s.quests[0].done ? 'today' : 'reading')]];
  rows.push([appButton(base, 'Words', 'words'), appButton(base, 'Writing', 'writing')]);
  if (s.boss?.unlocked && !s.boss.tried_today) rows.push([appButton(base, `Fight the level ${s.boss.level} boss`, 'boss')]);
  return rows;
}

/** Evening nudge: only what is still open, and what is at stake. */
export function eveningQuestsText(s: GameState): string | null {
  const open = s.quests.filter((q) => !q.done);
  if (!open.length) return null;
  const reading = !s.quests[0].done;
  const parts = [`<b>${3 - open.length} of 3 quests done today.</b>`];
  if (reading) {
    parts.push(s.streak.current ? `Reading is still open — without it the ${s.streak.current}-day streak ends at midnight${s.streak.shields ? ' (a shield will save it once)' : ''}.` : 'Reading is still open — one test starts a streak.');
    if (s.minutes.held > 0) parts.push(`${s.minutes.held} min are waiting for Reading.`);
  }
  parts.push(...open.map((q) => `☐ ${QUEST_LABEL[q.id]}${q.target > 1 ? ` — ${q.progress}/${q.target}` : ''}`));
  return parts.join('\n');
}

export function rewardLine(r: Reward): string {
  const bits = [`+${r.xp} XP`];
  if (r.minutes > 0) bits.push(`+${r.minutes} min`);
  if (r.held > 0) bits.push(`${r.held} min wait for Reading`);
  const extra: string[] = [];
  if (r.level_after > r.level_before) extra.push(`Level up: <b>${r.level_after}</b>.`);
  if (r.chest) extra.push(`All quests done — chest opened.`);
  return `${bits.join(' · ')}${extra.length ? `\n${extra.join(' ')}` : ''}`;
}

function mmss(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function voiceReplyText(o: VoiceOutcome): string {
  switch (o.status) {
    case 'ok':
      return [
        `Counted: Speaking, <b>${escapeHtml(o.card)}</b>, ${mmss(o.seconds)}.`,
        rewardLine(o.reward),
        o.next ? `\nOne more card for today (optional):\n${cardText(o.next)}` : '\nThat’s today’s Speaking done. New cards tomorrow.',
      ].join('\n');
    case 'short':
      return `Not counted: ${mmss(o.seconds)} is too short. Speak for at least ${SPEAKING_MIN_SECONDS} seconds about <b>${escapeHtml(o.card)}</b> — cover every point on the card.`;
    case 'forwarded':
      return 'Not counted: forwarded voice messages don’t count. Record your own answer here.';
    case 'duplicate':
      return 'This voice message was already counted.';
    case 'limit':
      return `Today’s Speaking is done (${EARN.speakingPerDay} answers). New cards tomorrow — the practice still helps, it just doesn’t pay.`;
  }
}
