import type { Activity, Entry } from '@tracker/shared';
import { diffDays, isScheduledOn } from '@tracker/shared';
import { escapeHtml } from '../lib/telegram';
import type { WeekStats } from '../lib/stats';

export function fmtDateRu(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${d} ${months[m - 1]}${y !== new Date().getUTCFullYear() ? ' ' + y : ''}`;
}

export function welcomeText(firstName: string, isNew: boolean): string {
  const hi = `Привет, ${escapeHtml(firstName || 'друг')}! 👋`;
  if (isNew) {
    return `${hi}\n\nЭто твой дневной трекер. Утром отмечаешь план, вечером — факт. Я буду напоминать и присылать недельную сводку.\n\nЯ уже добавил три активности: English (IELTS), Диплом и Спорт (через день). Открой трекер, чтобы настроить их под себя.`;
  }
  return `${hi}\n\nОткрой трекер, чтобы отметить план или факт за сегодня.`;
}

export function helpText(): string {
  return [
    '<b>Команды</b>',
    '/app — открыть трекер',
    '/today — статус за сегодня',
    '/help — эта справка',
    '',
    'Напоминания и время сводки настраиваются в приложении (Настройки).',
  ].join('\n');
}

export function todayStatusText(date: string, activities: Activity[], entries: Entry[]): string {
  const scheduled = activities.filter((a) => isScheduledOn(a, date));
  if (!scheduled.length) return `На ${fmtDateRu(date)} ничего не запланировано по расписанию.`;
  const byId = new Map(entries.map((e) => [e.activity_id, e]));
  const lines = scheduled.map((a) => {
    const e = byId.get(a.id);
    const plan = e?.planned ? '📝' : '·';
    const done = e?.done ? '✅' : '⬜';
    const note = e?.done_note || e?.plan_note;
    const goal = a.goal_date ? ` <i>(${diffDays(date, a.goal_date)} дн. до ${escapeHtml(a.goal_text ?? 'цели')})</i>` : '';
    return `${done} ${plan} ${a.emoji} <b>${escapeHtml(a.name)}</b>${goal}${note ? `\n      <i>${escapeHtml(note)}</i>` : ''}`;
  });
  const doneCount = scheduled.filter((a) => byId.get(a.id)?.done).length;
  return `<b>${fmtDateRu(date)}</b> — сделано ${doneCount} из ${scheduled.length}\n\n${lines.join('\n')}`;
}

export function morningText(date: string, activities: Activity[]): string {
  const scheduled = activities.filter((a) => isScheduledOn(a, date));
  const list = scheduled.map((a) => `${a.emoji} ${escapeHtml(a.name)}`).join('\n');
  return `☀️ <b>Доброе утро!</b> Что планируешь на сегодня?\n\n${list || 'Сегодня по расписанию пусто.'}`;
}

export function eveningText(date: string, activities: Activity[], entries: Entry[]): string {
  const scheduled = activities.filter((a) => isScheduledOn(a, date));
  const byId = new Map(entries.map((e) => [e.activity_id, e]));
  const planned = scheduled.filter((a) => byId.get(a.id)?.planned);
  const list = (planned.length ? planned : scheduled).map((a) => {
    const e = byId.get(a.id);
    return `${e?.done ? '✅' : '⬜'} ${a.emoji} ${escapeHtml(a.name)}${e?.plan_note ? ` — <i>${escapeHtml(e.plan_note)}</i>` : ''}`;
  });
  return `🌙 <b>Как прошёл день?</b> Отметь, что получилось.\n\n${list.join('\n') || 'Сегодня по расписанию пусто.'}`;
}

export function weeklyText(cur: WeekStats, prev: WeekStats): string {
  const pct = (d: number, s: number) => (s ? Math.round((d / s) * 100) : 0);
  const lines = cur.perActivity.map(({ activity, done, scheduled }) => {
    const bar = scheduled ? '▰'.repeat(Math.round((done / scheduled) * 7)).padEnd(7, '▱') : '———————';
    return `${activity.emoji} <b>${escapeHtml(activity.name)}</b>: ${done} из ${scheduled}  ${bar}`;
  });
  const best = [...cur.perActivity].filter((x) => x.scheduled > 0).sort((a, b) => pct(b.done, b.scheduled) - pct(a.done, a.scheduled) || b.done - a.done)[0];
  const curPct = pct(cur.doneTotal, cur.scheduledTotal);
  const prevPct = pct(prev.doneTotal, prev.scheduledTotal);
  const delta = curPct - prevPct;
  const cmp = prev.scheduledTotal
    ? delta > 0
      ? `📈 На ${delta} п.п. лучше прошлой недели (${prevPct}%)`
      : delta < 0
        ? `📉 На ${-delta} п.п. ниже прошлой недели (${prevPct}%)`
        : `➡️ Как на прошлой неделе (${prevPct}%)`
    : '';
  return [
    `📊 <b>Итоги недели</b> ${fmtDateRu(cur.from)} — ${fmtDateRu(cur.to)}`,
    '',
    ...lines,
    '',
    `Всего: <b>${cur.doneTotal} из ${cur.scheduledTotal}</b> (${curPct}%)`,
    best ? `🏆 Лучшая активность: ${best.activity.emoji} ${escapeHtml(best.activity.name)}` : '',
    cmp,
  ]
    .filter((l) => l !== undefined)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}
