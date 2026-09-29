import type { Homework, Lesson, Skill } from '@tracker/shared';
import { diffDays, nextWeekdayDate, weekdayMon0 } from '@tracker/shared';
import { escapeHtml, type InlineKeyboardButton } from '../lib/telegram';
import { fmtDate } from './messages';

const TAG_RULES: [Skill, RegExp][] = [
  ['writing', /(writing|essay|эссе|письм|task ?[12]|report|letter|напис|сочинен)/i],
  ['speaking', /(speaking|говор|устн|cue card|record|голосов|voice|монолог)/i],
  ['reading', /(reading|чтен|прочит|passage|текст|article|стать)/i],
  ['listening', /(listening|аудир|послуш|слуша|podcast|подкаст|audio)/i],
  ['vocab', /(vocab|слов|word list|лексик|выуч|learn.*words|phras)/i],
  ['grammar', /(grammar|граммат|tense|conditional|passive|artic|упражнен|exercise|unit ?\d|стр\.|page|упр\.)/i],
];

export function detectTags(text: string): Skill[] {
  const tags = TAG_RULES.filter(([, re]) => re.test(text)).map(([s]) => s);
  return tags.length ? tags : ['grammar'];
}

/** Due date = next lesson date strictly after `today` (homework is usually given in class). */
export function nextLessonDate(lessons: Lesson[], today: string, includeToday = false): { date: string; lesson: Lesson } | null {
  let best: { date: string; lesson: Lesson } | null = null;
  for (const l of lessons) {
    const d = nextWeekdayDate(today, l.weekdays, includeToday);
    if (d && (!best || d < best.date)) best = { date: d, lesson: l };
  }
  return best;
}

const WD = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function dueLabel(h: Homework, today: string): string {
  if (!h.due_date) return 'no deadline';
  const n = diffDays(today, h.due_date);
  const wd = WD[weekdayMon0(h.due_date)];
  if (n < 0) return `${-n} day${n === -1 ? '' : 's'} overdue`;
  if (n === 0) return 'due today';
  if (n === 1) return `due tomorrow (${fmtDate(h.due_date)})`;
  return `due ${wd} · ${n} days`;
}

export function homeworkLine(h: Homework, today: string, idx?: number): string {
  const prefix = idx != null ? `${idx}. ` : '';
  const tags = h.tags.length ? ` <i>[${h.tags.join(', ')}]</i>` : '';
  return `${prefix}<b>${dueLabel(h, today)}</b>${tags}\n${escapeHtml(h.text.slice(0, 400))}${h.text.length > 400 ? '…' : ''}${h.has_file ? ' 📎' : ''}`;
}

export function homeworkListText(hws: Homework[], today: string): string {
  if (!hws.length) return 'No open homework. Add some with <code>/hw the task text</code> or send a photo with the caption “hw”.';
  return `<b>Homework</b>\n\n${hws.map((h, i) => homeworkLine(h, today, i + 1)).join('\n\n')}\n\n<i>Done — tap the button or /hw done N.</i>`;
}

export function homeworkKeyboard(hws: Homework[]): InlineKeyboardButton[][] {
  return hws.slice(0, 4).map((h) => [
    { text: `Done: ${h.text.slice(0, 24)}${h.text.length > 24 ? '…' : ''}`, callback_data: `hwd:${h.id}` },
    { text: '✕', callback_data: `hwx:${h.id}` },
  ]);
}

export function lessonReminderText(title: string, time: string, when: 'morning' | 'before', hws: Homework[], today: string, beforeMin: number): string {
  const inWords = beforeMin >= 60 ? `${Math.round((beforeMin / 60) * 10) / 10} h` : `${beforeMin} min`;
  const head = when === 'morning' ? `<b>${escapeHtml(title)}</b> today at <b>${time}</b>.` : `<b>${escapeHtml(title)}</b> in ${inWords} (${time}).`;
  if (!hws.length) return `${head}\n\nNo homework on the list. If you were given some, send it to me: <code>/hw …</code>`;
  const due = hws.filter((h) => h.due_date === today);
  const list = (due.length ? due : hws).map((h) => `• ${escapeHtml(h.text.slice(0, 120))}${h.text.length > 120 ? '…' : ''}`).join('\n');
  return `${head}\n\n${due.length ? 'For today’s lesson:' : 'Open homework:'}\n${list}\n\n<i>Not done yet — there is still time. Done — tap Done in /hw.</i>`;
}
