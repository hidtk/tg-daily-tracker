import type { Activity, Entry, VocabCard } from '@tracker/shared';
import { diffDays, isScheduledOn } from '@tracker/shared';
import { escapeHtml } from '../lib/telegram';
import type { WeekStats } from '../lib/stats';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${y !== new Date().getUTCFullYear() ? ' ' + y : ''}`;
}

export function welcomeText(firstName: string, isNew: boolean): string {
  const hi = `Hello, ${escapeHtml(firstName || 'there')}.`;
  if (isNew) {
    return `${hi}\n\nThis is your IELTS trainer. Every morning I send five new words and a practice task; every evening I ask whether you practised. Lessons and homework live here too.\n\nOpen the app to set your target band, exam date and lesson times.`;
  }
  return `${hi}\n\nOpen the app to log today’s practice, or use /task, /words and /hw.`;
}

export function helpText(): string {
  return [
    '<b>Commands</b>',
    '/app — open the trainer',
    '/today — today’s status',
    '/task — today’s practice task (/task writing2 · speaking · reading · writing1 · listening · grammar)',
    '/words — today’s vocabulary and reviews',
    '/hw — homework: list; /hw text — add (or a photo with the caption “hw”); /hw done N — mark done',
    '/minutes — social-media minutes in the wallet',
    '/partner — accountability partner (a link for a friend or a code for a group)',
    '/partner off — unlink the partner',
    '/help — this message',
    '',
    'Reminder times, lessons and the exam date are in the app (Settings).',
  ].join('\n');
}

function mark(e: Entry | undefined): string {
  if (!e) return '☐';
  if (e.done) return '☑';
  if (e.skipped) return '—';
  return '☐';
}

export function todayStatusText(date: string, activities: Activity[], entries: Entry[]): string {
  const scheduled = activities.filter((a) => isScheduledOn(a, date));
  if (!scheduled.length) return `Nothing scheduled for ${fmtDate(date)}.`;
  const byId = new Map(entries.map((e) => [e.activity_id, e]));
  const lines = scheduled.map((a) => {
    const e = byId.get(a.id);
    const note = e?.done_note || e?.plan_note;
    const goal = a.goal_date ? ` <i>(${diffDays(date, a.goal_date)} days to ${escapeHtml(a.goal_text ?? 'the goal')})</i>` : '';
    const mins = e?.minutes ? ` · ${e.minutes} min` : '';
    const skills = e?.skills?.length ? ` · ${e.skills.join(', ')}` : '';
    return `${mark(e)} <b>${escapeHtml(a.name)}</b>${mins}${skills}${goal}${note ? `\n      <i>${escapeHtml(note)}</i>` : ''}`;
  });
  const done = scheduled.filter((a) => byId.get(a.id)?.done).length;
  return `<b>${fmtDate(date)}</b> — ${done ? 'practised' : 'not practised yet'}\n\n${lines.join('\n')}`;
}

export function morningText(date: string, activities: Activity[]): string {
  void date;
  void activities;
  return `<b>Good morning.</b> Today’s words and task are below. Mark the plan in the app when you know what you will do.`;
}

export function eveningText(date: string, activities: Activity[], entries: Entry[]): string {
  const scheduled = activities.filter((a) => isScheduledOn(a, date));
  const byId = new Map(entries.map((e) => [e.activity_id, e]));
  const list = scheduled.map((a) => {
    const e = byId.get(a.id);
    return `${mark(e)} ${escapeHtml(a.name)}${e?.plan_note ? ` — <i>${escapeHtml(e.plan_note)}</i>` : ''}`;
  });
  return `<b>How did it go?</b> Log your minutes and skills for today.\n\n${list.join('\n') || 'Nothing scheduled today.'}`;
}

export function weeklyText(cur: WeekStats, prev: WeekStats, ownerName?: string): string {
  const pct = (d: number, s: number) => (s ? Math.round((d / s) * 100) : 0);
  const lines = cur.perActivity.map(({ activity, done, scheduled, skipped }) => {
    const bar = scheduled ? '▰'.repeat(Math.min(7, Math.round((done / scheduled) * 7))).padEnd(7, '▱') : '———————';
    const sk = skipped ? ` <i>(skipped ${skipped})</i>` : '';
    return `<b>${escapeHtml(activity.name)}</b>: ${done} of ${scheduled} days  ${bar}${sk}`;
  });
  const curPct = pct(cur.doneTotal, cur.scheduledTotal);
  const prevPct = pct(prev.doneTotal, prev.scheduledTotal);
  const delta = curPct - prevPct;
  const cmp = prev.scheduledTotal
    ? delta > 0
      ? `${delta} points better than last week (${prevPct}%).`
      : delta < 0
        ? `${-delta} points below last week (${prevPct}%).`
        : `Same as last week (${prevPct}%).`
    : '';
  const title = ownerName ? `<b>${escapeHtml(ownerName)}’s week</b>` : '<b>Your week</b>';
  return [`${title} ${fmtDate(cur.from)} — ${fmtDate(cur.to)}`, '', ...lines, '', `Total: <b>${cur.doneTotal} of ${cur.scheduledTotal}</b> (${curPct}%)`, cmp]
    .filter((l) => l !== undefined)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

export function partnerText(botUsername: string, code: string, currentName: string | null): string {
  const link = `https://t.me/${botUsername}?start=partner_${code}`;
  return [
    '<b>Accountability partner</b>',
    currentName ? `Currently linked: <b>${escapeHtml(currentName)}</b>. A new link will replace them.` : 'Nobody yet.',
    '',
    'Send this link to a friend — once they open it, they will receive your weekly summary and missed days:',
    link,
    '',
    `Or add me to a group and post there: <code>/partner ${code}</code>`,
    '',
    'Unlink: /partner off. Missed-day notices can be switched off in Settings.',
  ].join('\n');
}

export function partnerLinkedText(ownerName: string): string {
  return `You are now the accountability partner of <b>${escapeHtml(ownerName)}</b>.\n\nOn Sundays I will send you their weekly summary, and a short note whenever a day is missed. Your job is simple: ask how it is going.`;
}

export function missedText(ownerName: string, date: string, missed: Activity[], skipped: { activity: Activity; reason: string | null }[]): string {
  const parts: string[] = [];
  if (missed.length) parts.push(`<b>${escapeHtml(ownerName)}</b> did not practise yesterday (${fmtDate(date)}).`);
  if (skipped.length) {
    const list = skipped.map(({ reason }) => (reason ? `— <i>${escapeHtml(reason)}</i>` : '— no reason given')).join('\n');
    parts.push(`${missed.length ? '' : `<b>${escapeHtml(ownerName)}</b> `}skipped on purpose yesterday (${fmtDate(date)}):\n${list}`);
  }
  parts.push(missed.length ? 'Perhaps worth asking what happened.' : 'At least it was an honest skip.');
  return parts.join('\n\n');
}

export function missedSelfText(date: string, missed: Activity[], skipped: { activity: Activity; reason: string | null }[], partnerName: string | null): string {
  const what = missed.length ? 'No practice logged' : `Skipped${skipped[0]?.reason ? ` — <i>${escapeHtml(skipped[0].reason)}</i>` : ''}`;
  return `${what} yesterday (${fmtDate(date)}).${partnerName ? ` ${escapeHtml(partnerName)} has been told.` : ''} Today is a new day.`;
}

// ---------- vocabulary ----------

export function wordLine(w: VocabCard): string {
  return `<b>${escapeHtml(w.word)}</b> /${escapeHtml(w.ipa)}/ <i>${escapeHtml(w.pos)}</i>\n${escapeHtml(w.meaning)} — ${escapeHtml(w.ru)}\n<i>${escapeHtml(w.example)}</i>`;
}

export function wordsText(newWords: VocabCard[], dueCount: number): string {
  if (!newWords.length && !dueCount) return 'No new words today and nothing to review. Set the daily number in Settings.';
  const parts: string[] = [];
  if (newWords.length) parts.push(`<b>Today’s words</b>\n\n${newWords.map(wordLine).join('\n\n')}`);
  if (dueCount) parts.push(`<b>${dueCount} word${dueCount === 1 ? '' : 's'} to review</b> — the quiz follows. Tap the meaning that fits.`);
  return parts.join('\n\n');
}

export function quizText(w: VocabCard, index: number, total: number): string {
  return `Review ${index} of ${total}\n\n<b>${escapeHtml(w.word)}</b> /${escapeHtml(w.ipa)}/`;
}
