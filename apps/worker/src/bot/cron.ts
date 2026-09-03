import { addDays, diffDays, timeInTz, todayInTz, weekdayMon0 } from '@tracker/shared';
import type { Env } from '../env';
import { Repo, type UserRow } from '../lib/db';
import { missedOn, skippedOn, weekStats } from '../lib/stats';
import { Bot } from '../lib/telegram';
import { eveningText, missedSelfText, missedText, morningText, weeklyText } from './messages';
import { openAppKeyboard, webappUrl } from './webhook';
import { formatTask, taskForDay, taskKeyboard } from './ielts-tasks';

/** A reminder is sent if local time is within [target, target + WINDOW_MIN) and not yet sent today. */
const WINDOW_MIN = 90;

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function inWindow(nowHHMM: string, targetHHMM: string): boolean {
  const diff = minutes(nowHHMM) - minutes(targetHHMM);
  return diff >= 0 && diff < WINDOW_MIN;
}

export async function runCron(env: Env, now = new Date()): Promise<{ morning: number; evening: number; weekly: number; missed: number; tasks: number }> {
  const repo = new Repo(env.DB);
  const bot = new Bot(env.BOT_TOKEN);
  const kb = openAppKeyboard(webappUrl(env));
  const counts = { morning: 0, evening: 0, weekly: 0, missed: 0, tasks: 0 };
  const users = await repo.allUsers();

  for (const u of users) {
    try {
      const today = todayInTz(u.tz, now);
      const time = timeInTz(u.tz, now);

      // Missed-day report (yesterday) goes out with the morning reminder window.
      if (u.last_partner_report !== today && inWindow(time, u.morning_time)) {
        if (await sendMissed(repo, bot, u, today, kb)) counts.missed++;
      }
      if (u.last_morning_sent !== today && inWindow(time, u.morning_time)) {
        if (await sendMorning(repo, bot, u, today, kb)) counts.morning++;
      }
      if ((u.ielts_daily_task ?? 1) && u.last_task_sent !== today && inWindow(time, u.morning_time)) {
        if (await sendTask(repo, bot, u, today)) counts.tasks++;
      }
      if (u.last_evening_sent !== today && inWindow(time, u.evening_time)) {
        if (await sendEvening(repo, bot, u, today, kb)) counts.evening++;
      }
      if (u.weekly_summary && weekdayMon0(today) === 6 && u.last_weekly_sent !== today && inWindow(time, u.weekly_time)) {
        if (await sendWeekly(repo, bot, u, today, kb)) counts.weekly++;
      }
    } catch (e) {
      console.error(`cron user ${u.tg_id} failed`, e);
    }
  }
  return counts;
}

type Kb = ReturnType<typeof openAppKeyboard>;

async function sendMorning(repo: Repo, bot: Bot, u: UserRow, today: string, kb: Kb): Promise<boolean> {
  await repo.markSent(u.id, 'last_morning_sent', today);
  const entries = await repo.entriesForDate(u.id, today);
  if (entries.some((e) => e.planned)) return false; // plan already filled
  const activities = await repo.listActivities(u.id);
  await bot.sendMessage(u.tg_id, morningText(today, activities), kb);
  return true;
}

async function sendEvening(repo: Repo, bot: Bot, u: UserRow, today: string, kb: Kb): Promise<boolean> {
  await repo.markSent(u.id, 'last_evening_sent', today);
  const entries = await repo.entriesForDate(u.id, today);
  const strict = !!u.strict_mode;
  // Skip only if every scheduled activity already counts as done.
  const activities = await repo.listActivities(u.id);
  if (missedOn(activities, entries, today, strict).length === 0) return false;
  await bot.sendMessage(u.tg_id, eveningText(today, activities, entries, strict), kb);
  return true;
}

async function sendWeekly(repo: Repo, bot: Bot, u: UserRow, today: string, kb: Kb): Promise<boolean> {
  await repo.markSent(u.id, 'last_weekly_sent', today);
  const activities = await repo.listActivities(u.id);
  if (!activities.length) return false;
  const strict = !!u.strict_mode;
  const cur = await weekStats(repo, u.id, activities, today, strict);
  const prev = await weekStats(repo, u.id, activities, addDays(cur.from, -1), strict);
  await bot.sendMessage(u.tg_id, weeklyText(cur, prev, strict), kb);
  if (u.partner_chat_id) await bot.sendMessage(u.partner_chat_id, weeklyText(cur, prev, strict, u.first_name));
  return true;
}

async function sendTask(repo: Repo, bot: Bot, u: UserRow, today: string): Promise<boolean> {
  await repo.markSent(u.id, 'last_task_sent', today);
  const activities = await repo.listActivities(u.id);
  if (!activities.some((a) => a.kind === 'ielts')) return false;
  const weekIndex = Math.floor(diffDays('2026-01-05', today) / 7); // Monday-anchored week counter
  const task = taskForDay(u.tg_id, today, weekdayMon0(today), weekIndex);
  await bot.sendMessage(u.tg_id, formatTask(task), taskKeyboard(task.id));
  return true;
}

async function sendMissed(repo: Repo, bot: Bot, u: UserRow, today: string, kb: Kb): Promise<boolean> {
  await repo.markSent(u.id, 'last_partner_report', today);
  const yesterday = addDays(today, -1);
  // Don't report days before the user existed.
  if (u.created_at.slice(0, 10) > yesterday) return false;
  const activities = await repo.listActivities(u.id);
  const entries = await repo.entriesForDate(u.id, yesterday);
  const strict = !!u.strict_mode;
  const missed = missedOn(activities, entries, yesterday, strict);
  const skipped = skippedOn(activities, entries, yesterday, strict);
  if (!missed.length && !skipped.length) return false;
  const partnerNotified = !!(u.partner_chat_id && u.partner_notify_missed);
  if (partnerNotified) await bot.sendMessage(u.partner_chat_id!, missedText(u.first_name, yesterday, missed, skipped, strict));
  await bot.sendMessage(u.tg_id, missedSelfText(yesterday, missed, skipped, partnerNotified ? u.partner_name : null), kb);
  return true;
}
