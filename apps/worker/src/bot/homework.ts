import type { Homework, Lesson, Skill } from '@tracker/shared';
import { diffDays, nextWeekdayDate, weekdayMon0 } from '@tracker/shared';
import { escapeHtml, type InlineKeyboardButton } from '../lib/telegram';
import { KIND_LABEL, TASKS, formatTask, taskForDay, type IeltsTask, type TaskKind } from './ielts-tasks';
import { fmtDateRu } from './messages';

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

const WD = ['понедельнику', 'вторнику', 'среде', 'четвергу', 'пятнице', 'субботе', 'воскресенью'];

export function dueLabel(h: Homework, today: string): string {
  if (!h.due_date) return 'без срока';
  const n = diffDays(today, h.due_date);
  const wd = WD[weekdayMon0(h.due_date)];
  if (n < 0) return `просрочено на ${-n} дн.`;
  if (n === 0) return 'сегодня!';
  if (n === 1) return `к завтра (${fmtDateRu(h.due_date)})`;
  return `к ${wd} · ${n} дн.`;
}

export function homeworkLine(h: Homework, today: string, idx?: number): string {
  const prefix = idx != null ? `${idx}. ` : '';
  const tags = h.tags.length ? ` <i>[${h.tags.join(', ')}]</i>` : '';
  return `${prefix}📌 <b>${dueLabel(h, today)}</b>${tags}\n${escapeHtml(h.text.slice(0, 400))}${h.text.length > 400 ? '…' : ''}${h.has_file ? ' 📎' : ''}`;
}

export function homeworkListText(hws: Homework[], today: string): string {
  if (!hws.length) return 'Открытых домашек нет. Добавить: <code>/hw текст задания</code> или фото с подписью «дз».';
  return `<b>Домашка</b>\n\n${hws.map((h, i) => homeworkLine(h, today, i + 1)).join('\n\n')}\n\n<i>Сделал — нажми кнопку или /hw done N.</i>`;
}

export function homeworkKeyboard(hws: Homework[]): InlineKeyboardButton[][] {
  return hws.slice(0, 4).map((h) => [
    { text: `✅ Сделал: ${h.text.slice(0, 24)}${h.text.length > 24 ? '…' : ''}`, callback_data: `hwd:${h.id}` },
    { text: '🗑', callback_data: `hwx:${h.id}` },
  ]);
}

const SHORT_KINDS: TaskKind[] = ['vocab', 'grammar', 'listening', 'reading'];

/** Pick a complementary bank task: a skill the homework does not cover, short ones preferred. */
export function complementaryTask(tgId: number, today: string, weekIndex: number, hwTags: Skill[]): IeltsTask {
  const covered = new Set<string>(hwTags);
  const kindSkill: Record<TaskKind, Skill> = { writing2: 'writing', writing1: 'writing', speaking: 'speaking', reading: 'reading', listening: 'listening', vocab: 'vocab', grammar: 'grammar' };
  const candidates = SHORT_KINDS.filter((k) => !covered.has(kindSkill[k]));
  const kind = candidates.length ? candidates[(weekIndex + weekdayMon0(today)) % candidates.length] : 'vocab';
  const list = TASKS.filter((t) => t.kind === kind);
  return list[(weekIndex * 7 + weekdayMon0(today) + (tgId % 7)) % list.length];
}

/** Morning message: homework first (if any), then a bank task. */
export function composeMorning(tgId: number, today: string, weekIndex: number, hws: Homework[]): { text: string; keyboard: InlineKeyboardButton[][] } {
  if (!hws.length) {
    const t = taskForDay(tgId, today, weekdayMon0(today), weekIndex);
    return { text: formatTask(t), keyboard: [] };
  }
  const tags = [...new Set(hws.flatMap((h) => h.tags))];
  const extra = complementaryTask(tgId, today, weekIndex, tags);
  const text = [
    `📚 <b>План на сегодня</b>`,
    '',
    ...hws.slice(0, 3).map((h) => homeworkLine(h, today)),
    '',
    `<b>Дополнительно (${KIND_LABEL[extra.kind]}, ~${extra.minutes} мин)</b> — по желанию, если домашка не съела всё время:`,
    `<b>${extra.title}</b>`,
    extra.body,
  ].join('\n');
  return { text, keyboard: homeworkKeyboard(hws) };
}

export function lessonReminderText(title: string, time: string, when: 'morning' | 'before', hws: Homework[], today: string, beforeMin: number): string {
  const head = when === 'morning' ? `🎓 Сегодня <b>${escapeHtml(title)}</b> в <b>${time}</b>.` : `⏰ Через ${beforeMin >= 60 ? `${Math.round(beforeMin / 60 * 10) / 10} ч` : `${beforeMin} мин`} — <b>${escapeHtml(title)}</b> (${time}).`;
  if (!hws.length) return `${head}\n\nДомашки в списке нет. Если задали — пришли мне текст: <code>/hw …</code>`;
  const due = hws.filter((h) => h.due_date === today);
  const list = (due.length ? due : hws).map((h) => `• ${escapeHtml(h.text.slice(0, 120))}${h.text.length > 120 ? '…' : ''}`).join('\n');
  return `${head}\n\n${due.length ? 'К сегодняшнему занятию:' : 'Открытая домашка:'}\n${list}\n\n<i>Не сделано — ещё есть время. Сделано — нажми ✅ в /hw.</i>`;
}
