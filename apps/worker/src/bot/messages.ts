import { SPEAKING_RULES, type Criterion, type ShopTask, type SpeakingCard } from '@tracker/shared';
import { escapeHtml, type InlineKeyboardButton } from '../lib/telegram';
import type { VoiceOutcome } from '../lib/tasks';

/** Bot texts: short, plain English. Every button leads to a concrete place in the app. */

export function appUrl(base: string, q?: { task?: string; go?: string }): string {
  if (!q || base.startsWith('https://t.me/')) return base;
  const params = new URLSearchParams(q.task ? { task: q.task } : { go: q.go ?? '' });
  return `${base}${base.includes('?') ? '&' : '?'}${params.toString()}`;
}

export function appButton(base: string, text: string, q?: { task?: string; go?: string }): InlineKeyboardButton {
  const url = appUrl(base, q);
  // web_app buttons require an HTTPS Mini App URL; a t.me fallback is a plain link.
  return base.startsWith('https://t.me/') ? { text, url } : { text, web_app: { url } };
}

export function welcomeText(firstName: string): string {
  return [
    `Hello, ${escapeHtml(firstName || 'there')}.`,
    '',
    'Do small IELTS tasks, earn social-media minutes, spend them in Instagram, TikTok, YouTube and VK.',
    'Open the app — it shows how it works in five short screens.',
  ].join('\n');
}

export function helpText(): string {
  return [
    '<b>How it works</b>',
    '1. Open the app and pick a task in the Shop. Each card says how long it takes and how many minutes it pays.',
    '2. Minutes open your social media. When they run out, the iPhone lock sends you to the Home Screen.',
    '3. Speaking: send me a voice message here — I check the length and count it.',
    '',
    '/start — the app button',
    '/help — this message',
  ].join('\n');
}

const TASK_NAME: Record<ShopTask['kind'], string> = {
  reading: 'Reading',
  words: 'Words',
  sentence: 'A sentence with a word',
  writing: 'Writing',
  speaking: 'Speaking',
};

export function taskLine(t: ShopTask): string {
  const what = t.kind === 'reading' ? `Reading · ${escapeHtml(t.title)} (${t.questions} questions)` : t.kind === 'writing' || t.kind === 'speaking' ? `${TASK_NAME[t.kind]} · ${escapeHtml(t.title)}` : TASK_NAME[t.kind];
  return `• ${what} — about ${t.minutes} min, pays ${t.price} min`;
}

/** Morning: three tasks for today, each a button that opens it in the app. */
export function morningText(top: ShopTask[], balance: number): string {
  return [
    `<b>Good morning.</b> ${balance >= 1 ? `${Math.floor(balance)} min on the balance.` : 'No minutes on the balance yet.'}`,
    '',
    'Three good tasks for today:',
    ...top.map(taskLine),
  ].join('\n');
}

export function morningKeyboard(base: string, top: ShopTask[]): InlineKeyboardButton[][] {
  return [...top.map((t) => [appButton(base, `${TASK_NAME[t.kind]}: +${t.price} min`, { task: t.id })]), [appButton(base, 'Open the Shop', { go: 'shop' })]];
}

export function cardText(card: SpeakingCard): string {
  return `<b>${escapeHtml(card.title)}</b>\n${escapeHtml(card.prompt)}\nYou should say:\n${card.points.map((p) => `- ${escapeHtml(p)}`).join('\n')}`;
}

function mmss(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function criterionLine(c: Criterion): string {
  switch (c.id) {
    case 'duration':
      return c.ok ? `Length ${mmss(Number(c.value))} — enough.` : `Length ${mmss(Number(c.value))} — too short, need at least ${mmss(Number(c.need))}.`;
    case 'own_voice':
      return c.ok ? 'Recorded by you — yes.' : 'Forwarded voice messages do not count. Record your own.';
    case 'new_voice':
      return c.ok ? 'New recording — yes.' : 'This voice message was already counted.';
    default:
      return '';
  }
}

export function voiceReplyText(o: VoiceOutcome): string {
  if (o.status === 'limit') return 'Both Speaking tasks are done today. New cards tomorrow — practice still helps, it just does not pay.';
  const task = o.size === 'long' ? 'Speaking, long answer' : 'Speaking, short answer';
  const checks = o.check.criteria.map(criterionLine).filter(Boolean).join('\n');
  if (o.status === 'rejected') {
    return [`<b>Not counted</b> — ${task}, card “${escapeHtml(o.card.title)}”.`, checks, '', 'Fix it and send a new voice message.'].join('\n');
  }
  const paid = o.payout.minutes > 0 ? `+${o.payout.minutes} min of social media.` : o.payout.capped ? 'Counted, but today’s limit of minutes is reached.' : 'Counted.';
  return [
    `<b>Counted</b> — ${task}, card “${escapeHtml(o.card.title)}”.`,
    checks,
    'The content is not checked automatically — honest practice is yours.',
    paid,
    o.next ? `\nOne more task today — ${o.next.size === 'long' ? 'long' : 'short'} answer, ${SPEAKING_RULES[o.next.size].minSeconds}+ seconds:\n${cardText(o.next.card)}` : '',
  ]
    .filter((l) => l !== '')
    .join('\n');
}
