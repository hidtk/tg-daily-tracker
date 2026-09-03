import type { Activity, Entry } from '@tracker/shared';
import { countsAsDone, diffDays, isConfirmed, isScheduledOn } from '@tracker/shared';
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
    return `${hi}\n\nЭто твой дневной трекер. Утром отмечаешь план, вечером — факт. Я буду напоминать и присылать недельную сводку.\n\nЯ уже добавил три активности: English (IELTS), Диплом и Спорт (через день). Открой трекер, чтобы настроить их под себя.\n\n📷 Чтобы занятие <b>засчиталось</b>, пришли мне фото или перешли диалог с ИИ — это подтверждение.`;
  }
  return `${hi}\n\nОткрой трекер, чтобы отметить план или факт за сегодня. Фото или пересланный чат с ИИ — это подтверждение занятия.`;
}

export function helpText(): string {
  return [
    '<b>Команды</b>',
    '/app — открыть трекер',
    '/today — статус за сегодня',
    '/task — задание дня по IELTS (/task writing2 · speaking · reading · vocab · writing1 · listening · grammar)',
    '/partner — партнёр по ответственности (ссылка для друга или код для группы)',
    '/partner off — отвязать партнёра',
    '/help — эта справка',
    '',
    '<b>Подтверждение занятий</b>',
    'Пришли фото (тетрадь, экран, зал), голосовое (Speaking) или перешли диалог с ChatGPT/Claude (или ссылку на него) — я спрошу, к какой активности привязать, и засчитаю. Текст эссе от 200 символов тоже считается.',
    'В строгом режиме без подтверждения занятие не идёт в стрик и статистику.',
    '',
    'Напоминания, режим и время сводки — в приложении (Настройки).',
  ].join('\n');
}

function mark(e: Entry | undefined, strict: boolean): string {
  if (!e) return '⬜';
  if (isConfirmed(e)) return '✅';
  if (e.skipped && !e.done) return '⏸';
  if (e.done) return strict ? '☑️' : '✅';
  return '⬜';
}

export function todayStatusText(date: string, activities: Activity[], entries: Entry[], strict: boolean): string {
  const scheduled = activities.filter((a) => isScheduledOn(a, date));
  if (!scheduled.length) return `На ${fmtDateRu(date)} ничего не запланировано по расписанию.`;
  const byId = new Map(entries.map((e) => [e.activity_id, e]));
  const lines = scheduled.map((a) => {
    const e = byId.get(a.id);
    const plan = e?.planned ? '📝' : '·';
    const note = e?.done_note || e?.plan_note;
    const goal = a.goal_date ? ` <i>(${diffDays(date, a.goal_date)} дн. до ${escapeHtml(a.goal_text ?? 'цели')})</i>` : '';
    const mins = e?.minutes ? ` · ${e.minutes} мин` : '';
    return `${mark(e, strict)} ${plan} ${a.emoji} <b>${escapeHtml(a.name)}</b>${mins}${goal}${note ? `\n      <i>${escapeHtml(note)}</i>` : ''}`;
  });
  const doneCount = scheduled.filter((a) => byId.get(a.id) && countsAsDone(byId.get(a.id)!, strict)).length;
  const unconfirmed = scheduled.filter((a) => byId.get(a.id)?.done && !isConfirmed(byId.get(a.id)!)).length;
  const tail = strict && unconfirmed ? `\n\n☑️ ${unconfirmed} без подтверждения — пришли фото или чат с ИИ, чтобы засчитать.` : '';
  return `<b>${fmtDateRu(date)}</b> — засчитано ${doneCount} из ${scheduled.length}\n\n${lines.join('\n')}${tail}`;
}

export function morningText(date: string, activities: Activity[]): string {
  const scheduled = activities.filter((a) => isScheduledOn(a, date));
  const list = scheduled.map((a) => `${a.emoji} ${escapeHtml(a.name)}`).join('\n');
  return `☀️ <b>Доброе утро!</b> Что планируешь на сегодня?\n\n${list || 'Сегодня по расписанию пусто.'}`;
}

export function eveningText(date: string, activities: Activity[], entries: Entry[], strict: boolean): string {
  const scheduled = activities.filter((a) => isScheduledOn(a, date));
  const byId = new Map(entries.map((e) => [e.activity_id, e]));
  const planned = scheduled.filter((a) => byId.get(a.id)?.planned);
  const list = (planned.length ? planned : scheduled).map((a) => {
    const e = byId.get(a.id);
    return `${mark(e, strict)} ${a.emoji} ${escapeHtml(a.name)}${e?.plan_note ? ` — <i>${escapeHtml(e.plan_note)}</i>` : ''}`;
  });
  const hint = strict ? '\n\n📷 Пришли фото или перешли чат с ИИ — и занятие засчитается.' : '';
  return `🌙 <b>Как прошёл день?</b> Отметь, что получилось.\n\n${list.join('\n') || 'Сегодня по расписанию пусто.'}${hint}`;
}

export function weeklyText(cur: WeekStats, prev: WeekStats, strict: boolean, ownerName?: string): string {
  const pct = (d: number, s: number) => (s ? Math.round((d / s) * 100) : 0);
  const lines = cur.perActivity.map(({ activity, done, scheduled, unconfirmed, skipped }) => {
    const bar = scheduled ? '▰'.repeat(Math.min(7, Math.round((done / scheduled) * 7))).padEnd(7, '▱') : '———————';
    const unc = strict && unconfirmed ? ` <i>(+${unconfirmed} без подтв.)</i>` : '';
    const sk = skipped ? ` <i>(⏸ ${skipped})</i>` : '';
    return `${activity.emoji} <b>${escapeHtml(activity.name)}</b>: ${done} из ${scheduled}  ${bar}${unc}${sk}`;
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
  const title = ownerName ? `📊 <b>Итоги недели ${escapeHtml(ownerName)}</b>` : '📊 <b>Итоги недели</b>';
  return [
    `${title} ${fmtDateRu(cur.from)} — ${fmtDateRu(cur.to)}`,
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

export function partnerText(botUsername: string, code: string, currentName: string | null): string {
  const link = `https://t.me/${botUsername}?start=partner_${code}`;
  return [
    '<b>Партнёр по ответственности</b>',
    currentName ? `Сейчас привязан: <b>${escapeHtml(currentName)}</b>. Новая ссылка заменит его.` : 'Пока никого нет.',
    '',
    `Отправь другу ссылку — как только он её откроет, ему будут приходить твои недельные итоги и пропуски:`,
    link,
    '',
    `Или добавь меня в группу/канал и напиши там: <code>/partner ${code}</code>`,
    '',
    'Отвязать: /partner off. Уведомления о пропусках можно выключить в настройках.',
  ].join('\n');
}

export function partnerLinkedText(ownerName: string): string {
  return `🤝 Ты теперь партнёр по ответственности для <b>${escapeHtml(ownerName)}</b>.\n\nПо воскресеньям я буду присылать итоги недели, а если день пропущен — короткое уведомление. Твоя задача простая: спросить «как дела?» 🙂`;
}

export function missedText(ownerName: string, date: string, missed: Activity[], skipped: { activity: Activity; reason: string | null }[], strict: boolean): string {
  const parts: string[] = [];
  if (missed.length) {
    const list = missed.map((a) => `${a.emoji} ${escapeHtml(a.name)}`).join('\n');
    parts.push(`⚠️ <b>${escapeHtml(ownerName)}</b> вчера (${fmtDateRu(date)}) ${strict ? 'не подтвердил' : 'не сделал'}:\n\n${list}`);
  }
  if (skipped.length) {
    const list = skipped.map(({ activity, reason }) => `⏸ ${activity.emoji} ${escapeHtml(activity.name)}${reason ? ` — <i>${escapeHtml(reason)}</i>` : ''}`).join('\n');
    parts.push(`${missed.length ? '' : `<b>${escapeHtml(ownerName)}</b> вчера (${fmtDateRu(date)}) `}осознанно пропустил:\n\n${list}`);
  }
  parts.push(missed.length ? 'Может, стоит спросить, что случилось?' : 'Хотя бы честно 🙂');
  return parts.join('\n\n');
}

export function missedSelfText(date: string, missed: Activity[], skipped: { activity: Activity; reason: string | null }[], partnerName: string | null): string {
  const list = [
    ...missed.map((a) => `${a.emoji} ${escapeHtml(a.name)}`),
    ...skipped.map(({ activity, reason }) => `⏸ ${activity.emoji} ${escapeHtml(activity.name)}${reason ? ` — <i>${escapeHtml(reason)}</i>` : ''}`),
  ].join('\n');
  return `Вчера (${fmtDateRu(date)}) не засчитано:\n\n${list}${partnerName ? `\n\n${escapeHtml(partnerName)} уже знает 😉 Сегодня — новый день.` : '\n\nСегодня — новый день.'}`;
}
